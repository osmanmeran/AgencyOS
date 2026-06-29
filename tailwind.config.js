/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      borderRadius: {
        none: '0',
        'extra-small': 'var(--m3-shape-extra-small)',
        small: 'var(--m3-shape-small)',
        DEFAULT: 'var(--m3-shape-medium)',
        medium: 'var(--m3-shape-medium)',
        large: 'var(--m3-shape-large)',
        'extra-large': 'var(--m3-shape-extra-large)',
        full: 'var(--m3-shape-full)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))'
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))'
        },

        /* ── M3 Color Aliases ───────────────────────────── */
        'm3-primary': {
          DEFAULT: 'hsl(var(--m3-primary))',
          container: 'hsl(var(--m3-primary-container))',
          foreground: 'hsl(var(--m3-on-primary))',
          'container-foreground': 'hsl(var(--m3-on-primary-container))',
        },
        'm3-secondary': {
          DEFAULT: 'hsl(var(--m3-secondary))',
          container: 'hsl(var(--m3-secondary-container))',
          foreground: 'hsl(var(--m3-on-secondary))',
          'container-foreground': 'hsl(var(--m3-on-secondary-container))',
        },
        'm3-tertiary': {
          DEFAULT: 'hsl(var(--m3-tertiary))',
          container: 'hsl(var(--m3-tertiary-container))',
          foreground: 'hsl(var(--m3-on-tertiary))',
          'container-foreground': 'hsl(var(--m3-on-tertiary-container))',
        },
        'm3-error': {
          DEFAULT: 'hsl(var(--m3-error))',
          container: 'hsl(var(--m3-error-container))',
          foreground: 'hsl(var(--m3-on-error))',
          'container-foreground': 'hsl(var(--m3-on-error-container))',
        },
        'm3-surface': {
          DEFAULT: 'hsl(var(--m3-surface))',
          variant: 'hsl(var(--m3-surface-variant))',
          foreground: 'hsl(var(--m3-on-surface))',
          'variant-foreground': 'hsl(var(--m3-on-surface-variant))',
          dim: 'hsl(var(--m3-surface-dim))',
          bright: 'hsl(var(--m3-surface-bright))',
        },
        'm3-outline': {
          DEFAULT: 'hsl(var(--m3-outline))',
          variant: 'hsl(var(--m3-outline-variant))',
        },
        'm3-inverse': {
          surface: 'hsl(var(--m3-inverse-surface))',
          'on-surface': 'hsl(var(--m3-inverse-on-surface))',
          primary: 'hsl(var(--m3-inverse-primary))',
        },
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        },
        'm3-fade-in': {
          from: { opacity: 0, transform: 'scale(0.95)' },
          to: { opacity: 1, transform: 'scale(1)' }
        },
        'm3-fade-out': {
          from: { opacity: 1, transform: 'scale(1)' },
          to: { opacity: 0, transform: 'scale(0.95)' }
        },
        'm3-slide-in-up': {
          from: { opacity: 0, transform: 'translateY(8px)' },
          to: { opacity: 1, transform: 'translateY(0)' }
        },
        'm3-slide-in-down': {
          from: { opacity: 0, transform: 'translateY(-8px)' },
          to: { opacity: 1, transform: 'translateY(0)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'm3-fade-in': 'm3-fade-in 200ms cubic-bezier(0.2, 0, 0, 1)',
        'm3-fade-out': 'm3-fade-out 150ms cubic-bezier(0.2, 0, 0, 1)',
        'm3-slide-in-up': 'm3-slide-in-up 300ms cubic-bezier(0.2, 0, 0, 1)',
        'm3-slide-in-down': 'm3-slide-in-down 200ms cubic-bezier(0.2, 0, 0, 1)',
        shimmer: 'shimmer 2s ease-in-out infinite',
      },
    }
  },
  plugins: [require("tailwindcss-animate")],
}
