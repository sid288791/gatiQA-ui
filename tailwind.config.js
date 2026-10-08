/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9eaff',
          500: '#2f7ef7',
          600: '#1f63d8',
          700: '#1a4fb0',
        },
      },
    },
  },
  plugins: [],
};
