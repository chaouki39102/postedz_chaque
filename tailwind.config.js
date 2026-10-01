/** @type {import('tailwindcss').Config} */
export default {
  // الوضع الداكن عبر class على <html> (يتحكم به useDarkMode)
  darkMode: 'class',
  content: [
    // index.html موجود في جذر المشروع وليس في public
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        accent: 'var(--color-accent)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
        info: 'var(--color-info)',
      },
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
