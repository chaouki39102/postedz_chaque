import React from 'react';
import { Loader2, Database, AlertTriangle } from 'lucide-react';
import { useLabels } from '../context/labelsCore';
import type { StorageEngineKind } from '../data';

/**
 * شاشة الإقلاع.
 *
 * ضرورية لأن SQLite + WASM + IndexedDB كلها غير متزامنة. بدونها
 * تظهر شاشة فارغة أو، أسوأ، واجهة تومض بمحتوى خاطئ قبل أن تُحمَّل
 * البيانات وتُستبدل.
 *
 * تعرض حالة فعلية: ما الذي ينتظره المستخدم بالضبط.
 */

export const BootScreen: React.FC = () => {
  const { t } = useLabels();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-gray-900 px-4">
      <div className="flex flex-col items-center gap-5 text-center max-w-md">
        <div className="relative">
          <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full" />
          <div className="relative bg-gradient-to-br from-indigo-500 to-purple-600 p-4 rounded-2xl shadow-lg">
            <Database className="w-8 h-8 text-white" />
          </div>
          <Loader2
            className="absolute -bottom-2 -right-2 w-7 h-7 text-indigo-500 animate-spin"
            aria-hidden="true"
          />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">
            {t('boot.loading')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('boot.loadingHint')}</p>
        </div>

        <div
          role="status"
          aria-live="polite"
          className="w-64 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
        >
          <div className="h-full w-1/3 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
};

export interface BootErrorScreenProps {
  reason: string;
  onRetry: () => void;
  onContinueLimited: () => void;
}

/**
 * شاشة فشل الإقلاع.
 *
 * لا نُسقط التطبيق: نزوّد المستخدم بقرار. المحاولة مرة أخرى، أو
 * المتابعة في وضع التخزين المحدود مع تنبيه بما سيتأثر.
 */
export const BootErrorScreen: React.FC<BootErrorScreenProps> = ({
  reason,
  onRetry,
  onContinueLimited,
}) => {
  const { t } = useLabels();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-gray-900 px-4">
      <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 md:p-8">
        <div className="flex items-start gap-4 mb-4">
          <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-xl flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              {t('boot.errorTitle')}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('boot.errorBody')}</p>
          </div>
        </div>

        {/* تفاصيل التقنية مفيدة للتشخيص ولا نخفيها عن المطوّر */}
        <details className="mb-5">
          <summary className="text-xs font-medium text-gray-500 dark:text-gray-400 cursor-pointer select-none">
            التفاصيل التقنية
          </summary>
          <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-900 rounded-lg text-[11px] text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-pre-wrap break-all">
            {reason}
          </pre>
        </details>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            {t('boot.retry')}
          </button>
          <button
            type="button"
            onClick={onContinueLimited}
            className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            {t('boot.continueLimited')}
          </button>
        </div>
      </div>
    </div>
  );
};

/** شريط تنبيه يظهر عند العمل بالمحرك المحدود */
export const FallbackBanner: React.FC<{ kind: StorageEngineKind }> = ({ kind }) => {
  const { t } = useLabels();
  if (kind === 'sqlite') return null;

  return (
    <div
      role="status"
      className="bg-amber-500 text-white px-4 py-2 text-center text-xs md:text-sm font-medium"
    >
      {t('boot.fallbackNotice')}
    </div>
  );
};
