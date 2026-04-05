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
        display: ['LXGW WenKai', 'serif'],
        sans: ['LXGW WenKai', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
