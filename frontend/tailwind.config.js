/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#4FD1C5',
          dark: '#38B2AC',
          light: '#81E6D9',
          50: 'rgba(79, 209, 197, 0.05)',
          100: 'rgba(79, 209, 197, 0.1)',
          200: 'rgba(79, 209, 197, 0.2)',
        },
        azure: {
          DEFAULT: '#007AFF',
          100: 'rgba(0, 122, 255, 0.1)',
        },
        bg: {
          main: '#FAFBFC',
          dark: '#0f172a',
        },
        user: {
          bubble: '#E6F6FF',
        },
        sidebar: {
          glass: 'rgba(255, 255, 255, 0.7)',
          dark: '#1e293b',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        soft: '0 10px 25px -5px rgba(0,0,0,0.04), 0 8px 10px -6px rgba(0,0,0,0.04)',
        glass: '0 8px 32px 0 rgba(31,38,135,0.07)',
      },
      animation: {
        'cursor-blink': 'blink 1s step-end infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-left': 'slideLeft 0.3s ease-out',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0 },
        },
        fadeIn: {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        slideUp: {
          from: { opacity: 0, transform: 'translateY(8px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        slideLeft: {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}
