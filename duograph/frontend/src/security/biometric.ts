/**
 * Biometric Authentication Module
 * 
 * WebAuthn-based biometric unlock:
 * - Hardware authenticator registration
 * - FaceID/TouchID/Fingerprint verification
 * - Inactivity auto-lock
 * - Per-message biometric verification
 */

export interface BiometricConfig {
    enabled: boolean;
    requireForAppUnlock: boolean;
    requireForMessages: boolean;
    inactivityTimeoutMs: number;
    allowFallback: boolean;
}

export interface BiometricCredential {
    credentialId: string;
    publicKey: ArrayBuffer;
    createdAt: number;
    deviceName: string;
}

export type LockState = 'unlocked' | 'locked' | 'authenticating';

type LockStateCallback = (state: LockState) => void;

const DEFAULT_CONFIG: BiometricConfig = {
    enabled: true,
    requireForAppUnlock: true,
    requireForMessages: false,
    inactivityTimeoutMs: 60 * 1000, // 1 minute
    allowFallback: true,
};

const CREDENTIAL_STORAGE_KEY = 'duograph_biometric_credentials';
const RP_ID = typeof window !== 'undefined' ? window.location.hostname : 'duograph.app';
const RP_NAME = 'DuoGraph';

// Module state
let config: BiometricConfig = { ...DEFAULT_CONFIG };
let lockState: LockState = 'locked';
let inactivityTimer: number | null = null;
let lastActivityTime = Date.now();
let stateListeners: LockStateCallback[] = [];

/**
 * Check if WebAuthn is supported
 */
export const isWebAuthnSupported = (): boolean => {
    return !!(
        typeof window !== 'undefined' &&
        window.PublicKeyCredential &&
        navigator.credentials &&
        typeof navigator.credentials.create === 'function' &&
        typeof navigator.credentials.get === 'function'
    );
};

/**
 * Check if platform authenticator (biometric) is available
 */
export const isBiometricAvailable = async (): Promise<boolean> => {
    if (!isWebAuthnSupported()) return false;

    try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        return available;
    } catch {
        return false;
    }
};

/**
 * Initialize biometric module with config
 */
export const initBiometric = async (
    customConfig?: Partial<BiometricConfig>
): Promise<void> => {
    config = { ...DEFAULT_CONFIG, ...customConfig };

    if (!config.enabled) return;

    // Setup activity tracking
    setupActivityTracking();

    // Start inactivity timer
    resetInactivityTimer();

    // Check if we have stored credentials - if not, stay unlocked for setup
    const credentials = getStoredCredentials();
    if (credentials.length === 0) {
        lockState = 'unlocked';
    } else if (config.requireForAppUnlock) {
        lockState = 'locked';
    } else {
        lockState = 'unlocked';
    }

    notifyStateChange();
    console.log('[Security] Biometric module initialized, state:', lockState);
};

/**
 * Register a new biometric credential
 */
export const registerBiometric = async (
    userId: string,
    displayName: string
): Promise<BiometricCredential> => {
    if (!isWebAuthnSupported()) {
        throw new Error('WebAuthn is not supported in this browser');
    }

    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userIdBuffer = new TextEncoder().encode(userId);

    const createOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
            name: RP_NAME,
            id: RP_ID,
        },
        user: {
            id: userIdBuffer,
            name: displayName,
            displayName: displayName,
        },
        pubKeyCredParams: [
            { alg: -7, type: 'public-key' },   // ES256
            { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
    };

    try {
        const credential = await navigator.credentials.create({
            publicKey: createOptions,
        }) as PublicKeyCredential;

        if (!credential) {
            throw new Error('Failed to create credential');
        }

        const response = credential.response as AuthenticatorAttestationResponse;
        const publicKey = response.getPublicKey();

        if (!publicKey) {
            throw new Error('Failed to extract public key');
        }

        const storedCredential: BiometricCredential = {
            credentialId: bufferToBase64(credential.rawId),
            publicKey: publicKey,
            createdAt: Date.now(),
            deviceName: getDeviceName(),
        };

        // Store credential
        storeCredential(storedCredential);

        console.log('[Security] Biometric registered successfully');
        return storedCredential;
    } catch (error) {
        console.error('[Security] Biometric registration failed:', error);
        throw error;
    }
};

/**
 * Authenticate with biometric
 */
export const authenticateWithBiometric = async (): Promise<boolean> => {
    if (!isWebAuthnSupported()) {
        throw new Error('WebAuthn is not supported');
    }

    const credentials = getStoredCredentials();
    if (credentials.length === 0) {
        throw new Error('No biometric credentials registered');
    }

    lockState = 'authenticating';
    notifyStateChange();

    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const allowCredentials = credentials.map(cred => ({
        id: base64ToBuffer(cred.credentialId),
        type: 'public-key' as const,
        transports: ['internal'] as AuthenticatorTransport[],
    }));

    const getOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        rpId: RP_ID,
        allowCredentials,
        userVerification: 'required',
        timeout: 60000,
    };

    try {
        const assertion = await navigator.credentials.get({
            publicKey: getOptions,
        }) as PublicKeyCredential;

        if (!assertion) {
            throw new Error('Authentication failed');
        }

        // Verification successful
        lockState = 'unlocked';
        lastActivityTime = Date.now();
        resetInactivityTimer();
        notifyStateChange();

        console.log('[Security] Biometric authentication successful');
        return true;
    } catch (error) {
        console.error('[Security] Biometric authentication failed:', error);
        lockState = 'locked';
        notifyStateChange();
        return false;
    }
};

/**
 * Verify biometric for a specific action (e.g., viewing a message)
 */
export const verifyForAction = async (actionName: string): Promise<boolean> => {
    if (!config.requireForMessages) {
        return true;
    }

    console.log(`[Security] Biometric verification required for: ${actionName}`);
    return authenticateWithBiometric();
};

/**
 * Lock the app manually
 */
export const lockApp = (): void => {
    lockState = 'locked';
    notifyStateChange();
    console.log('[Security] App locked');
};

/**
 * Get current lock state
 */
export const getLockState = (): LockState => lockState;

/**
 * Subscribe to lock state changes
 */
export const onLockStateChange = (callback: LockStateCallback): (() => void) => {
    stateListeners.push(callback);
    return () => {
        stateListeners = stateListeners.filter(cb => cb !== callback);
    };
};

/**
 * Update configuration
 */
export const updateBiometricConfig = (updates: Partial<BiometricConfig>): void => {
    config = { ...config, ...updates };

    if (config.inactivityTimeoutMs) {
        resetInactivityTimer();
    }
};

/**
 * Get registered credentials
 */
export const getRegisteredCredentials = (): BiometricCredential[] => {
    return getStoredCredentials();
};

/**
 * Remove a credential
 */
export const removeCredential = (credentialId: string): void => {
    const credentials = getStoredCredentials();
    const updated = credentials.filter(c => c.credentialId !== credentialId);
    localStorage.setItem(CREDENTIAL_STORAGE_KEY, JSON.stringify(updated));
};

/**
 * Clear all credentials
 */
export const clearAllCredentials = (): void => {
    localStorage.removeItem(CREDENTIAL_STORAGE_KEY);
};

/**
 * Record user activity (resets inactivity timer)
 */
export const recordActivity = (): void => {
    lastActivityTime = Date.now();
};

// ============================================================================
// Internal Functions
// ============================================================================

const notifyStateChange = (): void => {
    stateListeners.forEach(cb => {
        try {
            cb(lockState);
        } catch (e) {
            console.error('[Security] Lock state callback error:', e);
        }
    });
};

const setupActivityTracking = (): void => {
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];

    events.forEach(event => {
        document.addEventListener(event, () => {
            lastActivityTime = Date.now();
        }, { passive: true });
    });
};

const resetInactivityTimer = (): void => {
    if (inactivityTimer) {
        clearInterval(inactivityTimer);
    }

    if (!config.enabled || !config.requireForAppUnlock) return;

    inactivityTimer = window.setInterval(() => {
        const elapsed = Date.now() - lastActivityTime;

        if (elapsed >= config.inactivityTimeoutMs && lockState === 'unlocked') {
            lockApp();
        }
    }, 1000);
};

const getStoredCredentials = (): BiometricCredential[] => {
    try {
        const stored = localStorage.getItem(CREDENTIAL_STORAGE_KEY);
        if (!stored) return [];
        return JSON.parse(stored);
    } catch {
        return [];
    }
};

const storeCredential = (credential: BiometricCredential): void => {
    const credentials = getStoredCredentials();

    // Serialize ArrayBuffer
    const serialized = {
        ...credential,
        publicKey: bufferToBase64(credential.publicKey),
    };

    credentials.push(serialized as unknown as BiometricCredential);
    localStorage.setItem(CREDENTIAL_STORAGE_KEY, JSON.stringify(credentials));
};

const bufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};

const base64ToBuffer = (base64: string): ArrayBuffer => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
};

const getDeviceName = (): string => {
    const ua = navigator.userAgent;

    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua)) return 'iPad';
    if (/Mac/.test(ua)) return 'Mac';
    if (/Android/.test(ua)) return 'Android Device';
    if (/Windows/.test(ua)) return 'Windows PC';
    if (/Linux/.test(ua)) return 'Linux PC';

    return 'Unknown Device';
};
