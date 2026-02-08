/**
 * Nostr Signaling Module
 * 
 * WebRTC signaling using Nostr ephemeral events.
 * Uses Ghost IDs for privacy-preserving signaling.
 */

import {
    SimplePool,
    generateSecretKey,
    getPublicKey,
    finalizeEvent,
    nip19,
} from 'nostr-tools';
import type { Event, Filter, UnsignedEvent } from 'nostr-tools';

// ============================================================================
// Types
// ============================================================================

export interface NostrSignalingOptions {
    ghostId: string;
    pactId: string;
    onOffer: (offer: RTCSessionDescriptionInit, fromGhostId: string) => void;
    onAnswer: (answer: RTCSessionDescriptionInit, fromGhostId: string) => void;
    onIceCandidate: (candidate: RTCIceCandidateInit, fromGhostId: string) => void;
    onError: (error: Error) => void;
    onConnected: () => void;
}

export interface SignalMessage {
    type: 'offer' | 'answer' | 'ice' | 'ping' | 'hangup';
    ghostId: string;
    targetGhostId: string;
    pactId: string;
    payload: string; // JSON stringified payload
    timestamp: number;
}

export type SignalingState =
    | 'disconnected'
    | 'connecting'
    | 'connected'
    | 'error';

// ============================================================================
// Constants
// ============================================================================

// Public Nostr relays for signaling
const DEFAULT_RELAYS = [
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://relay.nostr.band',
    'wss://nostr.wine',
    'wss://relay.current.fyi',
];

// Ephemeral event kinds (20000-29999 range per NIP-16)
const SIGNAL_EVENT_KIND = 20420; // Custom ephemeral event for WebRTC signaling

// Signal expiration time (5 minutes)
const SIGNAL_EXPIRY_SECONDS = 300;

// ============================================================================
// Ghost ID Generation
// ============================================================================

/**
 * Generate a new Ghost ID for anonymous signaling.
 * This is NOT the user's blockchain identity.
 */
export const generateGhostId = (): { ghostId: string; secretKey: Uint8Array; publicKey: string } => {
    const secretKey = generateSecretKey();
    const publicKey = getPublicKey(secretKey);
    const ghostId = nip19.npubEncode(publicKey);

    return { ghostId, secretKey, publicKey };
};

/**
 * Decode a Ghost ID to get the public key.
 */
export const decodeGhostId = (ghostId: string): string | null => {
    try {
        const decoded = nip19.decode(ghostId);
        if (decoded.type === 'npub') {
            return decoded.data;
        }
        return null;
    } catch {
        return null;
    }
};

// ============================================================================
// Nostr Signaling Class
// ============================================================================

export class NostrSignaling {
    private pool: SimplePool;
    private secretKey: Uint8Array;
    private publicKey: string;
    private ghostId: string;
    private pactId: string;
    private options: NostrSignalingOptions;
    private state: SignalingState = 'disconnected';
    private subscriptionClose: (() => void) | null = null;
    private relays: string[] = DEFAULT_RELAYS;

    constructor(secretKey: Uint8Array, options: NostrSignalingOptions) {
        this.pool = new SimplePool();
        this.secretKey = secretKey;
        this.publicKey = getPublicKey(secretKey);
        this.ghostId = options.ghostId;
        this.pactId = options.pactId;
        this.options = options;
    }

    /**
     * Get current signaling state.
     */
    getState(): SignalingState {
        return this.state;
    }

    /**
     * Connect to Nostr relays and start listening.
     */
    async connect(customRelays?: string[]): Promise<void> {
        if (this.state === 'connected' || this.state === 'connecting') {
            return;
        }

        this.state = 'connecting';
        this.relays = customRelays || DEFAULT_RELAYS;

        try {
            // Subscribe to ephemeral events for this pact
            const filter: Filter = {
                kinds: [SIGNAL_EVENT_KIND],
                '#p': [this.pactId],
                since: Math.floor(Date.now() / 1000) - 60, // Last minute
            };

            const sub = this.pool.subscribeMany(
                this.relays,
                filter,
                {
                    onevent: (event: Event) => {
                        this.handleIncomingEvent(event);
                    },
                    oneose: () => {
                        // End of stored events
                    },
                }
            );

            this.subscriptionClose = () => sub.close();

            this.state = 'connected';
            this.options.onConnected();
        } catch (error) {
            this.state = 'error';
            this.options.onError(
                error instanceof Error ? error : new Error('Failed to connect to relays')
            );
        }
    }

    /**
     * Handle incoming Nostr event.
     */
    private handleIncomingEvent(event: Event): void {
        try {
            // Parse the signal message from content
            const signal: SignalMessage = JSON.parse(event.content);

            // Ignore our own messages
            if (signal.ghostId === this.ghostId) {
                return;
            }

            // Verify this is for our pact
            if (signal.pactId !== this.pactId) {
                return;
            }

            // Check if message is for us (or broadcast)
            if (signal.targetGhostId && signal.targetGhostId !== this.ghostId) {
                return;
            }

            // Check expiration
            const age = Date.now() / 1000 - signal.timestamp;
            if (age > SIGNAL_EXPIRY_SECONDS) {
                return;
            }

            // Route to appropriate handler
            const payload = JSON.parse(signal.payload);

            switch (signal.type) {
                case 'offer':
                    this.options.onOffer(payload as RTCSessionDescriptionInit, signal.ghostId);
                    break;
                case 'answer':
                    this.options.onAnswer(payload as RTCSessionDescriptionInit, signal.ghostId);
                    break;
                case 'ice':
                    this.options.onIceCandidate(payload as RTCIceCandidateInit, signal.ghostId);
                    break;
                case 'hangup':
                    // Handle hangup if needed
                    break;
            }
        } catch (error) {
            console.warn('Failed to parse signal event:', error);
        }
    }

    /**
     * Create and publish a signed Nostr event.
     */
    private async publishSignal(signal: SignalMessage): Promise<boolean> {
        try {
            const unsignedEvent: UnsignedEvent = {
                kind: SIGNAL_EVENT_KIND,
                pubkey: this.publicKey,
                created_at: Math.floor(Date.now() / 1000),
                tags: [
                    ['p', this.pactId],
                    ['expiration', String(Math.floor(Date.now() / 1000) + SIGNAL_EXPIRY_SECONDS)],
                ],
                content: JSON.stringify(signal),
            };

            const signedEvent = finalizeEvent(unsignedEvent, this.secretKey);

            // Publish to all relays
            await Promise.allSettled(
                this.relays.map(relay =>
                    this.pool.publish([relay], signedEvent)
                )
            );

            return true;
        } catch (error) {
            console.error('Failed to publish signal:', error);
            return false;
        }
    }

    /**
     * Send a WebRTC offer.
     */
    async sendOffer(offer: RTCSessionDescriptionInit, targetGhostId: string): Promise<boolean> {
        const signal: SignalMessage = {
            type: 'offer',
            ghostId: this.ghostId,
            targetGhostId,
            pactId: this.pactId,
            payload: JSON.stringify(offer),
            timestamp: Date.now() / 1000,
        };

        return this.publishSignal(signal);
    }

    /**
     * Send a WebRTC answer.
     */
    async sendAnswer(answer: RTCSessionDescriptionInit, targetGhostId: string): Promise<boolean> {
        const signal: SignalMessage = {
            type: 'answer',
            ghostId: this.ghostId,
            targetGhostId,
            pactId: this.pactId,
            payload: JSON.stringify(answer),
            timestamp: Date.now() / 1000,
        };

        return this.publishSignal(signal);
    }

    /**
     * Send an ICE candidate.
     */
    async sendIceCandidate(candidate: RTCIceCandidateInit, targetGhostId: string): Promise<boolean> {
        const signal: SignalMessage = {
            type: 'ice',
            ghostId: this.ghostId,
            targetGhostId,
            pactId: this.pactId,
            payload: JSON.stringify(candidate),
            timestamp: Date.now() / 1000,
        };

        return this.publishSignal(signal);
    }

    /**
     * Send a hangup signal.
     */
    async sendHangup(targetGhostId: string): Promise<boolean> {
        const signal: SignalMessage = {
            type: 'hangup',
            ghostId: this.ghostId,
            targetGhostId,
            pactId: this.pactId,
            payload: '{}',
            timestamp: Date.now() / 1000,
        };

        return this.publishSignal(signal);
    }

    /**
     * Disconnect from relays.
     */
    disconnect(): void {
        if (this.subscriptionClose) {
            this.subscriptionClose();
            this.subscriptionClose = null;
        }

        this.pool.close(this.relays);
        this.state = 'disconnected';
    }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new Nostr signaling instance with a fresh Ghost ID.
 */
export const createNostrSignaling = (
    pactId: string,
    options: Omit<NostrSignalingOptions, 'ghostId' | 'pactId'>
): { signaling: NostrSignaling; ghostId: string } => {
    const { ghostId, secretKey } = generateGhostId();

    const signaling = new NostrSignaling(secretKey, {
        ...options,
        ghostId,
        pactId,
    });

    return { signaling, ghostId };
};
