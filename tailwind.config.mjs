/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class', // Explicitly set dark mode to use the 'dark' class
  theme: {
    screens: {
      'xs': '375px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        // Light mode colors
        'sketch-bg': '#fbf4e8', // Match our --bg-light variable
        'sketch-text': '#111111', // Match our --sketch-text variable
        'sketch-accent-light': '#a0c4c0', // Muted teal/aqua
        'sketch-accent-dark': '#6b8e8a', // Deeper desaturated teal
        'sketch-border': '#dcdcdc', // Soft grey
        
        // Dark mode specific colors
        'dark-bg': '#0b0b12', // Match our --bg-dark variable
        'dark-text-primary': '#f0f0ff', // Match our --text-primary in dark mode
        'dark-text-secondary': '#c0c0e6', // Match our --text-secondary in dark mode
        'dark-accent': '#6080ff', // Blue accent for dark mode
        'dark-border': '#333355', // Subtle border for dark mode
      },
      fontFamily: {
        'ubuntu': ['Ubuntu', 'sans-serif'],
      },
      backgroundColor: {
        // Add CSS variable references
        'theme-light': 'var(--bg-light)',
        'theme-dark': 'var(--bg-dark)',
      },
      textColor: {
        // Add CSS variable references
        'theme-primary': 'var(--text-primary)',
        'theme-secondary': 'var(--text-secondary)',
      },
      // We can add fonts, animations, etc. here later
    },
  },
  plugins: [],
} 