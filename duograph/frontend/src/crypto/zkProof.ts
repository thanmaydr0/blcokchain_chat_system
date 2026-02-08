/**
 * Zero-Knowledge Proof for Signaling
 * 
 * Generates ephemeral "Ghost IDs" for anonymous signaling on Nostr.
 * Allows pact members to recognize each other without revealing real identity.
 * 
 * Security Properties:
 * - Ghost IDs are deterministically derived from shared pact secret + date
 * - Same inputs produce same Ghost ID (for recognition)
 * - Different days produce different Ghost IDs (unlinkability across days)
 * - No information about real identity is leaked
 */

// ============================================================================
// Constants
// ============================================================================

const GHOST_ID_VERSION = 1;
const GHOST_ID_LENGTH = 32; // 256 bits
const DERIVATION_INFO = 'DuoGraph-GhostID-v1';

// ============================================================================
// Utility: Convert Uint8Array to ArrayBuffer (TypeScript strict mode fix)
// ============================================================================

const toArrayBuffer = (arr: Uint8Array): ArrayBuffer => {
    return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer;
};

// ============================================================================
// Types
// ============================================================================

export interface GhostId {
    /** The ephemeral identity (hex string) */
    id: string;
    /** Date this Ghost ID is valid for (YYYY-MM-DD) */
    validFor: string;
    /** Version for future compatibility */
    version: number;
    /** Hash of the pact ID (for internal verification) */
    pactHash: string;
}

export interface GhostIdProof {
    /** The Ghost ID being proven */
    ghostId: string;
    /** Commitment to the pact secret (hashed) */
    commitment: string;
    /** Challenge response for verification */
    response: string;
    /** Timestamp of proof generation */
    timestamp: number;
}

export interface NostrEventTemplate {
    kind: number;
    content: string;
    tags: string[][];
    created_at: number;
}

export interface SignedNostrEvent extends NostrEventTemplate {
    id: string;
    pubkey: string;
    sig: string;
}

// ============================================================================
// Ghost ID Generation
// ============================================================================

/**
 * Generate a Ghost ID from pact secret and optional date.
 * Same inputs produce same Ghost ID (deterministic).
 */
export const generateGhostId = async (
    pactSecret: CryptoKey | Uint8Array,
    pactId: string,
    date?: Date
): Promise<GhostId> => {
    // Use provided date or current date
    const targetDate = date || new Date();
    const dateString = formatDate(targetDate);

    // Get pact secret as bytes
    const secretBytes = await getSecretBytes(pactSecret);

    // Derive Ghost ID: HKDF(secret, date + pactId, info)
    const salt = new TextEncoder().encode(`${dateString}:${pactId}`);
    const info = new TextEncoder().encode(DERIVATION_INFO);

    const ghostIdBytes = await hkdfDerive(secretBytes, salt, info, GHOST_ID_LENGTH);

    // Create pact hash for internal verification
    const pactHashBytes = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(pactId)
    );

    return {
        id: bytesToHex(ghostIdBytes),
        validFor: dateString,
        version: GHOST_ID_VERSION,
        pactHash: bytesToHex(new Uint8Array(pactHashBytes).slice(0, 8)),
    };
};

/**
 * Verify that a Ghost ID matches expected derivation.
 */
export const verifyGhostId = async (
    ghostId: GhostId,
    pactSecret: CryptoKey | Uint8Array,
    pactId: string
): Promise<boolean> => {
    try {
        const expected = await generateGhostId(
            pactSecret,
            pactId,
            new Date(ghostId.validFor)
        );
        return expected.id === ghostId.id;
    } catch {
        return false;
    }
};

/**
 * Check if a Ghost ID is valid for the current date.
 */
export const isGhostIdCurrent = (ghostId: GhostId): boolean => {
    const today = formatDate(new Date());
    return ghostId.validFor === today;
};

/**
 * Generate Ghost IDs for a date range (for receiving messages).
 */
export const generateGhostIdRange = async (
    pactSecret: CryptoKey | Uint8Array,
    pactId: string,
    daysBack: number = 7,
    daysForward: number = 1
): Promise<Map<string, GhostId>> => {
    const ghostIds = new Map<string, GhostId>();
    const today = new Date();

    for (let i = -daysBack; i <= daysForward; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);

        const ghostId = await generateGhostId(pactSecret, pactId, date);
        ghostIds.set(ghostId.id, ghostId);
    }

    return ghostIds;
};

// ============================================================================
// Zero-Knowledge Proof Generation
// ============================================================================

/**
 * Generate a proof that you know the pact secret for a Ghost ID.
 * Does not reveal the actual secret.
 */
export const generateGhostIdProof = async (
    pactSecret: CryptoKey | Uint8Array,
    ghostId: GhostId
): Promise<GhostIdProof> => {
    const secretBytes = await getSecretBytes(pactSecret);
    const timestamp = Date.now();

    // Create commitment: H(secret || timestamp)
    const commitmentInput = new Uint8Array([...secretBytes, ...new TextEncoder().encode(timestamp.toString())]);
    const commitmentHash = await crypto.subtle.digest('SHA-256', toArrayBuffer(commitmentInput));
    const commitment = bytesToHex(new Uint8Array(commitmentHash));

    // Create challenge: H(ghostId || commitment)
    const challengeInput = new TextEncoder().encode(`${ghostId.id}:${commitment}`);
    const challengeHash = await crypto.subtle.digest('SHA-256', toArrayBuffer(challengeInput));
    const challenge = new Uint8Array(challengeHash);

    // Create response: HMAC(secret, challenge)
    const hmacKey = await crypto.subtle.importKey(
        'raw',
        toArrayBuffer(secretBytes),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const responseBytes = await crypto.subtle.sign('HMAC', hmacKey, toArrayBuffer(challenge));
    const response = bytesToHex(new Uint8Array(responseBytes));

    return {
        ghostId: ghostId.id,
        commitment,
        response,
        timestamp,
    };
};

/**
 * Verify a Zero-Knowledge proof.
 * Verifier must also know the pact secret.
 */
export const verifyGhostIdProof = async (
    pactSecret: CryptoKey | Uint8Array,
    proof: GhostIdProof,
    maxAge: number = 5 * 60 * 1000 // 5 minutes
): Promise<boolean> => {
    // Check timestamp freshness
    const age = Date.now() - proof.timestamp;
    if (age > maxAge || age < 0) {
        return false;
    }

    const secretBytes = await getSecretBytes(pactSecret);

    // Recreate commitment
    const commitmentInput = new Uint8Array([...secretBytes, ...new TextEncoder().encode(proof.timestamp.toString())]);
    const commitmentHash = await crypto.subtle.digest('SHA-256', toArrayBuffer(commitmentInput));
    const expectedCommitment = bytesToHex(new Uint8Array(commitmentHash));

    if (expectedCommitment !== proof.commitment) {
        return false;
    }

    // Recreate challenge
    const challengeInput = new TextEncoder().encode(`${proof.ghostId}:${proof.commitment}`);
    const challengeHash = await crypto.subtle.digest('SHA-256', toArrayBuffer(challengeInput));
    const challenge = new Uint8Array(challengeHash);

    // Verify response
    const hmacKey = await crypto.subtle.importKey(
        'raw',
        toArrayBuffer(secretBytes),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const expectedResponseBytes = await crypto.subtle.sign('HMAC', hmacKey, toArrayBuffer(challenge));
    const expectedResponse = bytesToHex(new Uint8Array(expectedResponseBytes));

    return expectedResponse === proof.response;
};

// ============================================================================
// Nostr Signaling
// ============================================================================

/**
 * Create a Nostr event for signaling using Ghost ID.
 */
export const createNostrSignalingEvent = async (
    ghostId: GhostId,
    signingKey: CryptoKey,
    content: string,
    kind: number = 30078 // NIP-78: Arbitrary custom app data
): Promise<SignedNostrEvent> => {
    const created_at = Math.floor(Date.now() / 1000);

    const eventTemplate: NostrEventTemplate = {
        kind,
        content,
        tags: [
            ['d', ghostId.id], // Unique identifier tag
            ['ghost-version', GHOST_ID_VERSION.toString()],
            ['valid-for', ghostId.validFor],
        ],
        created_at,
    };

    // Calculate event ID: SHA256(serialized event)
    const serialized = JSON.stringify([
        0, // Reserved for future use
        ghostId.id, // pubkey (using Ghost ID as ephemeral pubkey)
        created_at,
        kind,
        eventTemplate.tags,
        content,
    ]);

    const idHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized));
    const id = bytesToHex(new Uint8Array(idHash));

    // Sign the event ID
    const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        signingKey,
        new TextEncoder().encode(id)
    );

    return {
        ...eventTemplate,
        id,
        pubkey: ghostId.id,
        sig: bytesToHex(new Uint8Array(signature)),
    };
};

/**
 * Verify a Nostr signaling event came from a known Ghost ID.
 */
export const verifyNostrSignalingEvent = (
    event: SignedNostrEvent,
    knownGhostIds: Map<string, GhostId>
): GhostId | null => {
    return knownGhostIds.get(event.pubkey) || null;
};

/**
 * Create encrypted content for Nostr event (NIP-04 style).
 */
export const encryptNostrContent = async (
    sharedSecret: CryptoKey | Uint8Array,
    plaintext: string
): Promise<string> => {
    const secretBytes = await getSecretBytes(sharedSecret);

    // Derive encryption key
    const encKey = await crypto.subtle.importKey(
        'raw',
        secretBytes.slice(0, 32),
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
    );

    // Generate IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        encKey,
        new TextEncoder().encode(plaintext)
    );

    // Format: base64(ciphertext)?iv=base64(iv)
    const ctBase64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
    const ivBase64 = btoa(String.fromCharCode(...iv));

    return `${ctBase64}?iv=${ivBase64}`;
};

/**
 * Decrypt Nostr event content.
 */
export const decryptNostrContent = async (
    sharedSecret: CryptoKey | Uint8Array,
    encrypted: string
): Promise<string> => {
    const [ctBase64, ivPart] = encrypted.split('?iv=');
    if (!ivPart) throw new Error('Invalid encrypted format');

    const secretBytes = await getSecretBytes(sharedSecret);

    // Derive encryption key
    const encKey = await crypto.subtle.importKey(
        'raw',
        secretBytes.slice(0, 32),
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
    );

    // Decode
    const ciphertext = Uint8Array.from(atob(ctBase64), (c) => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(ivPart), (c) => c.charCodeAt(0));

    // Decrypt
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, encKey, ciphertext);

    return new TextDecoder().decode(plaintext);
};

// ============================================================================
// Session Unlinkability
// ============================================================================

/**
 * Generate a session-specific sub-identity from Ghost ID.
 * Provides additional unlinkability within a day.
 */
export const deriveSessionId = async (
    ghostId: GhostId,
    sessionSalt: Uint8Array
): Promise<string> => {
    const input = new Uint8Array([
        ...hexToBytes(ghostId.id),
        ...sessionSalt,
    ]);

    const hash = await crypto.subtle.digest('SHA-256', input);
    return bytesToHex(new Uint8Array(hash));
};

/**
 * Generate random session salt.
 */
export const generateSessionSalt = (): Uint8Array => {
    return crypto.getRandomValues(new Uint8Array(16));
};

// ============================================================================
// Utility Functions
// ============================================================================

const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
};

const getSecretBytes = async (secret: CryptoKey | Uint8Array): Promise<Uint8Array> => {
    if (secret instanceof Uint8Array) {
        return secret;
    }

    const raw = await crypto.subtle.exportKey('raw', secret);
    return new Uint8Array(raw);
};

const hkdfDerive = async (
    ikm: Uint8Array,
    salt: Uint8Array,
    info: Uint8Array,
    length: number
): Promise<Uint8Array> => {
    const keyMaterial = await crypto.subtle.importKey('raw', toArrayBuffer(ikm), 'HKDF', false, ['deriveBits']);

    const bits = await crypto.subtle.deriveBits(
        {
            name: 'HKDF',
            hash: 'SHA-256',
            salt: toArrayBuffer(salt),
            info: toArrayBuffer(info),
        },
        keyMaterial,
        length * 8
    );

    return new Uint8Array(bits);
};

const bytesToHex = (bytes: Uint8Array): string => {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
};

const hexToBytes = (hex: string): Uint8Array => {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
};
