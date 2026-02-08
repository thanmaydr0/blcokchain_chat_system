/**
 * Message Bubble Component (Enhanced)
 * 
 * Chat message display with encryption status.
 */

import { motion } from 'framer-motion';
import { CheckIcon, ClockIcon, ExclamationCircleIcon } from '@heroicons/react/24/solid';
import { EncryptionLock } from '../shared/PrivacyBadge';

// ============================================================================
// Types
// ============================================================================

export type MessageStatusType = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface EnhancedMessageBubbleProps {
    content: string;
    timestamp: Date;
    isOwn: boolean;
    status?: MessageStatusType;
    isEncrypted?: boolean;

    // Media
    imageUrl?: string;
    videoUrl?: string;
    fileName?: string;
    fileSize?: number;

    // Metadata
    showAvatar?: boolean;
    avatarUrl?: string;
}

// ============================================================================
// Status Icons
// ============================================================================

const StatusIndicator = ({ status }: { status: MessageStatusType }) => {
    switch (status) {
        case 'pending':
            return <ClockIcon className="w-3 h-3 text-slate-500" />;
        case 'sent':
            return <CheckIcon className="w-3 h-3 text-slate-500" />;
        case 'delivered':
            return (
                <div className="flex -space-x-1">
                    <CheckIcon className="w-3 h-3 text-slate-400" />
                    <CheckIcon className="w-3 h-3 text-slate-400" />
                </div>
            );
        case 'read':
            return (
                <div className="flex -space-x-1">
                    <CheckIcon className="w-3 h-3 text-blue-400" />
                    <CheckIcon className="w-3 h-3 text-blue-400" />
                </div>
            );
        case 'failed':
            return <ExclamationCircleIcon className="w-3 h-3 text-red-400" />;
        default:
            return null;
    }
};

// ============================================================================
// Component
// ============================================================================

export const EnhancedMessageBubble = ({
    content,
    timestamp,
    isOwn,
    status = 'sent',
    isEncrypted = true,
    imageUrl,
    videoUrl,
    fileName,
    fileSize,
    showAvatar = false,
    avatarUrl,
}: EnhancedMessageBubbleProps) => {
    const hasMedia = imageUrl || videoUrl || fileName;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2 }}
            className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}
        >
            <div className={`flex items-end gap-2 max-w-[80%] ${isOwn ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                {showAvatar && !isOwn && (
                    <div className="flex-shrink-0">
                        {avatarUrl ? (
                            <img
                                src={avatarUrl}
                                alt="Avatar"
                                className="w-8 h-8 rounded-full"
                            />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500" />
                        )}
                    </div>
                )}

                {/* Bubble */}
                <div
                    className={`
                        relative rounded-2xl px-4 py-2.5
                        ${isOwn
                            ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white rounded-br-md'
                            : 'bg-slate-700/80 text-white rounded-bl-md'
                        }
                    `}
                >
                    {/* Media Preview */}
                    {hasMedia && (
                        <div className="mb-2">
                            {imageUrl && (
                                <img
                                    src={imageUrl}
                                    alt="Shared image"
                                    className="rounded-lg max-w-full max-h-64 object-cover"
                                />
                            )}

                            {videoUrl && (
                                <video
                                    src={videoUrl}
                                    controls
                                    className="rounded-lg max-w-full max-h-64"
                                />
                            )}

                            {fileName && !imageUrl && !videoUrl && (
                                <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                                    <div className="p-2 bg-purple-500/20 rounded-lg">
                                        <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{fileName}</p>
                                        {fileSize && (
                                            <p className="text-xs text-slate-400">
                                                {formatFileSize(fileSize)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Text Content */}
                    {content && (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {content}
                        </p>
                    )}

                    {/* Footer */}
                    <div className={`
                        flex items-center gap-1.5 mt-1
                        ${isOwn ? 'justify-end' : 'justify-start'}
                    `}>
                        {isEncrypted && (
                            <EncryptionLock size={12} isEncrypted={true} />
                        )}

                        <span className="text-[10px] text-slate-400">
                            {formatTime(timestamp)}
                        </span>

                        {isOwn && <StatusIndicator status={status} />}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

// ============================================================================
// Typing Indicator
// ============================================================================

export const TypingIndicator = () => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex justify-start mb-2"
        >
            <div className="bg-slate-700/80 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                        <motion.div
                            key={i}
                            className="w-2 h-2 bg-slate-400 rounded-full"
                            animate={{ y: [0, -5, 0] }}
                            transition={{
                                duration: 0.6,
                                repeat: Infinity,
                                delay: i * 0.15,
                            }}
                        />
                    ))}
                </div>
            </div>
        </motion.div>
    );
};

// ============================================================================
// Helpers
// ============================================================================

const formatTime = (date: Date): string => {
    return date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit'
    });
};

const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};
