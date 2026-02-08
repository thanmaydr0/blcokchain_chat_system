/**
 * Hardware-Bound Key Manager
 * 
 * Generates and manages non-extractable ECDSA key pairs in browser's secure storage.
 * Uses WebAuthn for biometric unlock and IndexedDB for metadata storage.
 * 
 * Security Properties:
 * - Private keys are non-extractable (cannot be exported from browser)
 * - WebAuthn provides biometric/device-bound authentication
 * - Keys are tied to the current origin (same-origin policy)
 */

// ============================================================================
// Constants & Configuration
// ============================================================================

const ECDSA_PARAMS: EcKeyGenParams = {
    name: 'ECDSA',
    namedCurve: 'P-256', // NIST P-256 curve
};

const ECDH_PARAMS: EcKeyGenParams = {
    name: 'ECDH',
    namedCurve: 'P-256',
};

const DB_NAME = 'duograph-secure-keys';
const DB_VERSION = 1;
const IDENTITY_STORE = 'identity-keys';
const SESSION_STORE = 'session-keys';

// ============================================================================
// Types
// ============================================================================

export interface HardwareIdentity {
    identityKeyPair: CryptoKeyPair;
    signingKeyPair: CryptoKeyPair;
    createdAt: number;
    keyId: string;
}

export interface StoredKeyMetadata {
    keyId: string;
    publicKeyJwk: JsonWebKey;
    publicSigningKeyJwk: JsonWebKey;
    createdAt: number;
    lastUsed: number;
    webAuthnCredentialId?: string;
}

export interface WebAuthnConfig {
    rpName: string;
    rpId: string;
    userName: string;
    userDisplayName: string;
}

// ============================================================================
// Security Logging
// ============================================================================

type LogLevel = 'info' | 'warn' | 'error' | 'security';

const securityLog = (level: LogLevel, message: string, data?: Record<string, unknown>): void => {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        level,
        component: 'KeyManager',
        message,
        ...data,
    };

    if (level === 'security' || level === 'error') {
        console.error(`[SECURITY] ${timestamp}:`, message, data);
    } else if (level === 'warn') {
        console.warn(`[KeyManager] ${timestamp}:`, message, data);
    } else {
        console.log(`[KeyManager] ${timestamp}:`, message, data);
    }

    // Store security events for audit trail
    if (level === 'security') {
        storeSecurityEvent(logEntry).catch(console.error);
    }
};

const storeSecurityEvent = async (event: Record<string, unknown>): Promise<void> => {
    try {
        const db = await openKeyStore();
        const tx = db.transaction('security-log', 'readwrite');
        const store = tx.objectStore('security-log');
        await new Promise<void>((resolve, reject) => {
            const request = store.add({ ...event, id: crypto.randomUUID() });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch {
        // Silently fail if audit store doesn't exist yet
    }
};

// ============================================================================
// IndexedDB Operations
// ============================================================================

const openKeyStore = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            securityLog('error', 'Failed to open key store', { error: request.error?.message });
            reject(new Error('Failed to open secure key storage'));
        };

        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // Identity keys store
            if (!db.objectStoreNames.contains(IDENTITY_STORE)) {
                db.createObjectStore(IDENTITY_STORE, { keyPath: 'keyId' });
            }

            // Session keys store
            if (!db.objectStoreNames.contains(SESSION_STORE)) {
                const sessionStore = db.createObjectStore(SESSION_STORE, { keyPath: 'sessionId' });
                sessionStore.createIndex('pactId', 'pactId', { unique: false });
            }

            // Security audit log
            if (!db.objectStoreNames.contains('security-log')) {
                const logStore = db.createObjectStore('security-log', { keyPath: 'id' });
                logStore.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
};

// ============================================================================
// Hardware-Bound Key Generation
// ============================================================================

/**
 * Generate a non-extractable ECDSA identity key pair.
 * The private key cannot be exported from the browser.
 */
export const generateNonExtractableSigningKey = async (): Promise<CryptoKeyPair> => {
    try {
        const keyPair = await crypto.subtle.generateKey(
            ECDSA_PARAMS,
            false, // NON-EXTRACTABLE - critical for hardware binding
            ['sign', 'verify']
        );

        securityLog('info', 'Generated non-extractable signing key pair');
        return keyPair;
    } catch (error) {
        securityLog('security', 'Failed to generate signing key', { error: String(error) });
        throw new Error('Cryptographic key generation failed');
    }
};

/**
 * Generate a non-extractable ECDH key pair for key exchange.
 */
export const generateNonExtractableExchangeKey = async (): Promise<CryptoKeyPair> => {
    try {
        const keyPair = await crypto.subtle.generateKey(
            ECDH_PARAMS,
            false, // NON-EXTRACTABLE
            ['deriveBits', 'deriveKey']
        );

        securityLog('info', 'Generated non-extractable exchange key pair');
        return keyPair;
    } catch (error) {
        securityLog('security', 'Failed to generate exchange key', { error: String(error) });
        throw new Error('Cryptographic key generation failed');
    }
};

/**
 * Generate complete hardware-bound identity.
 * Creates both identity (ECDH) and signing (ECDSA) key pairs.
 */
export const generateHardwareIdentity = async (): Promise<HardwareIdentity> => {
    const keyId = crypto.randomUUID();

    securityLog('info', 'Generating new hardware-bound identity', { keyId });

    const [identityKeyPair, signingKeyPair] = await Promise.all([
        generateNonExtractableExchangeKey(),
        generateNonExtractableSigningKey(),
    ]);

    const identity: HardwareIdentity = {
        identityKeyPair,
        signingKeyPair,
        createdAt: Date.now(),
        keyId,
    };

    // Store metadata (not the actual keys - they're non-extractable)
    await storeIdentityMetadata(identity);

    securityLog('info', 'Hardware identity created successfully', { keyId });
    return identity;
};

/**
 * Store identity metadata in IndexedDB.
 * Note: Private keys are not stored - they remain in the CryptoKey objects.
 */
const storeIdentityMetadata = async (identity: HardwareIdentity): Promise<void> => {
    // Export public keys only (private keys are non-extractable)
    const [publicKeyJwk, publicSigningKeyJwk] = await Promise.all([
        crypto.subtle.exportKey('jwk', identity.identityKeyPair.publicKey),
        crypto.subtle.exportKey('jwk', identity.signingKeyPair.publicKey),
    ]);

    const metadata: StoredKeyMetadata = {
        keyId: identity.keyId,
        publicKeyJwk,
        publicSigningKeyJwk,
        createdAt: identity.createdAt,
        lastUsed: Date.now(),
    };

    const db = await openKeyStore();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDENTITY_STORE, 'readwrite');
        const store = tx.objectStore(IDENTITY_STORE);
        const request = store.put(metadata);

        request.onsuccess = () => {
            securityLog('info', 'Identity metadata stored', { keyId: identity.keyId });
            resolve();
        };
        request.onerror = () => {
            securityLog('error', 'Failed to store identity metadata', { error: request.error?.message });
            reject(request.error);
        };
    });
};

// ============================================================================
// Public Key Export (for Blockchain Identity)
// ============================================================================

/**
 * Export public key in JWK format for sharing/blockchain.
 */
export const exportPublicKeyJwk = async (publicKey: CryptoKey): Promise<JsonWebKey> => {
    return await crypto.subtle.exportKey('jwk', publicKey);
};

/**
 * Export public key as raw bytes (for Ethereum/blockchain use).
 */
export const exportPublicKeyRaw = async (publicKey: CryptoKey): Promise<Uint8Array> => {
    const rawKey = await crypto.subtle.exportKey('raw', publicKey);
    return new Uint8Array(rawKey);
};

/**
 * Get public key formatted for blockchain identity.
 * Returns hex-encoded public key suitable for Ethereum addresses.
 */
export const getPublicKeyForBlockchain = async (publicKey: CryptoKey): Promise<string> => {
    const rawKey = await exportPublicKeyRaw(publicKey);
    return Array.from(rawKey)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
};

/**
 * Generate a fingerprint from public key for display.
 */
export const getKeyFingerprint = async (publicKey: CryptoKey): Promise<string> => {
    const rawKey = await crypto.subtle.exportKey('raw', publicKey);
    const hash = await crypto.subtle.digest('SHA-256', rawKey);
    const hashArray = Array.from(new Uint8Array(hash));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    // Format as XXXX-XXXX-XXXX-XXXX
    return hashHex
        .slice(0, 16)
        .toUpperCase()
        .match(/.{4}/g)!
        .join('-');
};

// ============================================================================
// WebAuthn Biometric Integration
// ============================================================================

/**
 * Check if WebAuthn is supported.
 */
export const isWebAuthnSupported = (): boolean => {
    return (
        typeof window !== 'undefined' &&
        typeof window.PublicKeyCredential !== 'undefined' &&
        typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
    );
};

/**
 * Check if platform authenticator (biometric) is available.
 */
export const isBiometricAvailable = async (): Promise<boolean> => {
    if (!isWebAuthnSupported()) return false;

    try {
        return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
        return false;
    }
};

/**
 * Register biometric credential for key unlock.
 */
export const registerBiometric = async (
    keyId: string,
    config: WebAuthnConfig
): Promise<string | null> => {
    if (!isWebAuthnSupported()) {
        securityLog('warn', 'WebAuthn not supported');
        return null;
    }

    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = new TextEncoder().encode(keyId);

    const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
            name: config.rpName,
            id: config.rpId,
        },
        user: {
            id: userId,
            name: config.userName,
            displayName: config.userDisplayName,
        },
        pubKeyCredParams: [
            { alg: -7, type: 'public-key' }, // ES256
            { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
            authenticatorAttachment: 'platform', // Device-bound
            userVerification: 'required', // Biometric required
            residentKey: 'required',
        },
        timeout: 60000,
        attestation: 'none',
    };

    try {
        const credential = (await navigator.credentials.create({
            publicKey: publicKeyCredentialCreationOptions,
        })) as PublicKeyCredential | null;

        if (!credential) {
            securityLog('warn', 'Biometric registration cancelled');
            return null;
        }

        const credentialId = bufferToBase64(credential.rawId);
        securityLog('info', 'Biometric credential registered', { keyId });

        // Update metadata with credential ID
        await updateCredentialId(keyId, credentialId);

        return credentialId;
    } catch (error) {
        securityLog('error', 'Biometric registration failed', { error: String(error) });
        throw new Error('Biometric registration failed');
    }
};

/**
 * Authenticate using biometric to unlock keys.
 */
export const authenticateWithBiometric = async (
    credentialId: string,
    rpId: string
): Promise<boolean> => {
    if (!isWebAuthnSupported()) {
        securityLog('warn', 'WebAuthn not supported');
        return false;
    }

    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        rpId,
        allowCredentials: [
            {
                id: base64ToBuffer(credentialId),
                type: 'public-key',
                transports: ['internal'],
            },
        ],
        userVerification: 'required',
        timeout: 60000,
    };

    try {
        const assertion = (await navigator.credentials.get({
            publicKey: publicKeyCredentialRequestOptions,
        })) as PublicKeyCredential | null;

        if (!assertion) {
            securityLog('security', 'Biometric authentication cancelled');
            return false;
        }

        securityLog('info', 'Biometric authentication successful');
        return true;
    } catch (error) {
        securityLog('security', 'Biometric authentication failed', { error: String(error) });
        return false;
    }
};

const updateCredentialId = async (keyId: string, credentialId: string): Promise<void> => {
    const db = await openKeyStore();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDENTITY_STORE, 'readwrite');
        const store = tx.objectStore(IDENTITY_STORE);
        const getRequest = store.get(keyId);

        getRequest.onsuccess = () => {
            const metadata = getRequest.result as StoredKeyMetadata | undefined;
            if (metadata) {
                metadata.webAuthnCredentialId = credentialId;
                const putRequest = store.put(metadata);
                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => reject(putRequest.error);
            } else {
                reject(new Error('Key metadata not found'));
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
};

// ============================================================================
// Key Retrieval & Management
// ============================================================================

/**
 * Get stored identity metadata.
 */
export const getIdentityMetadata = async (keyId: string): Promise<StoredKeyMetadata | null> => {
    const db = await openKeyStore();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDENTITY_STORE, 'readonly');
        const store = tx.objectStore(IDENTITY_STORE);
        const request = store.get(keyId);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
};

/**
 * List all stored identity key IDs.
 */
export const listIdentityKeys = async (): Promise<StoredKeyMetadata[]> => {
    const db = await openKeyStore();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDENTITY_STORE, 'readonly');
        const store = tx.objectStore(IDENTITY_STORE);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
};

/**
 * Delete identity keys (for key rotation).
 */
export const deleteIdentity = async (keyId: string): Promise<void> => {
    securityLog('security', 'Deleting identity', { keyId });

    const db = await openKeyStore();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDENTITY_STORE, 'readwrite');
        const store = tx.objectStore(IDENTITY_STORE);
        const request = store.delete(keyId);

        request.onsuccess = () => {
            securityLog('info', 'Identity deleted', { keyId });
            resolve();
        };
        request.onerror = () => {
            securityLog('error', 'Failed to delete identity', { keyId, error: request.error?.message });
            reject(request.error);
        };
    });
};

// ============================================================================
// Utility Functions
// ============================================================================

const bufferToBase64 = (buffer: ArrayBuffer): string => {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
};

const base64ToBuffer = (base64: string): ArrayBuffer => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
};

/**
 * Check if secure storage is available.
 */
export const hasSecureStorage = (): boolean => {
    return (
        typeof crypto !== 'undefined' &&
        typeof crypto.subtle !== 'undefined' &&
        typeof indexedDB !== 'undefined'
    );
};

/**
 * Verify runtime security requirements.
 */
export const verifySecurityRequirements = (): {
    isSecure: boolean;
    issues: string[];
} => {
    const issues: string[] = [];

    if (!hasSecureStorage()) {
        issues.push('Web Crypto API or IndexedDB not available');
    }

    if (typeof window !== 'undefined' && window.location.protocol !== 'https:') {
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            issues.push('HTTPS required for secure key storage');
        }
    }

    return {
        isSecure: issues.length === 0,
        issues,
    };
};
