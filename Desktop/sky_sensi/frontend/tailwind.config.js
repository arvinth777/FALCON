/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Aviation flight categories
        vfr: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d'
        },
        mvfr: {
          50: '#fefce8',
          100: '#fef9c3',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207'
        },
        ifr: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c'
        },
        lifr: {
          50: '#faf5ff',
          100: '#f3e8ff',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7c3aed'
        },
        // Severity levels
        severity: {
          high: '#dc2626',
          medium: '#ea580c',
          low: '#16a34a'
        },
        // Aviation UI colors
        cockpit: {
          bg: '#0f172a',
          panel: '#1e293b',
          text: '#f8fafc',
          accent: '#38bdf8'
        }
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'monospace'],
        'aviation': ['Inter', 'system-ui', 'sans-serif']
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem'
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-gentle': 'bounce 2s infinite'
      },
      backdropBlur: {
        xs: '2px'
      }
    },
  },
  plugins: [],
}