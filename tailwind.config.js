/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cosmo: {
          950: '#07090e',
          900: '#0c1017',
          850: '#111722',
          800: '#171f2e',
          700: '#232e42',
          600: '#344460',
          500: '#485d82',
          cyan: '#00f2fe',
          purple: '#7928ca',
          accent: '#4facfe',
          emerald: '#10b981',
          rose: '#f43f5e',
          amber: '#f59e0b',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'monospace'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'glow-cyan': '0 0 20px -5px rgba(0, 242, 254, 0.3)',
        'glow-purple': '0 0 20px -5px rgba(121, 40, 202, 0.3)',
        'glow-blue': '0 0 20px -5px rgba(79, 172, 254, 0.3)',
      }
    },
  },
  plugins: [],
}
