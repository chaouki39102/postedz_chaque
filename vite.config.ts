import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  /*
   * sql.js ملف واحد يضم فرع Node وفرع المتصفح. في CommonJS يُحوّل
   * Vite استدعاءات require إلى استيرادات في أعلى الملف، فيظهر تحذير
   * لكل وحدة	node Although فرع Node لا يُنفَّذ في المتصفح أصلاً.
   *
   * نستبدلها بوحدة فارغة بدل `external`: الإعلان كخارجية يجعل Vite
   * يترك الاستيراد المجرّد في الحزمة، فيفشل التحميل في المتصفح.
   */
  resolve: {
    alias: {
      fs: fileURLToPath(new URL('./src/shims/emptyModule.ts', import.meta.url)),
      path: fileURLToPath(new URL('./src/shims/emptyModule.ts', import.meta.url)),
      crypto: fileURLToPath(new URL('./src/shims/emptyModule.ts', import.meta.url)),
    },
  },
});
