/**
 * Web Crypto API utilities for hardware-bound identity
 * Uses browser's secure key storage for cryptographic operations
 */

// Key generation parameters
const ECDH_ALGORITHM = {
    name: 'ECDH',
    namedCurve: 'P-256',
};

const ECDSA_ALGORITHM = {
    name: 'ECDSA',
    namedCurve: 'P-256',
};

const AES_ALGORITHM = {
    name: 'AES-GCM',
    length: 256,
};

// IndexedDB storage for keys
const DB_NAME = 'duograph-keys';
const DB_VERSION = 1;
const STORE_NAME = 'cryptokeys';

interface StoredKeyPair {
    id: string;
    publicKey: JsonWebKey;
    privateKey: JsonWebKey;
    createdAt: number;
}

// Open IndexedDB for key storage
const openKeyStore = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

// Generate an ECDH key pair for key exchange
export const generateIdentityKeyPair = async (): Promise<CryptoKeyPair> => {
    return await crypto.subtle.generateKey(
        ECDH_ALGORITHM,
        true, // extractable for storage
        ['deriveBits', 'deriveKey']
    );
};

// Generate an ECDSA key pair for signing
export const generateSigningKeyPair = async (): Promise<CryptoKeyPair> => {
    return await crypto.subtle.generateKey(
        ECDSA_ALGORITHM,
        true,
        ['sign', 'verify']
    );
};

// Export public key to shareable format
export const exportPublicKey = async (key: CryptoKey): Promise<JsonWebKey> => {
    return await crypto.subtle.exportKey('jwk', key);
};

// Import public key from JWK format
export const importPublicKey = async (
    jwk: JsonWebKey,
    algorithm: 'ECDH' | 'ECDSA' = 'ECDH'
): Promise<CryptoKey> => {
    const alg = algorithm === 'ECDH' ? ECDH_ALGORITHM : ECDSA_ALGORITHM;
    const usages: KeyUsage[] = algorithm === 'ECDH' ? [] : ['verify'];

    return await crypto.subtle.importKey('jwk', jwk, alg, true, usages);
};

// Derive shared secret from ECDH key exchange
export const deriveSharedSecret = async (
    privateKey: CryptoKey,
    publicKey: CryptoKey
): Promise<CryptoKey> => {
    return await crypto.subtle.deriveKey(
        {
            name: 'ECDH',
            public: publicKey,
        },
        privateKey,
        AES_ALGORITHM,
        false,
        ['encrypt', 'decrypt']
    );
};

// Encrypt data with AES-GCM
export const encrypt = async (
    key: CryptoKey,
    data: string
): Promise<{ iv: Uint8Array; ciphertext: ArrayBuffer }> => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const encoded = encoder.encode(data);

    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoded
    );

    return { iv, ciphertext };
};

// Decrypt data with AES-GCM
export const decrypt = async (
    key: CryptoKey,
    iv: Uint8Array,
    ciphertext: ArrayBuffer
): Promise<string> => {
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as unknown as BufferSource },
        key,
        ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
};

// Sign data with ECDSA
export const sign = async (
    privateKey: CryptoKey,
    data: string
): Promise<ArrayBuffer> => {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(data);

    return await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        privateKey,
        encoded
    );
};

// Verify signature with ECDSA
export const verify = async (
    publicKey: CryptoKey,
    signature: ArrayBuffer,
    data: string
): Promise<boolean> => {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(data);

    return await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        publicKey,
        signature,
        encoded
    );
};

// Store key pair in IndexedDB
export const storeKeyPair = async (
    id: string,
    keyPair: CryptoKeyPair
): Promise<void> => {
    const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

    const storedPair: StoredKeyPair = {
        id,
        publicKey: publicKeyJwk,
        privateKey: privateKeyJwk,
        createdAt: Date.now(),
    };

    const db = await openKeyStore();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(storedPair);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

// Retrieve key pair from IndexedDB
export const retrieveKeyPair = async (id: string): Promise<CryptoKeyPair | null> => {
    const db = await openKeyStore();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = async () => {
            const stored = request.result as StoredKeyPair | undefined;
            if (!stored) {
                resolve(null);
                return;
            }

            try {
                const publicKey = await crypto.subtle.importKey(
                    'jwk',
                    stored.publicKey,
                    ECDH_ALGORITHM,
                    true,
                    []
                );
                const privateKey = await crypto.subtle.importKey(
                    'jwk',
                    stored.privateKey,
                    ECDH_ALGORITHM,
                    true,
                    ['deriveBits', 'deriveKey']
                );

                resolve({ publicKey, privateKey });
            } catch (error) {
                reject(error);
            }
        };

        request.onerror = () => reject(request.error);
    });
};

// Generate a fingerprint from public key for display
export const getKeyFingerprint = async (publicKey: CryptoKey): Promise<string> => {
    const exported = await crypto.subtle.exportKey('raw', publicKey);
    const hash = await crypto.subtle.digest('SHA-256', exported);
    const hashArray = Array.from(new Uint8Array(hash));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    // Return first 16 chars formatted as XXXX-XXXX-XXXX-XXXX
    return hashHex
        .slice(0, 16)
        .toUpperCase()
        .match(/.{4}/g)!
        .join('-');
};

// Check if device has secure key storage
export const hasSecureStorage = (): boolean => {
    return (
        typeof crypto !== 'undefined' &&
        typeof crypto.subtle !== 'undefined' &&
        typeof indexedDB !== 'undefined'
    );
};
