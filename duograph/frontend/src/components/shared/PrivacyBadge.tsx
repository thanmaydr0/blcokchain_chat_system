/**
 * Privacy Status Badge
 * 
 * Visual indicator for encryption and security status.
 */

import { motion } from 'framer-motion';
import {
    ShieldCheckIcon,
    ArrowPathIcon,
    ExclamationTriangleIcon,
    LinkIcon,
} from '@heroicons/react/24/solid';
import { privacyStatus, type PrivacyStatusType } from '../../styles/theme';

// ============================================================================
// Types
// ============================================================================

export interface PrivacyBadgeProps {
    status: PrivacyStatusType;
    showLabel?: boolean;
    size?: 'sm' | 'md' | 'lg';
    animate?: boolean;
}

// ============================================================================
// Icon Map
// ============================================================================

const statusIcons: Record<PrivacyStatusType, typeof ShieldCheckIcon> = {
    secure: ShieldCheckIcon,
    syncing: ArrowPathIcon,
    alert: ExclamationTriangleIcon,
    blockchain: LinkIcon,
};

const sizeStyles = {
    sm: {
        badge: 'px-2 py-1 text-xs gap-1',
        icon: 'w-3 h-3',
    },
    md: {
        badge: 'px-3 py-1.5 text-sm gap-1.5',
        icon: 'w-4 h-4',
    },
    lg: {
        badge: 'px-4 py-2 text-base gap-2',
        icon: 'w-5 h-5',
    },
};

// ============================================================================
// Component
// ============================================================================

export const PrivacyBadge = ({
    status,
    showLabel = true,
    size = 'md',
    animate = true,
}: PrivacyBadgeProps) => {
    const config = privacyStatus[status];
    const Icon = statusIcons[status];
    const styles = sizeStyles[size];

    return (
        <motion.div
            initial={animate ? { opacity: 0, scale: 0.9 } : false}
            animate={{ opacity: 1, scale: 1 }}
            className={`
                inline-flex items-center
                rounded-full font-medium
                ${styles.badge}
            `}
            style={{
                backgroundColor: config.bg,
                border: `1px solid ${config.border}`,
                color: config.color,
                boxShadow: animate ? config.glow : 'none',
            }}
        >
            <motion.div
                animate={status === 'syncing' ? { rotate: 360 } : {}}
                transition={status === 'syncing' ? {
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'linear'
                } : {}}
            >
                <Icon className={styles.icon} />
            </motion.div>

            {showLabel && (
                <span className="whitespace-nowrap">{config.label}</span>
            )}
        </motion.div>
    );
};

// ============================================================================
// Encryption Lock Icon (Animated)
// ============================================================================

export const EncryptionLock = ({
    isEncrypted = true,
    size = 20,
}: {
    isEncrypted?: boolean;
    size?: number;
}) => {
    return (
        <motion.svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            initial={false}
            animate={isEncrypted ? 'locked' : 'unlocked'}
        >
            <motion.rect
                x="4"
                y="11"
                width="16"
                height="10"
                rx="2"
                fill={isEncrypted ? '#10B981' : '#64748B'}
                transition={{ duration: 0.2 }}
            />
            <motion.path
                d="M8 11V7a4 4 0 018 0v4"
                stroke={isEncrypted ? '#10B981' : '#64748B'}
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
                variants={{
                    locked: { d: 'M8 11V7a4 4 0 018 0v4' },
                    unlocked: { d: 'M8 11V7a4 4 0 018 0v0' },
                }}
                transition={{ duration: 0.2 }}
            />
            <motion.circle
                cx="12"
                cy="16"
                r="1.5"
                fill="#0F172A"
            />
        </motion.svg>
    );
};

// ============================================================================
// Blockchain Anchor Badge
// ============================================================================

export const BlockchainAnchor = ({
    txHash,
    blockNumber,
    onClick,
}: {
    txHash?: string;
    blockNumber?: number;
    onClick?: () => void;
}) => {
    const shortened = txHash
        ? `${txHash.slice(0, 6)}...${txHash.slice(-4)}`
        : 'Not anchored';

    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className={`
                inline-flex items-center gap-2 px-3 py-1.5
                rounded-lg text-sm font-mono
                transition-colors duration-200
                ${txHash
                    ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20'
                    : 'bg-slate-700/50 border border-slate-600/50 text-slate-400'
                }
            `}
        >
            <LinkIcon className="w-4 h-4" />
            <span>{shortened}</span>
            {blockNumber && (
                <span className="text-xs text-slate-500">
                    Block #{blockNumber.toLocaleString()}
                </span>
            )}
        </motion.button>
    );
};

// ============================================================================
// Security Status Bar
// ============================================================================

export interface SecurityStatusBarProps {
    encryptionStatus: PrivacyStatusType;
    blockchainAnchored: boolean;
    lastVerified?: Date;
}

export const SecurityStatusBar = ({
    encryptionStatus,
    blockchainAnchored,
    lastVerified,
}: SecurityStatusBarProps) => {
    return (
        <div className="
            flex items-center justify-between
            px-4 py-2 bg-slate-800/50
            border-b border-slate-700/50
        ">
            <div className="flex items-center gap-3">
                <PrivacyBadge status={encryptionStatus} size="sm" />

                {blockchainAnchored && (
                    <PrivacyBadge status="blockchain" size="sm" />
                )}
            </div>

            {lastVerified && (
                <span className="text-xs text-slate-500">
                    Verified {formatTimeAgo(lastVerified)}
                </span>
            )}
        </div>
    );
};

// ============================================================================
// Helpers
// ============================================================================

const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
};
