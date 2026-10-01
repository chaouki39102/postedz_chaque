import type { Language, PositionMap, Preset, StoredCheckData, UiPrefs } from '../types';

/**
 * عقد التخزين.
 *
 * كل الوصول الدائم للبيانات يمر عبر هذه الواجهة، مما يسمح بتبديل
 * محرك التخزين دون تعديل أي مكوّن. المحركان المتاحان:
 * SQLite (WASM) + IndexedDB، و localStorage كمسار احتياطي.
 *
 * كل الدوال غير متزامنة (Promise) عن قصد، لأن محركات مثل SQLite/WASM
 * وIndexedDB لا يمكن الاستعلام منها بشكل متزامن. هذا يعني أن كل مستهلِك
 * يحتاج حالة تحميل، وأن الوصول لا يجوز أن يكون في مسار الرسم.
 */
export interface CheckRepository {
  /** اسم المحرك، للعرض في واجهة المستخدم */
  readonly kind: string;

  // ---- تفضيلات ----
  getPreference(key: string): Promise<string | null>;
  setPreference(key: string, value: string): Promise<void>;

  // ---- المواضع (لكل بنك + لغة) ----
  loadPositions(bankId: string, language: Language): Promise<PositionMap | null>;
  savePositions(bankId: string, language: Language, positions: PositionMap): Promise<void>;
  resetPositions(bankId: string, language: Language): Promise<void>;

  // ---- بيانات الشيك ----
  loadCheckData(): Promise<StoredCheckData | null>;
  saveCheckData(data: StoredCheckData): Promise<void>;
  clearCheckData(): Promise<void>;

  // ---- إعدادات الواجهة ----
  loadUiPrefs(): Promise<UiPrefs>;
  saveUiPrefs(prefs: UiPrefs): Promise<void>;

  // ---- القوالب المحفوظة ----
  listPresets(): Promise<Preset[]>;
  getPreset(id: string): Promise<Preset | null>;
  savePreset(preset: Preset): Promise<void>;
  deletePreset(id: string): Promise<void>;

  // ---- الصيانة ----

  /** تهيئة المحرك (إنشاء المخطط). آمنة للاستدعاء المتكرر. */
  init(): Promise<void>;

  /** حذف كل البيانات (إعادة تعيين شاملة) */
  clearAll(): Promise<void>;

  // ---- البنوك (اختيارية: غير متوفرة في localStorage) ----

  listBanks?(includeInactive?: boolean): Promise<import('../types').BankRecord[]>;
  getBank?(id: string): Promise<import('../types').BankRecord | null>;
  saveBank?(input: BankInput): Promise<import('../types').BankRecord>;
  deleteBank?(id: string): Promise<void>;
  reorderBanks?(orderedIds: readonly string[]): Promise<void>;

  // ---- التسميات ----

  listLabels?(): Promise<import('../types').LabelBundle[]>;
  getLabel?(language: import('../types').Language, key: string): Promise<string | null>;
  setLabel?(key: string, ar: string, fr: string): Promise<void>;

  // ---- القيم الافتراضية للحقول ----

  /**
   * القيم الافتراضية لحقول الشيك لهذه اللغة، مُستخرجة من جدول
   * field_defaults. عند غيابها يرجع المحرك إلى ما في الكود، فيبقى
   * النموذج مستعملاً في المحرك الاحتياطي.
   */
  loadFieldDefaults?(language: import('../types').Language): Promise<StoredCheckData>;
  setFieldDefault?(
    language: import('../types').Language,
    field: string,
    value: string
  ): Promise<void>;

  // ---- السجل والتصدير ----

  addHistory?(entry: Omit<import('../types').HistoryEntry, 'id'>): Promise<void>;
  listHistory?(limit?: number): Promise<import('../types').HistoryEntry[]>;
  clearHistory?(): Promise<void>;
  listAudit?(limit?: number): Promise<AuditRow[]>;
  exportBytes?(): Promise<Uint8Array>;
  importBytes?(bytes: Uint8Array): Promise<void>;
}

/** مدخل حفظ بنك (إضافة أو تعديل) */
export interface BankInput {
  /** يُهمَل عند الإضافة (يولَّد تلقائياً) */
  id?: string;
  nameAr: string;
  nameFr: string;
  imageMime?: string | null;
  imageBytes?: Uint8Array | null;
  isActive?: boolean;
}

/** سطر سجل تدقيق */
export interface AuditRow {
  id: number;
  action: string;
  entity: string;
  entityId: string;
  at: number;
}

/** القيم الافتراضية لإعدادات الواجهة */
export const DEFAULT_UI_PREFS: UiPrefs = {
  locked: false,
  showPositionControls: false,
};

/** مفاتيح التفضيلات النصية */
export const PREF_KEYS = {
  darkMode: 'dark_mode',
  bank: 'selected_bank_id',
  language: 'language',
  /** مواضع الشيك على الورقة (هوامش الطباعة)، تُحرَّر من واجهة الطباعة */
  printLayout: 'print_layout',
} as const;

/** المفاتيح كقائمة، للتنقل بينها (ترحيل بيانات، تفريغ) */
export const PREF_KEY_LIST: readonly string[] = Object.values(PREF_KEYS);
