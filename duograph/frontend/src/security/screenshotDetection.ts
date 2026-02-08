/**
 * Screenshot Detection Module
 * 
 * Detects and responds to screenshot attempts:
 * - Visibility API monitoring
 * - PrintScreen key blocking
 * - Screen capture API detection
 * - Content blur on threat
 * - Partner notification via callback
 */

// Detection event types
export type ScreenshotEventType =
    | 'visibility_hidden'
    | 'print_screen'
    | 'screen_capture'
    | 'context_menu'
    | 'dev_tools';

export interface ScreenshotEvent {
    type: ScreenshotEventType;
    timestamp: number;
    blocked: boolean;
}

export interface ScreenshotDetectionConfig {
    enabled: boolean;
    blurOnDetect: boolean;
    notifyPartner: boolean;
    blockDevTools: boolean;
    disableChatOnCapture: boolean;
    blurIntensity: number; // px
}

type EventCallback = (event: ScreenshotEvent) => void;

const DEFAULT_CONFIG: ScreenshotDetectionConfig = {
    enabled: true,
    blurOnDetect: true,
    notifyPartner: true,
    blockDevTools: true,
    disableChatOnCapture: false,
    blurIntensity: 20,
};

// Module state
let config: ScreenshotDetectionConfig = { ...DEFAULT_CONFIG };
let isInitialized = false;
let blurOverlay: HTMLDivElement | null = null;
let eventListeners: EventCallback[] = [];
let detectedEvents: ScreenshotEvent[] = [];

/**
 * Initialize screenshot detection with optional config
 */
export const initScreenshotDetection = (
    customConfig?: Partial<ScreenshotDetectionConfig>
): void => {
    if (isInitialized) return;

    config = { ...DEFAULT_CONFIG, ...customConfig };

    if (!config.enabled) return;

    // Create blur overlay
    createBlurOverlay();

    // Visibility change detection
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // PrintScreen detection
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keyup', handleKeyUp, true);

    // Context menu (right-click) prevention
    document.addEventListener('contextmenu', handleContextMenu);

    // DevTools detection
    if (config.blockDevTools) {
        startDevToolsDetection();
    }

    // Screen capture API monitoring
    monitorScreenCapture();

    isInitialized = true;
    console.log('[Security] Screenshot detection initialized');
};

/**
 * Cleanup and disable detection
 */
export const destroyScreenshotDetection = (): void => {
    if (!isInitialized) return;

    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.removeEventListener('keydown', handleKeyDown, true);
    document.removeEventListener('keyup', handleKeyUp, true);
    document.removeEventListener('contextmenu', handleContextMenu);

    // Clear DevTools detection interval
    if (devToolsCheckInterval) {
        clearInterval(devToolsCheckInterval);
        devToolsCheckInterval = null;
    }

    if (blurOverlay?.parentNode) {
        blurOverlay.parentNode.removeChild(blurOverlay);
    }
    blurOverlay = null;

    isInitialized = false;
};

/**
 * Subscribe to screenshot events
 */
export const onScreenshotEvent = (callback: EventCallback): (() => void) => {
    eventListeners.push(callback);
    return () => {
        eventListeners = eventListeners.filter(cb => cb !== callback);
    };
};

/**
 * Get detection history
 */
export const getDetectionHistory = (): ScreenshotEvent[] => {
    return [...detectedEvents];
};

/**
 * Clear detection history
 */
export const clearDetectionHistory = (): void => {
    detectedEvents = [];
};

/**
 * Update configuration at runtime
 */
export const updateConfig = (updates: Partial<ScreenshotDetectionConfig>): void => {
    config = { ...config, ...updates };

    if (blurOverlay) {
        blurOverlay.style.backdropFilter = `blur(${config.blurIntensity}px)`;
    }
};

/**
 * Manually trigger blur (for testing or external events)
 */
export const triggerBlur = (_reason: string = 'manual'): void => {
    showBlurOverlay();
    emitEvent({
        type: 'visibility_hidden',
        timestamp: Date.now(),
        blocked: true,
    });
};

/**
 * Manually clear blur
 */
export const clearBlur = (): void => {
    hideBlurOverlay();
};

// ============================================================================
// Internal Functions
// ============================================================================

const createBlurOverlay = (): void => {
    blurOverlay = document.createElement('div');
    blurOverlay.id = 'screenshot-protection-overlay';
    blurOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.9);
        backdrop-filter: blur(${config.blurIntensity}px);
        z-index: 999999;
        display: none;
        align-items: center;
        justify-content: center;
        color: white;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 18px;
        text-align: center;
        pointer-events: all;
    `;
    blurOverlay.innerHTML = `
        <div style="max-width: 400px; padding: 40px;">
            <div style="font-size: 48px; margin-bottom: 20px;">🛡️</div>
            <div style="font-weight: 600; margin-bottom: 12px;">Content Protected</div>
            <div style="opacity: 0.7; font-size: 14px;">
                Screenshot attempt detected. Content has been hidden to protect privacy.
            </div>
        </div>
    `;
    document.body.appendChild(blurOverlay);
};

const showBlurOverlay = (): void => {
    if (blurOverlay && config.blurOnDetect) {
        blurOverlay.style.display = 'flex';
    }
};

const hideBlurOverlay = (): void => {
    if (blurOverlay) {
        blurOverlay.style.display = 'none';
    }
};

const emitEvent = (event: ScreenshotEvent): void => {
    detectedEvents.push(event);

    // Keep only last 100 events
    if (detectedEvents.length > 100) {
        detectedEvents = detectedEvents.slice(-100);
    }

    eventListeners.forEach(cb => {
        try {
            cb(event);
        } catch (e) {
            console.error('[Security] Event callback error:', e);
        }
    });
};

const handleVisibilityChange = (): void => {
    if (document.hidden) {
        // Tab is hidden - potential screenshot via app switcher
        showBlurOverlay();
        emitEvent({
            type: 'visibility_hidden',
            timestamp: Date.now(),
            blocked: true,
        });
    } else {
        // Tab visible again - hide overlay after short delay
        setTimeout(hideBlurOverlay, 500);
    }
};

const handleKeyDown = (e: KeyboardEvent): void => {
    // PrintScreen key
    if (e.key === 'PrintScreen') {
        e.preventDefault();
        showBlurOverlay();
        emitEvent({
            type: 'print_screen',
            timestamp: Date.now(),
            blocked: true,
        });

        // Auto-hide after 2 seconds
        setTimeout(hideBlurOverlay, 2000);
    }

    // Cmd+Shift+3/4 (Mac screenshot)
    if (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5')) {
        e.preventDefault();
        showBlurOverlay();
        emitEvent({
            type: 'print_screen',
            timestamp: Date.now(),
            blocked: true,
        });
        setTimeout(hideBlurOverlay, 2000);
    }

    // Windows Snipping Tool (Win+Shift+S)
    if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        showBlurOverlay();
        emitEvent({
            type: 'print_screen',
            timestamp: Date.now(),
            blocked: true,
        });
        setTimeout(hideBlurOverlay, 2000);
    }
};

const handleKeyUp = (e: KeyboardEvent): void => {
    // Additional cleanup if needed
    if (e.key === 'PrintScreen') {
        setTimeout(hideBlurOverlay, 1000);
    }
};

const handleContextMenu = (e: Event): void => {
    // Prevent right-click context menu (save image, inspect)
    e.preventDefault();
    emitEvent({
        type: 'context_menu',
        timestamp: Date.now(),
        blocked: true,
    });
};

// DevTools check interval (stored for cleanup)
let devToolsCheckInterval: number | null = null;

const startDevToolsDetection = (): void => {
    const threshold = 160;

    const checkDevTools = () => {
        const widthThreshold = window.outerWidth - window.innerWidth > threshold;
        const heightThreshold = window.outerHeight - window.innerHeight > threshold;

        if (widthThreshold || heightThreshold) {
            showBlurOverlay();
            emitEvent({
                type: 'dev_tools',
                timestamp: Date.now(),
                blocked: true,
            });
        }
    };

    devToolsCheckInterval = window.setInterval(checkDevTools, 1000);
    window.addEventListener('resize', checkDevTools);
};

const monitorScreenCapture = (): void => {
    // Monitor navigator.mediaDevices for getDisplayMedia calls
    if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(
            navigator.mediaDevices
        );

        navigator.mediaDevices.getDisplayMedia = async (constraints) => {
            showBlurOverlay();
            emitEvent({
                type: 'screen_capture',
                timestamp: Date.now(),
                blocked: false, // Can't fully block, just detect
            });

            // Still allow but with warning
            return originalGetDisplayMedia(constraints);
        };
    }
};

/**
 * CSS to disable selection and drag (apply to sensitive content)
 */
export const getProtectionStyles = (): string => `
    .protected-content {
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        -webkit-touch-callout: none;
        -webkit-user-drag: none;
    }

    @media print {
        .protected-content {
            display: none !important;
        }
    }
`;
