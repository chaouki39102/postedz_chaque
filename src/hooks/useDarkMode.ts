import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEYS, loadPreference, savePreference } from '../utils/storage';

const DARK_QUERY = '(prefers-color-scheme: dark)';

const getInitialDarkMode = (): boolean => {
  const stored = loadPreference(STORAGE_KEYS.darkMode);
  if (stored === 'dark') return true;
  if (stored === 'light') return false;

  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(DARK_QUERY).matches;
};

/**
 * يدير الوضع الداكن كحالة React بدلاً من قراءة DOM أثناء العرض،
 * sehingga يتحدّث أيقونة/نص زر التبديل فوراً.
 */
export const useDarkMode = () => {
  const [isDark, setIsDark] = useState<boolean>(getInitialDarkMode);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    savePreference(STORAGE_KEYS.darkMode, isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleDarkMode = useCallback(() => {
    setIsDark((previous) => !previous);
  }, []);

  return { isDark, toggleDarkMode };
};
