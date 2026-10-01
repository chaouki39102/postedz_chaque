export interface Position {
  /** النسبة المئوية الأفقية من عرض الشيك (0 = اليسار، 100 = اليمين) */
  x: number;
  /** النسبة المئوية العمودية من ارتفاع الشيك (0 = الأعلى، 100 = الأسفل) */
  y: number;
  /**
   * عرض النص كنسبة مئوية من عرض الشيك.
   *
   * مهم: يجب أن تكون نسبة مئوية وليس بكسل. العرض بالبكسل كان يسبب
   * اختلافاً بين المعاينة (حاوية ~900px) والطباعة (حاوية 210mm ≈ 794px)،
   * فيخرج النص المطبوع غير مطابق للمعاينة. النسبة تجعل الاثنين متطابقين.
   */
  widthPercent?: number;
}

export interface CheckData {
  date: string;
  place: string;
  beneficiary: string;
  amount: string;
}

export type Language = 'ar' | 'fr';

export type PositionMap = Record<string, Position>;

/** أسماء الحقول القابلة للضبط داخل الشيك */
export const CHECK_FIELDS = [
  'date',
  'place',
  'beneficiary',
  'amount',
  'amountWords',
] as const;

export type CheckField = (typeof CHECK_FIELDS)[number];

/**
 * بنك مخزَّن في قاعدة البيانات.
 *
 * هذا هو النوع المعتمد الآن. الفرق الجوهري عن `Bank` القديمة أن الصورة
 * بيانات (BLOB) وليست رابطاً في مجلد static. النتيجة أن إضافة بنك أو
 * تغيير صورته أو حذفه عملية على البيانات، تُنفَّذ وقت التشغيل، بلا
 * تعديل كود ولا إعادة بناء للتطبيق.
 */
export interface BankRecord {
  id: string;
  nameAr: string;
  nameFr: string;
  /** نوع MIME للصورة (image/jpeg مثلاً) */
  imageMime: string | null;
  /** بايتات صورة الشيك، أو null إن لم تُضَف صورة بعد */
  imageBytes: Uint8Array | null;
  /**
   * مسار الصورة الأصلية المضمَّنة في المشروع إن كانت هذه الصورة منه.
   * نحفظه لنعرف أن صورة البنك لم يمسّها المستخدم، فبنفسها نعيد البذر
   * بلا أن نطمس استبداله.
   */
  imageSeed: string | null;
  /** غير مفعّل = مخفي من قائمة الاختيار، دون حذف بياناته */
  isActive: boolean;
  /** من البذرة الأصلية (يُميَّز في واجهة الإدارة) */
  isBuiltin: boolean;
  /** ترتيب الظهور في القائمة */
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * بنك جاهز للعرض: سجل قاعدة البيانات + رابط صورة صالح للاستخدام في CSS.
 *
 * `imageUrl` إمّا object URL من بايتات BLOB، أو المسار المحلي للبذرة.
 * `getImageUrl` (في طبقة الصور) هو المسؤول عن إنشاء الرابط وإبطاله.
 */
export interface Bank extends BankRecord {
  /** رابط جاهز للعرض في background-image */
  imageUrl: string | null;
  initialPositions: Record<Language, PositionMap>;
}

/** تسمية واجهة مخزَّنة في قاعدة البيانات وقابلة للتحرير */
export interface LabelBundle {
  key: string;
  ar: string;
  fr: string;
}

/**
 * سجل شيك طُبع فعلاً.
 *
 * منفصل عن القوالب: القالب نيّة ونص قابل للتعديل، أما هذا فهو ما طُبع
 * بالضبط، ويُحفظ كما طُبع لأغراض المتابعة المحاسبية.
 */
export interface HistoryEntry {
  id: number;
  bankId: string;
  /** الاسم وقت الطباعة، حتى يبقى السجل مقروءاً بعد حذف البنك */
  bankName: string;
  language: Language;
  data: CheckData;
  positions: PositionMap;
  /** المبلغ بالحروف كما طُبع، للمراجعة اللاحقة */
  amountWords: string;
  createdAt: number;
}

/** إعدادات واجهة تُحفظ محلياً */
export interface UiPrefs {
  /** قفل عناصر المعاينة لمنع السحب بالخطأ */
  locked: boolean;
  /** إظهار لوحة التحكم في المواضع */
  showPositionControls: boolean;
}

/** بيانات الشيك المحفوظة مع علامة تمييز التاريخ التلقائي */
export interface StoredCheckData extends CheckData {
  /**
   * true = التاريخ يُملأ تلقائياً بتاريخ اليوم في كل زيارة.
   * false = المستخدم عدّله يدوياً ونحتفظ به.
   */
  dateIsAuto: boolean;
}

/**
 * قالب محفوظ: بيانات شيك + مواضعها لنموذج بنك محدد.
 * يسمح للمستخدم بحفظ عدة شيكات متكررة واستدعائها لاحقاً.
 */
export interface Preset {
  id: string;
  name: string;
  bankId: string;
  language: Language;
  data: CheckData;
  positions: PositionMap;
  createdAt: number;
  updatedAt: number;
}
