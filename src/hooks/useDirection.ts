import { useEffect } from 'react';
import type { Language } from '../types';

/** يزامن dir و lang على عنصر html مع اللغة المختارة */
export const useDirection = (language: Language) => {
  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);
};
