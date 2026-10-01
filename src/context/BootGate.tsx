import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { bootRepository, flushRepository, type BootResult } from '../data';
import { EngineProvider } from './EngineContext';
import { LabelsProvider } from './LabelsContext';
import { BootErrorScreen, BootScreen } from '../components/BootScreen';
import { ErrorBoundary } from '../components/ErrorBoundary';

/**
 * بوابة الإقلاع.
 *
 * تفرض ترتيباً لا يمكن تجاوزه:
 *   1. تهيئة محرك التخزين (SQLite/WASM ثم IndexedDB، أو البديل).
 *   2. تهيئة التسميات.
 *   3. فقط بعدها يُركَّب التطبيق.
 *
 * السبب: كل الـ hooks تقرأ من المستودع مباشرة. تركيبها قبل التهيئة
 * يعني كتابة في محرك غير موجود — إما استثناء فوري أو، أخطر، ضياع
 * تعديلات المستخدم الأولى. نعرض شاشة انتظار بدل ذلك.
 */

interface BootGateProps {
  children: ReactNode;
}

interface BootState {
  phase: 'loading' | 'ready' | 'error';
  result: BootResult | null;
  reason: string;
}

export const BootGate: React.FC<BootGateProps> = ({ children }) => {
  const [state, setState] = useState<BootState>({
    phase: 'loading',
    result: null,
    reason: '',
  });

  const start = useCallback(async () => {
    setState({ phase: 'loading', result: null, reason: '' });
    try {
      const result = await bootRepository();
      setState({ phase: 'ready', result, reason: '' });

      if (result.fallbackReason !== null) {
        console.warn('[boot] running on limited storage engine:', result.fallbackReason);
      }
    } catch (error) {
      setState({
        phase: 'error',
        result: null,
        reason: error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error),
      });
    }
  }, []);

  useEffect(() => {
    void start();
  }, [start]);

  /*
   * حفظ ما هو معلّق قبل الإغلاق.
   *
   * pagehide هو الحدث الموثوق على iOS عند الانتقال للخلفية؛
   * visibilitychange غايته الخروج من التبويب. نحفظ في الحالتين لأن
   * صون البيانات المالية ليست موضوع تفاوض.
   */
  useEffect(() => {
    if (state.phase !== 'ready') return undefined;

    const flush = (): void => {
      void flushRepository();
    };

    window.addEventListener('pagehide', flush);
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [state.phase]);

  const continueLimited = useCallback(async () => {
    /*
     * الخيار الوحيد الذي نعرضه عند الفشل: المتابعة على المحرك المحدود.
     * لا نُخفي الفشل ولا نُسطّح البيانات — نُبلغ المستخدم بما سيتأثر
     * (شاشة التنبيه فوق التطبيق) ونتركه يقرّر.
     */
    setState({ phase: 'loading', result: null, reason: '' });
    try {
      const result = await bootRepository({ forceLocal: true });
      setState({ phase: 'ready', result, reason: '' });
    } catch (error) {
      setState({
        phase: 'error',
        result: null,
        reason: error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error),
      });
    }
  }, []);

  return (
    <LabelsProvider readyKey={state.result}>
      <EngineProvider
        value={{
          kind: state.result?.kind ?? 'sqlite',
          fallbackReason: state.result?.fallbackReason ?? null,
          seeded: state.result?.seeded ?? null,
        }}
      >
        {state.phase === 'loading' && <BootScreen />}

        {state.phase === 'error' && (
          <BootErrorScreen
            reason={state.reason}
            onRetry={() => void start()}
            onContinueLimited={() => void continueLimited()}
          />
        )}

        {state.phase === 'ready' && state.result !== null && (
          <ErrorBoundary>{children}</ErrorBoundary>
        )}
      </EngineProvider>
    </LabelsProvider>
  );
};
