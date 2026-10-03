import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { BootGate } from './context/BootGate';
import './index.css';
/*
 * تصميم واجهة الإعدادات ملف CSS مستقل مكتوب يدوياً (src/styles).
 * استيراد منفصل لا @import داخل index.css: Tailwind يوسّع index.css
 * أولاً، و@import بعده تحذير يبتلع الملف بصمت.
 */
import './styles/settings-panel.css';

/*
 * تسجيل Service Worker لتفعيل PWA (التثبيت على الهاتف والعمل دون إنترنت).
 * مقصود أنه لا يعطّل التشغيل: أي فشل في التسجيل يتجاهله بصمت، لأن التطبيق
 * يعتمد على IndexedDB/WASM محلياً ولا يشترط وجود SW ليعمل.
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* لا شيء: التطبيق يعمل بدونه */
    });
  });
}

/*
 * ترتيب التركيب مقصود: حاجز الأخطاء في الخارج لأنه يجب أن يلتقط حتى
 * فشل الإقلاع نفسه (فشل تحميل WASM أو IndexedDB استثناء متزامن أو
 * وعد مرفوض أثناء الإقلاع، وكلاهما يقع قبل اكتمال البوابة).
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BootGate>
      <App />
    </BootGate>
  </StrictMode>
);
