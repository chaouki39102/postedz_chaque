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
