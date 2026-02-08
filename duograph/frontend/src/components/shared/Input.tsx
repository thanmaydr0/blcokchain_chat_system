/**
 * Input Components
 * 
 * Accessible form inputs with validation states.
 */

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { motion } from 'framer-motion';

// ============================================================================
// Types
// ============================================================================

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    hint?: string;
    leftElement?: React.ReactNode;
    rightElement?: React.ReactNode;
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
    hint?: string;
}

// ============================================================================
// Input Component
// ============================================================================

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, hint, leftElement, rightElement, className = '', ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                        {label}
                    </label>
                )}

                <div className="relative">
                    {leftElement && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            {leftElement}
                        </div>
                    )}

                    <input
                        ref={ref}
                        className={`
                            w-full px-4 py-2.5 rounded-xl
                            bg-slate-800/50 border
                            text-white placeholder-slate-500
                            transition-all duration-200
                            focus:outline-none focus:ring-2 focus:ring-offset-0
                            disabled:opacity-50 disabled:cursor-not-allowed
                            ${leftElement ? 'pl-10' : ''}
                            ${rightElement ? 'pr-10' : ''}
                            ${error
                                ? 'border-red-500/50 focus:ring-red-500/50'
                                : 'border-slate-600/50 focus:border-purple-500 focus:ring-purple-500/50'
                            }
                            ${className}
                        `}
                        {...props}
                    />

                    {rightElement && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                            {rightElement}
                        </div>
                    )}
                </div>

                {(error || hint) && (
                    <p className={`mt-1.5 text-sm ${error ? 'text-red-400' : 'text-slate-500'}`}>
                        {error || hint}
                    </p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

// ============================================================================
// Textarea Component
// ============================================================================

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ label, error, hint, className = '', ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                        {label}
                    </label>
                )}

                <textarea
                    ref={ref}
                    className={`
                        w-full px-4 py-3 rounded-xl
                        bg-slate-800/50 border
                        text-white placeholder-slate-500
                        transition-all duration-200
                        focus:outline-none focus:ring-2 focus:ring-offset-0
                        disabled:opacity-50 disabled:cursor-not-allowed
                        resize-none
                        ${error
                            ? 'border-red-500/50 focus:ring-red-500/50'
                            : 'border-slate-600/50 focus:border-purple-500 focus:ring-purple-500/50'
                        }
                        ${className}
                    `}
                    {...props}
                />

                {(error || hint) && (
                    <p className={`mt-1.5 text-sm ${error ? 'text-red-400' : 'text-slate-500'}`}>
                        {error || hint}
                    </p>
                )}
            </div>
        );
    }
);

Textarea.displayName = 'Textarea';

// ============================================================================
// Chat Input (Special)
// ============================================================================

export interface ChatInputProps {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    onAttach?: () => void;
    placeholder?: string;
    disabled?: boolean;
    isTyping?: boolean;
}

export const ChatInput = ({
    value,
    onChange,
    onSend,
    onAttach,
    placeholder = 'Type a message...',
    disabled = false,
    isTyping = false,
}: ChatInputProps) => {
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (value.trim()) {
                onSend();
            }
        }
    };

    return (
        <div className="flex items-end gap-2 p-4 bg-slate-800/50 border-t border-slate-700/50">
            {onAttach && (
                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={onAttach}
                    className="
                        p-2.5 rounded-full
                        bg-slate-700/50 hover:bg-slate-600/50
                        text-slate-400 hover:text-white
                        transition-colors duration-200
                    "
                    disabled={disabled}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                </motion.button>
            )}

            <div className="flex-1 relative">
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={disabled}
                    rows={1}
                    className="
                        w-full px-4 py-3 rounded-2xl
                        bg-slate-700/50 border border-slate-600/50
                        text-white placeholder-slate-500
                        transition-all duration-200
                        focus:outline-none focus:border-purple-500
                        disabled:opacity-50 disabled:cursor-not-allowed
                        resize-none max-h-32
                    "
                    style={{ minHeight: '48px' }}
                />

                {isTyping && (
                    <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute -top-6 left-4 text-xs text-slate-500"
                    >
                        Partner is typing...
                    </motion.span>
                )}
            </div>

            <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onSend}
                disabled={disabled || !value.trim()}
                className={`
                    p-2.5 rounded-full
                    transition-all duration-200
                    ${value.trim()
                        ? 'bg-purple-600 hover:bg-purple-500 text-white'
                        : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                    }
                `}
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
            </motion.button>
        </div>
    );
};
