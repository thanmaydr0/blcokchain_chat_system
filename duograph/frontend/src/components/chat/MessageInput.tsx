import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Smile, Mic, Image as ImageIcon } from 'lucide-react';

interface MessageInputProps {
    onSendMessage: (message: string) => void;
    onAttachFile?: () => void;
    onStartVoiceMessage?: () => void;
    disabled?: boolean;
    placeholder?: string;
}

export const MessageInput = ({
    onSendMessage,
    onAttachFile,
    onStartVoiceMessage,
    disabled = false,
    placeholder = 'Type a message...',
}: MessageInputProps) => {
    const [message, setMessage] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
        }
    }, [message]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (message.trim() && !disabled) {
            onSendMessage(message.trim());
            setMessage('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="p-4 border-t border-dark-700">
            <div className="flex items-end gap-2">
                {/* Attachment Button */}
                <button
                    type="button"
                    onClick={onAttachFile}
                    disabled={disabled}
                    className="btn-ghost p-2 rounded-xl text-dark-400 hover:text-dark-200 disabled:opacity-50"
                >
                    <Paperclip className="w-5 h-5" />
                </button>

                {/* Image Button */}
                <button
                    type="button"
                    onClick={onAttachFile}
                    disabled={disabled}
                    className="btn-ghost p-2 rounded-xl text-dark-400 hover:text-dark-200 disabled:opacity-50"
                >
                    <ImageIcon className="w-5 h-5" />
                </button>

                {/* Message Input */}
                <div className="flex-1 relative">
                    <textarea
                        ref={textareaRef}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        disabled={disabled}
                        rows={1}
                        className="w-full px-4 py-3 pr-12 rounded-2xl bg-dark-800/50 border border-dark-700
                     text-dark-100 placeholder-dark-500 resize-none
                     focus:outline-none focus:border-duo-500 focus:ring-2 focus:ring-duo-500/20
                     transition-all duration-200 disabled:opacity-50"
                    />
                    <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-300"
                    >
                        <Smile className="w-5 h-5" />
                    </button>
                </div>

                {/* Send or Voice Button */}
                {message.trim() ? (
                    <button
                        type="submit"
                        disabled={disabled}
                        className="p-3 rounded-xl gradient-primary text-white
                     hover:opacity-90 active:scale-95 transition-all duration-200
                     disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={onStartVoiceMessage}
                        disabled={disabled}
                        className="p-3 rounded-xl bg-dark-700 text-dark-300
                     hover:bg-dark-600 hover:text-dark-100 active:scale-95
                     transition-all duration-200 disabled:opacity-50"
                    >
                        <Mic className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Encryption Indicator */}
            <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-dark-500">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                        fillRule="evenodd"
                        d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                        clipRule="evenodd"
                    />
                </svg>
                <span>End-to-end encrypted</span>
            </div>
        </form>
    );
};

export default MessageInput;
