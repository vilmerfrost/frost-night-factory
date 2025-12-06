// =============================================================================
// DESIGN SYSTEM - The Single Source of Truth for UI
// =============================================================================
// This is "The Truth" for all UI. Agents MUST use ONLY these values.
// Inspired by Linear, Vercel, Raycast, and Lovable.ai
export const DESIGN_SYSTEM = {
    // =============================================================================
    // COLORS - Premium SaaS Palette
    // =============================================================================
    colors: {
        // Primary Brand Colors
        primary: {
            50: '#f0f9ff',
            100: '#e0f2fe',
            200: '#bae6fd',
            300: '#7dd3fc',
            400: '#38bdf8',
            500: '#0ea5e9', // Main brand color
            600: '#0284c7',
            700: '#0369a1',
            800: '#075985',
            900: '#0c4a6e',
            950: '#082f49',
        },
        // Neutral Grays (for text, backgrounds)
        neutral: {
            50: '#fafafa',
            100: '#f5f5f5',
            200: '#e5e5e5',
            300: '#d4d4d4',
            400: '#a3a3a3',
            500: '#737373',
            600: '#525252',
            700: '#404040',
            800: '#262626',
            900: '#171717',
            950: '#0a0a0a',
        },
        // Semantic Colors
        success: {
            50: '#f0fdf4',
            500: '#22c55e',
            600: '#16a34a',
            700: '#15803d',
        },
        warning: {
            50: '#fffbeb',
            500: '#f59e0b',
            600: '#d97706',
            700: '#b45309',
        },
        error: {
            50: '#fef2f2',
            500: '#ef4444',
            600: '#dc2626',
            700: '#b91c1c',
        },
        // Background Colors
        background: {
            default: '#ffffff',
            secondary: '#fafafa',
            tertiary: '#f5f5f5',
            dark: '#0a0a0a',
            darkSecondary: '#171717',
        },
        // Border Colors
        border: {
            default: '#e5e5e5',
            light: '#f5f5f5',
            dark: '#262626',
        },
    },
    // =============================================================================
    // TYPOGRAPHY
    // =============================================================================
    typography: {
        fontFamily: {
            sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
            mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
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
            '5xl': ['3rem', { lineHeight: '1' }],
        },
        fontWeight: {
            normal: 400,
            medium: 500,
            semibold: 600,
            bold: 700,
        },
    },
    // =============================================================================
    // SPACING - Consistent Rhythm
    // =============================================================================
    spacing: {
        xs: '0.25rem', // 4px
        sm: '0.5rem', // 8px
        md: '1rem', // 16px
        lg: '1.5rem', // 24px
        xl: '2rem', // 32px
        '2xl': '3rem', // 48px
        '3xl': '4rem', // 64px
        '4xl': '6rem', // 96px
    },
    // =============================================================================
    // BORDER RADIUS
    // =============================================================================
    borderRadius: {
        none: '0',
        sm: '0.25rem', // 4px
        md: '0.5rem', // 8px
        lg: '0.75rem', // 12px
        xl: '1rem', // 16px
        '2xl': '1.5rem', // 24px
        full: '9999px',
    },
    // =============================================================================
    // SHADOWS - Depth & Elevation
    // =============================================================================
    shadows: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
    },
    // =============================================================================
    // TRANSITIONS & ANIMATIONS
    // =============================================================================
    transitions: {
        duration: {
            fast: '150ms',
            normal: '200ms',
            slow: '300ms',
        },
        easing: {
            default: 'cubic-bezier(0.4, 0, 0.2, 1)',
            in: 'cubic-bezier(0.4, 0, 1, 1)',
            out: 'cubic-bezier(0, 0, 0.2, 1)',
            inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
        },
        // Framer Motion presets
        spring: {
            type: 'spring',
            stiffness: 300,
            damping: 30,
        },
        smooth: {
            type: 'tween',
            duration: 0.2,
            ease: [0.4, 0, 0.2, 1],
        },
    },
    // =============================================================================
    // COMPONENT SPECIFICATIONS
    // =============================================================================
    components: {
        button: {
            height: {
                sm: '2rem', // 32px
                md: '2.5rem', // 40px
                lg: '3rem', // 48px
            },
            padding: {
                sm: '0.5rem 1rem',
                md: '0.75rem 1.5rem',
                lg: '1rem 2rem',
            },
            borderRadius: '0.5rem', // md
            fontWeight: 500,
            transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        },
        input: {
            height: {
                sm: '2rem',
                md: '2.5rem',
                lg: '3rem',
            },
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            borderWidth: '1px',
            borderColor: '#e5e5e5',
            focusBorderColor: '#0ea5e9',
            transition: 'border-color 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        },
        card: {
            padding: {
                sm: '1rem',
                md: '1.5rem',
                lg: '2rem',
            },
            borderRadius: '0.75rem', // lg
            backgroundColor: '#ffffff',
            borderWidth: '1px',
            borderColor: '#e5e5e5',
            shadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        },
    },
    // =============================================================================
    // BREAKPOINTS (for responsive design)
    // =============================================================================
    breakpoints: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
    },
    // =============================================================================
    // Z-INDEX SCALE
    // =============================================================================
    zIndex: {
        dropdown: 1000,
        sticky: 1020,
        fixed: 1030,
        modalBackdrop: 1040,
        modal: 1050,
        popover: 1060,
        tooltip: 1070,
    },
};
// =============================================================================
// TAILWIND CLASS MAPPINGS
// =============================================================================
// Helper to convert design system values to Tailwind classes
export const DESIGN_TO_TAILWIND = {
    // Colors
    primary: 'bg-primary-500 text-white hover:bg-primary-600',
    secondary: 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200',
    success: 'bg-success-500 text-white',
    warning: 'bg-warning-500 text-white',
    error: 'bg-error-500 text-white',
    // Spacing (for padding/margin)
    spacing: {
        xs: 'p-1',
        sm: 'p-2',
        md: 'p-4',
        lg: 'p-6',
        xl: 'p-8',
    },
    // Shadows
    shadow: {
        sm: 'shadow-sm',
        md: 'shadow-md',
        lg: 'shadow-lg',
        xl: 'shadow-xl',
        '2xl': 'shadow-2xl',
    },
    // Border Radius
    radius: {
        sm: 'rounded-sm',
        md: 'rounded-md',
        lg: 'rounded-lg',
        xl: 'rounded-xl',
        '2xl': 'rounded-2xl',
        full: 'rounded-full',
    },
};
// =============================================================================
// USAGE EXAMPLES FOR AI AGENTS
// =============================================================================
export const DESIGN_SYSTEM_EXAMPLES = `
EXAMPLES OF CORRECT USAGE:

1. Button:
   className="bg-primary-500 text-white px-6 py-3 rounded-md shadow-md hover:bg-primary-600 transition-colors"

2. Card:
   className="bg-white p-6 rounded-lg shadow-md border border-neutral-200"

3. Input:
   className="w-full px-4 py-2 border border-neutral-300 rounded-md focus:border-primary-500 focus:ring-2 focus:ring-primary-200"

4. Text:
   className="text-neutral-900 text-base font-medium"

5. Container:
   className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"

CRITICAL RULES:
- NEVER use arbitrary colors like bg-[#ff0000]
- ALWAYS use colors from DESIGN_SYSTEM.colors
- ALWAYS use spacing from DESIGN_SYSTEM.spacing
- ALWAYS use shadows from DESIGN_SYSTEM.shadows
- ALWAYS use borderRadius from DESIGN_SYSTEM.borderRadius
`;
