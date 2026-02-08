/**
 * Anti-Surveillance Module
 * 
 * Traffic analysis prevention:
 * - Message timing randomization (jitter)
 * - Dummy traffic generation
 * - VPN/Tor detection and recommendations
 * - Network fingerprint obfuscation
 */

export interface AntiSurveillanceConfig {
    enabled: boolean;
    timingJitter: {
        enabled: boolean;
        minDelayMs: number;
        maxDelayMs: number;
    };
    dummyTraffic: {
        enabled: boolean;
        intervalMs: number;
        variance: number;
    };
    networkProtection: {
        checkVpn: boolean;
        warnIfNoVpn: boolean;
        checkTor: boolean;
    };
}

export interface NetworkStatus {
    isVpnDetected: boolean;
    isTorDetected: boolean;
    connectionType: string;
    effectiveType: string;
    isSecure: boolean;
    recommendations: string[];
}

type SendFunction = (message: unknown) => Promise<void>;
type DummyGenerator = () => unknown;

const DEFAULT_CONFIG: AntiSurveillanceConfig = {
    enabled: true,
    timingJitter: {
        enabled: true,
        minDelayMs: 100,
        maxDelayMs: 2000,
    },
    dummyTraffic: {
        enabled: false, // Opt-in for battery/data savings
        intervalMs: 30000,
        variance: 0.5,
    },
    networkProtection: {
        checkVpn: true,
        warnIfNoVpn: true,
        checkTor: true,
    },
};

// Module state
let config: AntiSurveillanceConfig = { ...DEFAULT_CONFIG };
let dummyTrafficTimer: number | null = null;
let messageQueue: Array<{ message: unknown; send: SendFunction; resolve: () => void }> = [];
let isProcessingQueue = false;

/**
 * Initialize anti-surveillance module
 */
export const initAntiSurveillance = (
    customConfig?: Partial<AntiSurveillanceConfig>
): void => {
    config = { ...DEFAULT_CONFIG, ...customConfig };
    console.log('[Security] Anti-surveillance module initialized');
};

/**
 * Send a message with random timing jitter
 */
export const sendWithJitter = async (
    message: unknown,
    sendFn: SendFunction
): Promise<void> => {
    if (!config.enabled || !config.timingJitter.enabled) {
        await sendFn(message);
        return;
    }

    return new Promise((resolve) => {
        messageQueue.push({ message, send: sendFn, resolve });
        processMessageQueue();
    });
};

/**
 * Start dummy traffic generation
 */
export const startDummyTraffic = (
    sendFn: SendFunction,
    generateDummy: DummyGenerator
): void => {
    if (!config.enabled || !config.dummyTraffic.enabled) return;

    stopDummyTraffic();

    const scheduleNext = () => {
        const variance = config.dummyTraffic.variance;
        const baseInterval = config.dummyTraffic.intervalMs;
        const jitter = baseInterval * variance * (Math.random() * 2 - 1);
        const nextInterval = Math.max(5000, baseInterval + jitter);

        dummyTrafficTimer = window.setTimeout(async () => {
            try {
                const dummyMessage = generateDummy();
                await sendFn(dummyMessage);
            } catch {
                // Ignore dummy traffic errors
            }
            scheduleNext();
        }, nextInterval);
    };

    scheduleNext();
    console.log('[Security] Dummy traffic generation started');
};

/**
 * Stop dummy traffic generation
 */
export const stopDummyTraffic = (): void => {
    if (dummyTrafficTimer) {
        clearTimeout(dummyTrafficTimer);
        dummyTrafficTimer = null;
    }
};

/**
 * Check network security status
 */
export const checkNetworkStatus = async (): Promise<NetworkStatus> => {
    const status: NetworkStatus = {
        isVpnDetected: false,
        isTorDetected: false,
        connectionType: 'unknown',
        effectiveType: 'unknown',
        isSecure: window.location.protocol === 'https:',
        recommendations: [],
    };

    // Check connection info
    const connection = (navigator as Navigator & {
        connection?: { type?: string; effectiveType?: string }
    }).connection;

    if (connection) {
        status.connectionType = connection.type || 'unknown';
        status.effectiveType = connection.effectiveType || 'unknown';
    }

    // VPN detection (heuristic - not 100% reliable)
    if (config.networkProtection.checkVpn) {
        status.isVpnDetected = await detectVpn();
    }

    // Tor detection
    if (config.networkProtection.checkTor) {
        status.isTorDetected = await detectTor();
    }

    // Generate recommendations
    if (!status.isSecure) {
        status.recommendations.push('Use HTTPS connection for secure communication');
    }

    if (!status.isVpnDetected && config.networkProtection.warnIfNoVpn) {
        status.recommendations.push('Consider using a VPN for additional privacy');
    }

    if (!status.isTorDetected) {
        status.recommendations.push('Tor Browser provides maximum anonymity');
    }

    if (status.effectiveType === '2g' || status.effectiveType === 'slow-2g') {
        status.recommendations.push('Slow connection may affect message delivery timing');
    }

    return status;
};

/**
 * Get random delay within configured jitter range
 */
export const getJitterDelay = (): number => {
    const { minDelayMs, maxDelayMs } = config.timingJitter;
    return Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1)) + minDelayMs;
};

/**
 * Obfuscate message metadata
 */
export const obfuscateMetadata = <T extends Record<string, unknown>>(
    metadata: T
): T & { _noise: string } => {
    // Add random noise field to change message fingerprint
    const noise = generateNoise();
    return { ...metadata, _noise: noise };
};

/**
 * Pad message to fixed size (prevents length-based analysis)
 */
export const padMessage = (message: string, targetLength: number = 1024): string => {
    if (message.length >= targetLength) {
        return message;
    }

    const paddingNeeded = targetLength - message.length;
    const padding = generatePadding(paddingNeeded);

    // Use a delimiter that won't appear in normal messages
    return message + '\x00PAD\x00' + padding;
};

/**
 * Remove padding from message
 */
export const unpadMessage = (paddedMessage: string): string => {
    const delimiterIndex = paddedMessage.indexOf('\x00PAD\x00');
    if (delimiterIndex === -1) {
        return paddedMessage;
    }
    return paddedMessage.substring(0, delimiterIndex);
};

/**
 * Update configuration
 */
export const updateAntiSurveillanceConfig = (
    updates: Partial<AntiSurveillanceConfig>
): void => {
    config = { ...config, ...updates };
};

/**
 * Get current config
 */
export const getAntiSurveillanceConfig = (): AntiSurveillanceConfig => ({ ...config });

// ============================================================================
// Internal Functions
// ============================================================================

const processMessageQueue = async (): Promise<void> => {
    if (isProcessingQueue) return;
    isProcessingQueue = true;

    while (messageQueue.length > 0) {
        const item = messageQueue.shift();
        if (!item) break;

        // Apply random delay
        const delay = getJitterDelay();
        await sleep(delay);

        try {
            await item.send(item.message);
            item.resolve();
        } catch (e) {
            console.error('[Security] Failed to send message:', e);
            item.resolve(); // Resolve anyway to not block queue
        }
    }

    isProcessingQueue = false;
};

const sleep = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

const detectVpn = async (): Promise<boolean> => {
    // VPN detection is inherently unreliable
    // This uses multiple heuristics

    try {
        // Check for WebRTC leak (if IP differs from external)
        // This is a simplified check
        const rtc = new RTCPeerConnection({ iceServers: [] });
        let detectedIp = '';

        rtc.createDataChannel('');
        await rtc.createOffer().then(offer => rtc.setLocalDescription(offer));

        await new Promise<void>((resolve) => {
            rtc.onicecandidate = (e) => {
                if (!e.candidate) {
                    resolve();
                    return;
                }

                const match = e.candidate.candidate.match(
                    /([0-9]{1,3}\.){3}[0-9]{1,3}/
                );
                if (match) {
                    detectedIp = match[0];
                }
            };

            // Timeout after 2 seconds
            setTimeout(resolve, 2000);
        });

        rtc.close();

        // Check if IP is in private range (suggests VPN tunnel)
        if (detectedIp) {
            const isPrivate =
                detectedIp.startsWith('10.') ||
                detectedIp.startsWith('172.') ||
                detectedIp.startsWith('192.168.');

            // If we're on HTTPS but see a private IP, likely VPN
            if (isPrivate && window.location.protocol === 'https:') {
                return true;
            }
        }

        return false;
    } catch {
        return false;
    }
};

const detectTor = async (): Promise<boolean> => {
    // Check for Tor Browser indicators

    // Check user agent for Tor Browser
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('torbrowser') || ua.includes('tor browser')) {
        return true;
    }

    // Check for common Tor Browser fingerprint traits
    // Tor Browser blocks certain APIs
    try {
        // Tor Browser returns false for this
        const hasGamepad = navigator.getGamepads !== undefined;
        const hasBattery = 'getBattery' in navigator;

        // If both are blocked, likely Tor
        if (!hasGamepad && !hasBattery) {
            return true;
        }
    } catch {
        return true; // API access threw, likely blocked by Tor
    }

    return false;
};

const generateNoise = (): string => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
};

const generatePadding = (length: number): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
        .map(b => chars[b % chars.length])
        .join('');
};
