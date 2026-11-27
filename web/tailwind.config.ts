import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // REPOSOUL dark palette from theme-tokens.json
        background: '#090909',
        surface: '#111111',
        elevated: '#191919',
        border: '#222222',
        // Accent — ember / phoenix
        primary: '#F97316',
        'primary-hover': '#EA6C10',
        secondary: '#FB923C',
        tertiary: '#FCD34D',
        // Text
        'text-primary': '#F5F5F5',
        'text-secondary': '#A1A1AA',
        'text-muted': '#52525B',
        // Status
        success: '#22C55E',
        warning: '#EAB308',
        error: '#EF4444',
        // Score colours
        'score-high': '#22C55E',
        'score-mid': '#EAB308',
        'score-low': '#EF4444',
      },
      fontFamily: {
        sans: ['system-ui', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'Cascadia Code', 'Fira Code', 'Menlo', 'Consolas', 'monospace'],
      },
      backgroundImage: {
        'phoenix-rise': 'linear-gradient(to top right, #F97316 0%, #FB923C 60%, #FCD34D 100%)',
        'ember-glow': 'radial-gradient(ellipse at bottom, rgba(249,115,22,0.3) 0%, transparent 70%)',
        'card-glow': 'radial-gradient(ellipse at top left, rgba(249,115,22,0.07) 0%, transparent 60%)',
      },
      borderRadius: {
        DEFAULT: '8px',
        sm: '4px',
        lg: '12px',
        pill: '999px',
      },
      boxShadow: {
        glow: '0 0 20px rgba(249, 115, 22, 0.15)',
        'glow-sm': '0 0 8px rgba(249, 115, 22, 0.1)',
        card: '0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.6)',
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-glow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
