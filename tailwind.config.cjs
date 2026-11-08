/** Tailwind for the shadcn / 21st.dev components (components/ui) only: no preflight, so the rest of the site keeps
 *  its own CSS; the shadcn colour tokens are the Grafysta palette. */
module.exports = {
  content: ['./components/**/*.{ts,tsx}', './app/prace/**/*.{js,jsx,ts,tsx}'],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        foreground: '#f2f2f3',
        card: { DEFAULT: '#141417', foreground: '#f2f2f3' },
        border: '#2a2a31',
        ring: '#B19EEF',
        primary: { DEFAULT: '#5227FF', foreground: '#ffffff' },
        secondary: { DEFAULT: '#1d1d24', foreground: '#f2f2f3' },
        muted: { DEFAULT: '#1d1d24', foreground: '#9d9da6' },
        destructive: { DEFAULT: '#ff4d6d', foreground: '#ffffff' },
        // the wheel's focus ring is "blue-500" in the component: our lilac
        blue: { 500: '#B19EEF' }
      },
      ringOffsetColor: { DEFAULT: '#0a0a0a' },
      fontFamily: { sans: ['"Odibee Sans CZ"', '"Odibee Sans"', '"Arial Narrow"', 'sans-serif'] }
    }
  }
};
