// User types
export interface User {
    id: string;
    email: string;
    publicKey?: JsonWebKey;
    walletAddress?: string;
    keyFingerprint?: string;
    createdAt: string;
}

// Pact types (blockchain-anchored connection)
export interface Pact {
    id: string;
    pactId: number; // On-chain pact ID
    initiator: User;
    partner: User | null;
    status: PactStatus;
    encryptedMetadata?: string;
    createdAt: string;
    acceptedAt?: string;
    transactionHash?: string;
}

export enum PactStatus {
    PENDING = 'pending',
    ACTIVE = 'active',
    DISSOLVED = 'dissolved',
    EXPIRED = 'expired',
}

// Message types
export interface Message {
    id: string;
    pactId: string;
    senderId: string;
    content: string; // Encrypted content
    type: MessageType;
    timestamp: string;
    status: MessageStatus;
    metadata?: MessageMetadata;
}

export enum MessageType {
    TEXT = 'text',
    IMAGE = 'image',
    VIDEO = 'video',
    AUDIO = 'audio',
    FILE = 'file',
    SYSTEM = 'system',
}

export enum MessageStatus {
    SENDING = 'sending',
    SENT = 'sent',
    DELIVERED = 'delivered',
    READ = 'read',
    FAILED = 'failed',
}

export interface MessageMetadata {
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    ipfsHash?: string;
    thumbnailHash?: string;
    duration?: number; // For audio/video
}

// Call types
export interface Call {
    id: string;
    pactId: string;
    initiatorId: string;
    type: CallType;
    status: CallStatus;
    startedAt?: string;
    endedAt?: string;
    duration?: number;
}

export enum CallType {
    AUDIO = 'audio',
    VIDEO = 'video',
}

export enum CallStatus {
    RINGING = 'ringing',
    CONNECTING = 'connecting',
    CONNECTED = 'connected',
    ENDED = 'ended',
    MISSED = 'missed',
    DECLINED = 'declined',
    FAILED = 'failed',
}

// Notification types
export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    timestamp: string;
    read: boolean;
    data?: Record<string, unknown>;
}

export enum NotificationType {
    PACT_REQUEST = 'pact_request',
    PACT_ACCEPTED = 'pact_accepted',
    MESSAGE = 'message',
    CALL = 'call',
    SYSTEM = 'system',
}

// Encryption types
export interface EncryptionKeys {
    identityKeyPair: CryptoKeyPair;
    signingKeyPair: CryptoKeyPair;
}

// Settings types
export interface Settings {
    theme: 'light' | 'dark' | 'system';
    notifications: boolean;
    soundEnabled: boolean;
    autoAcceptCalls: boolean;
    showReadReceipts: boolean;
}

// API Response types
export interface ApiResponse<T> {
    data?: T;
    error?: string;
    success: boolean;
}
