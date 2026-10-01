/**
 * أدوات التعامل مع التواريخ بصيغة "YYYY-MM-DD".
 *
 * ملاحظة مهمة: `new Date('2025-06-10')` يفسَّر كتوقيت UTC، و`toISOString()`
 * يحوّل التاريخ إلى UTC أيضاً. الجمع بين الاثنين يسبب انزياحاً بيوماً واحد
 * في المناطق الزمنية السالبة. هنا نتجنّب UTC كلياً ونستخدم getters المحلية.
 */

/** تاريخ اليوم بصيغة YYYY-MM-DD حسب التوقيت المحلي (بدون انزياح UTC) */
export const toLocalDateInputValue = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * يحلّل "YYYY-MM-DD" إلى Date عند منتصف الليل المحلي.
 * يعيد null إذا كانت القيمة فارغة أو غير صالحة (مثل 2025-02-31).
 */
export const parseLocalDate = (dateString: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);
  // يرفض القيم التي تتجاوز حدود الشهر مثل 2025-02-31
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

/** يعرض التاريخ بصيغة "DD/MM/YYYY" (نفس التنسيق للعربية والفرنسية) */
export const formatDateNumeric = (dateString: string): string => {
  const date = parseLocalDate(dateString);
  if (!date) return '';

  const day = `${date.getDate()}`.padStart(2, '0');
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
};
