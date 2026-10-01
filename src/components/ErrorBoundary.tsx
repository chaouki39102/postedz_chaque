import React from 'react';
import { ShieldAlert, RotateCcw } from 'lucide-react';

/**
 * حاجز أخطاء على مستوى التطبيق.
 *
 * لماذا نحتاجه مع هذا المشروع تحديداً:
 * - تحميل WebAssembly قد يُحجب بسياسة CSP في بعض البيئات.
 * - IndexedDB قد يُرفض في وضع تصفّح خاص صارم.
 * - أي خطأ في طبقة البيانات كان سيترك المستخدم أمام شاشة فارغة بلا أي
 *   تفسير. هذا التطبيق يتعامل مع بيانات مالية، فصمت غير مفهوم أسوأ من
 *   رسالة خطأ صريحة.
 *
 * الملاحظة المهمة: البيانات محفوظة في قاعدة البيانات على جهاز
 * المستخدم. إعادة التحميل آمنة ولا تفقد شيئاً، وهذا ما نخبره به.
 */

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // نُسجّل في الطرفية: لا خدمة أخطاء خارجية، حتى لا تغادر أي بيانات
    console.error('[app] uncaught error', error, info.componentStack);
  }

  private readonly handleReload = (): void => {
    window.location.reload();
  };

  override render(): React.ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-gray-900 px-4">
        <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 md:p-8">
          <div className="flex items-start gap-4 mb-4">
            <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-xl flex-shrink-0">
              <ShieldAlert className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                حدث خطأ غير متوقع
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                يمكنك إعادة تحميل الصفحة. بياناتك المحفوظة في قاعدة البيانات ستبقى سليمة.
              </p>
            </div>
          </div>

          <pre className="mb-5 p-3 bg-gray-100 dark:bg-gray-900 rounded-lg text-[11px] text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-pre-wrap break-all">
            {error.message}
          </pre>

          <button
            type="button"
            onClick={this.handleReload}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            إعادة التحميل
          </button>
        </div>
      </div>
    );
  }
}
