export const colors = {
  surface: {
    0: '#09090b',
    1: '#0f0f12',
    2: '#16161a',
    3: '#1c1c21',
    4: '#232329',
  },
  border: {
    subtle: '#1e1e24',
    default: '#2a2a32',
    strong: '#3a3a44',
  },
  text: {
    primary: '#ededf0',
    secondary: '#9898a4',
    tertiary: '#5c5c68',
    inverse: '#09090b',
  },
  accent: {
    DEFAULT: '#5b8def',
    muted: '#3d5a8a',
    subtle: '#1a2744',
  },
  confidence: {
    high: '#34d399',
    medium: '#fbbf24',
    low: '#f87171',
  },
  status: {
    info: '#60a5fa',
    warning: '#fbbf24',
    critical: '#f87171',
    neutral: '#71717a',
  },
} as const

export const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  '2xl': '3rem',
  '3xl': '4rem',
} as const

export const typography = {
  fontFamily: {
    sans: "'Inter', system-ui, -apple-system, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.8125rem',
    base: '0.875rem',
    lg: '1rem',
    xl: '1.125rem',
    '2xl': '1.5rem',
    '3xl': '2rem',
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75',
  },
} as const

export const motion = {
  duration: {
    fast: '120ms',
    normal: '200ms',
    slow: '350ms',
  },
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const

export const layout = {
  sidebarWidth: '240px',
  sidebarCollapsedWidth: '64px',
  headerHeight: '48px',
  maxContentWidth: '1400px',
} as const
