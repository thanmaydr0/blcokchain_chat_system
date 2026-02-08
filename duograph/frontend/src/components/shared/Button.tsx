/**
 * Button Component
 * 
 * Accessible button with multiple variants.
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

// ============================================================================
// Types
// ============================================================================

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    isLoading?: boolean;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
    children: ReactNode;
    fullWidth?: boolean;
}

// ============================================================================
// Styles
// ============================================================================

const variantStyles: Record<ButtonVariant, string> = {
    primary: `
        bg-gradient-to-r from-purple-600 to-purple-700
        hover:from-purple-500 hover:to-purple-600
        text-white shadow-lg shadow-purple-900/30
        border border-purple-500/30
    `,
    secondary: `
        bg-gradient-to-r from-blue-600 to-blue-700
        hover:from-blue-500 hover:to-blue-600
        text-white shadow-lg shadow-blue-900/30
        border border-blue-500/30
    `,
    ghost: `
        bg-transparent hover:bg-slate-700/50
        text-slate-300 hover:text-white
        border border-slate-600/50 hover:border-slate-500
    `,
    danger: `
        bg-gradient-to-r from-red-600 to-red-700
        hover:from-red-500 hover:to-red-600
        text-white shadow-lg shadow-red-900/30
        border border-red-500/30
    `,
    success: `
        bg-gradient-to-r from-emerald-600 to-emerald-700
        hover:from-emerald-500 hover:to-emerald-600
        text-white shadow-lg shadow-emerald-900/30
        border border-emerald-500/30
    `,
};

const sizeStyles: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-base gap-2',
    lg: 'px-6 py-3 text-lg gap-2.5',
};

// ============================================================================
// Component
// ============================================================================

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            variant = 'primary',
            size = 'md',
            isLoading = false,
            leftIcon,
            rightIcon,
            children,
            fullWidth = false,
            className = '',
            disabled,
            ...props
        },
        ref
    ) => {
        const isDisabled = disabled || isLoading;

        return (
            <motion.button
                ref={ref}
                whileHover={!isDisabled ? { scale: 1.02 } : undefined}
                whileTap={!isDisabled ? { scale: 0.98 } : undefined}
                className={`
                    inline-flex items-center justify-center
                    font-medium rounded-xl
                    transition-all duration-200
                    focus:outline-none focus:ring-2 focus:ring-offset-2
                    focus:ring-offset-slate-900 focus:ring-purple-500
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${variantStyles[variant]}
                    ${sizeStyles[size]}
                    ${fullWidth ? 'w-full' : ''}
                    ${className}
                `}
                disabled={isDisabled}
                {...(props as HTMLMotionProps<"button">)}
            >
                {isLoading ? (
                    <LoadingSpinner size={size} />
                ) : (
                    <>
                        {leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
                        {children}
                        {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
                    </>
                )}
            </motion.button>
        );
    }
);

Button.displayName = 'Button';

// ============================================================================
// Loading Spinner
// ============================================================================

const LoadingSpinner = ({ size }: { size: ButtonSize }) => {
    const sizeMap = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-6 h-6' };

    return (
        <motion.svg
            className={`animate-spin ${sizeMap[size]}`}
            fill="none"
            viewBox="0 0 24 24"
        >
            <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
            />
            <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
        </motion.svg>
    );
};

// ============================================================================
// Icon Button
// ============================================================================

export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'leftIcon' | 'rightIcon'> {
    icon: ReactNode;
    'aria-label': string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
    ({ icon, size = 'md', className = '', ...props }, ref) => {
        const sizeStyles: Record<ButtonSize, string> = {
            sm: 'p-1.5',
            md: 'p-2',
            lg: 'p-3',
        };

        return (
            <Button
                ref={ref}
                size={size}
                className={`${sizeStyles[size]} !rounded-full ${className}`}
                {...props}
            >
                {icon}
            </Button>
        );
    }
);

IconButton.displayName = 'IconButton';
