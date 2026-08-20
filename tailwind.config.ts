import type { Config } from 'tailwindcss'

/**
 * Sunrise Playground design tokens — canonical spec in docs/design/DESIGN.md.
 * Hard rules: no black/gray ink (use ink/ink-soft), subjects stay on the
 * coral/blue colorblind-safe axis, success stays teal, gold is decoration-only.
 */
const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: { top: '#FFF8E7', mid: '#FFEFD0', bottom: '#FFE6BD' },
        hill: { near: '#9FD8AB', far: '#C0E7C7' },
        ink: { DEFAULT: '#6B4423', soft: '#B0813F' },
        chinese: { DEFAULT: '#F4576B', light: '#FF7A82', edge: '#C13A52' },
        math: { DEFAULT: '#3D7DE4', light: '#57A5F5', edge: '#2B5AB0' },
        success: { DEFAULT: '#1FA88C', bg: '#E2F7EE', edge: '#147663' },
        gold: { DEFAULT: '#FFCF57', deep: '#F5B93F', edge: '#D9A32C' },
        plum: { DEFAULT: '#9A7BE8', edge: '#7A5BD0' },
        'card-edge': '#F0D8A8',
        'chip-track': '#F5E9CC',
      },
      fontFamily: {
        display: ['var(--font-baloo)', 'ui-rounded', 'system-ui', 'sans-serif'],
        hanzi: ['var(--font-kuaile)', 'var(--font-baloo)', 'sans-serif'],
        emoji: ['Apple Color Emoji', 'var(--font-emoji)', 'Segoe UI Emoji', 'sans-serif'],
        // legacy alias so unmigrated screens keep rendering during the restyle
        nunito: ['var(--font-baloo)', 'ui-rounded', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        // toy-physics press edges — pair with active:translate-y-[5px] active:shadow-press-down
        'press-chinese': '0 7px 0 #C13A52',
        'press-math': '0 7px 0 #2B5AB0',
        'press-gold': '0 6px 0 #D9A32C',
        'press-plum': '0 6px 0 #7A5BD0',
        'press-success': '0 6px 0 #147663',
        'press-card': '0 6px 0 #F0D8A8',
        'press-chip': '0 4px 0 #F0D8A8',
        'press-down': '0 2px 0 rgba(0,0,0,0)',
        'tile-chinese': '0 6px 0 #F4576B',
        'tile-math': '0 6px 0 #3D7DE4',
        'tile-gold': '0 6px 0 #F5B93F',
        'tile-plum': '0 6px 0 #9A7BE8',
      },
      keyframes: {
        bob: {
          '0%, 100%': { transform: 'translateY(0) rotate(-2deg)' },
          '50%': { transform: 'translateY(-7px) rotate(2deg)' },
        },
        sway: {
          '0%, 100%': { transform: 'rotate(-6deg)' },
          '50%': { transform: 'rotate(6deg)' },
        },
        twinkle: {
          '0%, 100%': { opacity: '0.9', transform: 'scale(1)' },
          '50%': { opacity: '0.35', transform: 'scale(0.7)' },
        },
      },
      animation: {
        bob: 'bob 3.2s ease-in-out infinite',
        sway: 'sway 4s ease-in-out infinite',
        twinkle: 'twinkle 2.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
