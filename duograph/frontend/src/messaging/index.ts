/**
 * Messaging Module Exports
 * 
 * Central exports for local-first messaging.
 */

// Local Store
export {
    // Types
    type MessageStatus,
    type MessageType,
    type StoredMessage,
    type MessageDraft,
    type DraftAttachment,
    type TypingIndicator,
    type SyncState,

    // Database instance
    db,

    // HLC utilities
    generateHLC,
    compareHLC,

    // Message operations
    createMessage,
    getMessages,
    getMessage,
    updateMessageStatus,
    markMessagesAsRead,
    getUnreadCount,
    searchMessages,
    deleteMessage,
    deleteAllMessages,

    // CRDT merge
    mergeMessage,
    getMessagesForSync,

    // Draft operations
    saveDraft,
    getDraft,
    deleteDraft,

    // Sync state
    getSyncState,
    updateSyncState,

    // Utilities
    clearAllData,
    exportMessages,
    importMessages,
    getDbStats,
} from './localStore';

// Sync
export {
    // Types
    type ConnectionState,
    type SyncMessage,
    type SyncOptions,

    // Class
    MessageSync,

    // Factory
    createMessageSync,
} from './sync';

// Message Handler
export {
    // Types
    type MessageHandlerOptions,
    type EncryptedPayload,
    type DecryptedMessage,
    type OutgoingMessage,

    // Class
    MessageHandler,

    // Factory
    createMessageHandler,

    // Utilities
    generateMessageId,
    formatMessageTime,
    getStatusIcon,
} from './messageHandler';
