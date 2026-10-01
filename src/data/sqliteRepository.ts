import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { readDatabaseFile, writeDatabaseFile } from './idb';
import { DEFAULT_UI_PREFS, type BankInput, type CheckRepository, type AuditRow } from './repository';
import type { LegacySnapshot } from './localStorageRepository';

/** حصيلة نقل بيانات الإصدار السابق */
export interface LegacyMigrationReport {
  positions: number;
  positionsSkipped: number;
  presets: number;
  presetsSkipped: number;
  checkData: boolean;
  uiPrefs: boolean;
  prefs: number;
}

import { applyMigrations, SCHEMA_VERSION } from './schema';
import { releaseAllImageUrls } from './imageCache';
import {
  seedIfEmpty,
  isSeeded,
  ensureFieldDefaults,
  ensureLabels,
  getDatabaseStats,
  hasMigratedLegacy,
  markLegacyMigrated,
  type BankSeedEntry,
} from './seed';
import { TODAY } from './fieldDefaults';
import { toLocalDateInputValue } from '../utils/date';
import { CHECK_FIELDS } from '../types';
import type {
  BankRecord,
  CheckField,
  HistoryEntry,
  LabelBundle,
  Language,
  PositionMap,
  Preset,
  StoredCheckData,
  UiPrefs,
} from '../types';

/**
 * محرك تخزين قائم على SQLite مُصرَّف إلى WebAssembly، مع كل بيانات
 * التطبيق (البنوك والصور والتسميات) داخله.
 *
 * لماذا SQLite في المتصفح:
 * - بيانات شيكات مالية. لا خادم = لا تسرّب ولا نقطة فشل.
 * - هندسة جاهزة للتوسّع: قيود حقيقية، معاملات، فهارس، استعلامات.
 * - الملف كله (عادة 1–2 ميغابايت مع صور البنوك) قابل للتصدير كملف واحد.
 *
 * حدود معروفة ومقصودة:
 * - قاعدة كاملة في الذاكرة. لا يصلح لمئات آلاف السجلات، وهو خارج نطاق
 *   هذا التطبيق (بنك أو نحوه + بضع قوالب لكل بنك).
 * - الحفظ مؤجّل 350ms. دالة flush تُستدعى عند إخفاء الصفحة لضمان آخر تعديل.
 */

const WRITE_DEBOUNCE_MS = 350;

/** أنواع المعاملات المقبولة في استعلامات sql.js */
type Params = SqlValue[];

const toBool = (value: unknown): boolean => Number(value) === 1;

/** ينفّذ استعلاماً يُعيد صفاً واحداً ككائن، أو null */
const queryOne = (
  db: Database,
  sql: string,
  params: Params = []
): Record<string, unknown> | null => {
  const stmt = db.prepare(sql);
  try {
    if (params.length > 0) stmt.bind(params);
    if (!stmt.step()) return null;
    return stmt.getAsObject() as Record<string, unknown>;
  } finally {
    stmt.free();
  }
};

/** ينفّذ استعلاماً يُعيد كل الصفوف */
const queryAll = (db: Database, sql: string, params: Params = []): Record<string, unknown>[] => {
  const stmt = db.prepare(sql);
  const rows: Record<string, unknown>[] = [];
  try {
    if (params.length > 0) stmt.bind(params);
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as Record<string, unknown>);
    }
  } finally {
    stmt.free();
  }
  return rows;
};

const isPosition = (value: unknown): value is { x: number; y: number; widthPercent?: number } => {
  if (typeof value !== 'object' || value === null) return false;
  const pos = value as Record<string, unknown>;
  return typeof pos.x === 'number' && Number.isFinite(pos.x)
    && typeof pos.y === 'number' && Number.isFinite(pos.y);
};

export class SqliteRepository implements CheckRepository {
  readonly kind = 'sqlite';

  private db: Database;
  private writeTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;

  private constructor(db: Database) {
    this.db = db;
  }

  /**
   * ينشئ المحرك: يحمّل WASM، يستعيد الملف من IndexedDB، يطبّق الترقيات.
   *
   * الترقيات تُطبَّق دائماً قبل أي قراءة، فجهاز قديم يفتح بعد تحديث
   * يجد مخططه محدَّثاً.
   */
  static async create(): Promise<SqliteRepository> {
    const SQL: SqlJsStatic = await initSqlJs({ locateFile: () => wasmUrl });

    const saved = await readDatabaseFile();
    const db = saved && saved.byteLength > 0 ? new SQL.Database(saved) : new SQL.Database();

    // القاعدة في الذاكرة، فلا معنى لـ WAL. نضبط المفاتيح المفيدة فقط:
    // سلامة المراجع (حذف بنك يحذف مواضعه)، وخطأ واضح بدل البيانات التالفة
    db.run('PRAGMA foreign_keys = ON');
    applyMigrations(db);
    ensureFieldDefaults(db);

    const repository = new SqliteRepository(db);
    await repository.persist();
    return repository;
  }

  // ---- إدارة المعاملات والاستمرارية ----

  private schedulePersist(): void {
    this.dirty = true;
    if (this.writeTimer !== null) return;

    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      void this.persist();
    }, WRITE_DEBOUNCE_MS);
  }

  /** يحفظ الملف فوراً */
  async persist(): Promise<void> {
    if (this.writeTimer !== null) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    this.dirty = false;
    await writeDatabaseFile(this.db.export());
  }

  /** يضمن حفظ كل التعديلات المعلّقة (يُستدعى عند إخفاء الصفحة) */
  async flush(): Promise<void> {
    if (this.dirty) await this.persist();
  }

  /** معاملة ذرّية: إما تُنفَّق كاملة أو لا شيء */
  private transact<T>(fn: (db: Database) => T): T {
    this.db.run('BEGIN');
    let result: T;
    try {
      result = fn(this.db);
      this.db.run('COMMIT');
    } catch (error) {
      try {
        this.db.run('ROLLBACK');
      } catch {
        /* المعاملة فشلت أصلاً */
      }
      throw error;
    }
    this.schedulePersist();
    return result;
  }

  /** يسجّل عملية في سجل التدقيق (يُستدعى داخل معاملة قائمة) */
  private audit(action: string, entity: string, entityId: string, details: unknown = {}): void {
    this.db.run(
      'INSERT INTO audit_log (action, entity, entity_id, details_json, at) VALUES (?, ?, ?, ?, ?)',
      [action, entity, entityId, JSON.stringify(details), Date.now()]
    );
  }

  /**
   * يبذر البنوك والتسميات عند أول تشغيل فقط، ثم يسدّ نقص التسميات.
   *
   * يعتمد على meta.installed: بعد أول بذر لا نعيد بذور البنوك أبداً،
   * حتى لا يمحو تعديلات المستخدم (بنك أضافه بنفسه، صورة غيّرها).
   *
   * أما التسميات فحالتها مختلفة: المفتاح الجديد يجب أن يصل لمن ثبّت
   * التطبيق قبل إضافته. لذلك نسدّ النقص بـ INSERT OR IGNORE (لا نكتب
   * فوق ترجمة عدّلها المستخدم) بدل ربطه بـ installed.
   */
  async seed(
    bankSeeds: readonly BankSeedEntry[],
    labels: readonly { key: string; ar: string; fr: string }[]
  ): Promise<{ banks: number; labels: number; images: number }> {
    const result = await seedIfEmpty(this.db, bankSeeds, labels);
    const addedLabels = ensureLabels(this.db, labels);
    if (addedLabels > 0) await this.persist();

    return { ...result, labels: result.labels + addedLabels };
  }

  /**
   * ينقل بيانات الإصدار السابق (localStorage) إلى قاعدة البيانات.
   *
   * لماذا هذا ليس تفصيلاً: تطبيق كهذا يُستخدم شهوراً، ومواضع الشيك
   * التي ضبطها المستخدم قد تكون ساعات عمل. من يفتح التطبيق بعد التحديث
   * يجب أن يجد عمله كما تركه، وإلا فالقاعدة الجديدة إعادة انطلاق مكلفة.
   *
   * القواعد:
   * - بيانات الإصدارين 1 و2 لا تسجّل ترقيات، فهي أقل ثقة من بيانات
   *   القاعدة نفسها، لذلك نكتب فوق ما وجدناه بـ INSERT OR REPLACE.
   * - موضع بنك غير موجود يُسقط ولا يُنشئ بنكاً وهمياً: المواضع بلا
   *   نموذج شيك لا معنى لها، وصف بنك ناقص يفسد قائمة الاختيار.
   * - النقل ذرّي: كله في معاملة واحدة، فلا تنتقل نصف بيانات.
   */
  async migrateLegacy(snapshot: LegacySnapshot): Promise<LegacyMigrationReport> {
    const report: LegacyMigrationReport = {
      positions: 0,
      positionsSkipped: 0,
      presets: 0,
      presetsSkipped: 0,
      checkData: false,
      uiPrefs: false,
      prefs: 0,
    };

    this.transact((db) => {
      for (const [key, value] of Object.entries(snapshot.prefs)) {
        db.run('INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)', [key, value]);
        report.prefs += 1;
      }

      for (const entry of snapshot.positions) {
        const known = db.exec(`SELECT 1 FROM banks WHERE id = '${entry.bankId.replace(/'/g, "''")}'`);
        if (known.length === 0) {
          report.positionsSkipped += 1;
          continue;
        }

        for (const field of CHECK_FIELDS) {
          const position = entry.positions[field];
          if (!position) continue;

          db.run(
            `INSERT OR REPLACE INTO bank_positions
               (bank_id, language, field, x, y, width_percent, font_cqw)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              entry.bankId,
              entry.language,
              field,
              position.x,
              position.y,
              position.widthPercent ?? null,
              position.fontCqw ?? null,
            ]
          );
          report.positions += 1;
        }
      }

      for (const preset of snapshot.presets) {
        const known = db.exec(`SELECT 1 FROM banks WHERE id = '${preset.bankId.replace(/'/g, "''")}'`);
        if (known.length === 0) {
          report.presetsSkipped += 1;
          continue;
        }

        db.run(
          `INSERT OR REPLACE INTO presets
             (id, name, bank_id, language, data_json, positions_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            preset.id,
            preset.name,
            preset.bankId,
            preset.language,
            JSON.stringify(preset.data),
            JSON.stringify(preset.positions),
            preset.createdAt,
            preset.updatedAt,
          ]
        );
        report.presets += 1;
      }

      const data = snapshot.checkData;
      if (data) {
        db.run(
          `INSERT OR REPLACE INTO check_data (id, date, place, beneficiary, amount, date_is_auto)
           VALUES (1, ?, ?, ?, ?, ?)`,
          [data.date, data.place, data.beneficiary, data.amount, data.dateIsAuto ? 1 : 0]
        );
        report.checkData = true;
      }

      const uiPrefs = snapshot.uiPrefs;
      if (uiPrefs) {
        db.run(
          `INSERT OR REPLACE INTO ui_prefs (id, locked, show_position_controls)
           VALUES (1, ?, ?)`,
          [uiPrefs.locked ? 1 : 0, uiPrefs.showPositionControls ? 1 : 0]
        );
        report.uiPrefs = true;
      }

      this.audit('migrate', 'database', 'legacy-localstorage', report);
      markLegacyMigrated(db);
    });

    return report;
  }

  /**
   * هل نُقلت بيانات الإصدار السابق من قبل؟
   *
   * العلامة تُمنع تكرار النقل: بدونها قد يعمل مستخدم على المحرك المحدود
   * localStorage فترة، ثم يعود ليُقلع بالقاعدة، فينقل localStorage القديمة
   * فوق بيانات أحدث كتبها في القاعدة نفسها.
   */
  hasMigratedLegacyData(): boolean {
    return hasMigratedLegacy(this.db);
  }

  /**
   * القيم الافتراضية للحقول لهذه اللغة.
   *
   * التاريخ يعالج هنا: القيمة المخزَّنة هي العلامة TODAY، ونحلّها إلى
   * تاريخ اليوم عند كل قراءة. لو خزّنا تاريخ البذر لانحرف التاريخ بعد
   * يوم واحد، ولو حلّلناه عند البذر فقط لتجمّد.
   */
  async loadFieldDefaults(language: Language): Promise<StoredCheckData> {
    const rows = queryAll(this.db, 'SELECT field, value FROM field_defaults WHERE language = ?', [
      language,
    ]);

    const stored = new Map<string, string>(
      rows.map((row) => [row.field as string, row.value as string])
    );
    const isAuto = stored.get('date') === TODAY;

    return {
      date: isAuto ? toLocalDateInputValue() : (stored.get('date') ?? ''),
      place: stored.get('place') ?? '',
      beneficiary: stored.get('beneficiary') ?? '',
      amount: stored.get('amount') ?? '',
      dateIsAuto: isAuto,
    };
  }

  async setFieldDefault(language: Language, field: string, value: string): Promise<void> {
    this.transact((db) => {
      db.run('INSERT OR REPLACE INTO field_defaults (language, field, value) VALUES (?, ?, ?)', [
        language,
        field,
        value,
      ]);
      this.audit('update', 'field_default', `${language}:${field}`, { value });
    });
  }

  // ---- البنوك ----

  async listBanks(includeInactive = true): Promise<BankRecord[]> {
    const sql = includeInactive
      ? 'SELECT * FROM banks ORDER BY sort_order, name_ar'
      : 'SELECT * FROM banks WHERE is_active = 1 ORDER BY sort_order, name_ar';
    return queryAll(this.db, sql).map((row) => this.rowToBank(row));
  }

  async getBank(id: string): Promise<BankRecord | null> {
    const row = queryOne(this.db, 'SELECT * FROM banks WHERE id = ?', [id]);
    return row ? this.rowToBank(row) : null;
  }

  private rowToBank(row: Record<string, unknown>): BankRecord {
    return {
      id: String(row.id),
      nameAr: String(row.name_ar),
      nameFr: String(row.name_fr),
      imageMime: row.image_mime === null ? null : String(row.image_mime),
      // Uint8Array جديد: الذاكرة المشتركة قد تُحرَّر عند إغلاق القاعدة
      imageBytes: row.image_bytes === null ? null : new Uint8Array(row.image_bytes as Uint8Array),
      imageSeed: row.image_seed === null ? null : String(row.image_seed),
      isActive: toBool(row.is_active),
      isBuiltin: toBool(row.is_builtin),
      sortOrder: Number(row.sort_order),
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    };
  }

  async saveBank(input: BankInput): Promise<BankRecord> {
    const now = Date.now();
    const isNew = input.id === undefined;
    /*
     * هل حُدّدت صورة جديدة؟
     *
     * التمييز مهم: نداء حفظ عادي (تغيير الاسم) يجب ألا يمحو صورة قائمة.
     * أما تمرير imageBytes = null صراحةً فيعني "احذف الصورة"، وهذا
     * يمر عبر hasImage لأن الحقل موجود في الكائن.
     */
    const imageProvided = 'imageBytes' in input;

    if (isNew) {
      const id = `bank_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const nextOrder = Number(
        queryOne(this.db, 'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM banks')?.next ?? 0
      );

      this.transact((db) => {
        db.run(
          `INSERT INTO banks
             (id, name_ar, name_fr, image_mime, image_bytes, image_seed,
              is_active, is_builtin, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NULL, ?, 0, ?, ?, ?)`,
          [
            id,
            input.nameAr,
            input.nameFr,
            input.imageMime ?? null,
            input.imageBytes ?? null,
            input.isActive === false ? 0 : 1,
            nextOrder,
            now,
            now,
          ]
        );
        this.audit('create', 'bank', id, { nameAr: input.nameAr, nameFr: input.nameFr });
      });

      const created = await this.getBank(id);
      if (!created) throw new Error('bank creation failed');
      return created;
    }

    const id = input.id;
    if (id === undefined) throw new Error('saveBank requires an id for updates');

    this.transact((db) => {
      db.run(
        `UPDATE banks
         SET name_ar = ?, name_fr = ?,
             is_active = ?,
             updated_at = ?,
             image_mime = CASE WHEN ? THEN ? ELSE image_mime END,
             image_bytes = CASE WHEN ? THEN ? ELSE image_bytes END,
             image_seed  = CASE WHEN ? THEN NULL ELSE image_seed END
         WHERE id = ?`,
        [
          input.nameAr,
          input.nameFr,
          input.isActive === false ? 0 : 1,
          now,
          // نحدّث الصورة فقط إن فُعّل المعامل: نداء بلا صورة يجب أن
          // يُبقي الصورة القائمة، لا أن يمحوها
          imageProvided ? 1 : 0,
          input.imageMime ?? null,
          imageProvided ? 1 : 0,
          input.imageBytes ?? null,
          imageProvided ? 1 : 0,
          id,
        ]
      );
      this.audit('update', 'bank', id, {
        nameAr: input.nameAr,
        nameFr: input.nameFr,
        imageChanged: imageProvided,
      });
    });

    const updated = await this.getBank(id);
    if (!updated) throw new Error('bank not found after update');
    return updated;
  }

  /** يحذف بنكاً وكل ما يتعلق به. القوالب تُحذف أيضاً (CASCADE). */
  async deleteBank(id: string): Promise<void> {
    const bank = await this.getBank(id);
    this.transact((db) => {
      db.run('DELETE FROM bank_positions WHERE bank_id = ?', [id]);
      db.run('DELETE FROM presets WHERE bank_id = ?', [id]);
      db.run('DELETE FROM banks WHERE id = ?', [id]);
      // نحتفظ بالسجل: name يجعل الاستعادة ممكنة رغم حذف البنك
      this.audit('delete', 'bank', id, {
        nameAr: bank?.nameAr ?? '',
        nameFr: bank?.nameFr ?? '',
      });
    });
  }

  async reorderBanks(orderedIds: readonly string[]): Promise<void> {
    this.transact((db) => {
      const stmt = db.prepare('UPDATE banks SET sort_order = ? WHERE id = ?');
      try {
        orderedIds.forEach((id, index) => stmt.run([index, id]));
      } finally {
        stmt.free();
      }
      this.audit('reorder', 'banks', '', { count: orderedIds.length });
    });
  }

  // ---- التسميات ----

  async listLabels(): Promise<LabelBundle[]> {
    return queryAll(this.db, 'SELECT key, ar, fr FROM labels ORDER BY key').map((row) => ({
      key: String(row.key),
      ar: String(row.ar),
      fr: String(row.fr),
    }));
  }

  async getLabel(language: Language, key: string): Promise<string | null> {
    const row = queryOne(this.db, 'SELECT ar, fr FROM labels WHERE key = ?', [key]);
    if (!row) return null;
    return String(row[language]);
  }

  async setLabel(key: string, ar: string, fr: string): Promise<void> {
    this.transact((db) => {
      db.run(
        'INSERT OR REPLACE INTO labels (key, ar, fr) VALUES (?, ?, ?)',
        [key, ar, fr]
      );
      this.audit('update', 'label', key, { ar, fr });
    });
  }

  // ---- التفضيلات ----

  async getPreference(key: string): Promise<string | null> {
    const row = queryOne(this.db, 'SELECT value FROM preferences WHERE key = ?', [key]);
    return row ? String(row.value) : null;
  }

  async setPreference(key: string, value: string): Promise<void> {
    this.transact((db) => {
      db.run('INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)', [key, value]);
    });
  }

  // ---- المواضع ----

  async loadPositions(bankId: string, language: Language): Promise<PositionMap | null> {
    const rows = queryAll(
      this.db,
      'SELECT field, x, y, width_percent, font_cqw FROM bank_positions WHERE bank_id = ? AND language = ?',
      [bankId, language]
    );

    if (rows.length === 0) return null;

    const result: PositionMap = {};
    for (const row of rows) {
      const field = String(row.field) as CheckField;
      if (!CHECK_FIELDS.includes(field)) continue;

      const position: PositionMap[string] = { x: Number(row.x), y: Number(row.y) };
      if (row.width_percent !== null && row.width_percent !== undefined) {
        position.widthPercent = Number(row.width_percent);
      }
      // NULL = الحجم الافتراضي، فنترك الحقل غائباً بدل تخزين صفر
      if (row.font_cqw !== null && row.font_cqw !== undefined) {
        position.fontCqw = Number(row.font_cqw);
      }
      result[field] = position;
    }

    return result;
  }

  async savePositions(
    bankId: string,
    language: Language,
    positions: PositionMap
  ): Promise<void> {
    this.transact((db) => {
      db.run('DELETE FROM bank_positions WHERE bank_id = ? AND language = ?', [bankId, language]);

      const stmt = db.prepare(
        `INSERT INTO bank_positions (bank_id, language, field, x, y, width_percent, font_cqw)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      try {
        for (const field of CHECK_FIELDS) {
          const position = positions[field];
          if (!position) continue;

          /*
           * الإحداثيان أساسان في الصف: لو غابا رفض sql.js الربط
           * (undefined) فيرفض المعاملة كاملة. الصف التالف يُتخطى بدل
           * أن يُسقط حفظ بقية الحقول.
           */
          const x = Number(position.x);
          const y = Number(position.y);
          if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

          stmt.run([
            bankId,
            language,
            field,
            x,
            y,
            position.widthPercent ?? null,
            position.fontCqw ?? null,
          ]);
        }
      } finally {
        stmt.free();
      }
    });
  }

  async resetPositions(bankId: string, language: Language): Promise<void> {
    this.transact((db) => {
      db.run('DELETE FROM bank_positions WHERE bank_id = ? AND language = ?', [bankId, language]);
      this.audit('reset-positions', 'bank', bankId, { language });
    });
  }

  // ---- بيانات الشيك ----

  async loadCheckData(): Promise<StoredCheckData | null> {
    const row = queryOne(
      this.db,
      'SELECT date, place, beneficiary, amount, date_is_auto FROM check_data WHERE id = 1'
    );
    if (!row) return null;

    return {
      date: String(row.date),
      place: String(row.place),
      beneficiary: String(row.beneficiary),
      amount: String(row.amount),
      dateIsAuto: toBool(row.date_is_auto),
    };
  }

  async saveCheckData(data: StoredCheckData): Promise<void> {
    this.transact((db) => {
      db.run(
        `INSERT OR REPLACE INTO check_data
           (id, date, place, beneficiary, amount, date_is_auto)
         VALUES (1, ?, ?, ?, ?, ?)`,
        [data.date, data.place, data.beneficiary, data.amount, data.dateIsAuto ? 1 : 0]
      );
    });
  }

  async clearCheckData(): Promise<void> {
    this.transact((db) => {
      db.run('DELETE FROM check_data WHERE id = 1');
    });
  }

  // ---- إعدادات العرض ----

  async loadUiPrefs(): Promise<UiPrefs> {
    const row = queryOne(
      this.db,
      'SELECT locked, show_position_controls FROM ui_prefs WHERE id = 1'
    );
    if (!row) return { ...DEFAULT_UI_PREFS };

    return {
      locked: toBool(row.locked),
      showPositionControls: toBool(row.show_position_controls),
    };
  }

  async saveUiPrefs(prefs: UiPrefs): Promise<void> {
    this.transact((db) => {
      db.run(
        `INSERT OR REPLACE INTO ui_prefs (id, locked, show_position_controls)
         VALUES (1, ?, ?)`,
        [prefs.locked ? 1 : 0, prefs.showPositionControls ? 1 : 0]
      );
    });
  }

  // ---- القوالب ----

  async listPresets(bankId?: string): Promise<Preset[]> {
    const rows = bankId
      ? queryAll(
          this.db,
          'SELECT * FROM presets WHERE bank_id = ? ORDER BY updated_at DESC',
          [bankId]
        )
      : queryAll(this.db, 'SELECT * FROM presets ORDER BY updated_at DESC');

    return rows.map((row) => this.rowToPreset(row)).filter((p): p is Preset => p !== null);
  }

  async getPreset(id: string): Promise<Preset | null> {
    const row = queryOne(this.db, 'SELECT * FROM presets WHERE id = ?', [id]);
    return row ? this.rowToPreset(row) : null;
  }

  private rowToPreset(row: Record<string, unknown>): Preset | null {
    try {
      const language = String(row.language);
      if (language !== 'ar' && language !== 'fr') return null;

      const data = JSON.parse(String(row.data_json)) as Record<string, unknown>;
      const positions = JSON.parse(String(row.positions_json)) as unknown;
      if (!isPosition((positions as Record<string, unknown>)?.date) && typeof positions !== 'object') {
        return null;
      }
      if (positions === null || typeof positions !== 'object') return null;

      return {
        id: String(row.id),
        name: String(row.name),
        bankId: String(row.bank_id),
        language,
        data: {
          date: String(data.date ?? ''),
          place: String(data.place ?? ''),
          beneficiary: String(data.beneficiary ?? ''),
          amount: String(data.amount ?? ''),
        },
        positions: positions as PositionMap,
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at),
      };
    } catch (error) {
      console.warn('[sqlite] malformed preset row skipped', error);
      return null;
    }
  }

  async savePreset(preset: Preset): Promise<void> {
    this.transact((db) => {
      db.run(
        `INSERT OR REPLACE INTO presets
           (id, name, bank_id, language, data_json, positions_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          preset.id,
          preset.name,
          preset.bankId,
          preset.language,
          JSON.stringify(preset.data),
          JSON.stringify(preset.positions),
          preset.createdAt,
          preset.updatedAt,
        ]
      );
      this.audit('save', 'preset', preset.id, { name: preset.name, bankId: preset.bankId });
    });
  }

  async deletePreset(id: string): Promise<void> {
    this.transact((db) => {
      db.run('DELETE FROM presets WHERE id = ?', [id]);
      this.audit('delete', 'preset', id);
    });
  }

  // ---- سجل الشيكات ----

  async addHistory(entry: Omit<HistoryEntry, 'id'>): Promise<void> {
    this.transact((db) => {
      db.run(
        `INSERT INTO history
           (bank_id, bank_name, language, data_json, positions_json, amount_words, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.bankId,
          entry.bankName,
          entry.language,
          JSON.stringify(entry.data),
          JSON.stringify(entry.positions),
          entry.amountWords,
          entry.createdAt,
        ]
      );
    });
  }

  async listHistory(limit = 50): Promise<HistoryEntry[]> {
    const rows = queryAll(
      this.db,
      'SELECT * FROM history ORDER BY created_at DESC LIMIT ?',
      [limit]
    );

    const entries: HistoryEntry[] = [];
    for (const row of rows) {
      let data: StoredCheckData;
      let positions: PositionMap;
      try {
        data = JSON.parse(String(row.data_json)) as StoredCheckData;
        positions = JSON.parse(String(row.positions_json)) as PositionMap;
      } catch {
        // صف تالف: نتخطاه بدل إسقاط السجل كله
        continue;
      }

      entries.push({
        id: Number(row.id),
        bankId: String(row.bank_id),
        bankName: String(row.bank_name),
        language: String(row.language) === 'fr' ? 'fr' : 'ar',
        data,
        positions,
        amountWords: String(row.amount_words ?? ''),
        createdAt: Number(row.created_at),
      });
    }
    return entries;
  }

  async clearHistory(): Promise<void> {
    this.transact((db) => {
      db.run('DELETE FROM history');
      this.audit('clear', 'history', '');
    });
  }

  // ---- سجل التدقيق ----

  async listAudit(limit = 100): Promise<AuditRow[]> {
    return queryAll(
      this.db,
      'SELECT id, action, entity, entity_id, at FROM audit_log ORDER BY at DESC LIMIT ?',
      [limit]
    ).map((row) => ({
      id: Number(row.id),
      action: String(row.action),
      entity: String(row.entity),
      entityId: String(row.entity_id),
      at: Number(row.at),
    }));
  }

  /** تهيئة المحرك. الترقيات طُبِّقت في المنشئ، فنكتفي بالتأكيد. */
  async init(): Promise<void> {
    applyMigrations(this.db);
    await this.persist();
  }

  /**
   * حذف كل البيانات: يمسح الجداول ويبذر من جديد.
   *
   * ملاحظة: البذر هنا بمحتوى فارغ. نستخدم clearAll فقط في مسارات الصيانة
   * الصريحة (إعادة تعيين من المستخدم)، وفيها نترك له استدعاء seed() ببنوك
   * حقيقية. وضع "installed" بلا بنوك أفضل من تطبيق بلا بيانات منطقية.
   */
  async clearAll(): Promise<void> {
    this.transact((db) => {
      for (const table of [
        'bank_positions',
        'presets',
        'check_data',
        'ui_prefs',
        'history',
        'audit_log',
        'labels',
        'banks',
        'preferences',
      ]) {
        db.run(`DELETE FROM ${table}`);
      }
      db.run("DELETE FROM meta WHERE key = 'installed'");
    });

    // نعيد البذر بمحتوى BANK_SEEDS/LABEL_SEEDS عبر seed() ليستطيع
    // المستخدم استدعاؤها؛ هنا نكتفي بتثبيت الحالة على "غير مبذور"
    await this.persist();
  }

  // ---- الصيانة والتصدير ----

  /**
   * يُصدّر قاعدة البيانات كاملة كملف .sqlite3.
   * يسمح للمستخدم بنقل كل إعداداته (البنوك والصور والمواضع والتسميات)
   * إلى جهاز آخر أو مشاركتها كقالب.
   */
  async exportBytes(): Promise<Uint8Array> {
    await this.flush();
    return this.db.export();
  }

  /**
   * يستورد ملف .sqlite3 مستبدلاً القاعدة الحالية.
   *
   * نتحقق من أن الملف قاعدة صالحة قبل الاستبدال: ملف تالف أو غير SQLite
   * يجب ألا يترك المستخدم بلا تخزين. نحتفظ بالنسخة الحالية في IndexedDB
   * حتى نجاح الاستيراد.
   */
  async importBytes(bytes: Uint8Array): Promise<void> {
    let candidate: Database;
    try {
      const SQL: SqlJsStatic = await initSqlJs({ locateFile: () => wasmUrl });
      candidate = new SQL.Database(bytes);
      // فحص سلامة: يجب أن توجد جداول banks عندها
      const check = candidate.exec(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'banks'"
      );
      if (check.length === 0) {
        candidate.close();
        throw new Error('not a cheque-generator database');
      }
      applyMigrations(candidate);
    } catch (error) {
      throw new Error(`invalid database file: ${(error as Error).message}`);
    }

    /*
     * الروابط المحفوظة تشير إلى بايتات القاعدة القديمة. لولا الإبطال
     * لصارت كل الصور القديمة ظاهرة بعد الاستيراد.
     */
    releaseAllImageUrls();

    // نجعل الملف المستورد هو القاعدة المعتمدة
    this.db.close();
    this.db = candidate;
    await this.persist();
    this.audit('import', 'database', '', { bytes: bytes.byteLength });
    await this.persist();
  }

  /** معلومات عن المخطط الحالي، للعرض في واجهة الإدارة */
  getSchemaInfo(): { version: number; sizeBytes: number; seeded: boolean; stats: ReturnType<typeof getDatabaseStats> } {
    return {
      version: SCHEMA_VERSION,
      sizeBytes: this.db.export().byteLength,
      seeded: isSeeded(this.db),
      stats: getDatabaseStats(this.db),
    };
  }

  close(): void {
    this.db.close();
  }
}

export { isPosition };
