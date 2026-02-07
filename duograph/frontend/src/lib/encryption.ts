/**
 * Double Ratchet Algorithm Implementation
 * Based on Signal Protocol for end-to-end encrypted messaging
 * 
 * This is a simplified implementation for demonstration.
 * For production, use libsignal-protocol-javascript or similar.
 */

import {
    deriveSharedSecret,
    encrypt,
    decrypt,
    generateIdentityKeyPair,
    exportPublicKey,
    importPublicKey,
} from './crypto';

// Message header containing ratchet public key and counters
interface MessageHeader {
    publicKey: JsonWebKey;
    previousChainLength: number;
    messageNumber: number;
}

// Encrypted message format
export interface EncryptedMessage {
    header: MessageHeader;
    iv: string; // Base64 encoded
    ciphertext: string; // Base64 encoded
}

// Ratchet state
interface RatchetState {
    // DH Ratchet keys
    dhSendingKey: CryptoKeyPair | null;
    dhReceivingKey: CryptoKey | null;

    // Root key for deriving chain keys
    rootKey: CryptoKey | null;

    // Chain keys for symmetric ratchet
    sendingChainKey: CryptoKey | null;
    receivingChainKey: CryptoKey | null;

    // Message counters
    sendingMessageNumber: number;
    receivingMessageNumber: number;
    previousSendingChainLength: number;

    // Skipped messages for out-of-order delivery
    skippedMessages: Map<string, CryptoKey>;
}

// Create initial ratchet state
export const createRatchetState = (): RatchetState => ({
    dhSendingKey: null,
    dhReceivingKey: null,
    rootKey: null,
    sendingChainKey: null,
    receivingChainKey: null,
    sendingMessageNumber: 0,
    receivingMessageNumber: 0,
    previousSendingChainLength: 0,
    skippedMessages: new Map(),
});

// HKDF-like key derivation using Web Crypto
const deriveChainKey = async (
    inputKey: CryptoKey,
    info: string
): Promise<{ chainKey: CryptoKey; messageKey: CryptoKey }> => {
    // Export the key to derive new keys
    const keyData = await crypto.subtle.exportKey('raw', inputKey);

    // Create info bytes
    const encoder = new TextEncoder();
    const infoBytes = encoder.encode(info);

    // Combine key data with info
    const combined = new Uint8Array(keyData.byteLength + infoBytes.byteLength);
    combined.set(new Uint8Array(keyData), 0);
    combined.set(infoBytes, keyData.byteLength);

    // Hash to derive new key material
    const hash = await crypto.subtle.digest('SHA-512', combined);
    const hashArray = new Uint8Array(hash);

    // Split hash into chain key (first 32 bytes) and message key (last 32 bytes)
    const chainKeyData = hashArray.slice(0, 32);
    const messageKeyData = hashArray.slice(32, 64);

    const chainKey = await crypto.subtle.importKey(
        'raw',
        chainKeyData,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );

    const messageKey = await crypto.subtle.importKey(
        'raw',
        messageKeyData,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );

    return { chainKey, messageKey };
};

// Initialize ratchet as initiator (Alice)
export const initializeAsInitiator = async (
    sharedSecret: CryptoKey,
    theirPublicKey: CryptoKey
): Promise<RatchetState> => {
    const state = createRatchetState();

    // Generate our DH key pair
    state.dhSendingKey = await generateIdentityKeyPair();
    state.dhReceivingKey = theirPublicKey;

    // Derive root key from shared secret
    state.rootKey = sharedSecret;

    // Perform initial DH ratchet step
    const dhOutput = await deriveSharedSecret(
        state.dhSendingKey.privateKey,
        state.dhReceivingKey
    );

    const { chainKey } = await deriveChainKey(dhOutput, 'init-send');
    state.sendingChainKey = chainKey;

    return state;
};

// Initialize ratchet as responder (Bob)
export const initializeAsResponder = async (
    sharedSecret: CryptoKey,
    ourKeyPair: CryptoKeyPair
): Promise<RatchetState> => {
    const state = createRatchetState();

    state.dhSendingKey = ourKeyPair;
    state.rootKey = sharedSecret;

    return state;
};

// Encrypt a message using the double ratchet
export const ratchetEncrypt = async (
    state: RatchetState,
    plaintext: string
): Promise<{ state: RatchetState; message: EncryptedMessage }> => {
    if (!state.sendingChainKey || !state.dhSendingKey) {
        throw new Error('Ratchet not initialized for sending');
    }

    // Derive message key from chain key
    const { chainKey, messageKey } = await deriveChainKey(
        state.sendingChainKey,
        `msg-${state.sendingMessageNumber}`
    );

    // Update chain key
    state.sendingChainKey = chainKey;

    // Encrypt the message
    const { iv, ciphertext } = await encrypt(messageKey, plaintext);

    // Create message header
    const header: MessageHeader = {
        publicKey: await exportPublicKey(state.dhSendingKey.publicKey),
        previousChainLength: state.previousSendingChainLength,
        messageNumber: state.sendingMessageNumber,
    };

    // Increment message counter
    state.sendingMessageNumber++;

    // Encode to base64 for transport
    const message: EncryptedMessage = {
        header,
        iv: btoa(String.fromCharCode(...iv)),
        ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    };

    return { state, message };
};

// Decrypt a message using the double ratchet
export const ratchetDecrypt = async (
    state: RatchetState,
    message: EncryptedMessage
): Promise<{ state: RatchetState; plaintext: string }> => {
    // Import sender's public key
    const senderPublicKey = await importPublicKey(message.header.publicKey);

    // Check if we need to perform a DH ratchet step
    if (!state.dhReceivingKey) {
        // First message received
        state.dhReceivingKey = senderPublicKey;

        if (state.dhSendingKey && state.rootKey) {
            // Derive receiving chain key
            const dhOutput = await deriveSharedSecret(
                state.dhSendingKey.privateKey,
                state.dhReceivingKey
            );

            const { chainKey } = await deriveChainKey(dhOutput, 'init-recv');
            state.receivingChainKey = chainKey;
        }
    }

    if (!state.receivingChainKey) {
        throw new Error('Ratchet not initialized for receiving');
    }

    // Derive message key
    const { chainKey, messageKey } = await deriveChainKey(
        state.receivingChainKey,
        `msg-${message.header.messageNumber}`
    );

    // Update chain key
    state.receivingChainKey = chainKey;

    // Decode from base64
    const ivString = atob(message.iv);
    const iv = new Uint8Array(ivString.length);
    for (let i = 0; i < ivString.length; i++) {
        iv[i] = ivString.charCodeAt(i);
    }

    const ciphertextString = atob(message.ciphertext);
    const ciphertext = new Uint8Array(ciphertextString.length);
    for (let i = 0; i < ciphertextString.length; i++) {
        ciphertext[i] = ciphertextString.charCodeAt(i);
    }

    // Decrypt
    const plaintext = await decrypt(messageKey, iv, ciphertext.buffer);

    // Update receiving message number
    state.receivingMessageNumber = message.header.messageNumber + 1;

    return { state, plaintext };
};

// Serialize ratchet state for storage (excluding private keys)
export const serializeState = async (state: RatchetState): Promise<string> => {
    const serializable = {
        sendingMessageNumber: state.sendingMessageNumber,
        receivingMessageNumber: state.receivingMessageNumber,
        previousSendingChainLength: state.previousSendingChainLength,
        // Note: In production, you'd want to securely serialize keys as well
    };

    return JSON.stringify(serializable);
};
