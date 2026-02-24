import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#faf8f5',
        surface: '#ffffff',
        border: '#e8e4de',
        text: { DEFAULT: '#2d2319', muted: '#78695a' },
        primary: { DEFAULT: '#c05621', hover: '#9c4318', light: '#fef3ec' },
        accent: { DEFAULT: '#2b6cb0', light: '#ebf4ff' },
        success: { DEFAULT: '#2f855a', light: '#f0fff4' },
        warning: { DEFAULT: '#d69e2e', light: '#fefcbf' },
        danger: { DEFAULT: '#c53030', light: '#fff5f5' },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
export default config
