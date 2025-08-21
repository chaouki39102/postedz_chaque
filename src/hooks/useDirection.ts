import { useEffect } from 'react';

export const useDirection = (language: string) => {
  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);
};