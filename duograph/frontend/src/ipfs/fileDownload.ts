/**
 * IPFS File Download Module
 * 
 * Fetches and decrypts media files from IPFS.
 */

import { importKey } from './fileUpload';

// ============================================================================
// Types
// ============================================================================

export interface DownloadOptions {
    cid: string;
    encryptionKey: string;
    iv: string;
    mimeType: string;
    onProgress?: (progress: number) => void;
}

export interface DownloadResult {
    blob: Blob;
    url: string;                      // Object URL for display
    mimeType: string;
}

export interface GatewayConfig {
    gateways: string[];
    timeout: number;
    retries: number;
}

// ============================================================================
// Constants
// ============================================================================

// Public IPFS gateways (in order of preference)
const DEFAULT_GATEWAYS = [
    'https://gateway.pinata.cloud/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://dweb.link/ipfs/',
    'https://gateway.ipfs.io/ipfs/',
];

const DEFAULT_CONFIG: GatewayConfig = {
    gateways: DEFAULT_GATEWAYS,
    timeout: 30000,   // 30 seconds
    retries: 3,
};

// Cache for downloaded files
const fileCache = new Map<string, DownloadResult>();

// ============================================================================
// Decryption
// ============================================================================

/**
 * Decrypt file data with AES-256-GCM.
 */
const decryptFile = async (
    ciphertext: ArrayBuffer,
    keyString: string,
    ivString: string
): Promise<ArrayBuffer> => {
    const key = await importKey(keyString);
    const iv = Uint8Array.from(atob(ivString), c => c.charCodeAt(0));

    return crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
    );
};

// ============================================================================
// Gateway Fetching
// ============================================================================

/**
 * Fetch from a single gateway with timeout.
 */
const fetchFromGateway = async (
    gateway: string,
    cid: string,
    timeout: number,
    onProgress?: (progress: number) => void
): Promise<ArrayBuffer> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const url = `${gateway}${cid}`;
        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok) {
            throw new Error(`Gateway returned ${response.status}`);
        }

        // Handle progress if Content-Length is available
        const contentLength = response.headers.get('Content-Length');
        if (contentLength && onProgress) {
            const total = parseInt(contentLength, 10);
            let loaded = 0;

            const reader = response.body?.getReader();
            if (reader) {
                const chunks: Uint8Array[] = [];

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    chunks.push(value);
                    loaded += value.length;
                    onProgress(Math.round((loaded / total) * 100));
                }

                // Combine chunks
                const combined = new Uint8Array(loaded);
                let offset = 0;
                for (const chunk of chunks) {
                    combined.set(chunk, offset);
                    offset += chunk.length;
                }

                return combined.buffer;
            }
        }

        return response.arrayBuffer();
    } finally {
        clearTimeout(timeoutId);
    }
};

/**
 * Try multiple gateways in parallel.
 */
const fetchWithFallback = async (
    cid: string,
    config: GatewayConfig,
    onProgress?: (progress: number) => void
): Promise<ArrayBuffer> => {
    // Start requests to multiple gateways
    const attempts = config.gateways.slice(0, config.retries).map((gateway) =>
        fetchFromGateway(gateway, cid, config.timeout, onProgress)
            .then(data => ({ success: true as const, data }))
            .catch(error => ({ success: false as const, error }))
    );

    // Use the first successful response
    const results = await Promise.all(attempts);

    for (const result of results) {
        if (result.success) {
            return result.data;
        }
    }

    throw new Error('Failed to fetch from all IPFS gateways');
};

// ============================================================================
// Main Download Function
// ============================================================================

/**
 * Download and decrypt file from IPFS.
 */
export const downloadFromIPFS = async (
    options: DownloadOptions,
    config: GatewayConfig = DEFAULT_CONFIG
): Promise<DownloadResult> => {
    const { cid, encryptionKey, iv, mimeType, onProgress } = options;

    // Check cache first
    const cacheKey = `${cid}:${encryptionKey}`;
    const cached = fileCache.get(cacheKey);
    if (cached) {
        onProgress?.(100);
        return cached;
    }

    // Download encrypted data
    onProgress?.(0);
    const encryptedData = await fetchWithFallback(cid, config, (p) => {
        onProgress?.(p * 0.8); // 0-80%
    });

    // Decrypt data
    onProgress?.(85);
    const decrypted = await decryptFile(encryptedData, encryptionKey, iv);

    onProgress?.(95);

    // Create blob and URL
    const blob = new Blob([decrypted], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const result: DownloadResult = { blob, url, mimeType };

    // Cache the result
    fileCache.set(cacheKey, result);

    onProgress?.(100);

    return result;
};

/**
 * Download thumbnail from IPFS.
 */
export const downloadThumbnail = async (
    cid: string,
    encryptionKey: string,
    iv: string,
    config: GatewayConfig = DEFAULT_CONFIG
): Promise<string> => {
    const result = await downloadFromIPFS({
        cid,
        encryptionKey,
        iv,
        mimeType: 'image/webp',
    }, config);

    return result.url;
};

/**
 * Preload a file into cache.
 */
export const preloadFile = async (
    options: DownloadOptions,
    config: GatewayConfig = DEFAULT_CONFIG
): Promise<void> => {
    await downloadFromIPFS(options, config);
};

/**
 * Clear a specific file from cache.
 */
export const clearFromCache = (cid: string, encryptionKey: string): void => {
    const cacheKey = `${cid}:${encryptionKey}`;
    const cached = fileCache.get(cacheKey);

    if (cached) {
        URL.revokeObjectURL(cached.url);
        fileCache.delete(cacheKey);
    }
};

/**
 * Clear entire cache.
 */
export const clearCache = (): void => {
    fileCache.forEach((result) => {
        URL.revokeObjectURL(result.url);
    });
    fileCache.clear();
};

/**
 * Get cache size.
 */
export const getCacheSize = (): number => {
    return fileCache.size;
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if CID is valid.
 */
export const isValidCID = (cid: string): boolean => {
    // Basic validation for CIDv0 and CIDv1
    return /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[A-Za-z2-7]{58})$/.test(cid);
};

/**
 * Get gateway URL for a CID.
 */
export const getGatewayUrl = (
    cid: string,
    gateway: string = DEFAULT_GATEWAYS[0]
): string => {
    return `${gateway}${cid}`;
};

/**
 * Save file to disk.
 */
export const saveFile = (
    blob: Blob,
    fileName: string
): void => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/**
 * Download and save to disk in one step.
 */
export const downloadAndSave = async (
    options: DownloadOptions & { fileName: string },
    config: GatewayConfig = DEFAULT_CONFIG
): Promise<void> => {
    const result = await downloadFromIPFS(options, config);
    saveFile(result.blob, options.fileName);
};

// ============================================================================
// Stream Support (for large files)
// ============================================================================

/**
 * Get a readable stream for decrypted content.
 * Useful for streaming video playback.
 */
export const getDecryptedStream = async (
    options: DownloadOptions,
    config: GatewayConfig = DEFAULT_CONFIG
): Promise<ReadableStream<Uint8Array>> => {
    const result = await downloadFromIPFS(options, config);
    return result.blob.stream();
};

/**
 * Create a MediaSource for streaming video.
 */
export const createMediaSource = async (
    options: DownloadOptions,
    videoElement: HTMLVideoElement,
    config: GatewayConfig = DEFAULT_CONFIG
): Promise<MediaSource> => {
    const result = await downloadFromIPFS(options, config);

    const mediaSource = new MediaSource();
    videoElement.src = URL.createObjectURL(mediaSource);

    mediaSource.addEventListener('sourceopen', async () => {
        const sourceBuffer = mediaSource.addSourceBuffer(options.mimeType);
        const data = await result.blob.arrayBuffer();

        sourceBuffer.appendBuffer(data);
        sourceBuffer.addEventListener('updateend', () => {
            if (!sourceBuffer.updating && mediaSource.readyState === 'open') {
                mediaSource.endOfStream();
            }
        });
    });

    return mediaSource;
};
