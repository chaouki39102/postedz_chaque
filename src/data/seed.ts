import type { Database } from 'sql.js';
import { SCHEMA_VERSION, applyMigrations } from './schema';
import type { Language } from '../types';
import { FIELD_DEFAULT_SEEDS } from './fieldDefaults';

/**
 * بذر قاعدة البيانات: تعبئة أولية ببنوك المشروع وتسمياته.
 *
 * مبدأ مهم: هذا يعمل مرة واحدة فقط. بعد أول بذر، قاعدة البيانات هي
 * مصدر الحقيقة، ولا نعيد البذر أبداً حتى لا يمحو تعديلات المستخدم
 * (مثلاً صورة غيّرها أو بنك أضافه بنفسه).
 *
 * الفحص يتم عبر meta.installed. إن غاب، نفترض أن القاعدة فارغة ونبذر.
 */

const META_INSTALLED = 'installed';
const META_SEED_VERSION = 'seed_version';

/**
 * إصدار البذرة.
 *
 * زدِه عند تغيير محتوى البذرة (بنك جديد، تسمية جديدة، صورة أفضل).
 * في التشغيل التالي سنُعيد بذر ما لم يُعدّله المستخدم.
 */
const SEED_VERSION = 1;

/** أسماء ملفات الصور المضمَّنة في المشروع، لربطها بالبنوك عند البذر */
export interface BankSeedEntry {
  id: string;
  nameAr: string;
  nameFr: string;
  /** مسار الصورة في مجلد public كما في المشروع */
  imageUrl: string;
}

/** يقرأ قيمة من جدول meta */
const getMeta = (db: Database, key: string): string | null => {
  const stmt = db.prepare('SELECT value FROM meta WHERE key = ?');
  try {
    stmt.bind([key]);
    if (!stmt.step()) return null;
    const row = stmt.getAsObject() as { value: unknown };
    return String(row.value);
  } finally {
    stmt.free();
  }
};

const setMeta = (db: Database, key: string, value: string): void => {
  db.run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [key, value]);
};

/** علامة تُكتب بعد نقل بيانات الإصدار السابق، فلا يتكرر النقل أبداً */
const META_LEGACY_MIGRATED = 'legacy_localstorage_migrated';

/** هل نُقلت بيانات localStorage إلى القاعدة بالفعل؟ */
export const hasMigratedLegacy = (db: Database): boolean =>
  getMeta(db, META_LEGACY_MIGRATED) === 'true';

/** تُستدعى بعد نجاح النقل فقط، داخل معاملة قائمة */
export const markLegacyMigrated = (db: Database): void => {
  setMeta(db, META_LEGACY_MIGRATED, 'true');
};

/**
 * يقرأ صورة كـ ArrayBuffer من رابط محلي.
 * يعيد null إن فشل التحميل، حتى لا يفشل البذر كله بسبب صورة واحدة.
 */
const fetchImageAsBytes = async (url: string): Promise<Uint8Array | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  } catch (error) {
    console.warn(`[seed] cannot load image ${url}`, error);
    return null;
  }
};

const mimeFromUrl = (url: string): string => {
  if (url.endsWith('.png')) return 'image/png';
  if (url.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
};

const countRows = (db: Database, table: string): number => {
  const result = db.exec(`SELECT COUNT(*) FROM ${table}`);
  if (result.length === 0 || result[0].values.length === 0) return 0;
  return Number(result[0].values[0][0]);
};

/**
 * يبذر البنوك والتسميات إن كانت القاعدة فارغة.
 *
 * @param db قاعدة مفتوحة بعد تطبيق الترقيات
 * @param bankSeeds تعريفات البنوك المضمَّنة في المشروع
 * @param labels التسميات الأساسية (مفتاح، عربي، فرنسي)
 */
export const seedIfEmpty = async (
  db: Database,
  bankSeeds: readonly BankSeedEntry[],
  labels: ReadonlyArray<{ key: string; ar: string; fr: string }>
): Promise<{ banks: number; labels: number; images: number }> => {
  // طبّق الترقيات أولاً: لا يمكن العمل على جداول غير موجودة
  applyMigrations(db);

  if (getMeta(db, META_INSTALLED) === 'true') {
    return { banks: 0, labels: 0, images: 0 };
  }

  const now = Date.now();
  let seededImages = 0;

  db.run('BEGIN');
  try {
    const labelStmt = db.prepare('INSERT OR IGNORE INTO labels (key, ar, fr) VALUES (?, ?, ?)');
    try {
      for (const label of labels) {
        labelStmt.run([label.key, label.ar, label.fr]);
      }
    } finally {
      labelStmt.free();
    }

    const bankStmt = db.prepare(`
      INSERT OR IGNORE INTO banks
        (id, name_ar, name_fr, image_mime, image_bytes, image_seed,
         is_active, is_builtin, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?)
    `);

    try {
      for (const [index, bank] of bankSeeds.entries()) {
        /*
         * imageUrl فارغ = بنك بلا صورة (بريد الجزائر مثلاً).
         * نتركه بلا صورة بدل أن نضع صورة بنك آخر: عرض خوارزمية
         * خاطئة في تطبيق مالي أسوأ من نقص صورة.
         */
        const bytes = bank.imageUrl === '' ? null : await fetchImageAsBytes(bank.imageUrl);
        if (bytes) seededImages += 1;

        bankStmt.run([
          bank.id,
          bank.nameAr,
          bank.nameFr,
          bytes ? mimeFromUrl(bank.imageUrl) : null,
          bytes,
          bank.imageUrl === '' ? null : bank.imageUrl,
          index,
          now,
          now,
        ]);
      }
    } finally {
      bankStmt.free();
    }

    setMeta(db, META_SEED_VERSION, String(SEED_VERSION));
    setMeta(db, 'schema_version', String(SCHEMA_VERSION));
    setMeta(db, META_INSTALLED, 'true');
    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }

  return { banks: bankSeeds.length, labels: labels.length, images: seededImages };
};

/** هل القاعدة مهيأة ومبذورة؟ (للعرض في واجهة الإدارة) */
export const isSeeded = (db: Database): boolean => getMeta(db, META_INSTALLED) === 'true';

/**
 * يضيف التسميات الناقصة فقط، ولا يمس ما هو موجود.
 *
 * السبب: التسمية المفتاحية (form.amountInWords مثلاً) أضيفت بعد أول
 * إصدار. من ثبّت التطبيق مبكراً لا يمرّ على البذر الأول أبداً، فتبقى
 * التسمية عنده مفقودة وتظهر في الواجهة كـ "manage.foo" — أي أن كود
 * مترجم ينهار على قاعدة صحيحة.
 *
 * INSERT OR IGNORE بالضبط: مفتاح موجود = ترجمة عدّلها المستخدم، ولا
 * يجوز أن يعود إقلاع جديد ويكتب فوقها الترجمة الأصلية.
 */
export const ensureLabels = (
  db: Database,
  labels: ReadonlyArray<{ key: string; ar: string; fr: string }>
): number => {
  const result = db.exec('SELECT key FROM labels');
  const existing = new Set<string>(
    result.length === 0 ? [] : result[0].values.map((row) => String(row[0]))
  );
  const missing = labels.filter((label) => !existing.has(label.key));
  if (missing.length === 0) return 0;

  db.run('BEGIN');
  try {
    const stmt = db.prepare('INSERT OR IGNORE INTO labels (key, ar, fr) VALUES (?, ?, ?)');
    try {
      for (const label of missing) {
        stmt.run([label.key, label.ar, label.fr]);
      }
    } finally {
      stmt.free();
    }
    setMeta(db, META_SEED_VERSION, String(SEED_VERSION));
    db.run('COMMIT');
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }

  return missing.length;
};

/**
 * يضمن وجود القيم الافتراضية للحقول، لكل لغة.
 *
 * تُستدعى في كل إقلاع وليست جزءاً من البذر الأول: الجدول ظهر في ترقية
 * 2، فمن لديه قاعدة من الإصدار 1 لن يمرّ على البذر مرة أخرى. لو ربطناها
 * بـ installed لبقيت الحقول فارغة عند كل من يحدّث التطبيق.
 *
 * INSERT OR IGNORE مقصود: القيمة موجودة = المستخدم أو برنامج الإعداد
 * عدّلها، ولا يجوز أن يمحوها إقلاع جديد.
 */
export const ensureFieldDefaults = (db: Database): number => {
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO field_defaults (language, field, value) VALUES (?, ?, ?)'
  );
  let inserted = 0;

  try {
    for (const row of FIELD_DEFAULT_SEEDS) {
      stmt.run([row.language, row.field, row.value]);
      if (db.getRowsModified() > 0) inserted += 1;
    }
  } finally {
    stmt.free();
  }

  return inserted;
};
/** إحصاء سريع لعرضه في واجهة إدارة قاعدة البيانات */
export const getDatabaseStats = (
  db: Database
): { banks: number; labels: number; presets: number; history: number; audit: number } => ({
  banks: countRows(db, 'banks'),
  labels: countRows(db, 'labels'),
  presets: countRows(db, 'presets'),
  history: countRows(db, 'history'),
  audit: countRows(db, 'audit_log'),
});

export type { Language };
