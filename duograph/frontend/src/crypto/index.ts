/**
 * DuoGraph Cryptographic Layer
 * 
 * Complete cryptographic implementation including:
 * - Hardware-bound key generation (non-extractable keys)
 * - WebAuthn biometric authentication
 * - Signal Protocol Double Ratchet
 * - AES-256-GCM message encryption
 * - Zero-knowledge Ghost IDs for signaling
 */

// Hardware-bound key management
export {
    generateHardwareIdentity,
    generateNonExtractableSigningKey,
    generateNonExtractableExchangeKey,
    exportPublicKeyJwk,
    exportPublicKeyRaw,
    getPublicKeyForBlockchain,
    getKeyFingerprint,
    isWebAuthnSupported,
    isBiometricAvailable,
    registerBiometric,
    authenticateWithBiometric,
    getIdentityMetadata,
    listIdentityKeys,
    deleteIdentity,
    hasSecureStorage,
    verifySecurityRequirements,
    type HardwareIdentity,
    type StoredKeyMetadata,
    type WebAuthnConfig,
} from './keyManager';

// Double Ratchet protocol
export {
    createRatchetState,
    initializeAsInitiator,
    initializeAsResponder,
    ratchetEncrypt,
    ratchetDecrypt,
    serializeState,
    deserializeState,
    type RatchetState,
    type EncryptedMessage,
    type MessageHeader,
    type SerializedRatchetState,
    type SessionInfo,
} from './doubleRatchet';

// Message encryption utilities
export {
    encryptAesGcm,
    decryptAesGcm,
    decryptAesGcmString,
    generateAesKey,
    importAesKey,
    exportAesKey,
    deriveKeyFromPassword,
    deriveKeyFromSecret,
    createMessageEnvelope,
    openMessageEnvelope,
    ratchetKey,
    secureDeleteKey,
    encryptMedia,
    decryptMedia,
    randomBytes,
    generateSalt,
    type EncryptedPayload,
    type MessageEnvelope,
} from './encryption';

// Zero-knowledge signaling
export {
    generateGhostId,
    verifyGhostId,
    isGhostIdCurrent,
    generateGhostIdRange,
    generateGhostIdProof,
    verifyGhostIdProof,
    createNostrSignalingEvent,
    verifyNostrSignalingEvent,
    encryptNostrContent,
    decryptNostrContent,
    deriveSessionId,
    generateSessionSalt,
    type GhostId,
    type GhostIdProof,
    type NostrEventTemplate,
    type SignedNostrEvent,
} from './zkProof';
