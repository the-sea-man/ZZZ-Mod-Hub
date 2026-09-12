/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'rgba(var(--bg-background), <alpha-value>)',
        surface: 'rgba(var(--bg-surface), <alpha-value>)',
        primary: 'rgba(var(--color-primary), <alpha-value>)',
        accent: 'rgba(var(--color-accent), <alpha-value>)',
        textMain: 'rgba(var(--color-text-main), <alpha-value>)',
        textMuted: 'rgba(var(--color-text-muted), <alpha-value>)',
      }
    },
  },
  plugins: [],
}
