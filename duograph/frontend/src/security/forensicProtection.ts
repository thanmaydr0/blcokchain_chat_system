/**
 * Forensic Protection Module
 * 
 * Data forensic resilience features:
 * - Disappearing messages (auto-delete scheduler)
 * - Secure memory wiping (TypedArray overwrite)
 * - Encryption key burn
 * - Debug logging suppression
 * - Export/backup prevention
 */

export interface DisappearingConfig {
    enabled: boolean;
    defaultTimeoutMs: number;
    wipeOnDisappear: boolean;
}

export interface ForensicConfig {
    disappearing: DisappearingConfig;
    suppressLogging: boolean;
    preventExport: boolean;
    secureWipeEnabled: boolean;
}

export interface ScheduledDelete {
    messageId: string;
    deleteAt: number;
    pactId: string;
}

type DeleteCallback = (messageId: string, pactId: string) => Promise<void>;

const DEFAULT_CONFIG: ForensicConfig = {
    disappearing: {
        enabled: true,
        defaultTimeoutMs: 24 * 60 * 60 * 1000, // 24 hours
        wipeOnDisappear: true,
    },
    suppressLogging: true,
    preventExport: true,
    secureWipeEnabled: true,
};

// Preset durations for disappearing messages
export const DISAPPEARING_PRESETS = {
    OFF: 0,
    SECONDS_30: 30 * 1000,
    MINUTES_5: 5 * 60 * 1000,
    HOURS_1: 60 * 60 * 1000,
    HOURS_24: 24 * 60 * 60 * 1000,
    DAYS_7: 7 * 24 * 60 * 60 * 1000,
    DAYS_30: 30 * 24 * 60 * 60 * 1000,
} as const;

// Module state
let config: ForensicConfig = { ...DEFAULT_CONFIG };
let scheduledDeletes: ScheduledDelete[] = [];
let deleteCallback: DeleteCallback | null = null;
let deleteTimer: number | null = null;
const STORAGE_KEY = 'duograph_scheduled_deletes';

/**
 * Initialize forensic protection
 */
export const initForensicProtection = (
    customConfig?: Partial<ForensicConfig>,
    onDelete?: DeleteCallback
): void => {
    config = { ...DEFAULT_CONFIG, ...customConfig };
    deleteCallback = onDelete || null;

    // Suppress console in production
    if (config.suppressLogging) {
        suppressConsoleLogs();
    }

    // Prevent export mechanisms
    if (config.preventExport) {
        preventDataExport();
    }

    // Load scheduled deletes from storage
    loadScheduledDeletes();

    // Start delete scheduler
    startDeleteScheduler();

    console.log('[Security] Forensic protection initialized');
};

/**
 * Schedule a message for deletion
 */
export const scheduleMessageDelete = (
    messageId: string,
    pactId: string,
    timeoutMs?: number
): void => {
    if (!config.disappearing.enabled) return;

    const timeout = timeoutMs ?? config.disappearing.defaultTimeoutMs;
    if (timeout === 0) return; // Disabled

    const deleteAt = Date.now() + timeout;

    // Remove any existing schedule for this message
    scheduledDeletes = scheduledDeletes.filter(s => s.messageId !== messageId);

    scheduledDeletes.push({ messageId, pactId, deleteAt });
    saveScheduledDeletes();
};

/**
 * Cancel scheduled deletion for a message
 */
export const cancelScheduledDelete = (messageId: string): void => {
    scheduledDeletes = scheduledDeletes.filter(s => s.messageId !== messageId);
    saveScheduledDeletes();
};

/**
 * Get time until message is deleted
 */
export const getTimeUntilDelete = (messageId: string): number | null => {
    const scheduled = scheduledDeletes.find(s => s.messageId === messageId);
    if (!scheduled) return null;

    const remaining = scheduled.deleteAt - Date.now();
    return remaining > 0 ? remaining : 0;
};

/**
 * Securely wipe a buffer (overwrite with random data)
 */
export const secureWipe = (buffer: ArrayBuffer | Uint8Array): void => {
    if (!config.secureWipeEnabled) return;

    const view = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

    // Multiple overwrites with different patterns
    for (let pass = 0; pass < 3; pass++) {
        // Pass 1: Random data
        if (pass === 0) {
            crypto.getRandomValues(view);
        }
        // Pass 2: Zeros
        else if (pass === 1) {
            view.fill(0x00);
        }
        // Pass 3: Random again
        else {
            crypto.getRandomValues(view);
        }
    }

    // Final zero pass
    view.fill(0x00);
};

/**
 * Securely wipe a CryptoKey (if possible)
 */
export const secureDeleteKey = async (key: CryptoKey): Promise<void> => {
    // CryptoKeys can't be directly wiped, but we can try to export and wipe
    // This is best-effort as the key may be marked as non-extractable
    try {
        if (key.extractable) {
            const exported = await crypto.subtle.exportKey('raw', key);
            secureWipe(exported);
        }
    } catch {
        // Key is non-extractable, which is actually better for security
    }

    // The key will be garbage collected, mark as used
    console.log('[Security] Key marked for deletion');
};

/**
 * Wipe a string from memory (best effort)
 */
export const secureWipeString = (str: string): void => {
    // JavaScript strings are immutable, so we can't truly wipe them
    // Best we can do is overwrite variables that hold references
    // This is a placeholder for documentation purposes

    // Convert to buffer and wipe that at least
    const encoder = new TextEncoder();
    const buffer = encoder.encode(str);
    secureWipe(buffer);
};

/**
 * Clear all sensitive data in memory
 */
export const emergencyWipe = async (): Promise<{ wiped: string[] }> => {
    const wiped: string[] = [];

    // Clear scheduled deletes
    scheduledDeletes = [];
    localStorage.removeItem(STORAGE_KEY);
    wiped.push('scheduled_deletes');

    // Clear session storage
    sessionStorage.clear();
    wiped.push('session_storage');

    // Clear IndexedDB
    try {
        const dbs = await indexedDB.databases();
        for (const db of dbs) {
            if (db.name) {
                indexedDB.deleteDatabase(db.name);
                wiped.push(`indexeddb:${db.name}`);
            }
        }
    } catch {
        // Some browsers don't support databases()
        // Try to delete known database
        indexedDB.deleteDatabase('DuoGraphDB');
        wiped.push('indexeddb:DuoGraphDB');
    }

    // Clear localStorage (except critical auth)
    const keysToKeep = [''] as string[]; // Add any keys that should survive
    const allKeys = Object.keys(localStorage);
    for (const key of allKeys) {
        if (!keysToKeep.includes(key)) {
            localStorage.removeItem(key);
            wiped.push(`localStorage:${key}`);
        }
    }

    // Clear caches
    try {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
            await caches.delete(name);
            wiped.push(`cache:${name}`);
        }
    } catch {
        // Caches API not available
    }

    console.log('[Security] Emergency wipe completed:', wiped.length, 'items');
    return { wiped };
};

/**
 * Update forensic config
 */
export const updateForensicConfig = (updates: Partial<ForensicConfig>): void => {
    config = { ...config, ...updates };
};

/**
 * Get current config
 */
export const getForensicConfig = (): ForensicConfig => ({ ...config });

/**
 * Get pending deletes count
 */
export const getPendingDeletesCount = (): number => {
    return scheduledDeletes.length;
};

// ============================================================================
// Internal Functions
// ============================================================================

const suppressConsoleLogs = (): void => {
    if (process.env.NODE_ENV === 'production') {
        const noop = () => { };
        console.log = noop;
        console.debug = noop;
        console.info = noop;
        // Keep warn and error for critical issues
    }
};

const preventDataExport = (): void => {
    // Disable print
    const style = document.createElement('style');
    style.textContent = `
        @media print {
            body * { display: none !important; }
            body::after {
                content: "Printing is disabled for security reasons.";
                display: block;
                text-align: center;
                padding: 50px;
                font-size: 24px;
            }
        }
    `;
    document.head.appendChild(style);

    // Disable copy on sensitive elements
    document.addEventListener('copy', (e) => {
        const selection = window.getSelection();
        const selectedNode = selection?.anchorNode?.parentElement;

        if (selectedNode?.closest('.protected-content')) {
            e.preventDefault();
        }
    });

    // Disable drag
    document.addEventListener('dragstart', (e) => {
        const target = e.target as HTMLElement;
        if (target?.closest('.protected-content')) {
            e.preventDefault();
        }
    });
};

const loadScheduledDeletes = (): void => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            scheduledDeletes = JSON.parse(stored);
            // Filter out expired ones
            const now = Date.now();
            scheduledDeletes = scheduledDeletes.filter(s => s.deleteAt > now);
        }
    } catch {
        scheduledDeletes = [];
    }
};

const saveScheduledDeletes = (): void => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(scheduledDeletes));
    } catch {
        // Storage full or unavailable
    }
};

const startDeleteScheduler = (): void => {
    if (deleteTimer) {
        clearInterval(deleteTimer);
    }

    deleteTimer = window.setInterval(async () => {
        const now = Date.now();
        const toDelete = scheduledDeletes.filter(s => s.deleteAt <= now);

        for (const item of toDelete) {
            try {
                if (deleteCallback) {
                    await deleteCallback(item.messageId, item.pactId);
                }
            } catch (e) {
                console.error('[Security] Failed to delete message:', e);
            }
        }

        // Remove processed items
        if (toDelete.length > 0) {
            scheduledDeletes = scheduledDeletes.filter(s => s.deleteAt > now);
            saveScheduledDeletes();
        }
    }, 10000); // Check every 10 seconds
};
