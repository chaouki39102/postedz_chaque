import React from 'react';
import { Download, X, Share } from 'lucide-react';
import { useLabels } from '../context/labelsCore';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

/**
 * شريط طلب تثبيت التطبيق.
 *
 * يظهر مرة واحدة فقط: عند الضغط على "لاحقاً" أو بعد القبول نحفظ العلامة
 * في التخزين المحلي فلا يعود يظهر. لا يعتمد على أي مكتبة خارجية.
 */
export const InstallPrompt: React.FC = () => {
  const { t } = useLabels();
  const { isVisible, platform, install, dismiss } = useInstallPrompt();

  if (!isVisible) return null;

  const isIos = platform === 'ios';

  return (
    <div
      role="dialog"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 no-print"
    >
      <div className="bg-gradient-to-br from-blue-600 to-yellow-500 rounded-lg shadow-lg p-4 flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
          {isIos ? (
            <Share className="w-5 h-5 text-white" aria-hidden="true" />
          ) : (
            <Download className="w-5 h-5 text-white" aria-hidden="true" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm leading-tight">
            {isIos ? t('pwa.iosTitle') : t('pwa.title')}
          </p>
          <p className="text-white/90 text-xs mt-1 leading-relaxed">
            {isIos ? t('pwa.iosBody') : t('pwa.body')}
          </p>

          {!isIos && (
            <button
              type="button"
              onClick={install}
              className="mt-3 bg-white text-blue-700 rounded-lg px-4 py-1.5 text-sm font-bold"
            >
              {t('pwa.install')}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label={t('pwa.later')}
          className="shrink-0 text-white/80 p-1"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};