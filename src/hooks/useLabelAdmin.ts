import { useCallback, useEffect, useMemo, useState } from 'react';
import { getRepository } from '../data';
import { useLabels } from '../context/labelsCore';
import type { LabelBundle } from '../types';

/**
 * تحرير تسميات الواجهة (جدول labels).
 *
 * التعديلات تُحفظ في القاعدة ثم يُعاد بناء الخريطة في السياق، فتظهر
 * في كل الواجهة فوراً. سبب آخر لعرضها: هذه النصوص Hundreds من
 * السلاسل، وأي نص مطبوع في الكود هو نص لا يستطيع المستخدم إصلاحه.
 */

export interface LabelAdminApi {
  labels: LabelBundle[];
  filtered: LabelBundle[];
  query: string;
  setQuery: (value: string) => void;
  isLoading: boolean;
  canManage: boolean;
  save: (key: string, ar: string, fr: string) => Promise<void>;
}

export const useLabelAdmin = (): LabelAdminApi => {
  const { refresh } = useLabels();
  const [labels, setLabels] = useState<LabelBundle[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);

  const reload = useCallback(async () => {
    const repository = getRepository();
    if (!repository.listLabels || !repository.setLabel) {
      setCanManage(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setCanManage(true);
    try {
      setLabels(await repository.listLabels());
    } catch (error) {
      console.error('[labels] admin load failed', error);
      setLabels([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback<LabelAdminApi['save']>(
    async (key, ar, fr) => {
      const repository = getRepository();
      if (!repository.setLabel) throw new Error('labels unavailable');

      await repository.setLabel(key, ar, fr);
      // التحديث في القاعدة لا يكفي: الخريطة في الذاكرة هي ما تقرأه الواجهة
      await refresh();
      await reload();
    },
    [refresh, reload]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') return labels;
    return labels.filter(
      (label) =>
        label.key.toLowerCase().includes(needle) ||
        label.ar.toLowerCase().includes(needle) ||
        label.fr.toLowerCase().includes(needle)
    );
  }, [labels, query]);

  return { labels, filtered, query, setQuery, isLoading, canManage, save };
};
