/**
 * Sync Module
 * 
 * Peer-to-peer message synchronization using Y.js CRDT.
 * Real-time sync when online, queue when offline.
 */

import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import {
    db,
    type StoredMessage,
    getSyncState,
    updateSyncState,
    mergeMessage,
    getMessagesForSync,
    compareHLC,
} from './localStore';

// ============================================================================
// Types
// ============================================================================

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface SyncMessage {
    type: 'sync-request' | 'sync-response' | 'message' | 'ack' | 'typing' | 'status-update';
    pactId: string;
    payload: unknown;
    timestamp: number;
}

export interface SyncOptions {
    pactId: string;
    userId: string;
    onMessage: (message: StoredMessage) => void;
    onTyping: (isTyping: boolean) => void;
    onStatusChange: (connectionState: ConnectionState) => void;
    onError: (error: Error) => void;
    signalSend: (data: string) => Promise<void>;
}

// ============================================================================
// Y.js Document for CRDT Sync
// ============================================================================

export class MessageSync {
    private ydoc: Y.Doc;
    private persistence: IndexeddbPersistence | null = null;
    private messageMap: Y.Map<StoredMessage>;
    private options: SyncOptions;
    private connectionState: ConnectionState = 'disconnected';
    private pendingQueue: SyncMessage[] = [];
    private typingTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor(options: SyncOptions) {
        this.options = options;
        this.ydoc = new Y.Doc();
        this.messageMap = this.ydoc.getMap<StoredMessage>('messages');

        // Observe changes to message map
        this.messageMap.observe(event => {
            event.changes.keys.forEach((change, key) => {
                if (change.action === 'add' || change.action === 'update') {
                    const message = this.messageMap.get(key);
                    if (message && message.senderId !== this.options.userId) {
                        this.options.onMessage(message);
                    }
                }
            });
        });
    }

    /**
     * Initialize local persistence and load existing messages.
     */
    async initialize(): Promise<void> {
        // Setup IndexedDB persistence for Y.js
        this.persistence = new IndexeddbPersistence(
            `duograph-sync-${this.options.pactId}`,
            this.ydoc
        );

        await new Promise<void>((resolve) => {
            this.persistence!.once('synced', () => resolve());
        });

        // Load existing messages from Dexie into Y.js
        const messages = await getMessagesForSync(this.options.pactId);
        this.ydoc.transact(() => {
            messages.forEach(msg => {
                if (!this.messageMap.has(msg.id)) {
                    this.messageMap.set(msg.id, msg);
                }
            });
        });
    }

    /**
     * Connect to peer for real-time sync.
     */
    connect(): void {
        this.setConnectionState('connecting');
        // Connection is managed externally via WebRTC data channel
        // This method signals readiness to sync
        this.setConnectionState('connected');
        this.flushPendingQueue();
        this.requestSync();
    }

    /**
     * Disconnect from peer.
     */
    disconnect(): void {
        this.setConnectionState('disconnected');
    }

    /**
     * Handle incoming sync data from peer.
     */
    async handleIncoming(data: string): Promise<void> {
        try {
            const message: SyncMessage = JSON.parse(data);

            switch (message.type) {
                case 'sync-request':
                    await this.handleSyncRequest(message);
                    break;
                case 'sync-response':
                    await this.handleSyncResponse(message);
                    break;
                case 'message':
                    await this.handleNewMessage(message);
                    break;
                case 'ack':
                    await this.handleAck(message);
                    break;
                case 'typing':
                    this.handleTyping(message);
                    break;
                case 'status-update':
                    await this.handleStatusUpdate(message);
                    break;
            }
        } catch (error) {
            console.error('Failed to handle sync message:', error);
        }
    }

    /**
     * Add a new message to local store and sync.
     */
    async addMessage(message: StoredMessage): Promise<void> {
        // Add to local Y.js doc
        this.ydoc.transact(() => {
            this.messageMap.set(message.id, message);
        });

        // Send to peer if connected
        if (this.connectionState === 'connected') {
            await this.send({
                type: 'message',
                pactId: this.options.pactId,
                payload: message,
                timestamp: Date.now(),
            });
        } else {
            // Queue for later
            this.pendingQueue.push({
                type: 'message',
                pactId: this.options.pactId,
                payload: message,
                timestamp: Date.now(),
            });
        }
    }

    /**
     * Send typing indicator.
     */
    async sendTyping(isTyping: boolean): Promise<void> {
        if (this.connectionState !== 'connected') return;

        await this.send({
            type: 'typing',
            pactId: this.options.pactId,
            payload: { isTyping },
            timestamp: Date.now(),
        });
    }

    /**
     * Update message status and notify peer.
     */
    async updateStatus(
        messageId: string,
        status: StoredMessage['status']
    ): Promise<void> {
        const message = this.messageMap.get(messageId);
        if (!message) return;

        const updated: StoredMessage = {
            ...message,
            status,
            ...(status === 'delivered' && { deliveredAt: Date.now() }),
            ...(status === 'read' && { readAt: Date.now() }),
        };

        this.ydoc.transact(() => {
            this.messageMap.set(messageId, updated);
        });

        if (this.connectionState === 'connected') {
            await this.send({
                type: 'status-update',
                pactId: this.options.pactId,
                payload: { messageId, status, timestamp: Date.now() },
                timestamp: Date.now(),
            });
        }
    }

    /**
     * Clean up resources.
     */
    destroy(): void {
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
        this.persistence?.destroy();
        this.ydoc.destroy();
    }

    // ========================================================================
    // Internal Methods
    // ========================================================================

    private setConnectionState(state: ConnectionState): void {
        this.connectionState = state;
        this.options.onStatusChange(state);
    }

    private async send(message: SyncMessage): Promise<void> {
        try {
            await this.options.signalSend(JSON.stringify(message));
        } catch (error) {
            this.options.onError(
                error instanceof Error ? error : new Error('Failed to send sync message')
            );
        }
    }

    private async requestSync(): Promise<void> {
        const syncState = await getSyncState(this.options.pactId);

        await this.send({
            type: 'sync-request',
            pactId: this.options.pactId,
            payload: {
                lastHlc: syncState.lastMessageHlc,
                vectorClock: syncState.vectorClock,
            },
            timestamp: Date.now(),
        });
    }

    private async handleSyncRequest(msg: SyncMessage): Promise<void> {
        const { lastHlc } = msg.payload as { lastHlc: string };

        // Get messages newer than their last sync point
        const messages = await getMessagesForSync(this.options.pactId, lastHlc);

        await this.send({
            type: 'sync-response',
            pactId: this.options.pactId,
            payload: { messages },
            timestamp: Date.now(),
        });
    }

    private async handleSyncResponse(msg: SyncMessage): Promise<void> {
        const { messages } = msg.payload as { messages: StoredMessage[] };

        let latestHlc = '';

        for (const message of messages) {
            const result = await mergeMessage(message);

            // Also add to Y.js map
            if (result.action !== 'skipped') {
                this.ydoc.transact(() => {
                    this.messageMap.set(message.id, result.message);
                });

                // Notify about new messages from remote
                if (message.senderId !== this.options.userId) {
                    this.options.onMessage(result.message);
                }
            }

            if (!latestHlc || compareHLC(message.hlc, latestHlc) > 0) {
                latestHlc = message.hlc;
            }
        }

        // Update sync state
        if (latestHlc) {
            await updateSyncState(this.options.pactId, {
                lastMessageHlc: latestHlc,
            });
        }
    }

    private async handleNewMessage(msg: SyncMessage): Promise<void> {
        const message = msg.payload as StoredMessage;

        // Merge into local store
        const result = await mergeMessage(message);

        // Add to Y.js map
        this.ydoc.transact(() => {
            this.messageMap.set(message.id, result.message);
        });

        // Notify about new message
        if (result.action !== 'skipped') {
            this.options.onMessage(result.message);
        }

        // Send acknowledgment
        await this.send({
            type: 'ack',
            pactId: this.options.pactId,
            payload: { messageId: message.id, status: 'delivered' },
            timestamp: Date.now(),
        });
    }

    private async handleAck(msg: SyncMessage): Promise<void> {
        const { messageId, status } = msg.payload as {
            messageId: string;
            status: StoredMessage['status'];
        };

        await db.messages.update(messageId, {
            status,
            deliveredAt: Date.now(),
        });

        // Update Y.js map
        const message = this.messageMap.get(messageId);
        if (message) {
            this.ydoc.transact(() => {
                this.messageMap.set(messageId, { ...message, status, deliveredAt: Date.now() });
            });
        }
    }

    private handleTyping(msg: SyncMessage): void {
        const { isTyping } = msg.payload as { isTyping: boolean };

        this.options.onTyping(isTyping);

        // Auto-clear typing after 5 seconds
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }

        if (isTyping) {
            this.typingTimeout = setTimeout(() => {
                this.options.onTyping(false);
            }, 5000);
        }
    }

    private async handleStatusUpdate(msg: SyncMessage): Promise<void> {
        const { messageId, status, timestamp } = msg.payload as {
            messageId: string;
            status: StoredMessage['status'];
            timestamp: number;
        };

        await db.messages.update(messageId, {
            status,
            ...(status === 'read' && { readAt: timestamp }),
        });

        // Update Y.js map
        const message = this.messageMap.get(messageId);
        if (message) {
            this.ydoc.transact(() => {
                this.messageMap.set(messageId, {
                    ...message,
                    status,
                    ...(status === 'read' && { readAt: timestamp }),
                });
            });
        }
    }

    private async flushPendingQueue(): Promise<void> {
        const queue = [...this.pendingQueue];
        this.pendingQueue = [];

        for (const message of queue) {
            await this.send(message);
        }
    }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new message sync instance.
 */
export const createMessageSync = async (
    options: SyncOptions
): Promise<MessageSync> => {
    const sync = new MessageSync(options);
    await sync.initialize();
    return sync;
};
