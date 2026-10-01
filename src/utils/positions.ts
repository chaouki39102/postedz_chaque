import type { Position, PositionMap } from '../types';

/**
 * تعديل موضع حقل وإعادته صالحاً للتخزين.
 *
 * لماذا دالة لا `{ ...current[field], x }` في كل مكان:
 * كثير من المعدِّلين يعدّلون خاصية واحدة (العرض، حجم الخط، الإحداثية)
 * على خريطة قد يكون فيها الحقل غائباً — القاعدة تحفظ صفاً لكل حقل
 * عدّله المستخدم فقط. عند الغياب ينتج `{ x }` أو `{ fontCqw }` بلا
 * y، وsql.js يرفض ربط undefined فيهرب الحفظ كاملاً بصمت.
 *
 * المحوران يُكمَّلان هنا دائماً، والخصائص الاختيارية تُحمل فقط إن
 * كانت رقماً صالحاً، وغياب `fontCqw` معناه "الحجم الافتراضي" لا صفر.
 */
export const patchPosition = (
  positions: PositionMap,
  field: string,
  patch: Partial<Position>
): PositionMap => {
  const current = positions[field] ?? { x: 0, y: 0 };
  const merged = { ...current, ...patch };

  const position: Position = {
    x: finiteOr(merged.x, current.x ?? 0),
    y: finiteOr(merged.y, current.y ?? 0),
  };

  const widthPercent = finiteOrUndefined(merged.widthPercent);
  if (widthPercent !== undefined) position.widthPercent = widthPercent;

  const fontCqw = finiteOrUndefined(merged.fontCqw);
  if (fontCqw !== undefined) position.fontCqw = fontCqw;

  return { ...positions, [field]: position };
};

const finiteOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const finiteOrUndefined = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/* ---- دقة الإحداثيات: لماذا كسر وليس عدد صحيح ---- */

/**
 * المواضع نسب مئوية من عرض الشيك وارتفاعه، والشيك 210×99mm.
 * فوحدة واحدة في النسبة = 2.10mm أفقياً و0.99mm عمودياً.
 *
 * التقريب إلى أقرب عدد صحيح (وهو ما كان هنا) يجعل أصغر خطوة مفيدة
 * 2.1mm، فيبتلع أي تعديل أصغر: المستخدم ينزل الحقل قليلاً فيطبع فيجده
 * كما هو، أو يزيحه 2mm فيقفز النص قفزة كاملة. تقسيم النسبة إلى 100
 * يجعل أصغر خطوة 0.021mm، أي أدق من دقة أي طابعة، فلا يضيع تعديل ولا
 * تقفز موضع قفزة كاملة.
 *
 * التقريب إلى منزلتين يبقى الرقم مقروءاً في القاعدة وفي حقول الإحداثيات
 * بدل فاصل عشري من خمسة عشر رقماً في كل قيمة.
 */
export const POSITION_MIN = -100;
export const POSITION_MAX = 200;

/** إحداثية صالحة للتخزين: ضمن المدى، بمنزلتين عشريتين */
export const clampPosition = (value: number | undefined): number => {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.min(POSITION_MAX, Math.max(POSITION_MIN, Math.round(value * 100) / 100));
};

/**
 * قراءة حقل إحداثية من المستخدم كما هي.
 *
 * `null` تعني "لا تعديل": حقل الإدخال يمرّ بلحظة يكون فيها فارغاً أو
 * محتواه ناقصاً (سالب لحاله)،فلو اعتبرناه صفراً لقفز الحقل إلى الطرف
 * ثم عاد، وهو ما بدا للمستخدم كأن الموضع لا يستجيب.
 */
export const parsePositionInput = (raw: string): number | null => {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '-') return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? clampPosition(parsed) : null;
};
