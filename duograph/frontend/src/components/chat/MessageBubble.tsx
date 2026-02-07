import { Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';
import type { Message, MessageStatus } from '../../types';

interface MessageBubbleProps {
    message: Message;
    isOwn: boolean;
    showAvatar?: boolean;
}

export const MessageBubble = ({ message, isOwn, showAvatar = true }: MessageBubbleProps) => {
    const formatTime = (timestamp: string) => {
        return new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getStatusIcon = (status: MessageStatus) => {
        switch (status) {
            case 'sending':
                return <Clock className="w-3 h-3 text-dark-500" />;
            case 'sent':
                return <Check className="w-3 h-3 text-dark-400" />;
            case 'delivered':
                return <CheckCheck className="w-3 h-3 text-dark-400" />;
            case 'read':
                return <CheckCheck className="w-3 h-3 text-duo-400" />;
            case 'failed':
                return <AlertCircle className="w-3 h-3 text-red-400" />;
            default:
                return null;
        }
    };

    return (
        <div
            className={`flex gap-3 animate-slide-up ${isOwn ? 'flex-row-reverse' : 'flex-row'
                }`}
        >
            {/* Avatar */}
            {showAvatar && !isOwn && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center text-white text-sm font-medium">
                    P
                </div>
            )}
            {showAvatar && isOwn && <div className="w-8" />}

            {/* Message Content */}
            <div
                className={`group relative ${isOwn ? 'chat-bubble-sent' : 'chat-bubble-received'
                    }`}
            >
                {/* Text Content */}
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {message.content}
                </p>

                {/* Time and Status */}
                <div
                    className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'
                        }`}
                >
                    <span
                        className={`text-xs ${isOwn ? 'text-white/60' : 'text-dark-500'
                            }`}
                    >
                        {formatTime(message.timestamp)}
                    </span>
                    {isOwn && getStatusIcon(message.status)}
                </div>
            </div>
        </div>
    );
};

export default MessageBubble;
