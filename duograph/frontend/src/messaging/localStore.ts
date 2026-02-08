/**
 * Local Store Module
 * 
 * IndexedDB-based message storage using Dexie.js.
 * Implements local-first storage with CRDT-ready timestamps.
 */

import Dexie from 'dexie';
import type { Table } from 'dexie';

// ============================================================================
// Types
// ============================================================================

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
export type MessageType = 'text' | 'image' | 'video' | 'file' | 'system';

export interface StoredMessage {
    id: string;                         // UUID v4
    pactId: string;                     // Pact identifier
    senderId: string;                   // Sender wallet address
    recipientId: string;                // Recipient wallet address
    type: MessageType;
    encryptedContent: string;           // Encrypted message payload
    iv: string;                         // Initialization vector for decryption
    keyVersion: number;                 // Double Ratchet key version
    messageNumber: number;              // Message number in chain
    status: MessageStatus;
    createdAt: number;                  // Timestamp (CRDT ordering)
    deliveredAt?: number;
    readAt?: number;

    // Media-specific fields
    ipfsCid?: string;                   // IPFS content ID for media
    mimeType?: string;
    fileSize?: number;
    fileName?: string;
    thumbnailCid?: string;              // Thumbnail for images/videos

    // Sync metadata
    syncedAt?: number;                  // Last sync timestamp
    isLocal: boolean;                   // True if created locally
    hlc: string;                        // Hybrid Logical Clock for CRDT
}

export interface MessageDraft {
    id: string;
    pactId: string;
    content: string;
    attachments: DraftAttachment[];
    updatedAt: number;
}

export interface DraftAttachment {
    id: string;
    file: File;
    previewUrl: string;
    uploadProgress: number;
    ipfsCid?: string;
    encryptionKey?: string;
}

export interface TypingIndicator {
    pactId: string;
    isTyping: boolean;
    updatedAt: number;
}

export interface SyncState {
    pactId: string;
    lastSyncedAt: number;
    lastMessageHlc: string;
    vectorClock: Record<string, number>;
}

// ============================================================================
// Hybrid Logical Clock (for CRDT ordering)
// ============================================================================

let hlcCounter = 0;
let lastTime = 0;

export const generateHLC = (): string => {
    const now = Date.now();

    if (now === lastTime) {
        hlcCounter++;
    } else {
        hlcCounter = 0;
        lastTime = now;
    }

    // Format: timestamp:counter:random
    const random = Math.random().toString(36).substring(2, 8);
    return `${now.toString(36)}:${hlcCounter.toString(36)}:${random}`;
};

export const compareHLC = (a: string, b: string): number => {
    const [timeA, counterA] = a.split(':').map(s => parseInt(s, 36));
    const [timeB, counterB] = b.split(':').map(s => parseInt(s, 36));

    if (timeA !== timeB) return timeA - timeB;
    return counterA - counterB;
};

// ============================================================================
// Database Schema
// ============================================================================

class DuoGraphDB extends Dexie {
    messages!: Table<StoredMessage>;
    drafts!: Table<MessageDraft>;
    syncStates!: Table<SyncState>;

    constructor() {
        super('DuoGraphDB');

        this.version(1).stores({
            messages: [
                'id',
                'pactId',
                '[pactId+createdAt]',
                '[pactId+status]',
                'hlc',
                'createdAt',
                'ipfsCid',
            ].join(', '),
            drafts: 'id, pactId, updatedAt',
            syncStates: 'pactId, lastSyncedAt',
        });
    }
}

export const db = new DuoGraphDB();

// ============================================================================
// Message Operations
// ============================================================================

/**
 * Create a new message.
 */
export const createMessage = async (
    message: Omit<StoredMessage, 'id' | 'hlc' | 'createdAt' | 'isLocal'>
): Promise<StoredMessage> => {
    const newMessage: StoredMessage = {
        ...message,
        id: crypto.randomUUID(),
        hlc: generateHLC(),
        createdAt: Date.now(),
        isLocal: true,
    };

    await db.messages.add(newMessage);
    return newMessage;
};

/**
 * Get messages for a pact.
 */
export const getMessages = async (
    pactId: string,
    options: {
        limit?: number;
        before?: number;
        after?: number;
    } = {}
): Promise<StoredMessage[]> => {
    let query = db.messages
        .where('[pactId+createdAt]')
        .between(
            [pactId, options.after || 0],
            [pactId, options.before || Date.now()],
            true,
            true
        );

    if (options.limit) {
        query = query.limit(options.limit);
    }

    return query.reverse().toArray();
};

/**
 * Get a single message by ID.
 */
export const getMessage = async (id: string): Promise<StoredMessage | undefined> => {
    return db.messages.get(id);
};

/**
 * Update message status.
 */
export const updateMessageStatus = async (
    id: string,
    status: MessageStatus,
    timestamp?: number
): Promise<void> => {
    const updates: Partial<StoredMessage> = { status };

    if (status === 'delivered' && timestamp) {
        updates.deliveredAt = timestamp;
    } else if (status === 'read' && timestamp) {
        updates.readAt = timestamp;
    }

    await db.messages.update(id, updates);
};

/**
 * Mark messages as read.
 */
export const markMessagesAsRead = async (
    pactId: string,
    recipientId: string
): Promise<number> => {
    const now = Date.now();

    return db.messages
        .where('[pactId+status]')
        .equals([pactId, 'delivered'])
        .filter(m => m.recipientId === recipientId)
        .modify({ status: 'read', readAt: now });
};

/**
 * Get unread message count.
 */
export const getUnreadCount = async (
    pactId: string,
    recipientId: string
): Promise<number> => {
    return db.messages
        .where('[pactId+status]')
        .equals([pactId, 'delivered'])
        .filter(m => m.recipientId === recipientId)
        .count();
};

/**
 * Search messages locally.
 */
export const searchMessages = async (
    pactId: string,
    query: string,
    limit: number = 50
): Promise<StoredMessage[]> => {
    // Note: This searches encrypted content - won't work directly
    // In a real app, you'd maintain a separate search index of decrypted content
    const lowerQuery = query.toLowerCase();

    return db.messages
        .where('pactId')
        .equals(pactId)
        .filter(m => {
            // For system messages or if we store plaintext preview
            return m.type === 'system' &&
                m.encryptedContent.toLowerCase().includes(lowerQuery);
        })
        .limit(limit)
        .toArray();
};

/**
 * Delete a message.
 */
export const deleteMessage = async (id: string): Promise<void> => {
    await db.messages.delete(id);
};

/**
 * Delete all messages for a pact.
 */
export const deleteAllMessages = async (pactId: string): Promise<number> => {
    return db.messages.where('pactId').equals(pactId).delete();
};

// ============================================================================
// CRDT Merge Operations
// ============================================================================

/**
 * Merge incoming message with local store.
 * Uses HLC for conflict resolution (last-write-wins).
 */
export const mergeMessage = async (
    incoming: StoredMessage
): Promise<{ action: 'inserted' | 'updated' | 'skipped'; message: StoredMessage }> => {
    const existing = await db.messages.get(incoming.id);

    if (!existing) {
        // New message
        const newMessage = { ...incoming, isLocal: false };
        await db.messages.add(newMessage);
        return { action: 'inserted', message: newMessage };
    }

    // Compare HLC for conflict resolution
    if (compareHLC(incoming.hlc, existing.hlc) > 0) {
        // Incoming is newer
        const merged = {
            ...existing,
            ...incoming,
            isLocal: existing.isLocal, // Preserve local flag
        };
        await db.messages.put(merged);
        return { action: 'updated', message: merged };
    }

    // Existing is newer or same
    return { action: 'skipped', message: existing };
};

/**
 * Get messages for sync (sent after a given HLC).
 */
export const getMessagesForSync = async (
    pactId: string,
    afterHlc?: string
): Promise<StoredMessage[]> => {
    if (!afterHlc) {
        return db.messages.where('pactId').equals(pactId).toArray();
    }

    return db.messages
        .where('pactId')
        .equals(pactId)
        .filter(m => compareHLC(m.hlc, afterHlc) > 0)
        .toArray();
};

// ============================================================================
// Draft Operations
// ============================================================================

/**
 * Save or update draft.
 */
export const saveDraft = async (
    draft: Omit<MessageDraft, 'updatedAt'>
): Promise<void> => {
    await db.drafts.put({ ...draft, updatedAt: Date.now() });
};

/**
 * Get draft for a pact.
 */
export const getDraft = async (pactId: string): Promise<MessageDraft | undefined> => {
    return db.drafts.where('pactId').equals(pactId).first();
};

/**
 * Delete draft.
 */
export const deleteDraft = async (pactId: string): Promise<void> => {
    await db.drafts.where('pactId').equals(pactId).delete();
};

// ============================================================================
// Sync State Operations
// ============================================================================

/**
 * Get or create sync state for a pact.
 */
export const getSyncState = async (pactId: string): Promise<SyncState> => {
    const existing = await db.syncStates.get(pactId);

    if (existing) return existing;

    const newState: SyncState = {
        pactId,
        lastSyncedAt: 0,
        lastMessageHlc: '',
        vectorClock: {},
    };

    await db.syncStates.add(newState);
    return newState;
};

/**
 * Update sync state.
 */
export const updateSyncState = async (
    pactId: string,
    updates: Partial<SyncState>
): Promise<void> => {
    await db.syncStates.update(pactId, {
        ...updates,
        lastSyncedAt: Date.now(),
    });
};

// ============================================================================
// Database Utilities
// ============================================================================

/**
 * Clear all data (for logout/reset).
 */
export const clearAllData = async (): Promise<void> => {
    await Promise.all([
        db.messages.clear(),
        db.drafts.clear(),
        db.syncStates.clear(),
    ]);
};

/**
 * Export all messages for a pact (for backup).
 */
export const exportMessages = async (pactId: string): Promise<StoredMessage[]> => {
    return db.messages.where('pactId').equals(pactId).toArray();
};

/**
 * Import messages (for restore).
 */
export const importMessages = async (messages: StoredMessage[]): Promise<number> => {
    let imported = 0;

    for (const message of messages) {
        const result = await mergeMessage(message);
        if (result.action !== 'skipped') {
            imported++;
        }
    }

    return imported;
};

/**
 * Get database statistics.
 */
export const getDbStats = async (): Promise<{
    totalMessages: number;
    pactCount: number;
    storageUsed: number;
}> => {
    const totalMessages = await db.messages.count();

    // Get unique pact count
    const pacts = new Set<string>();
    await db.messages.each(m => pacts.add(m.pactId));

    // Estimate storage (rough)
    const estimate = await navigator.storage?.estimate();

    return {
        totalMessages,
        pactCount: pacts.size,
        storageUsed: estimate?.usage || 0,
    };
};
