/**
 * إدارة صور البنوك كـ object URLs.
 *
 * بايتات BLOB القادمة من SQLite ليست روابطاً، و CSS لا يقبل بايتات.
 * الحل إنشاء object URL، لكن كل رابط مرتبط بعدد مراجع: كل مستهلِك يزيده
 * في useEffect، وتنظيفُ نفس الـ useEffect ينقصه، وعند الصفر نبطّل.
 *
 * لماذا لا يُنشأ الرابط أثناء الرسم: React قد يرسم ثم يتخلّى عن النتيجة
 * (StrictMode، Suspense، تحديثات متزامنة). عدّاد مراجع يزيد مع رسم لم
 * يُلتزَم به فيبقى الرابط حيّاً بلا مستخدم، أو يُبطَل وهو مستخدم.
 * الاكتساب في useEffect هو الوحيد الذي يضمن ارتباطاً صارماً بالدورة.
 */

interface Entry {
  url: string;
  refs: number;
}

const cache = new Map<string, Entry>();

const bankKey = (bankId: string, updatedAt: number): string => `${bankId}@${updatedAt}`;

/**
 * يعيد رابطاً صالحاً لصورة البنك، وينشئه إن لم يكن موجوداً، ويزيد
 * عدّاد المراجع بمقدار واحد. من الواجب استدعاء releaseImageUrl بنفس
 * الوعد (تنظيف useEffect) أو يتسرّب الرابط.
 */
export const acquireImageUrl = (
  bankId: string,
  updatedAt: number,
  bytes: Uint8Array | null,
  mime: string | null,
  seedPath: string | null
): string | null => {
  // صورة البذرة تُستخدم من مسارها: لا ذاكرة ولا إبطال
  if (bytes === null) return seedPath;

  const key = bankKey(bankId, updatedAt);
  const existing = cache.get(key);
  if (existing !== undefined) {
    existing.refs += 1;
    return existing.url;
  }

  /*
   * نسخة مستقلة: بعض المتصفحات تفصل Buffer عن الذاكرة المصدرية،
   * وقد نحتاج إعادة استخدام بايتات المحرك لاحقاً.
   */
  const blob = new Blob([new Uint8Array(bytes)], { type: mime ?? 'image/jpeg' });
  const url = URL.createObjectURL(blob);
  cache.set(key, { url, refs: 1 });
  return url;
};

/** ينقص عدّاد المراجع، ويبطّل الرابط عند الوصول للصفر */
export const releaseImageUrl = (key: string): void => {
  const entry = cache.get(key);
  if (entry === undefined) return;

  entry.refs -= 1;
  if (entry.refs <= 0) {
    URL.revokeObjectURL(entry.url);
    cache.delete(key);
  }
};

/** يبطل كل الروابط (عند تفريغ القاعدة أو استيراد نسخة جديدة) */
export const releaseAllImageUrls = (): void => {
  for (const entry of cache.values()) {
    URL.revokeObjectURL(entry.url);
  }
  cache.clear();
};

/** عدد الروابط الحيّة — للاختبارات والتشخيص فقط */
export const activeImageUrlCount = (): number => cache.size;

export { bankKey };
