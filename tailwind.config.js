/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { cairo: ['Cairo', 'sans-serif'] },
      colors: {
        primary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        /* تركواز في الوضع الداكن، بينك بناتي عند .theme-pink.dark (متغيرات في index.css) */
        teal: {
          50: 'rgb(var(--tw-teal-50, 240 253 250) / <alpha-value>)',
          100: 'rgb(var(--tw-teal-100, 204 251 241) / <alpha-value>)',
          200: 'rgb(var(--tw-teal-200, 153 246 228) / <alpha-value>)',
          300: 'rgb(var(--tw-teal-300, 94 234 212) / <alpha-value>)',
          400: 'rgb(var(--tw-teal-400, 45 212 191) / <alpha-value>)',
          500: 'rgb(var(--tw-teal-500, 20 184 166) / <alpha-value>)',
          600: 'rgb(var(--tw-teal-600, 13 148 136) / <alpha-value>)',
          700: 'rgb(var(--tw-teal-700, 15 118 110) / <alpha-value>)',
          800: 'rgb(var(--tw-teal-800, 17 94 89) / <alpha-value>)',
          900: 'rgb(var(--tw-teal-900, 19 78 74) / <alpha-value>)',
        },
        emerald: {
          50: 'rgb(var(--tw-emerald-50, 236 253 245) / <alpha-value>)',
          100: 'rgb(var(--tw-emerald-100, 209 250 229) / <alpha-value>)',
          200: 'rgb(var(--tw-emerald-200, 167 243 208) / <alpha-value>)',
          300: 'rgb(var(--tw-emerald-300, 110 231 183) / <alpha-value>)',
          400: 'rgb(var(--tw-emerald-400, 52 211 153) / <alpha-value>)',
          500: 'rgb(var(--tw-emerald-500, 16 185 129) / <alpha-value>)',
          600: 'rgb(var(--tw-emerald-600, 5 150 105) / <alpha-value>)',
          700: 'rgb(var(--tw-emerald-700, 4 120 87) / <alpha-value>)',
          800: 'rgb(var(--tw-emerald-800, 6 95 70) / <alpha-value>)',
          900: 'rgb(var(--tw-emerald-900, 6 78 59) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
}
