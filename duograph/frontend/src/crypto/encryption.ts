/**
 * Message Encryption Utilities
 * 
 * AES-256-GCM encryption with proper key management and MAC.
 * Designed to work with the Double Ratchet protocol.
 */

// ============================================================================
// Constants
// ============================================================================

const AES_ALGORITHM = 'AES-GCM';
const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for AES-GCM
const TAG_LENGTH = 128; // Authentication tag length in bits

// ============================================================================
// Utility: Convert Uint8Array to ArrayBuffer (TypeScript strict mode fix)
// ============================================================================

const toArrayBuffer = (arr: Uint8Array): ArrayBuffer => {
    return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer;
};

// ============================================================================
// Types
// ============================================================================

export interface EncryptedPayload {
    /** Base64-encoded initialization vector */
    iv: string;
    /** Base64-encoded ciphertext (includes auth tag) */
    ciphertext: string;
    /** Algorithm identifier for future-proofing */
    algorithm: 'AES-256-GCM';
    /** Timestamp of encryption */
    timestamp: number;
}

export interface MessageEnvelope {
    /** Encrypted message payload */
    payload: EncryptedPayload;
    /** Message type indicator */
    type: 'text' | 'media' | 'system';
    /** Message ID for deduplication */
    messageId: string;
    /** Sender's public key fingerprint */
    senderFingerprint: string;
}

// ============================================================================
// Core Encryption Functions
// ============================================================================

/**
 * Encrypt plaintext with AES-256-GCM.
 */
export const encryptAesGcm = async (
    key: CryptoKey,
    plaintext: string | Uint8Array,
    additionalData?: Uint8Array
): Promise<EncryptedPayload> => {
    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    // Convert plaintext to bytes if string
    const plaintextBytes =
        typeof plaintext === 'string' ? new TextEncoder().encode(plaintext) : plaintext;

    // Encrypt with AES-GCM
    const ciphertext = await crypto.subtle.encrypt(
        {
            name: AES_ALGORITHM,
            iv: iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer,
            tagLength: TAG_LENGTH,
            additionalData: additionalData ? additionalData.buffer.slice(additionalData.byteOffset, additionalData.byteOffset + additionalData.byteLength) as ArrayBuffer : undefined,
        },
        key,
        plaintextBytes.buffer.slice(plaintextBytes.byteOffset, plaintextBytes.byteOffset + plaintextBytes.byteLength) as ArrayBuffer
    );

    return {
        iv: arrayBufferToBase64(iv),
        ciphertext: arrayBufferToBase64(ciphertext),
        algorithm: 'AES-256-GCM',
        timestamp: Date.now(),
    };
};

/**
 * Decrypt ciphertext with AES-256-GCM.
 */
export const decryptAesGcm = async (
    key: CryptoKey,
    payload: EncryptedPayload,
    additionalData?: Uint8Array
): Promise<Uint8Array> => {
    const iv = base64ToArrayBuffer(payload.iv);
    const ciphertext = base64ToArrayBuffer(payload.ciphertext);

    const plaintext = await crypto.subtle.decrypt(
        {
            name: AES_ALGORITHM,
            iv: iv,
            tagLength: TAG_LENGTH,
            additionalData: additionalData ? additionalData.buffer.slice(additionalData.byteOffset, additionalData.byteOffset + additionalData.byteLength) as ArrayBuffer : undefined,
        },
        key,
        ciphertext
    );

    return new Uint8Array(plaintext);
};

/**
 * Decrypt to string.
 */
export const decryptAesGcmString = async (
    key: CryptoKey,
    payload: EncryptedPayload,
    additionalData?: Uint8Array
): Promise<string> => {
    const plaintext = await decryptAesGcm(key, payload, additionalData);
    return new TextDecoder().decode(plaintext);
};

// ============================================================================
// Key Generation
// ============================================================================

/**
 * Generate a random AES-256 key.
 */
export const generateAesKey = async (extractable: boolean = false): Promise<CryptoKey> => {
    return crypto.subtle.generateKey(
        {
            name: AES_ALGORITHM,
            length: AES_KEY_LENGTH,
        },
        extractable,
        ['encrypt', 'decrypt']
    );
};

/**
 * Import AES key from raw bytes.
 */
export const importAesKey = async (
    keyData: Uint8Array | ArrayBuffer,
    extractable: boolean = false
): Promise<CryptoKey> => {
    const data = keyData instanceof ArrayBuffer
        ? keyData
        : toArrayBuffer(keyData);
    return crypto.subtle.importKey(
        'raw',
        data,
        {
            name: AES_ALGORITHM,
            length: AES_KEY_LENGTH,
        },
        extractable,
        ['encrypt', 'decrypt']
    );
};

/**
 * Export AES key to raw bytes.
 */
export const exportAesKey = async (key: CryptoKey): Promise<Uint8Array> => {
    const raw = await crypto.subtle.exportKey('raw', key);
    return new Uint8Array(raw);
};

// ============================================================================
// Key Derivation
// ============================================================================

/**
 * Derive encryption key from password/passphrase using PBKDF2.
 */
export const deriveKeyFromPassword = async (
    password: string,
    salt: Uint8Array,
    iterations: number = 100000
): Promise<CryptoKey> => {
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(password);

    // Import password as key
    const passwordKey = await crypto.subtle.importKey('raw', toArrayBuffer(passwordBytes), 'PBKDF2', false, [
        'deriveBits',
        'deriveKey',
    ]);

    // Derive AES key
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer,
            iterations,
            hash: 'SHA-256',
        },
        passwordKey,
        {
            name: AES_ALGORITHM,
            length: AES_KEY_LENGTH,
        },
        false,
        ['encrypt', 'decrypt']
    );
};

/**
 * Derive key from shared secret using HKDF.
 */
export const deriveKeyFromSecret = async (
    secret: Uint8Array,
    salt: Uint8Array,
    info: string = 'DuoGraph-MessageKey'
): Promise<CryptoKey> => {
    const secretData = toArrayBuffer(secret);
    const secretKey = await crypto.subtle.importKey('raw', secretData, 'HKDF', false, ['deriveKey']);

    const infoBytes = new TextEncoder().encode(info);
    const saltData = toArrayBuffer(salt);
    const infoData = toArrayBuffer(infoBytes);

    return crypto.subtle.deriveKey(
        {
            name: 'HKDF',
            hash: 'SHA-256',
            salt: saltData,
            info: infoData,
        },
        secretKey,
        {
            name: AES_ALGORITHM,
            length: AES_KEY_LENGTH,
        },
        false,
        ['encrypt', 'decrypt']
    );
};

// ============================================================================
// Message Envelope Functions
// ============================================================================

/**
 * Create an encrypted message envelope.
 */
export const createMessageEnvelope = async (
    key: CryptoKey,
    content: string,
    type: 'text' | 'media' | 'system',
    senderFingerprint: string
): Promise<MessageEnvelope> => {
    const messageId = crypto.randomUUID();

    // Include message ID as additional authenticated data
    const aad = new TextEncoder().encode(messageId);

    const payload = await encryptAesGcm(key, content, aad);

    return {
        payload,
        type,
        messageId,
        senderFingerprint,
    };
};

/**
 * Open an encrypted message envelope.
 */
export const openMessageEnvelope = async (
    key: CryptoKey,
    envelope: MessageEnvelope
): Promise<string> => {
    // Verify message ID as additional authenticated data
    const aad = new TextEncoder().encode(envelope.messageId);

    return decryptAesGcmString(key, envelope.payload, aad);
};

// ============================================================================
// Key Ratcheting & Deletion
// ============================================================================

/**
 * Ratchet forward a key (derive next key and mark current for deletion).
 */
export const ratchetKey = async (
    currentKey: CryptoKey
): Promise<{ nextKey: CryptoKey; currentKeyForDeletion: CryptoKey }> => {
    // Export current key to derive next
    const currentKeyRaw = await exportAesKey(currentKey);

    // Derive next key using HMAC
    const hmacKey = await crypto.subtle.importKey(
        'raw',
        toArrayBuffer(currentKeyRaw),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const nextKeyRaw = await crypto.subtle.sign(
        'HMAC',
        hmacKey,
        new TextEncoder().encode('ratchet-forward')
    );

    const nextKey = await importAesKey(new Uint8Array(nextKeyRaw.slice(0, 32)), false);

    return { nextKey, currentKeyForDeletion: currentKey };
};

/**
 * Securely delete a key by overwriting its material.
 * Note: In JavaScript, we can't truly overwrite CryptoKey memory,
 * but we can ensure it's not stored or referenced.
 */
export const secureDeleteKey = async (key: CryptoKey): Promise<void> => {
    // In JS, we rely on garbage collection.
    // For exported keys, we should overwrite the buffer.
    try {
        if (key.extractable) {
            const raw = await crypto.subtle.exportKey('raw', key);
            const bytes = new Uint8Array(raw);
            // Overwrite with random data
            crypto.getRandomValues(bytes);
            // Overwrite with zeros
            bytes.fill(0);
        }
    } catch {
        // Key already unusable or non-extractable
    }
    // The key reference should be dereferenced after this call
};

// ============================================================================
// Media Encryption
// ============================================================================

/**
 * Encrypt binary data (images, files, etc.).
 */
export const encryptMedia = async (
    key: CryptoKey,
    data: ArrayBuffer | Uint8Array,
    mimeType: string
): Promise<{
    encrypted: EncryptedPayload;
    metadata: { mimeType: string; size: number; checksum: string };
}> => {
    const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;

    // Calculate checksum before encryption
    const bytesBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const hash = await crypto.subtle.digest('SHA-256', bytesBuffer);
    const checksum = arrayBufferToBase64(hash);

    // Encrypt
    const encrypted = await encryptAesGcm(key, bytes);

    return {
        encrypted,
        metadata: {
            mimeType,
            size: bytes.length,
            checksum,
        },
    };
};

/**
 * Decrypt binary data and verify checksum.
 */
export const decryptMedia = async (
    key: CryptoKey,
    encrypted: EncryptedPayload,
    expectedChecksum: string
): Promise<Uint8Array> => {
    const decrypted = await decryptAesGcm(key, encrypted);

    // Verify checksum
    const decryptedBuffer = decrypted.buffer.slice(decrypted.byteOffset, decrypted.byteOffset + decrypted.byteLength) as ArrayBuffer;
    const hash = await crypto.subtle.digest('SHA-256', decryptedBuffer);
    const checksum = arrayBufferToBase64(hash);

    if (checksum !== expectedChecksum) {
        throw new Error('Media checksum mismatch - possible tampering detected');
    }

    return decrypted;
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

/**
 * Generate random bytes.
 */
export const randomBytes = (length: number): Uint8Array => {
    return crypto.getRandomValues(new Uint8Array(length));
};

/**
 * Generate random salt for key derivation.
 */
export const generateSalt = (length: number = 16): Uint8Array => {
    return randomBytes(length);
};
