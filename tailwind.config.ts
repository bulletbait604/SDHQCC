import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Stream Dreams Creator Corner brand colors
        sdhq: {
          cyan: {
            50: '#f0fdff',
            100: '#ccfaff',
            200: '#99f5ff',
            300: '#66ebff',
            400: '#33e1ff',
            500: '#00e5ff',
            600: '#00b8cc',
            700: '#008b99',
            800: '#005e66',
            900: '#003133',
          },
          green: {
            50: '#f0fff4',
            100: '#ccffdd',
            200: '#99ffbb',
            300: '#66ff99',
            400: '#33ff77',
            500: '#00ff00',
            600: '#00cc00',
            700: '#009900',
            800: '#006600',
            900: '#003300',
          },
          dark: {
            50: '#ffffff',
            100: '#f5f5f5',
            200: '#e0e0e0',
            300: '#cccccc',
            400: '#999999',
            500: '#666666',
            600: '#404040',
            700: '#262626',
            800: '#1a1a1a',
            900: '#000000',
          }
        },
        primary: {
          50: '#f0fdff',
          100: '#ccfaff',
          200: '#99f5ff',
          300: '#66ebff',
          400: '#33e1ff',
          500: '#00e5ff',
          600: '#00b8cc',
          700: '#008b99',
          800: '#005e66',
          900: '#003133',
        },
        secondary: {
          50: '#f0fff4',
          100: '#ccffdd',
          200: '#99ffbb',
          300: '#66ff99',
          400: '#33ff77',
          500: '#00ff00',
          600: '#00cc00',
          700: '#009900',
          800: '#006600',
          900: '#003300',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'gradient': 'gradient 3s ease infinite',
        'neon-glow': 'neonGlow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        neonGlow: {
          '0%': { boxShadow: '0 0 5px #00e5ff, 0 0 10px #00e5ff, 0 0 15px #00e5ff' },
          '50%': { boxShadow: '0 0 10px #00e5ff, 0 0 20px #00e5ff, 0 0 30px #00e5ff' },
          '100%': { boxShadow: '0 0 5px #00e5ff, 0 0 10px #00e5ff, 0 0 15px #00e5ff' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'sdhq-gradient': 'linear-gradient(135deg, #00e5ff 0%, #00ff00 100%)',
        'sdhq-gradient-reverse': 'linear-gradient(135deg, #00ff00 0%, #00e5ff 100%)',
      },
      boxShadow: {
        'neon-cyan': '0 0 5px #00e5ff, 0 0 10px #00e5ff, 0 0 15px #00e5ff',
        'neon-green': '0 0 5px #00ff00, 0 0 10px #00ff00, 0 0 15px #00ff00',
      },
    },
  },
  plugins: [],
}
export default config
