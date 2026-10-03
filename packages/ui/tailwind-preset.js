/** Ink & Cotton design tokens, shared by shop / sell / deliver / admin. */
module.exports = {
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#1B1A17', soft: '#44403C', mute: '#78716C' },
        paper: { DEFAULT: '#FAF8F4', warm: '#F3EFE8', line: '#E7E1D7' },
        clay: { DEFAULT: '#A8482A', dark: '#8A3A21', tint: '#F6E9E3' },
        leaf: { DEFAULT: '#2F6B4F', tint: '#E4F0E9' },
        gold: '#B98B2E',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['"Iowan Old Style"', '"Palatino Linotype"', 'Palatino', 'Georgia', 'serif'],
      },
      maxWidth: { page: '1360px' },
      boxShadow: { card: '0 1px 2px rgba(27,26,23,.04), 0 8px 24px -12px rgba(27,26,23,.12)' },
      keyframes: {
        'slide-in': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'fade-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: { 'slide-in': 'slide-in .25s ease-out', 'fade-up': 'fade-up .3s ease-out' },
    },
  },
};
