import { useCallback, useEffect, useState } from 'react';
import { getRepository } from '../data';
import { TODAY } from '../data/fieldDefaults';
import type { Language, StoredCheckData } from '../types';

/**
 * إدارة القيم الافتراضية للحقول (جدول field_defaults).
 *
 * القيم تُقرأ عند أول تشغيل فقط، فوجود واجهة لتعديلها ليس ترفاً: بدونها
 * يصبح تغيير الاسم الافتراضي للمستفيد أو مبلغ تجريبي يتطلب بناء نسخة
 * جديدة من التطبيق.
 *
 * حقل التاريخ له حالتان: "اليوم تلقائياً" (القيمة TODAY) أو تاريخ ثابت.
 * التخزين بالإشارة مقصود: تاريخ ثابت في القاعدة يخطئ بعد يوم واحد.
 */

export interface FieldDefaultsApi {
  values: StoredCheckData | null;
  isLoading: boolean;
  canManage: boolean;
  isSaved: boolean;
  save: (values: { place: string; beneficiary: string; amount: string; date: string }) => Promise<void>;
  refresh: () => Promise<void>;
}

const toStoredValue = (): StoredCheckData => ({
  date: TODAY,
  place: '',
  beneficiary: '',
  amount: '',
  dateIsAuto: true,
});

export const useFieldDefaults = (language: Language): FieldDefaultsApi => {
  const [values, setValues] = useState<StoredCheckData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const refresh = useCallback(async () => {
    const repository = getRepository();
    if (!repository.loadFieldDefaults || !repository.setFieldDefault) {
      setCanManage(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setCanManage(true);
    try {
      setValues(await repository.loadFieldDefaults(language));
    } catch (error) {
      console.error('[defaults] load failed', error);
      setValues(null);
    } finally {
      setIsLoading(false);
    }
  }, [language]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback<FieldDefaultsApi['save']>(
    async (next) => {
      const repository = getRepository();
      if (!repository.setFieldDefault) throw new Error('field defaults unavailable');

      for (const [field, value] of Object.entries(next)) {
        await repository.setFieldDefault(language, field, value);
      }

      setValues(await repository.loadFieldDefaults?.(language) ?? toStoredValue());
      setIsSaved(true);
      window.setTimeout(() => setIsSaved(false), 1500);
    },
    [language]
  );

  return { values, isLoading, canManage, isSaved, save, refresh };
};
