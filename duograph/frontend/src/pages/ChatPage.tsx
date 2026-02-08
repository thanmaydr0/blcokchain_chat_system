import { useState, useMemo } from 'react';
import { MessageSquare, Video, Phone } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { ChatHeader, MessageList, MessageInput } from '../components/chat';
import { OnboardingContainer } from '../components/Onboarding';
import { useAuthStore, usePactStore, useMessageStore } from '../store';
import type { Message, MessageType, MessageStatus } from '../types';

export const ChatPage = () => {
    const { user } = useAuthStore();
    const { activePact, pacts } = usePactStore();
    const { messages, addMessage } = useMessageStore();
    const [onboardingDismissed, setOnboardingDismissed] = useState(false);

    // Determine if we should show onboarding
    // If user has no pacts and hasn't dismissed it, show onboarding
    const showOnboarding = useMemo(() => {
        return pacts.length === 0 && !onboardingDismissed;
    }, [pacts.length, onboardingDismissed]);

    const handleOnboardingComplete = () => {
        // Refresh pacts or just hide onboarding if state updated
        setOnboardingDismissed(true);
    };

    const pactMessages = activePact ? messages[activePact.id] || [] : [];

    const handleSendMessage = (content: string) => {
        if (!activePact || !user) return;

        const newMessage: Message = {
            id: crypto.randomUUID(),
            pactId: activePact.id,
            senderId: user.id,
            content,
            type: 'text' as MessageType,
            timestamp: new Date().toISOString(),
            status: 'sending' as MessageStatus,
        };

        addMessage(activePact.id, newMessage);

        // Simulate message sent status
        setTimeout(() => {
            // In real app, update via store
        }, 500);
    };

    const handleVoiceCall = () => {
        console.log('Starting voice call...');
    };

    const handleVideoCall = () => {
        console.log('Starting video call...');
    };

    if (showOnboarding) {
        return <OnboardingContainer onComplete={handleOnboardingComplete} />;
    }

    return (
        <div className="h-screen flex bg-dark-950">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Chat Area */}
            <main className="flex-1 flex flex-col">
                {activePact ? (
                    <>
                        {/* Chat Header */}
                        <ChatHeader
                            partner={activePact.partner}
                            pactStatus={activePact.status}
                            onVoiceCall={handleVoiceCall}
                            onVideoCall={handleVideoCall}
                        />

                        {/* Messages */}
                        <MessageList
                            messages={pactMessages}
                            currentUserId={user?.id || ''}
                        />

                        {/* Input */}
                        <MessageInput
                            onSendMessage={handleSendMessage}
                            disabled={activePact.status !== 'active'}
                            placeholder={
                                activePact.status === 'pending'
                                    ? 'Waiting for partner to accept...'
                                    : 'Type a message...'
                            }
                        />
                    </>
                ) : (
                    /* Empty State */
                    <div className="flex-1 flex flex-col items-center justify-center p-8">
                        <div className="w-24 h-24 rounded-3xl bg-dark-800/50 border border-dark-700 flex items-center justify-center mb-6">
                            <MessageSquare className="w-12 h-12 text-dark-600" />
                        </div>
                        <h2 className="text-xl font-semibold text-dark-200 mb-2">
                            Select a Pact
                        </h2>
                        <p className="text-dark-500 text-center max-w-sm mb-6">
                            Choose an existing pact from the sidebar or create a new one to start
                            a secure, encrypted conversation.
                        </p>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-dark-500">
                                <Video className="w-5 h-5" />
                                <span className="text-sm">Video Calls</span>
                            </div>
                            <div className="w-1 h-1 rounded-full bg-dark-600" />
                            <div className="flex items-center gap-2 text-dark-500">
                                <Phone className="w-5 h-5" />
                                <span className="text-sm">Voice Calls</span>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default ChatPage;
