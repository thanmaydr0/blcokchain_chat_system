/**
 * Security Module - DuoGraph Extreme Protection
 * 
 * Comprehensive security layer including:
 * - Screenshot detection and prevention
 * - Biometric authentication (WebAuthn)
 * - Zero-knowledge chat audit (Merkle trees)
 * - Forensic protection (disappearing messages, secure wipe)
 * - Anti-surveillance (traffic obfuscation)
 * - Emergency features (panic button, wipe, duress code)
 */

// Screenshot Detection
export {
    initScreenshotDetection,
    destroyScreenshotDetection,
    onScreenshotEvent,
    triggerBlur,
    clearBlur,
    getDetectionHistory,
    clearDetectionHistory,
    updateConfig as updateScreenshotConfig,
    getProtectionStyles,
    type ScreenshotEvent,
    type ScreenshotEventType,
    type ScreenshotDetectionConfig,
} from './screenshotDetection';

// Biometric Authentication
export {
    initBiometric,
    isWebAuthnSupported,
    isBiometricAvailable,
    registerBiometric,
    authenticateWithBiometric,
    verifyForAction,
    lockApp,
    getLockState,
    onLockStateChange,
    updateBiometricConfig,
    getRegisteredCredentials,
    removeCredential,
    clearAllCredentials,
    recordActivity,
    type BiometricConfig,
    type BiometricCredential,
    type LockState,
} from './biometric';

// Zero-Knowledge Audit
export {
    initZkAudit,
    sha256,
    hashMessage,
    buildMerkleTree,
    computeRootHash,
    generateMerkleProof,
    verifyMerkleProof,
    performAudit,
    startAutoAudit,
    stopAutoAudit,
    onAuditResult,
    getAuditHistory,
    getLatestAudit,
    clearAuditHistory,
    exportVerificationData,
    type MerkleNode,
    type AuditResult,
    type AuditConfig,
    type MessageForAudit,
} from './zkAudit';

// Forensic Protection
export {
    initForensicProtection,
    scheduleMessageDelete,
    cancelScheduledDelete,
    getTimeUntilDelete,
    secureWipe,
    secureDeleteKey,
    secureWipeString,
    emergencyWipe,
    updateForensicConfig,
    getForensicConfig,
    getPendingDeletesCount,
    DISAPPEARING_PRESETS,
    type DisappearingConfig,
    type ForensicConfig,
    type ScheduledDelete,
} from './forensicProtection';

// Anti-Surveillance
export {
    initAntiSurveillance,
    sendWithJitter,
    startDummyTraffic,
    stopDummyTraffic,
    checkNetworkStatus,
    getJitterDelay,
    obfuscateMetadata,
    padMessage,
    unpadMessage,
    updateAntiSurveillanceConfig,
    getAntiSurveillanceConfig,
    type AntiSurveillanceConfig,
    type NetworkStatus,
} from './antiSurveillance';

// Emergency Features
export {
    initEmergency,
    triggerPanic,
    wipeLocalData,
    wipeAll,
    checkDuressCode,
    enterDuressMode,
    isInDuressMode,
    exitDuressMode,
    setDuressCode,
    configureDeadManSwitch,
    checkInDeadMan,
    getDaysUntilDeadMan,
    onEmergencyEvent,
    updateEmergencyConfig,
    getEmergencyConfig,
    generateSecurePin,
    PANIC_BUTTON_STYLES,
    type EmergencyConfig,
    type EmergencyAction,
    type EmergencyEvent,
} from './emergency';

// ============================================================================
// Unified Security Initialization
// ============================================================================

export interface SecurityConfig {
    screenshot?: Partial<import('./screenshotDetection').ScreenshotDetectionConfig>;
    biometric?: Partial<import('./biometric').BiometricConfig>;
    zkAudit?: Partial<import('./zkAudit').AuditConfig>;
    forensic?: Partial<import('./forensicProtection').ForensicConfig>;
    antiSurveillance?: Partial<import('./antiSurveillance').AntiSurveillanceConfig>;
    emergency?: Partial<import('./emergency').EmergencyConfig>;
}

/**
 * Initialize all security modules at once
 */
export const initAllSecurity = async (
    config: SecurityConfig = {},
    callbacks?: {
        onScreenshotEvent?: (event: import('./screenshotDetection').ScreenshotEvent) => void;
        onLockStateChange?: (state: import('./biometric').LockState) => void;
        onAuditResult?: (result: import('./zkAudit').AuditResult) => void;
        onMessageDelete?: (messageId: string, pactId: string) => Promise<void>;
        onPanic?: (pactId: string) => Promise<void>;
        onWipe?: () => Promise<void>;
        onEmergency?: (event: import('./emergency').EmergencyEvent) => void;
    }
): Promise<void> => {
    const {
        initScreenshotDetection,
        onScreenshotEvent,
    } = await import('./screenshotDetection');

    const {
        initBiometric,
        onLockStateChange,
    } = await import('./biometric');

    const {
        initZkAudit,
        onAuditResult,
    } = await import('./zkAudit');

    const {
        initForensicProtection,
    } = await import('./forensicProtection');

    const {
        initAntiSurveillance,
    } = await import('./antiSurveillance');

    const {
        initEmergency,
        onEmergencyEvent,
    } = await import('./emergency');

    // Initialize all modules
    initScreenshotDetection(config.screenshot);
    await initBiometric(config.biometric);
    initZkAudit(config.zkAudit);
    initForensicProtection(config.forensic, callbacks?.onMessageDelete);
    initAntiSurveillance(config.antiSurveillance);
    initEmergency(config.emergency, callbacks?.onPanic, callbacks?.onWipe);

    // Setup callbacks
    if (callbacks?.onScreenshotEvent) {
        onScreenshotEvent(callbacks.onScreenshotEvent);
    }
    if (callbacks?.onLockStateChange) {
        onLockStateChange(callbacks.onLockStateChange);
    }
    if (callbacks?.onAuditResult) {
        onAuditResult(callbacks.onAuditResult);
    }
    if (callbacks?.onEmergency) {
        onEmergencyEvent(callbacks.onEmergency);
    }

    console.log('[Security] All security modules initialized');
};
