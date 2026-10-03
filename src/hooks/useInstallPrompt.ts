import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEYS, loadPreference, savePreference } from '../utils/storage';

/**
 * دعم التثبيت كتطبيق (PWA).
 *
 * المتصفح لا يعرض أي واجهة تثبيت من تلقاء نفسه: يجب التقاط حدث
 * `beforeinstallprompt` (أندروم/كروم/إيدج) والاحتفاظ به في مرجع، لأن
 * الحدث يحدث مرة واحدة ولا يمكن استدعاؤه لاحقاً. لذلك نعرض الرسالة
 * عند وقوعه ولا نخزّنه في حالة دائمة.
 *
 * سفاري على iOS لا يدعم هذا الحدث إطلاقاً. لاكتشافه نستعمل فحصاً
 * مستقلاً: مستخدم غير مثبّت + سفاري + iOS/iPadOS. في هذه الحالة نعرض
 * تعليمات "زر المشاركة" بدل زر تثبيت.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Platform = 'native' | 'ios' | 'unsupported';

const isStandalone = (): boolean =>
  typeof window !== 'undefined'
  && (
    window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as { standalone?: boolean }).standalone === true
  );

const isIos = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // iPadOS 13+ يعرّف نفسه ك Macintosh، فنقرأ اللمس مع حد أقصى للعرض.
  const iPadOs = /Macintosh/.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/.test(ua) || iPadOs;
};

const isSafari = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);
};

export const useInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [platform, setPlatform] = useState<Platform>('unsupported');

  useEffect(() => {
    // التطبيق مثبّت بالفعل: لا رسالة.
    if (isStandalone()) return;

    const dismissed = loadPreference(STORAGE_KEYS.pwaDismissed);
    if (dismissed === '1') return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setPlatform('native');
      setIsVisible(true);
    };

    const onInstalled = () => {
      setIsVisible(false);
      setDeferredPrompt(null);
      savePreference(STORAGE_KEYS.pwaDismissed, '1');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    // iOS: لا حدث، نكتشفه بأنفسنا بعد اكتمال تحميل الصفحة.
    if (isIos() && isSafari()) {
      setPlatform('ios');
      const timer = window.setTimeout(() => setIsVisible(true), 1200);
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
        window.removeEventListener('appinstalled', onInstalled);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsVisible(false);
      savePreference(STORAGE_KEYS.pwaDismissed, '1');
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    setIsVisible(false);
    savePreference(STORAGE_KEYS.pwaDismissed, '1');
  }, []);

  return { isVisible, platform, install, dismiss };
};