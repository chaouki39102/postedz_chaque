import { useCallback, useEffect, useRef, useState } from 'react';
import { getRepository } from '../data';
import { PREF_KEYS } from '../data/repository';
import { CENTERED_LAYOUT, clampLayout, type PrintLayout } from '../utils/printCheck';

/**
 * موضع الشيك على الورقة عند الطباعة.
 *
 * لا صلة له بمواضع الحقول داخل الشيك: تلك تُحفظ لكل بنك ولغة
 * (useCheckState)، وهذا تفضيل واحد للمطابعة والورقة يبقى نفسه أيّ بنك
 * كان. لذلك يقرأ من جدول التفضيلات لا من جدول المواضع.
 *
 * القراءة بعد إقلاع المحرك (BootGate ينتظره)، فقيمة الوسط تظهر للحظة
 * واحدة ثم تُستبدل بما في القاعدة إن وُجد.
 */
export interface PrintLayoutApi {
  layout: PrintLayout;
  isLoading: boolean;
  isSaved: boolean;
  /** يحفظ هامشاً واحداً (يمين أو أعلى) */
  setMargin: (axis: keyof PrintLayout, value: number) => void;
  /** يعود بالهوامش إلى التوسيط */
  reset: () => void;
}

/** مهلة قبل الكتابة: سحب المنزلق يرسل حدث input عشرات المرات */
const WRITE_DELAY_MS = 400;

/** مهلة إظهار «تم الحفظ» ثم إخفائه */
const SAVED_FLAG_MS = 1500;

/** قراءة متسامحة: قيمة تالفة في القاعدة تُترك للـ clamp لا تُسقط الإعداد */
const parseLayout = (raw: string | null): Partial<PrintLayout> | null => {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Partial<PrintLayout>) : null;
  } catch {
    return null;
  }
};

export const usePrintLayout = (): PrintLayoutApi => {
  const [layout, setLayout] = useState<PrintLayout>(CENTERED_LAYOUT);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const writeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    void getRepository()
      .getPreference(PREF_KEYS.printLayout)
      .then((raw) => {
        if (!cancelled) setLayout(clampLayout(parseLayout(raw)));
      })
      .catch((error: unknown) => console.error('[print-layout] load failed', error))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * الكتابة مؤجَّلة: تحريك المنزلق يرسل عشرات أحداث input، وكل واحد
   * كتابة في القاعدة. نكتب آخر قيمة فقط بعد سكون.
   */
  const write = useCallback((next: PrintLayout) => {
    setLayout(next);

    if (writeTimerRef.current !== null) window.clearTimeout(writeTimerRef.current);
    writeTimerRef.current = window.setTimeout(() => {
      void getRepository()
        .setPreference(PREF_KEYS.printLayout, JSON.stringify(next))
        .then(() => {
          setIsSaved(true);
          window.setTimeout(() => setIsSaved(false), SAVED_FLAG_MS);
        })
        .catch((error: unknown) => console.error('[print-layout] save failed', error));
    }, WRITE_DELAY_MS);
  }, []);

  const setMargin = useCallback<PrintLayoutApi['setMargin']>(
    (axis, value) => {
      setLayout((current) => {
        const next = clampLayout({ ...current, [axis]: value });
        write(next);
        return next;
      });
    },
    [write]
  );

  const reset = useCallback(() => {
    write(clampLayout(CENTERED_LAYOUT));
  }, [write]);

  return { layout, isLoading, isSaved, setMargin, reset };
};
