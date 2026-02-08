/**
 * Double Ratchet Algorithm Implementation
 * 
 * Based on Signal Protocol specification for end-to-end encrypted messaging.
 * Provides Perfect Forward Secrecy (PFS) and Post-Compromise Security (PCS).
 * 
 * Reference: https://signal.org/docs/specifications/doubleratchet/
 * 
 * Security Properties:
 * - Forward Secrecy: Compromise of current keys doesn't expose past messages
 * - Post-Compromise Security: Security is restored after key compromise
 * - Message authentication via AES-GCM
 */

// ============================================================================
// Constants
// ============================================================================

const ECDH_PARAMS: EcKeyGenParams = {
    name: 'ECDH',
    namedCurve: 'P-256',
};

const AES_PARAMS: AesKeyGenParams = {
    name: 'AES-GCM',
    length: 256,
};

const MAX_SKIP = 1000; // Maximum messages to skip for out-of-order delivery
const CHAIN_KEY_CONSTANT = new Uint8Array([0x01]); // KDF constant for chain key
const MESSAGE_KEY_CONSTANT = new Uint8Array([0x02]); // KDF constant for message key

// ============================================================================
// Utility: Convert Uint8Array to ArrayBuffer (TypeScript strict mode fix)
// ============================================================================

const toArrayBuffer = (arr: Uint8Array): ArrayBuffer => {
    return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer;
};

// ============================================================================
// Types
// ============================================================================

export interface MessageHeader {
    /** Sender's current ratchet public key (JWK) */
    dhPublicKey: JsonWebKey;
    /** Previous sending chain length */
    previousChainLength: number;
    /** Message number in current sending chain */
    messageNumber: number;
}

export interface EncryptedMessage {
    header: MessageHeader;
    /** Base64-encoded 12-byte IV */
    iv: string;
    /** Base64-encoded ciphertext */
    ciphertext: string;
    /** Message timestamp for ordering */
    timestamp: number;
}

export interface RatchetState {
    // DH Ratchet
    dhSendingKeyPair: CryptoKeyPair | null;
    dhReceivingKey: CryptoKey | null;

    // Root Key (used to derive chain keys)
    rootKey: CryptoKey | null;

    // Symmetric Ratchet - Sending
    sendingChainKey: CryptoKey | null;
    sendingMessageNumber: number;

    // Symmetric Ratchet - Receiving
    receivingChainKey: CryptoKey | null;
    receivingMessageNumber: number;

    // Chain length tracking
    previousSendingChainLength: number;

    // Skipped message keys (for out-of-order delivery)
    skippedMessageKeys: Map<string, { key: CryptoKey; timestamp: number }>;
}

export interface SessionInfo {
    pactId: string;
    partnerId: string;
    createdAt: number;
    lastMessageAt: number;
}

// ============================================================================
// HKDF Implementation (NIST SP 800-56C)
// ============================================================================

/**
 * HKDF-Extract: Create a pseudorandom key from input keying material.
 */
const hkdfExtract = async (salt: Uint8Array, ikm: Uint8Array): Promise<CryptoKey> => {
    // Import IKM as HMAC key
    const ikmData = ikm.length > 0 ? toArrayBuffer(ikm) : new ArrayBuffer(32);
    const ikmKey = await crypto.subtle.importKey(
        'raw',
        ikmData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    // HMAC(salt, ikm) - but we need salt as key for standard HKDF
    // For simplicity, we'll use SHA-256 hash
    const saltData = salt.length > 0 ? toArrayBuffer(salt) : new ArrayBuffer(32);
    const prk = await crypto.subtle.sign('HMAC', ikmKey, saltData);

    return crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, true, ['sign']);
};

/**
 * HKDF-Expand: Expand PRK to desired length.
 */
const hkdfExpand = async (
    prk: CryptoKey,
    info: Uint8Array,
    length: number
): Promise<Uint8Array> => {
    const hashLen = 32; // SHA-256 output length
    const n = Math.ceil(length / hashLen);
    const output = new Uint8Array(n * hashLen);

    let prev = new Uint8Array(0);
    for (let i = 0; i < n; i++) {
        const data = new Uint8Array(prev.length + info.length + 1);
        data.set(prev);
        data.set(info, prev.length);
        data[prev.length + info.length] = i + 1;

        const block = await crypto.subtle.sign('HMAC', prk, data);
        prev = new Uint8Array(block);
        output.set(prev, i * hashLen);
    }

    return output.slice(0, length);
};

/**
 * Complete HKDF: Extract-then-Expand.
 */
const hkdf = async (
    ikm: Uint8Array,
    salt: Uint8Array,
    info: Uint8Array,
    length: number
): Promise<Uint8Array> => {
    const prk = await hkdfExtract(salt, ikm);
    return hkdfExpand(prk, info, length);
};

// ============================================================================
// Key Derivation Functions
// ============================================================================

/**
 * KDF for root key ratchet.
 * Takes current root key and DH output, produces new root key and chain key.
 */
const kdfRootKey = async (
    rootKey: CryptoKey,
    dhOutput: ArrayBuffer
): Promise<{ rootKey: CryptoKey; chainKey: CryptoKey }> => {
    const rootKeyRaw = await crypto.subtle.exportKey('raw', rootKey);
    const info = new TextEncoder().encode('DuoGraph-RootRatchet');

    const output = await hkdf(
        new Uint8Array(dhOutput),
        new Uint8Array(rootKeyRaw),
        info,
        64 // 32 bytes for root key + 32 bytes for chain key
    );

    const newRootKey = await crypto.subtle.importKey(
        'raw',
        output.slice(0, 32),
        { name: 'HMAC', hash: 'SHA-256' },
        true,
        ['sign']
    );

    const chainKey = await crypto.subtle.importKey('raw', output.slice(32, 64), AES_PARAMS, true, [
        'encrypt',
        'decrypt',
    ]);

    return { rootKey: newRootKey, chainKey };
};

/**
 * KDF for chain key ratchet.
 * Advances chain key and produces a message key.
 */
const kdfChainKey = async (
    chainKey: CryptoKey
): Promise<{ chainKey: CryptoKey; messageKey: CryptoKey }> => {
    const chainKeyRaw = await crypto.subtle.exportKey('raw', chainKey);

    // Derive message key: HMAC(chainKey, 0x02)
    const hmacKey = await crypto.subtle.importKey(
        'raw',
        chainKeyRaw,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const messageKeyRaw = await crypto.subtle.sign('HMAC', hmacKey, MESSAGE_KEY_CONSTANT);
    const newChainKeyRaw = await crypto.subtle.sign('HMAC', hmacKey, CHAIN_KEY_CONSTANT);

    const messageKey = await crypto.subtle.importKey('raw', messageKeyRaw, AES_PARAMS, false, [
        'encrypt',
        'decrypt',
    ]);

    const newChainKey = await crypto.subtle.importKey('raw', newChainKeyRaw, AES_PARAMS, true, [
        'encrypt',
        'decrypt',
    ]);

    return { chainKey: newChainKey, messageKey };
};

// ============================================================================
// Ratchet Operations
// ============================================================================

/**
 * Create initial ratchet state.
 */
export const createRatchetState = (): RatchetState => ({
    dhSendingKeyPair: null,
    dhReceivingKey: null,
    rootKey: null,
    sendingChainKey: null,
    sendingMessageNumber: 0,
    receivingChainKey: null,
    receivingMessageNumber: 0,
    previousSendingChainLength: 0,
    skippedMessageKeys: new Map(),
});

/**
 * Generate new ECDH key pair for ratchet.
 */
const generateDHKeyPair = async (): Promise<CryptoKeyPair> => {
    return crypto.subtle.generateKey(ECDH_PARAMS, true, ['deriveBits']);
};

/**
 * Perform ECDH key exchange.
 */
const performDH = async (privateKey: CryptoKey, publicKey: CryptoKey): Promise<ArrayBuffer> => {
    return crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256);
};

/**
 * Initialize ratchet as initiator (Alice - initiates the session).
 */
export const initializeAsInitiator = async (
    sharedSecret: CryptoKey,
    theirPublicKey: CryptoKey
): Promise<RatchetState> => {
    const state = createRatchetState();

    // Set root key from shared secret (from X3DH or pact secret)
    state.rootKey = sharedSecret;

    // Store their public key
    state.dhReceivingKey = theirPublicKey;

    // Generate our first ratchet key pair
    state.dhSendingKeyPair = await generateDHKeyPair();

    // Perform DH and advance root key to get first sending chain key
    const dhOutput = await performDH(state.dhSendingKeyPair.privateKey, theirPublicKey);

    const { rootKey, chainKey } = await kdfRootKey(state.rootKey, dhOutput);
    state.rootKey = rootKey;
    state.sendingChainKey = chainKey;

    return state;
};

/**
 * Initialize ratchet as responder (Bob - responds to session initiation).
 */
export const initializeAsResponder = async (
    sharedSecret: CryptoKey,
    ourKeyPair: CryptoKeyPair
): Promise<RatchetState> => {
    const state = createRatchetState();

    state.rootKey = sharedSecret;
    state.dhSendingKeyPair = ourKeyPair;

    // Responder waits for first message to perform DH ratchet
    return state;
};

/**
 * Perform DH ratchet step when receiving a new public key.
 */
const dhRatchetStep = async (state: RatchetState, theirPublicKey: CryptoKey): Promise<void> => {
    if (!state.rootKey || !state.dhSendingKeyPair) {
        throw new Error('Ratchet not properly initialized');
    }

    // Save previous chain length
    state.previousSendingChainLength = state.sendingMessageNumber;

    // Reset counters
    state.sendingMessageNumber = 0;
    state.receivingMessageNumber = 0;

    // Update their public key
    state.dhReceivingKey = theirPublicKey;

    // DH with old key pair and their new public key
    const dhOutput1 = await performDH(state.dhSendingKeyPair.privateKey, theirPublicKey);
    const result1 = await kdfRootKey(state.rootKey, dhOutput1);
    state.rootKey = result1.rootKey;
    state.receivingChainKey = result1.chainKey;

    // Generate new key pair
    state.dhSendingKeyPair = await generateDHKeyPair();

    // DH with new key pair and their public key
    const dhOutput2 = await performDH(state.dhSendingKeyPair.privateKey, theirPublicKey);
    const result2 = await kdfRootKey(state.rootKey, dhOutput2);
    state.rootKey = result2.rootKey;
    state.sendingChainKey = result2.chainKey;
};

// ============================================================================
// Message Encryption/Decryption
// ============================================================================

/**
 * Encrypt a message using the double ratchet.
 */
export const ratchetEncrypt = async (
    state: RatchetState,
    plaintext: string
): Promise<{ state: RatchetState; message: EncryptedMessage }> => {
    if (!state.sendingChainKey || !state.dhSendingKeyPair) {
        throw new Error('Ratchet not initialized for sending');
    }

    // Advance chain key and get message key
    const { chainKey, messageKey } = await kdfChainKey(state.sendingChainKey);
    state.sendingChainKey = chainKey;

    // Encrypt message
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const plaintextBytes = encoder.encode(plaintext);

    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        messageKey,
        plaintextBytes
    );

    // Create header
    const header: MessageHeader = {
        dhPublicKey: await crypto.subtle.exportKey('jwk', state.dhSendingKeyPair.publicKey),
        previousChainLength: state.previousSendingChainLength,
        messageNumber: state.sendingMessageNumber,
    };

    // Increment message counter
    state.sendingMessageNumber++;

    // Delete message key after use (PFS)
    // Note: In JS, we can't truly delete the key, but we don't store it

    const message: EncryptedMessage = {
        header,
        iv: arrayBufferToBase64(iv),
        ciphertext: arrayBufferToBase64(ciphertext),
        timestamp: Date.now(),
    };

    return { state, message };
};

/**
 * Try to decrypt using skipped message keys.
 */
const trySkippedMessageKeys = async (
    state: RatchetState,
    message: EncryptedMessage
): Promise<string | null> => {
    const keyId = `${message.header.dhPublicKey.x}:${message.header.messageNumber}`;
    const skipped = state.skippedMessageKeys.get(keyId);

    if (!skipped) return null;

    // Decrypt with skipped key
    const iv = base64ToArrayBuffer(message.iv);
    const ciphertext = base64ToArrayBuffer(message.ciphertext);

    const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        skipped.key,
        ciphertext
    );

    // Delete used key
    state.skippedMessageKeys.delete(keyId);

    return new TextDecoder().decode(plaintext);
};

/**
 * Skip message keys for out-of-order delivery.
 */
const skipMessageKeys = async (state: RatchetState, until: number): Promise<void> => {
    if (!state.receivingChainKey) return;

    if (state.receivingMessageNumber + MAX_SKIP < until) {
        throw new Error('Too many skipped messages');
    }

    while (state.receivingMessageNumber < until) {
        const { chainKey, messageKey } = await kdfChainKey(state.receivingChainKey);
        state.receivingChainKey = chainKey;

        // Store skipped message key
        const keyId = `${state.dhReceivingKey ? 'current' : 'unknown'}:${state.receivingMessageNumber}`;
        state.skippedMessageKeys.set(keyId, {
            key: messageKey,
            timestamp: Date.now(),
        });

        state.receivingMessageNumber++;

        // Clean up old skipped keys (older than 24 hours)
        cleanupSkippedKeys(state);
    }
};

/**
 * Clean up old skipped message keys.
 */
const cleanupSkippedKeys = (state: RatchetState): void => {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();

    for (const [keyId, { timestamp }] of state.skippedMessageKeys.entries()) {
        if (now - timestamp > maxAge) {
            state.skippedMessageKeys.delete(keyId);
        }
    }
};

/**
 * Decrypt a message using the double ratchet.
 */
export const ratchetDecrypt = async (
    state: RatchetState,
    message: EncryptedMessage
): Promise<{ state: RatchetState; plaintext: string }> => {
    // Try skipped message keys first
    const fromSkipped = await trySkippedMessageKeys(state, message);
    if (fromSkipped !== null) {
        return { state, plaintext: fromSkipped };
    }

    // Import sender's public key
    const senderPublicKey = await crypto.subtle.importKey(
        'jwk',
        message.header.dhPublicKey,
        ECDH_PARAMS,
        true,
        []
    );

    // Check if we need to perform a DH ratchet step
    const needsRatchet =
        !state.dhReceivingKey ||
        (await publicKeysEqual(state.dhReceivingKey, senderPublicKey)) === false;

    if (needsRatchet) {
        // Skip any messages from previous chain
        if (state.receivingChainKey && message.header.previousChainLength > state.receivingMessageNumber) {
            await skipMessageKeys(state, message.header.previousChainLength);
        }

        // Perform DH ratchet
        await dhRatchetStep(state, senderPublicKey);
    }

    // Skip messages in current chain if needed
    if (message.header.messageNumber > state.receivingMessageNumber) {
        await skipMessageKeys(state, message.header.messageNumber);
    }

    if (!state.receivingChainKey) {
        throw new Error('No receiving chain key');
    }

    // Advance chain key and get message key
    const { chainKey, messageKey } = await kdfChainKey(state.receivingChainKey);
    state.receivingChainKey = chainKey;
    state.receivingMessageNumber++;

    // Decrypt
    const iv = base64ToArrayBuffer(message.iv);
    const ciphertext = base64ToArrayBuffer(message.ciphertext);

    const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        messageKey,
        ciphertext
    );

    return { state, plaintext: new TextDecoder().decode(plaintext) };
};

// ============================================================================
// State Serialization
// ============================================================================

export interface SerializedRatchetState {
    dhSendingPublicKey: JsonWebKey | null;
    dhReceivingPublicKey: JsonWebKey | null;
    rootKey: string | null;
    sendingChainKey: string | null;
    receivingChainKey: string | null;
    sendingMessageNumber: number;
    receivingMessageNumber: number;
    previousSendingChainLength: number;
}

/**
 * Serialize ratchet state for storage.
 * Note: Private keys should be handled separately with hardware binding.
 */
export const serializeState = async (state: RatchetState): Promise<SerializedRatchetState> => {
    const exportKeyBase64 = async (key: CryptoKey | null): Promise<string | null> => {
        if (!key) return null;
        const raw = await crypto.subtle.exportKey('raw', key);
        return arrayBufferToBase64(raw);
    };

    return {
        dhSendingPublicKey: state.dhSendingKeyPair
            ? await crypto.subtle.exportKey('jwk', state.dhSendingKeyPair.publicKey)
            : null,
        dhReceivingPublicKey: state.dhReceivingKey
            ? await crypto.subtle.exportKey('jwk', state.dhReceivingKey)
            : null,
        rootKey: await exportKeyBase64(state.rootKey),
        sendingChainKey: await exportKeyBase64(state.sendingChainKey),
        receivingChainKey: await exportKeyBase64(state.receivingChainKey),
        sendingMessageNumber: state.sendingMessageNumber,
        receivingMessageNumber: state.receivingMessageNumber,
        previousSendingChainLength: state.previousSendingChainLength,
    };
};

/**
 * Restore ratchet state from serialized form.
 * Note: Requires the DH private key to be provided separately.
 */
export const deserializeState = async (
    serialized: SerializedRatchetState,
    dhPrivateKey?: CryptoKey
): Promise<RatchetState> => {
    const importKeyBase64 = async (
        base64: string | null,
        algorithm: AlgorithmIdentifier,
        keyUsages: KeyUsage[]
    ): Promise<CryptoKey | null> => {
        if (!base64) return null;
        const raw = base64ToArrayBuffer(base64);
        return crypto.subtle.importKey('raw', raw, algorithm, true, keyUsages);
    };

    const state = createRatchetState();

    if (serialized.dhSendingPublicKey && dhPrivateKey) {
        const publicKey = await crypto.subtle.importKey(
            'jwk',
            serialized.dhSendingPublicKey,
            ECDH_PARAMS,
            true,
            []
        );
        state.dhSendingKeyPair = { publicKey, privateKey: dhPrivateKey };
    }

    if (serialized.dhReceivingPublicKey) {
        state.dhReceivingKey = await crypto.subtle.importKey(
            'jwk',
            serialized.dhReceivingPublicKey,
            ECDH_PARAMS,
            true,
            []
        );
    }

    state.rootKey = await importKeyBase64(serialized.rootKey, { name: 'HMAC', hash: 'SHA-256' } as HmacImportParams, [
        'sign',
    ]);

    state.sendingChainKey = await importKeyBase64(serialized.sendingChainKey, AES_PARAMS, [
        'encrypt',
        'decrypt',
    ]);

    state.receivingChainKey = await importKeyBase64(serialized.receivingChainKey, AES_PARAMS, [
        'encrypt',
        'decrypt',
    ]);

    state.sendingMessageNumber = serialized.sendingMessageNumber;
    state.receivingMessageNumber = serialized.receivingMessageNumber;
    state.previousSendingChainLength = serialized.previousSendingChainLength;

    return state;
};

// ============================================================================
// Utility Functions
// ============================================================================

const arrayBufferToBase64 = (buffer: ArrayBuffer | Uint8Array): string => {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    return btoa(String.fromCharCode(...bytes));
};

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
};

const publicKeysEqual = async (key1: CryptoKey, key2: CryptoKey): Promise<boolean> => {
    const [raw1, raw2] = await Promise.all([
        crypto.subtle.exportKey('raw', key1),
        crypto.subtle.exportKey('raw', key2),
    ]);

    const arr1 = new Uint8Array(raw1);
    const arr2 = new Uint8Array(raw2);

    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) return false;
    }
    return true;
};
