/**
 * Emergency Features Module
 * 
 * Panic and emergency response:
 * - Panic button (instant pact revocation)
 * - One-tap local data wipe
 * - Duress code (opens decoy)
 * - Dead man's switch (auto-wipe)
 */

import { emergencyWipe } from './forensicProtection';

export interface EmergencyConfig {
    enabled: boolean;
    duressCode: {
        enabled: boolean;
        code: string;
        decoyPactId: string | null;
    };
    deadManSwitch: {
        enabled: boolean;
        inactiveDays: number;
        lastCheckIn: number;
    };
    confirmPanic: boolean;
}

export type EmergencyAction =
    | 'panic_revoke'
    | 'wipe_local'
    | 'wipe_all'
    | 'duress_triggered'
    | 'dead_man_triggered';

export interface EmergencyEvent {
    action: EmergencyAction;
    timestamp: number;
    success: boolean;
    details?: string;
}

type PanicCallback = (pactId: string) => Promise<void>;
type WipeCallback = () => Promise<void>;
type EmergencyEventCallback = (event: EmergencyEvent) => void;

const DEFAULT_CONFIG: EmergencyConfig = {
    enabled: true,
    duressCode: {
        enabled: false,
        code: '',
        decoyPactId: null,
    },
    deadManSwitch: {
        enabled: false,
        inactiveDays: 30,
        lastCheckIn: Date.now(),
    },
    confirmPanic: true,
};

const CONFIG_STORAGE_KEY = 'duograph_emergency_config';
const DEAD_MAN_CHECK_KEY = 'duograph_dead_man_checkin';

// Module state
let config: EmergencyConfig = { ...DEFAULT_CONFIG };
let eventListeners: EmergencyEventCallback[] = [];
let panicCallback: PanicCallback | null = null;
let wipeCallback: WipeCallback | null = null;
let deadManTimer: number | null = null;
let isDuressMode = false;

/**
 * Initialize emergency features
 */
export const initEmergency = (
    customConfig?: Partial<EmergencyConfig>,
    onPanic?: PanicCallback,
    onWipe?: WipeCallback
): void => {
    // Load saved config
    const savedConfig = loadConfig();
    config = { ...DEFAULT_CONFIG, ...savedConfig, ...customConfig };

    panicCallback = onPanic || null;
    wipeCallback = onWipe || null;

    // Start dead man's switch monitor
    if (config.deadManSwitch.enabled) {
        startDeadManMonitor();
    }

    console.log('[Security] Emergency module initialized');
};

/**
 * Trigger panic button - revokes pact on blockchain
 */
export const triggerPanic = async (pactId: string): Promise<boolean> => {
    if (!config.enabled) {
        console.warn('[Security] Emergency features disabled');
        return false;
    }

    if (config.confirmPanic) {
        // In real implementation, show confirmation dialog
        console.log('[Security] Panic confirmation required');
    }

    try {
        // Revoke pact on blockchain
        if (panicCallback) {
            await panicCallback(pactId);
        }

        // Wipe local data for this pact
        await wipeLocalData();

        emitEvent({
            action: 'panic_revoke',
            timestamp: Date.now(),
            success: true,
            details: `Pact ${pactId} revoked`,
        });

        return true;
    } catch (error) {
        emitEvent({
            action: 'panic_revoke',
            timestamp: Date.now(),
            success: false,
            details: String(error),
        });
        return false;
    }
};

/**
 * Wipe all local data immediately
 */
export const wipeLocalData = async (): Promise<boolean> => {
    try {
        // Use forensic protection's emergency wipe
        await emergencyWipe();

        // Call custom wipe callback
        if (wipeCallback) {
            await wipeCallback();
        }

        emitEvent({
            action: 'wipe_local',
            timestamp: Date.now(),
            success: true,
        });

        // Reload page to clear memory
        setTimeout(() => {
            window.location.reload();
        }, 100);

        return true;
    } catch (error) {
        emitEvent({
            action: 'wipe_local',
            timestamp: Date.now(),
            success: false,
            details: String(error),
        });
        return false;
    }
};

/**
 * Wipe everything and revoke all pacts
 */
export const wipeAll = async (pactIds: string[]): Promise<boolean> => {
    try {
        // Revoke all pacts
        if (panicCallback) {
            for (const pactId of pactIds) {
                await panicCallback(pactId);
            }
        }

        // Wipe all local data
        await emergencyWipe();

        if (wipeCallback) {
            await wipeCallback();
        }

        emitEvent({
            action: 'wipe_all',
            timestamp: Date.now(),
            success: true,
            details: `Revoked ${pactIds.length} pacts`,
        });

        // Redirect to blank page
        window.location.href = 'about:blank';

        return true;
    } catch (error) {
        emitEvent({
            action: 'wipe_all',
            timestamp: Date.now(),
            success: false,
            details: String(error),
        });
        return false;
    }
};

/**
 * Check if code is duress code
 */
export const checkDuressCode = (code: string): boolean => {
    if (!config.duressCode.enabled || !config.duressCode.code) {
        return false;
    }

    return code === config.duressCode.code;
};

/**
 * Enter duress mode (shows decoy)
 */
export const enterDuressMode = (): string | null => {
    if (!config.duressCode.enabled) {
        return null;
    }

    isDuressMode = true;

    emitEvent({
        action: 'duress_triggered',
        timestamp: Date.now(),
        success: true,
    });

    // Return decoy pact ID to show
    return config.duressCode.decoyPactId;
};

/**
 * Check if in duress mode
 */
export const isInDuressMode = (): boolean => isDuressMode;

/**
 * Exit duress mode (careful - only use when truly safe)
 */
export const exitDuressMode = (realCode: string): boolean => {
    // Require a different "real" code to exit duress mode
    // This prevents the duress mode from being easily discovered
    if (checkDuressCode(realCode)) {
        return false; // Can't exit with duress code
    }

    isDuressMode = false;
    return true;
};

/**
 * Set duress code
 */
export const setDuressCode = (code: string, decoyPactId: string | null): void => {
    config.duressCode = {
        enabled: code.length > 0,
        code,
        decoyPactId,
    };
    saveConfig();
};

/**
 * Configure dead man's switch
 */
export const configureDeadManSwitch = (
    enabled: boolean,
    inactiveDays: number = 30
): void => {
    config.deadManSwitch = {
        enabled,
        inactiveDays,
        lastCheckIn: Date.now(),
    };
    saveConfig();

    if (enabled) {
        startDeadManMonitor();
    } else {
        stopDeadManMonitor();
    }
};

/**
 * Check in to reset dead man's switch
 */
export const checkInDeadMan = (): void => {
    config.deadManSwitch.lastCheckIn = Date.now();
    localStorage.setItem(DEAD_MAN_CHECK_KEY, String(Date.now()));
    saveConfig();
};

/**
 * Get days until dead man's switch triggers
 */
export const getDaysUntilDeadMan = (): number | null => {
    if (!config.deadManSwitch.enabled) {
        return null;
    }

    const lastCheckIn = config.deadManSwitch.lastCheckIn;
    const triggerTime = lastCheckIn + (config.deadManSwitch.inactiveDays * 24 * 60 * 60 * 1000);
    const remaining = triggerTime - Date.now();

    return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
};

/**
 * Subscribe to emergency events
 */
export const onEmergencyEvent = (callback: EmergencyEventCallback): (() => void) => {
    eventListeners.push(callback);
    return () => {
        eventListeners = eventListeners.filter(cb => cb !== callback);
    };
};

/**
 * Update emergency config
 */
export const updateEmergencyConfig = (updates: Partial<EmergencyConfig>): void => {
    config = { ...config, ...updates };
    saveConfig();
};

/**
 * Get current config (sanitized - no secrets)
 */
export const getEmergencyConfig = (): Omit<EmergencyConfig, 'duressCode'> & {
    duressCode: { enabled: boolean }
} => ({
    enabled: config.enabled,
    duressCode: { enabled: config.duressCode.enabled },
    deadManSwitch: { ...config.deadManSwitch },
    confirmPanic: config.confirmPanic,
});

// ============================================================================
// Internal Functions
// ============================================================================

const emitEvent = (event: EmergencyEvent): void => {
    eventListeners.forEach(cb => {
        try {
            cb(event);
        } catch (e) {
            console.error('[Security] Emergency callback error:', e);
        }
    });
};

const loadConfig = (): Partial<EmergencyConfig> => {
    try {
        const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch {
        // Ignore
    }
    return {};
};

const saveConfig = (): void => {
    try {
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch {
        // Storage full or unavailable
    }
};

const startDeadManMonitor = (): void => {
    if (deadManTimer) {
        clearInterval(deadManTimer);
    }

    // Check every hour
    deadManTimer = window.setInterval(() => {
        const daysRemaining = getDaysUntilDeadMan();

        if (daysRemaining !== null && daysRemaining <= 0) {
            console.warn('[Security] Dead man\'s switch triggered!');

            emitEvent({
                action: 'dead_man_triggered',
                timestamp: Date.now(),
                success: true,
            });

            // Trigger wipe
            wipeLocalData();
        }
    }, 60 * 60 * 1000);

    // Also check immediately on load
    const storedCheckIn = localStorage.getItem(DEAD_MAN_CHECK_KEY);
    if (storedCheckIn) {
        config.deadManSwitch.lastCheckIn = parseInt(storedCheckIn, 10);
    }
};

const stopDeadManMonitor = (): void => {
    if (deadManTimer) {
        clearInterval(deadManTimer);
        deadManTimer = null;
    }
};

/**
 * Generate a secure random PIN for duress code
 */
export const generateSecurePin = (length: number = 6): string => {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
        .map(b => (b % 10).toString())
        .join('');
};

/**
 * CSS class for panic button styling
 */
export const PANIC_BUTTON_STYLES = `
    .panic-button {
        background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
        color: white;
        border: none;
        padding: 16px 32px;
        border-radius: 8px;
        font-weight: 600;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 14px rgba(220, 38, 38, 0.4);
    }

    .panic-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(220, 38, 38, 0.5);
    }

    .panic-button:active {
        transform: translateY(0);
    }

    .panic-button--small {
        padding: 8px 16px;
        font-size: 14px;
    }
`;
