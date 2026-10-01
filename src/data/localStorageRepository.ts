import type { Language, Position, PositionMap, Preset, StoredCheckData, UiPrefs } from '../types';
import { CHECK_FIELDS } from '../types';
import {
  DEFAULT_UI_PREFS,
  PREF_KEYS,
  PREF_KEY_LIST,
  type CheckRepository,
} from './repository';

/**
 * إصدار مخطط التخزين.
 *
 * سبب وجوده: المواضع كانت تُخزَّن بعرض بالبكسل (`width`)، والصيغة الجديدة
 * تستخدم نسبة مئوية (`widthPercent`). بدون ترقية إصدار، سيقرأ التطبيق
 * بيانات قديمة بإحداثيات غير متوافقة. عند تغيير الصيغة يجب رفع الإصدار.
 */
const SCHEMA_VERSION = 2;

/**
 * العرض الذي كانت تُحسب عليه مواضع الإصدار 1 (بالبكسل على معاينة ~896px).
 * نحتاجه لتحويل العرض القديم إلى نسبة مئوية.
 */
const LEGACY_PREVIEW_WIDTH_PX = 896;

const K = {
  positions: (bankId: string, language: Language) =>
    `v${SCHEMA_VERSION}:positions:${bankId}:${language}`,
  checkData: `v${SCHEMA_VERSION}:check_data`,
  uiPrefs: `v${SCHEMA_VERSION}:ui_prefs`,
  presets: `v${SCHEMA_VERSION}:presets`,
} as const;

/**
 * مفاتيح الإصدار 1 (القديم). تُقرأ مرة واحدة عند أول تشغيل بعد الترقية
 * ثم تُحذف، حتى لا تضيع مواضع المستخدم التي ضبطها يدوياً.
 */
const LEGACY_KEYS = {
  positions: (bankId: string, language: Language) => `bank_positions_${bankId}_${language}`,
} as const;

export const PREF_KEYS_V2 = PREF_KEYS;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** يتحقق من موضع واحد ويحوّل صيغته القديمة إن وُجدت */
const normalizePosition = (raw: unknown): Position | null => {
  if (typeof raw !== 'object' || raw === null) return null;
  const value = raw as Record<string, unknown>;

  if (!isFiniteNumber(value.x) || !isFiniteNumber(value.y)) return null;

  const position: Position = { x: value.x, y: value.y };

  if (isFiniteNumber(value.widthPercent)) {
    position.widthPercent = value.widthPercent;
  } else if (isFiniteNumber(value.width) && value.width > 0) {
    // ترقية من الإصدار 1: كان العرض بالبكسل على حاوية ~896px
    position.widthPercent = Math.round((value.width / LEGACY_PREVIEW_WIDTH_PX) * 100);
  }

  return position;
};

const normalizePositions = (raw: unknown): PositionMap | null => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;

  const result: PositionMap = {};
  for (const field of CHECK_FIELDS) {
    const normalized = normalizePosition((raw as Record<string, unknown>)[field]);
    // نتجاهل الحقول غير المعروفة: بيانات قديمة من إصدارات أقدم
    if (normalized) result[field] = normalized;
  }

  return CHECK_FIELDS.some((field) => field in result) ? result : null;
};

const isStoredCheckData = (raw: unknown): raw is StoredCheckData => {
  if (typeof raw !== 'object' || raw === null) return false;
  const value = raw as Record<string, unknown>;
  return (
    typeof value.date === 'string'
    && typeof value.place === 'string'
    && typeof value.beneficiary === 'string'
    && typeof value.amount === 'string'
    && typeof value.dateIsAuto === 'boolean'
  );
};

const isPreset = (raw: unknown): raw is Preset => {
  if (typeof raw !== 'object' || raw === null) return false;
  const value = raw as Record<string, unknown>;
  return (
    typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.bankId === 'string'
    && (value.language === 'ar' || value.language === 'fr')
    && isFiniteNumber(value.createdAt)
    && isFiniteNumber(value.updatedAt)
    && typeof value.data === 'object' && value.data !== null
    && normalizePositions(value.positions) !== null
  );
};

/** يقرأ مفتاحاً ويفك ترميزه، مع إزالة السجل عند التلف */
const readJson = <T>(key: string, guard: (raw: unknown) => raw is T): T | null => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;

    const parsed: unknown = JSON.parse(raw);
    if (guard(parsed)) return parsed;

    console.warn(`[storage] dropping malformed record: ${key}`);
    localStorage.removeItem(key);
    return null;
  } catch (error) {
    console.warn(`[storage] cannot read ${key}`, error);
    return null;
  }
};

const writeJson = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // غالباً حصة التخزين ممتلئة أو التصفح في وضع خاص
    console.warn(`[storage] cannot write ${key}`, error);
  }
};

const removeKey = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* تجاهل */
  }
};

const readRaw = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
};

/**
 * محرك تخزين محلي مبني على localStorage.
 *
 * مزاياه: بدون خادم، ويعمل دون اتصال، والبيانات لا تغادر الجهاز
 * (مهم لتطبيق يتعامل مع شيكات مالية).
 * حدوده: سعة ~5MB، ومقيد بنطاق واحد (لا مزامنة بين الأجهزة).
 * هذه القيود هي سبب وجود طبقة SQLite خلف نفس الواجهة.
 */
export class LocalStorageRepository implements CheckRepository {
  readonly kind = 'local';

  async init(): Promise<void> {
    // لا يحتاج تهيئة
  }

  async getPreference(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  async setPreference(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* تجاهل */
    }
  }

  async loadPositions(bankId: string, language: Language): Promise<PositionMap | null> {
    const current = normalizePositions(readRaw(K.positions(bankId, language)));
    if (current) return current;

    /*
     * ترحيل كسول من الإصدار 1: إن لم يوجد سجل بالنسخة الجديدة، نقرأ المفتاح
     * القديم ونحوّله ونكتبه. بهذا الشكل لا يُفقد أي موضع ضبطه المستخدم سابقاً،
     * حتى لو كان لم يفتح هذا البنك من قبل (لأن التحويل يحدث وقت القراءة
     * لا في عملية ترحيل شاملة عند الإقلاع.
     */
    const legacyKey = LEGACY_KEYS.positions(bankId, language);
    const migrated = normalizePositions(readRaw(legacyKey));
    if (!migrated) return null;

    writeJson(K.positions(bankId, language), migrated);
    removeKey(legacyKey);
    return migrated;
  }

  async savePositions(
    bankId: string,
    language: Language,
    positions: PositionMap
  ): Promise<void> {
    writeJson(K.positions(bankId, language), positions);
  }

  async resetPositions(bankId: string, language: Language): Promise<void> {
    removeKey(K.positions(bankId, language));
  }

  async loadCheckData(): Promise<StoredCheckData | null> {
    return readJson(K.checkData, isStoredCheckData);
  }

  async saveCheckData(data: StoredCheckData): Promise<void> {
    writeJson(K.checkData, data);
  }

  async clearCheckData(): Promise<void> {
    removeKey(K.checkData);
  }

  async loadUiPrefs(): Promise<UiPrefs> {
    const stored = readJson(K.uiPrefs, (raw): raw is UiPrefs => {
      if (typeof raw !== 'object' || raw === null) return false;
      const value = raw as Record<string, unknown>;
      return typeof value.locked === 'boolean'
        && typeof value.showPositionControls === 'boolean';
    });

    return stored ? { ...DEFAULT_UI_PREFS, ...stored } : { ...DEFAULT_UI_PREFS };
  }

  async saveUiPrefs(prefs: UiPrefs): Promise<void> {
    writeJson(K.uiPrefs, prefs);
  }

  async listPresets(): Promise<Preset[]> {
    const presets = readJson(K.presets, (raw): raw is Preset[] => {
      if (!Array.isArray(raw)) return false;
      return raw.every(isPreset);
    });

    if (!presets) return [];

    // الأحدث أولاً
    return [...presets].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getPreset(id: string): Promise<Preset | null> {
    const presets = await this.listPresets();
    return presets.find((preset) => preset.id === id) ?? null;
  }

  async savePreset(preset: Preset): Promise<void> {
    const presets = await this.listPresets();
    const index = presets.findIndex((item) => item.id === preset.id);

    if (index >= 0) {
      presets[index] = preset;
    } else {
      presets.push(preset);
    }

    writeJson(K.presets, presets);
  }

  async deletePreset(id: string): Promise<void> {
    const presets = await this.listPresets();
    writeJson(K.presets, presets.filter((preset) => preset.id !== id));
  }

  async clearAll(): Promise<void> {
    try {
      const prefix = `v${SCHEMA_VERSION}:`;
      const stale: string[] = [];

      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) stale.push(key);
      }

      stale.forEach(removeKey);
    } catch (error) {
      console.warn('[storage] clearAll failed', error);
    }
  }
}

export { PREF_KEYS as STORAGE_PREF_KEYS };

/** كل مفاتيح localStorage التي كتبها هذا التطبيق في أي إصدار */
const OWNED_KEY_PREFIXES = ['v2:', 'v1:', 'bank_positions_', 'app_prefs'] as const;

/** هل توجد بيانات قديمة تستحق النقل إلى SQLite؟ */
export const hasLegacyData = (): boolean => {
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key === null) continue;
      if (OWNED_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) return true;
    }
    return false;
  } catch {
    return false;
  }
};

export interface LegacySnapshot {
  prefs: Record<string, string>;
  positions: Array<{ bankId: string; language: Language; positions: PositionMap }>;
  checkData: StoredCheckData | null;
  uiPrefs: UiPrefs | null;
  presets: Preset[];
}

/**
 * يلتقط محتوى localStorage قبل إزالته.
 *
 * الترتيب مقصود: نقرأ، ثم ينفّذ المستودع الجديد الحذف. reverse — الحذف
 * أولاً ثم القراءة — يمحو ما ننتقل إليه.
 */
export const readLegacySnapshot = (): LegacySnapshot => {
  const positions: LegacySnapshot['positions'] = [];

  /*
   * نمرّ على كل مفاتيح المواضع: لا نعرف أي بنك/لغة عدّلها المستخدم،
   * ولا نعرف أسماء بنوكه (كانت من الكود الذي استُبدل بالقاعدة).
   */
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key === null) continue;

      const v2 = /^v2:positions:([^:]+):(ar|fr)$/.exec(key);
      if (v2) {
        const raw = normalizePositions(readRaw(key));
        if (raw) positions.push({ bankId: v2[1], language: v2[2] as Language, positions: raw });
        continue;
      }

      // مفاتيح الإصدار 1: bank_positions_<bankId>_<lang>
      const v1 = /^bank_positions_(.+)_(ar|fr)$/.exec(key);
      if (v1) {
        const raw = normalizePositions(readRaw(key));
        if (raw) positions.push({ bankId: v1[1], language: v1[2] as Language, positions: raw });
      }
    }
  } catch (error) {
    console.warn('[migration] cannot enumerate legacy positions', error);
  }

  const prefs: Record<string, string> = {};
  for (const key of PREF_KEY_LIST) {
    const value = localStorage.getItem(key);
    if (value !== null) prefs[key] = value;
  }

  /*
   * القراءات هنا متزامنة فعلياً رغم أن واجهة المستودع غير متزامنة: لا
   * أحد ينافسنا على المفاتيح في هذه اللحظة من الإقلاع، والاستدعاء
   * المتزامن اختصار مقصود لا سهو.
   */
  return {
    prefs,
    positions,
    checkData: readJson(K.checkData, isStoredCheckData),
    uiPrefs: readJson(K.uiPrefs, (raw): raw is UiPrefs => {
      if (typeof raw !== 'object' || raw === null) return false;
      const value = raw as Record<string, unknown>;
      return typeof value.locked === 'boolean' && typeof value.showPositionControls === 'boolean';
    }),
    presets:
      readJson(K.presets, (raw): raw is Preset[] => {
        if (!Array.isArray(raw)) return false;
        return raw.every(isPreset);
      }) ?? [],
  };
};

/**
 * يمحو كل ما كتبه التطبيق من localStorage.
 *
 * يُستدعى بعد نجاح النقل إلى SQLite فقط. الفشل يعني بقاء البيانات
 * القديمة، وهذا أفضل من حذفها ثم اكتشاف أن النقل لم يكتمل.
 */
export const clearLegacyData = (): void => {
  try {
    const stale: string[] = [];

    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key === null) continue;
      const owned = OWNED_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
      if (owned || PREF_KEY_LIST.includes(key)) stale.push(key);
    }

    stale.forEach(removeKey);
  } catch (error) {
    console.warn('[migration] cannot clear legacy data', error);
  }
};
