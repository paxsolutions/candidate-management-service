/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          100: '#1a1a1a',
          200: '#2d2d2d',
          300: '#404040',
          400: '#4d4d4d',
          500: '#5c5c5c',
          600: '#6b6b6b',
          700: '#7a7a7a',
        },
      },
    },
  },
  plugins: [],
};

export default config;
