import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gis: {
          app: '#F8FAFC',
          sidebar: '#FFFFFF',
          surface: '#F1F5F9',
          elevated: '#E2E8F0',
          border: '#CBD5E1',
          text: {
            primary: '#0F172A',
            secondary: '#475569',
            muted: '#64748B',
          },
          accent: '#0284C7', // crisp precision cyan/blue
          success: '#16A34A', // clear green
          warning: '#D97706', // amber
          danger: '#DC2626', // emergency red
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
