/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:          '#0A0A0F',
        bgCard:      '#13131A',
        bgElevated:  '#1C1C27',
        accent:      '#F5A623',
        green:       '#22C55E',
        red:         '#EF4444',
        blue:        '#3B82F6',
        yellow:      '#EAB308',
        purple:      '#A855F7',
        text:        '#F0F0F8',
        textMuted:   '#8888AA',
        textDim:     '#55556A',
        border:      'rgba(255,255,255,0.07)',
      },
      fontFamily: {
        display: ["'Syne'",   'sans-serif'],
        body:    ["'DM Sans'", 'sans-serif'],
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },
    },
  },
  plugins: [],
}
