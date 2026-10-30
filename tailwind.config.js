/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        desert: {
          50: '#fbf8f3',
          100: '#f5efe3',
          200: '#ebdcc5',
          300: '#dec2a1',
          400: '#cfa27b',
          500: '#bd8458',
          600: '#a66b44',
          700: '#875138',
          800: '#6f4332',
          900: '#5c382c',
        }
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
