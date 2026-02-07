import { useRef, useEffect } from 'react';
import { Shield, Lock } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import type { Message } from '../../types';

interface MessageListProps {
    messages: Message[];
    currentUserId: string;
}

export const MessageList = ({ messages, currentUserId }: MessageListProps) => {
    const bottomRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    if (messages.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
                <div className="w-20 h-20 rounded-full bg-duo-500/10 flex items-center justify-center mb-4">
                    <Lock className="w-10 h-10 text-duo-400" />
                </div>
                <h3 className="text-lg font-semibold text-dark-200 mb-2">
                    Secure Connection Established
                </h3>
                <p className="text-dark-500 text-center max-w-sm">
                    Your messages are protected by end-to-end encryption. Only you and your
                    chat partner can read them.
                </p>
                <div className="encryption-badge mt-4">
                    <Shield className="w-3 h-3" />
                    <span>Double Ratchet Encryption</span>
                </div>
            </div>
        );
    }

    // Group messages by date
    const groupedMessages: { date: string; messages: Message[] }[] = [];
    let currentDate = '';

    messages.forEach((message) => {
        const messageDate = new Date(message.timestamp).toLocaleDateString();
        if (messageDate !== currentDate) {
            currentDate = messageDate;
            groupedMessages.push({ date: messageDate, messages: [message] });
        } else {
            groupedMessages[groupedMessages.length - 1].messages.push(message);
        }
    });

    const formatDateHeader = (dateString: string) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        }
        if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        }
        return date.toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
        });
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {groupedMessages.map((group) => (
                <div key={group.date}>
                    {/* Date Header */}
                    <div className="flex items-center justify-center my-4">
                        <div className="px-3 py-1 rounded-full bg-dark-800/50 border border-dark-700/50">
                            <span className="text-xs text-dark-400">
                                {formatDateHeader(group.date)}
                            </span>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="space-y-3">
                        {group.messages.map((message, index) => {
                            const isOwn = message.senderId === currentUserId;
                            const prevMessage = group.messages[index - 1];
                            const showAvatar =
                                !prevMessage || prevMessage.senderId !== message.senderId;

                            return (
                                <MessageBubble
                                    key={message.id}
                                    message={message}
                                    isOwn={isOwn}
                                    showAvatar={showAvatar}
                                />
                            );
                        })}
                    </div>
                </div>
            ))}
            <div ref={bottomRef} />
        </div>
    );
};

export default MessageList;
