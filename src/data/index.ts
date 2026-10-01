import { SqliteRepository, type LegacyMigrationReport } from './sqliteRepository';
import {
  LocalStorageRepository,
  clearLegacyData,
  hasLegacyData,
  readLegacySnapshot,
} from './localStorageRepository';
import type { CheckRepository } from './repository';
import { BANK_SEEDS } from './bankSeeds';
import { LABEL_SEEDS } from './labelSeeds';

/**
 * إقلاع محرك التخزين.
 *
 * المسار المفضّل: SQLite (WASM) + IndexedDB. كل بيانات التطبيق داخله،
 * ولا يغادر أي شيء الجهاز.
 *
 * المسار الاحتياطي: localStorage. يُستخدم فقط إذا تعذّر تحميل WebAssembly
 * أو فتح IndexedDB (وضع تصفح خاص صارم، سياسة CSP، متصفح قديم).
 * ما يفقده المستخدم في هذا الوضع: صور البنوك (تُقرأ من مسارات المضمَّن)،
 * سجل التدقيق، وتصدير/استيراد قاعدة البيانات. ما يبقى صالحاً: المواضع
 * وبيانات الشيك والقوالب.
 *
 * السبب: التطبيق يتعامل مع بيانات مالية، ولا يجوز أن تظهر شاشة بيضاء
 * بسبب قيد تقني في المتصفح. العمل ناقصاً أفضل من عدم العمل.
 */

export type StorageEngineKind = 'sqlite' | 'local';

export interface BootResult {
  repository: CheckRepository;
  kind: StorageEngineKind;
  /** رسالة تُعرض للمستخدم عند الرجوع للمحرك المحدود */
  fallbackReason: string | null;
  /** إحصاء البذرة عند أول تشغيل، للعرض في شاشة الإقلاع */
  seeded: { banks: number; labels: number; images: number } | null;
  /** حصيلة نقل بيانات الإصدار السابق، إن حدث نقل */
  migrated: LegacyMigrationReport | null;
}

/** المحرّك المهيأ، بعد نجاح الإقلاع */
let active: CheckRepository | null = null;
let activeKind: StorageEngineKind = 'local';
/** وعد الإقلاع الجاري، يمنع إقلاعين متزامنين */
let booting: Promise<BootResult> | null = null;

/**
 * ينشئ محرك SQLite ثم يبذّره عند أول تشغيل.
 *
 * البذر يعتمد على meta.installed ويعمل مرة واحدة فقط. زيادة BANK_SEEDS
 * أو LABEL_SEEDS لا تمسّ مستخدماً سبق أن فتح التطبيق، وهذا مقصود:
 * تغيير ما بعد النشر يمر عبر ترقية مخطط، لا عبر إعادة بذر.
 */
const bootSqlite = async (): Promise<BootResult> => {
  const engine = await SqliteRepository.create();
  const seeded = await engine.seed(BANK_SEEDS, LABEL_SEEDS);

  /*
   * نقل الإصدار السابق.
   *
   * يُقرأ localStorage قبل حذفه، والحذف بعد نجاح النقل فقط. لو فشلت
   * الخطوة الأولى، البيانات القديمة كلها ما تزال في مكانها، ويعمل
   * التطبيق على محرك localStorage الاحتياطي. الأولوية هنا بترتيب
   * المعاكس: لا نفقد شيئاً مهما كان.
   */
  let migrated: LegacyMigrationReport | null = null;
  const alreadyMigrated = engine.hasMigratedLegacyData();

  if (!alreadyMigrated && hasLegacyData()) {
    try {
      const snapshot = readLegacySnapshot();
      migrated = await engine.migrateLegacy(snapshot);
      await engine.persist();
      clearLegacyData();
      console.info('[data] migrated legacy localStorage data', migrated);
    } catch (error) {
      console.error('[data] legacy migration failed, legacy data kept', error);
      migrated = null;
    }
  } else if (alreadyMigrated) {
    // لا نقل ثانٍ: بيانات localStorage المتبقية أحدث في الغالب، ونقلها
    // فوق القاعدة يمحو عمل المستخدم
    clearLegacyData();
  }

  return { repository: engine, kind: 'sqlite', fallbackReason: null, seeded, migrated };
};

const bootLocalStorage = async (reason: string): Promise<BootResult> => {
  const repository = new LocalStorageRepository();
  await repository.init();
  return { repository, kind: 'local', fallbackReason: reason, seeded: null, migrated: null };
};

/** نقطة الدخول الوحيدة. يُستدعى مرة واحدة عند إقلاع التطبيق. */
export const bootRepository = async (
  options: { forceLocal?: boolean } = {}
): Promise<BootResult> => {
  if (active !== null) {
    return { repository: active, kind: activeKind, fallbackReason: null, seeded: null, migrated: null };
  }

  if (booting !== null) return booting;

  booting = (async () => {
    if (options.forceLocal === true) {
      // المستخدم اختار صراحةً العمل بناقص بعد فشل SQLite
      const reason = 'localStorage engine forced by user';
      console.warn('[data] forcing localStorage engine', reason);
      const result = await bootLocalStorage(reason);
      active = result.repository;
      activeKind = 'local';
      return result;
    }

    try {
      const result = await bootSqlite();
      active = result.repository;
      activeKind = 'sqlite';
      return result;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.error('[data] SQLite boot failed, falling back to localStorage', error);
      const result = await bootLocalStorage(reason);
      active = result.repository;
      activeKind = 'local';
      return result;
    }
  })();

  try {
    return await booting;
  } finally {
    booting = null;
  }
};

/**
 * يعيد المحرك المهيأ.
 *
 * الاستدعاء قبل اكتمال bootRepository خطأ برمجي: نُفشلّه بصوت عالٍ
 * بدلاً من إرجاع محرك صامت قد يكتب في المكان الخطأ.
 */
export const getRepository = (): CheckRepository => {
  if (active === null) {
    throw new Error('getRepository() was called before bootRepository() completed');
  }
  return active;
};

export const getEngineKind = (): StorageEngineKind => activeKind;

/** ينتظر حفظ كل التعديلات المعلّقة. يُستدعى عند إخفاء الصفحة. */
export const flushRepository = async (): Promise<void> => {
  const repository = active as (CheckRepository & { flush?: () => Promise<void> }) | null;
  if (repository?.flush) await repository.flush();
};

export * from './repository';
