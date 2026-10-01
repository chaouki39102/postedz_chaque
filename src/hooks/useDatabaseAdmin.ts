import { useCallback, useEffect, useState } from 'react';
import { getRepository } from '../data';
import type { AuditRow } from '../data/repository';
import type { HistoryEntry } from '../types';

/**
 * صيانة قاعدة البيانات: السجل، سجل العمليات، والتصدير/الاستيراد.
 *
 * التصدير يُنزّل ملف القاعدة نفسه (بايتات من db.export) لا JSON. السبب
 * أن JSON يفقد الصور (BLOB) ويفقد ترتيب الصفوف، فالنتيجة نسخة ناقصة
 * متنكرة كنسخة كاملة.
 */

export interface DatabaseAdminApi {
  history: HistoryEntry[];
  audit: AuditRow[];
  isLoading: boolean;
  canManage: boolean;
  exportDatabase: () => Promise<void>;
  importDatabase: (file: File) => Promise<void>;
  clearHistory: () => Promise<void>;
  refresh: () => Promise<void>;
}

const HISTORY_LIMIT = 50;
const AUDIT_LIMIT = 50;

export const useDatabaseAdmin = (onReplaced: () => Promise<void> | void): DatabaseAdminApi => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);

  const refresh = useCallback(async () => {
    const repository = getRepository();
    if (!repository.listHistory || !repository.exportBytes || !repository.importBytes) {
      setCanManage(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setCanManage(true);
    try {
      const [loadedHistory, loadedAudit] = await Promise.all([
        repository.listHistory(HISTORY_LIMIT),
        repository.listAudit?.(AUDIT_LIMIT) ?? Promise.resolve([]),
      ]);
      setHistory(loadedHistory);
      setAudit(loadedAudit);
    } catch (error) {
      console.error('[data] admin load failed', error);
      setHistory([]);
      setAudit([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const exportDatabase = useCallback(async () => {
    const repository = getRepository();
    if (!repository.exportBytes) throw new Error('export unavailable');

    const bytes = await repository.exportBytes();
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `cheques-${stamp}.sqlite3`;
    link.click();

    /*
     * الإبطال بعد التنزيل لا فوراً: بعض المتصفحات تبدأ القراءة بعد
     * انتهاء التنفيذ، والإبطال المبكر ينتج ملفاً فارغاً.
     */
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }, []);

  const importDatabase = useCallback(
    async (file: File) => {
      const repository = getRepository();
      if (!repository.importBytes) throw new Error('import unavailable');

      const bytes = new Uint8Array(await file.arrayBuffer());
      await repository.importBytes(bytes);
      await onReplaced();
      await refresh();
    },
    [onReplaced, refresh]
  );

  const clearHistory = useCallback(async () => {
    const repository = getRepository();
    await repository.clearHistory?.();
    await refresh();
  }, [refresh]);

  return { history, audit, isLoading, canManage, exportDatabase, importDatabase, clearHistory, refresh };
};
