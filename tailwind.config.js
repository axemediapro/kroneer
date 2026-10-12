/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/views/**/*.ejs",
    "./public/js/**/*.js"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#16a34a',
          600: '#15803d',
          700: '#166534',
          800: '#14532d',
          900: '#052e16',
        },
        kroneer: {
          gold: '#D4AF37',
          goldLight: '#F3E5AB',
          goldDark: '#AA820A',
          slate: '#0F172A',
          dark: '#0B0F17',
          surface: '#1E293B',
          surfaceLight: '#F8FAFC',
          cardDark: '#161F30',
          accent: '#0284C7',
          accentGlow: '#38BDF8'
        }
      },
      fontFamily: {
        sans: ['system-ui','-apple-system','Segoe UI','Roboto','Helvetica Neue','Arial','sans-serif'],
        mono: ['system-ui','-apple-system','Segoe UI','Roboto','Helvetica Neue','Arial','sans-serif'],
      }
    },
  },
  plugins: [],
}
