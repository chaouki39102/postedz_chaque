import type { Language, PositionMap } from './types';

/**
 * المواضع الافتراضية.
 *
 * ملاحظة معمارية: تعريف البنوك لم يعد هنا. البنك الآن صف في قاعدة
 * البيانات (انظر src/data)، وهذا الملف يبقى مصدر القيم الافتراضية
 * فقط، تُستخدم حين لا توجد مواضع محفوظة لنموذج معيّن.
 *
 * `widthPercent` نسبة مئوية من عرض الشيك وليست بكسل، لأن العرض بالبكسل
 * كان يجعل الالتفاف مختلفاً بين المعاينة والطباعة.
 */
export const DEFAULT_POSITIONS: PositionMap = {
  date: { x: 83, y: 55 },
  place: { x: 63, y: 56 },
  beneficiary: { x: 78, y: 46 },
  amount: { x: 90, y: 17 },
  amountWords: { x: 56, y: 32, widthPercent: 50 },
};

/** نسخة جديدة من المواضع الافتراضية (الكائن نفسه لا يُعاد استخدامه) */
export const getDefaultPositions = (): PositionMap =>
  Object.fromEntries(
    Object.entries(DEFAULT_POSITIONS).map(([field, position]) => [field, { ...position }])
  ) as PositionMap;

/**
 * يدمج المواضع المحفوظة فوق الافتراضية.
 *
 * الدمج ضروري لأن الحقول تختلف بين النماذج: لو حفظنا مواضعاً ناقصة
 * (الحقل ما زال بمكانه الافتراضي) فالحقل الناقص يختفي من المعاينة.
 */
export const mergeWithDefaults = (saved: PositionMap | null): PositionMap => {
  if (!saved) return getDefaultPositions();

  const merged: PositionMap = getDefaultPositions();
  for (const [field, position] of Object.entries(saved)) {
    if (!position) continue;
    merged[field] = { ...merged[field], ...position };
  }
  return merged;
};

/** ترتيب الحقول في لوحة التحكم */
export const POSITION_FIELD_ORDER = [
  'date',
  'place',
  'beneficiary',
  'amount',
  'amountWords',
] as const;

/** اللغات المدعومة، مصدر واحد للحقيقة */
export const SUPPORTED_LANGUAGES: readonly Language[] = ['ar', 'fr'];
