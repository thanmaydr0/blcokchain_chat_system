/**
 * DuoGraph Design System
 * 
 * Privacy-focused dark theme with encryption indicators.
 */

// ============================================================================
// Colors
// ============================================================================

export const colors = {
    // Primary - Deep purple (encryption)
    primary: {
        50: '#FAF5FF',
        100: '#F3E8FF',
        200: '#E9D5FF',
        300: '#D8B4FE',
        400: '#C084FC',
        500: '#A855F7',
        600: '#9333EA',
        700: '#7E22CE',
        800: '#6B21A8',
        900: '#581C87',
        DEFAULT: '#6B46C1',
    },

    // Secondary - Electric blue (blockchain)
    secondary: {
        50: '#EFF6FF',
        100: '#DBEAFE',
        200: '#BFDBFE',
        300: '#93C5FD',
        400: '#60A5FA',
        500: '#3B82F6',
        600: '#2563EB',
        700: '#1D4ED8',
        800: '#1E40AF',
        900: '#1E3A8A',
        DEFAULT: '#3B82F6',
    },

    // Status colors
    success: {
        light: '#34D399',
        DEFAULT: '#10B981',
        dark: '#059669',
    },
    warning: {
        light: '#FBBF24',
        DEFAULT: '#F59E0B',
        dark: '#D97706',
    },
    danger: {
        light: '#F87171',
        DEFAULT: '#EF4444',
        dark: '#DC2626',
    },

    // Backgrounds
    background: {
        primary: '#0F172A',      // Near black
        secondary: '#1E293B',    // Dark gray
        tertiary: '#334155',     // Medium gray
        elevated: '#475569',     // Elevated surfaces
    },

    // Text
    text: {
        primary: '#F8FAFC',
        secondary: '#CBD5E1',
        tertiary: '#94A3B8',
        muted: '#64748B',
    },

    // Borders
    border: {
        subtle: '#334155',
        DEFAULT: '#475569',
        strong: '#64748B',
    },
} as const;

// ============================================================================
// Typography
// ============================================================================

export const typography = {
    fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
    },
    fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
    },
    fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
    },
} as const;

// ============================================================================
// Spacing
// ============================================================================

export const spacing = {
    px: '1px',
    0: '0',
    0.5: '0.125rem',
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    10: '2.5rem',
    12: '3rem',
    16: '4rem',
    20: '5rem',
    24: '6rem',
} as const;

// ============================================================================
// Border Radius
// ============================================================================

export const borderRadius = {
    none: '0',
    sm: '0.25rem',
    DEFAULT: '0.5rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.5rem',
    full: '9999px',
} as const;

// ============================================================================
// Shadows
// ============================================================================

export const shadows = {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    glow: {
        primary: '0 0 20px rgba(107, 70, 193, 0.4)',
        secondary: '0 0 20px rgba(59, 130, 246, 0.4)',
        success: '0 0 20px rgba(16, 185, 129, 0.4)',
        danger: '0 0 20px rgba(239, 68, 68, 0.4)',
    },
} as const;

// ============================================================================
// Animation
// ============================================================================

export const animation = {
    duration: {
        fast: 150,
        normal: 300,
        slow: 500,
    },
    easing: {
        default: [0.4, 0, 0.2, 1],
        in: [0.4, 0, 1, 1],
        out: [0, 0, 0.2, 1],
        inOut: [0.4, 0, 0.2, 1],
        spring: { type: 'spring', stiffness: 300, damping: 30 },
    },
} as const;

// ============================================================================
// Privacy Status Colors
// ============================================================================

export const privacyStatus = {
    secure: {
        color: colors.success.DEFAULT,
        bg: 'rgba(16, 185, 129, 0.1)',
        border: 'rgba(16, 185, 129, 0.3)',
        glow: shadows.glow.success,
        label: 'End-to-End Encrypted',
    },
    syncing: {
        color: colors.warning.DEFAULT,
        bg: 'rgba(245, 158, 11, 0.1)',
        border: 'rgba(245, 158, 11, 0.3)',
        glow: '0 0 20px rgba(245, 158, 11, 0.4)',
        label: 'Syncing...',
    },
    alert: {
        color: colors.danger.DEFAULT,
        bg: 'rgba(239, 68, 68, 0.1)',
        border: 'rgba(239, 68, 68, 0.3)',
        glow: shadows.glow.danger,
        label: 'Security Alert',
    },
    blockchain: {
        color: colors.secondary.DEFAULT,
        bg: 'rgba(59, 130, 246, 0.1)',
        border: 'rgba(59, 130, 246, 0.3)',
        glow: shadows.glow.secondary,
        label: 'Blockchain Anchored',
    },
} as const;

// ============================================================================
// Breakpoints
// ============================================================================

export const breakpoints = {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
} as const;

// ============================================================================
// Z-Index
// ============================================================================

export const zIndex = {
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
    toast: 1080,
} as const;

// ============================================================================
// Type Exports
// ============================================================================

export type PrivacyStatusType = keyof typeof privacyStatus;
export type ColorShade = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
