/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#10B981',
          accent: '#F59E0B',
          bg: '#F8FAFC',
        }
      },
      fontFamily: {
        // 品牌标题使用 Noto Serif SC
        display: ['Noto Serif SC', 'serif'],
        // 品牌副标题及其他文字使用 Noto Sans SC
        sans: ['Noto Sans SC', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
