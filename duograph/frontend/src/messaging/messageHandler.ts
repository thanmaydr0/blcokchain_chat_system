/**
 * Message Handler Module
 * 
 * Encryption/decryption, sending/receiving messages.
 * Integrates with local store and sync.
 */

import {
    createMessage,
    updateMessageStatus,
    type StoredMessage,
    type MessageType,
    type MessageStatus,
} from './localStore';
import { MessageSync, createMessageSync, type ConnectionState } from './sync';

// ============================================================================
// Types
// ============================================================================

export interface MessageHandlerOptions {
    pactId: string;
    userId: string;
    partnerId: string;
    onMessage: (message: DecryptedMessage) => void;
    onTyping: (isTyping: boolean) => void;
    onConnectionChange: (state: ConnectionState) => void;
    onError: (error: Error) => void;

    // Encryption callbacks - integrate with your crypto module
    encryptContent: (plaintext: string) => Promise<EncryptedPayload>;
    decryptContent: (payload: EncryptedPayload) => Promise<string>;

    // Signaling callback for P2P data channel
    signalSend: (data: string) => Promise<void>;
}

export interface EncryptedPayload {
    ciphertext: string;
    iv: string;
    keyVersion: number;
    messageNumber: number;
    hmac: string;
}

export interface DecryptedMessage {
    id: string;
    senderId: string;
    type: MessageType;
    content: string;
    createdAt: number;
    status: MessageStatus;

    // Media fields
    ipfsCid?: string;
    mimeType?: string;
    fileName?: string;
    fileSize?: number;
}

export interface OutgoingMessage {
    type: MessageType;
    content: string;

    // For media messages
    ipfsCid?: string;
    mimeType?: string;
    fileName?: string;
    fileSize?: number;
    thumbnailCid?: string;
}

// ============================================================================
// Message Handler Class
// ============================================================================

export class MessageHandler {
    private sync: MessageSync | null = null;
    private options: MessageHandlerOptions;
    private isInitialized = false;

    constructor(options: MessageHandlerOptions) {
        this.options = options;
    }

    /**
     * Initialize handler with sync.
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        this.sync = await createMessageSync({
            pactId: this.options.pactId,
            userId: this.options.userId,
            onMessage: async (message) => {
                await this.handleIncomingMessage(message);
            },
            onTyping: this.options.onTyping,
            onStatusChange: this.options.onConnectionChange,
            onError: this.options.onError,
            signalSend: this.options.signalSend,
        });

        this.isInitialized = true;
    }

    /**
     * Connect to peer for real-time messaging.
     */
    connect(): void {
        this.sync?.connect();
    }

    /**
     * Disconnect from peer.
     */
    disconnect(): void {
        this.sync?.disconnect();
    }

    /**
     * Handle incoming data from data channel.
     */
    async handleIncomingData(data: string): Promise<void> {
        await this.sync?.handleIncoming(data);
    }

    /**
     * Send a message.
     */
    async sendMessage(outgoing: OutgoingMessage): Promise<DecryptedMessage> {
        if (!this.isInitialized) {
            throw new Error('Handler not initialized');
        }

        // Encrypt the content
        const encrypted = await this.options.encryptContent(outgoing.content);

        // Create message in local store
        const stored = await createMessage({
            pactId: this.options.pactId,
            senderId: this.options.userId,
            recipientId: this.options.partnerId,
            type: outgoing.type,
            encryptedContent: encrypted.ciphertext,
            iv: encrypted.iv,
            keyVersion: encrypted.keyVersion,
            messageNumber: encrypted.messageNumber,
            status: 'pending',

            // Media fields
            ipfsCid: outgoing.ipfsCid,
            mimeType: outgoing.mimeType,
            fileName: outgoing.fileName,
            fileSize: outgoing.fileSize,
            thumbnailCid: outgoing.thumbnailCid,
        });

        // Add to sync for P2P delivery
        await this.sync?.addMessage(stored);

        // Mark as sent (will be updated to delivered when ack received)
        await updateMessageStatus(stored.id, 'sent');

        return {
            id: stored.id,
            senderId: stored.senderId,
            type: stored.type,
            content: outgoing.content,
            createdAt: stored.createdAt,
            status: 'sent',
            ipfsCid: stored.ipfsCid,
            mimeType: stored.mimeType,
            fileName: stored.fileName,
            fileSize: stored.fileSize,
        };
    }

    /**
     * Send typing indicator.
     */
    async sendTyping(isTyping: boolean): Promise<void> {
        await this.sync?.sendTyping(isTyping);
    }

    /**
     * Mark messages as read.
     */
    async markAsRead(messageIds: string[]): Promise<void> {
        for (const id of messageIds) {
            await this.sync?.updateStatus(id, 'read');
        }
    }

    /**
     * Clean up resources.
     */
    destroy(): void {
        this.sync?.destroy();
        this.sync = null;
        this.isInitialized = false;
    }

    // ========================================================================
    // Internal Methods
    // ========================================================================

    private async handleIncomingMessage(stored: StoredMessage): Promise<void> {
        try {
            // Decrypt the content
            const plaintext = await this.options.decryptContent({
                ciphertext: stored.encryptedContent,
                iv: stored.iv,
                keyVersion: stored.keyVersion,
                messageNumber: stored.messageNumber,
                hmac: '', // HMAC should be in the stored message
            });

            const decrypted: DecryptedMessage = {
                id: stored.id,
                senderId: stored.senderId,
                type: stored.type,
                content: plaintext,
                createdAt: stored.createdAt,
                status: stored.status,
                ipfsCid: stored.ipfsCid,
                mimeType: stored.mimeType,
                fileName: stored.fileName,
                fileSize: stored.fileSize,
            };

            this.options.onMessage(decrypted);
        } catch (error) {
            this.options.onError(
                error instanceof Error ? error : new Error('Failed to decrypt message')
            );
        }
    }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create and initialize a message handler.
 */
export const createMessageHandler = async (
    options: MessageHandlerOptions
): Promise<MessageHandler> => {
    const handler = new MessageHandler(options);
    await handler.initialize();
    return handler;
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a random message ID.
 */
export const generateMessageId = (): string => {
    return crypto.randomUUID();
};

/**
 * Format message timestamp.
 */
export const formatMessageTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();

    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = new Date(now.getTime() - 86400000).toDateString() === date.toDateString();

    const timeStr = date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit'
    });

    if (isToday) {
        return timeStr;
    } else if (isYesterday) {
        return `Yesterday ${timeStr}`;
    } else {
        return date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }
};

/**
 * Get status icon for message.
 */
export const getStatusIcon = (status: MessageStatus): string => {
    switch (status) {
        case 'pending': return '⏳';
        case 'sent': return '✓';
        case 'delivered': return '✓✓';
        case 'read': return '✓✓'; // Would be colored blue in UI
        case 'failed': return '⚠️';
        default: return '';
    }
};
