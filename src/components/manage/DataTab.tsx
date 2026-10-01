import React, { useRef, useState } from 'react';
import { Download, Upload, Trash2, RefreshCw } from 'lucide-react';
import { useLabelProxy } from '../../context/labelsCore';
import { useEngineKind } from '../../context/engineCore';
import { useDatabaseAdmin } from '../../hooks/useDatabaseAdmin';
import { formatDateNumeric } from '../../utils/date';

interface DataTabProps {
  onReplaced: () => Promise<void> | void;
}

/**
 * صيانة البيانات: تصدير، استيراد، سجل الشيكات، سجل العمليات.
 *
 * الاستيراد يستبدل القاعدة كاملة، ولذلك يطلب تأكيداً صريحاً بعد قراءة
 * الملف لا قبله. الفرق بينهما مهم: تحذير قبل اختيار الملف لا يحمي من
 * استيراد الملف الخطأ.
 */
const DataTab: React.FC<DataTabProps> = ({ onReplaced }) => {
  const currentLabels = useLabelProxy('manage.');
  const engineKind = useEngineKind();
  const { history, audit, isLoading, canManage, exportDatabase, importDatabase, clearHistory, refresh } =
    useDatabaseAdmin(onReplaced);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!canManage) {
    return <p className="text-sm text-amber-700 dark:text-amber-300">{currentLabels.noData}</p>;
  }

  const buttonClass =
    'flex items-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-700';

  const onImport = async (file: File | undefined) => {
    if (file === undefined) return;
    setError(null);
    setNotice(null);

    if (!window.confirm(currentLabels.importConfirm)) return;

    try {
      await importDatabase(file);
      setNotice(currentLabels.imported);
    } catch (caught) {
      console.error('[manage] import failed', caught);
      setError(currentLabels.importFailed);
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="font-bold text-gray-900 dark:text-white">{currentLabels.export}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">{currentLabels.exportHint}</p>
        <button
          type="button"
          id="manage-export"
          onClick={() => {
            setError(null);
            void exportDatabase()
              .then(() => setNotice(currentLabels.exported))
              .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : null));
          }}
          className={buttonClass}
        >
          <Download className="w-4 h-4" />
          {currentLabels.export}
        </button>
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-gray-900 dark:text-white">{currentLabels.import}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">{currentLabels.importConfirm}</p>
        <input
          ref={fileInputRef}
          id="manage-import"
          type="file"
          accept=".sqlite3,application/octet-stream"
          className="hidden"
          onChange={(event) => {
            void onImport(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <button type="button" onClick={() => fileInputRef.current?.click()} className={buttonClass}>
          <Upload className="w-4 h-4" />
          {currentLabels.import}
        </button>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 dark:text-white">{currentLabels.history}</h3>
          <div className="flex gap-2">
            <button type="button" onClick={() => void refresh()} aria-label={currentLabels.refresh} className={buttonClass}>
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => void clearHistory()}
              disabled={history.length === 0}
              className={`${buttonClass} disabled:opacity-40`}
            >
              <Trash2 className="w-4 h-4" />
              {currentLabels.clearHistory}
            </button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-gray-500">…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{currentLabels.noHistory}</p>
        ) : (
          <ul className="space-y-1 max-h-48 overflow-y-auto text-xs">
            {history.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <span className="font-medium">{entry.bankName}</span>
                <span className="text-gray-500 dark:text-gray-400">{formatDateNumeric(entry.data.date)}</span>
                <span className="text-gray-600 dark:text-gray-300">{entry.data.amount}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-bold text-gray-900 dark:text-white">{currentLabels.audit}</h3>
        {audit.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{currentLabels.noAudit}</p>
        ) : (
          <ul className="space-y-1 max-h-40 overflow-y-auto text-xs">
            {audit.map((row) => (
              <li key={row.id} className="flex gap-2 p-1.5 rounded border border-gray-100 dark:border-gray-800">
                <span className="font-mono text-gray-500 dark:text-gray-400">{row.action}</span>
                <span className="text-gray-700 dark:text-gray-300">{row.entity}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
        <p>
          {currentLabels.storageEngine}: {engineKind}
        </p>
      </section>

      {notice !== null && <p className="text-sm text-green-600 dark:text-green-400">{notice}</p>}
      {error !== null && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
};

export default DataTab;
