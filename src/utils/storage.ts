/**
 * إعدادات العرض العامة (الوضع الداكن، آخر بنك ولغة مختارين).
 *
 * لماذا تبقى هنا بينما المواضع وبيانات الشيك انتقلت إلى طبقة `data/`:
 * هذه المفاتيح تُقرأ بشكل متزامن قبل أول رسم للواجهة. نقلها إلى مستودع
 * غير متزامن سيومض المحتوى أو يجعله يبدأ دائماً على عربية/البنك الأول.
 * القراءة غير المتزامنة لبقية الحالة (المواضع، المسودة، القوالب) لا تسبب
 * وميضاً لأنها تُحمَّل خلف شاشة تحميل.
 */

const DARK_MODE_KEY = 'dark_mode';
const BANK_KEY = 'selected_bank_id';
const LANGUAGE_KEY = 'language';
const PWA_DISMISSED_KEY = 'pwa_install_dismissed';

export const STORAGE_KEYS = {
  darkMode: DARK_MODE_KEY,
  bank: BANK_KEY,
  language: LANGUAGE_KEY,
  pwaDismissed: PWA_DISMISSED_KEY,
} as const;

export const loadPreference = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const savePreference = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* التخزين غير متاح (وضع التصفح الخاص) - نتجاهل بهدوء */
  }
};
