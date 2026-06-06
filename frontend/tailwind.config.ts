import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ella: {
          green:  '#22c55e',
          blue:   '#3b82f6',
          orange: '#f97316',
          red:    '#ef4444',
          gray:   '#6b7280',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
