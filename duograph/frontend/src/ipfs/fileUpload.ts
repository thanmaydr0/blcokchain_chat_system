/**
 * IPFS File Upload Module
 * 
 * Encrypts media files and uploads to IPFS.
 * Uses Pinata/Infura HTTP API for uploads.
 */

// ============================================================================
// Types
// ============================================================================

export interface UploadOptions {
    file: File;
    onProgress?: (progress: number) => void;
    generateThumbnail?: boolean;
    maxThumbnailSize?: number;
}

export interface UploadResult {
    cid: string;
    encryptionKey: string;           // Base64 encoded AES-256 key
    iv: string;                      // Base64 encoded IV
    fileName: string;
    fileSize: number;
    mimeType: string;
    thumbnailCid?: string;
    thumbnailKey?: string;
}

export interface IPFSConfig {
    gateway: string;
    apiEndpoint: string;
    apiKey?: string;
    apiSecret?: string;
}

// ============================================================================
// Constants
// ============================================================================

// Free public IPFS gateways
export const PUBLIC_GATEWAYS = [
    'https://gateway.pinata.cloud/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://dweb.link/ipfs/',
];

// Default config (use environment variables in production)
const DEFAULT_CONFIG: IPFSConfig = {
    gateway: import.meta.env.VITE_IPFS_GATEWAY || PUBLIC_GATEWAYS[0],
    apiEndpoint: import.meta.env.VITE_IPFS_API || 'https://api.pinata.cloud',
    apiKey: import.meta.env.VITE_PINATA_API_KEY,
    apiSecret: import.meta.env.VITE_PINATA_SECRET,
};

// Max file size: 100MB
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

// Supported media types
export const SUPPORTED_TYPES = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    video: ['video/mp4', 'video/webm', 'video/quicktime'],
    audio: ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm'],
    file: ['application/pdf', 'application/zip', 'text/plain'],
};

// ============================================================================
// Encryption Helpers
// ============================================================================

/**
 * Generate a random AES-256 key for file encryption.
 */
export const generateFileKey = async (): Promise<CryptoKey> => {
    return crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
};

/**
 * Export key to base64 string.
 */
export const exportKey = async (key: CryptoKey): Promise<string> => {
    const raw = await crypto.subtle.exportKey('raw', key);
    return btoa(String.fromCharCode(...new Uint8Array(raw)));
};

/**
 * Import key from base64 string.
 */
export const importKey = async (keyString: string): Promise<CryptoKey> => {
    const raw = Uint8Array.from(atob(keyString), c => c.charCodeAt(0));
    return crypto.subtle.importKey(
        'raw',
        raw,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
};

/**
 * Encrypt file data with AES-256-GCM.
 */
export const encryptFile = async (
    data: ArrayBuffer,
    key: CryptoKey
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> => {
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data
    );

    return { ciphertext, iv };
};

/**
 * Generate thumbnail for image.
 */
const generateImageThumbnail = async (
    file: File,
    maxSize: number = 200
): Promise<Blob | null> => {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            const canvas = document.createElement('canvas');
            let { width, height } = img;

            // Calculate thumbnail dimensions
            if (width > height) {
                if (width > maxSize) {
                    height = Math.round(height * maxSize / width);
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width = Math.round(width * maxSize / height);
                    height = maxSize;
                }
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(null);
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.7);
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(null);
        };

        img.src = url;
    });
};

/**
 * Generate thumbnail for video.
 */
const generateVideoThumbnail = async (
    file: File,
    maxSize: number = 200
): Promise<Blob | null> => {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        const url = URL.createObjectURL(file);

        video.onloadedmetadata = () => {
            video.currentTime = Math.min(1, video.duration / 2);
        };

        video.onseeked = () => {
            const canvas = document.createElement('canvas');
            let width = video.videoWidth;
            let height = video.videoHeight;

            // Calculate thumbnail dimensions
            if (width > height) {
                if (width > maxSize) {
                    height = Math.round(height * maxSize / width);
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width = Math.round(width * maxSize / height);
                    height = maxSize;
                }
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                URL.revokeObjectURL(url);
                resolve(null);
                return;
            }

            ctx.drawImage(video, 0, 0, width, height);
            URL.revokeObjectURL(url);

            canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.7);
        };

        video.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(null);
        };

        video.src = url;
    });
};

// ============================================================================
// IPFS Upload
// ============================================================================

/**
 * Upload encrypted blob to IPFS via Pinata.
 */
const uploadToPinata = async (
    blob: Blob,
    config: IPFSConfig,
    onProgress?: (progress: number) => void
): Promise<string> => {
    const formData = new FormData();
    formData.append('file', blob, 'encrypted');

    // Use XMLHttpRequest for progress tracking
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && onProgress) {
                onProgress(Math.round((e.loaded / e.total) * 100));
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    resolve(response.IpfsHash);
                } catch {
                    reject(new Error('Invalid response from IPFS'));
                }
            } else {
                reject(new Error(`Upload failed: ${xhr.status}`));
            }
        });

        xhr.addEventListener('error', () => {
            reject(new Error('Network error during upload'));
        });

        xhr.open('POST', `${config.apiEndpoint}/pinning/pinFileToIPFS`);

        if (config.apiKey) {
            xhr.setRequestHeader('pinata_api_key', config.apiKey);
        }
        if (config.apiSecret) {
            xhr.setRequestHeader('pinata_secret_api_key', config.apiSecret);
        }

        xhr.send(formData);
    });
};

/**
 * Upload to local IPFS node (fallback for development).
 */
const uploadToLocalIPFS = async (
    blob: Blob,
    onProgress?: (progress: number) => void
): Promise<string> => {
    const formData = new FormData();
    formData.append('file', blob);

    const response = await fetch('http://localhost:5001/api/v0/add', {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        throw new Error('Failed to upload to local IPFS');
    }

    onProgress?.(100);

    const result = await response.json();
    return result.Hash;
};

// ============================================================================
// Main Upload Function
// ============================================================================

/**
 * Encrypt and upload a file to IPFS.
 */
export const uploadToIPFS = async (
    options: UploadOptions,
    config: IPFSConfig = DEFAULT_CONFIG
): Promise<UploadResult> => {
    const { file, onProgress, generateThumbnail = true, maxThumbnailSize = 200 } = options;

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Generate encryption key
    const key = await generateFileKey();
    const keyString = await exportKey(key);

    // Read file data
    const fileData = await file.arrayBuffer();

    // Encrypt file
    onProgress?.(0);
    const { ciphertext, iv } = await encryptFile(fileData, key);
    onProgress?.(10);

    // Create encrypted blob
    const encryptedBlob = new Blob([ciphertext], { type: 'application/octet-stream' });

    // Upload to IPFS
    let cid: string;
    try {
        cid = await uploadToPinata(encryptedBlob, config, (p) => {
            onProgress?.(10 + p * 0.7); // 10-80%
        });
    } catch {
        // Fallback to local IPFS node
        cid = await uploadToLocalIPFS(encryptedBlob, (p) => {
            onProgress?.(10 + p * 0.7);
        });
    }

    // Generate and upload thumbnail if applicable
    let thumbnailCid: string | undefined;
    let thumbnailKey: string | undefined;

    if (generateThumbnail) {
        let thumbnailBlob: Blob | null = null;

        if (file.type.startsWith('image/')) {
            thumbnailBlob = await generateImageThumbnail(file, maxThumbnailSize);
        } else if (file.type.startsWith('video/')) {
            thumbnailBlob = await generateVideoThumbnail(file, maxThumbnailSize);
        }

        if (thumbnailBlob) {
            onProgress?.(85);

            // Encrypt thumbnail with a separate key
            const thumbKey = await generateFileKey();
            thumbnailKey = await exportKey(thumbKey);

            const thumbData = await thumbnailBlob.arrayBuffer();
            const encThumb = await encryptFile(thumbData, thumbKey);

            const encThumbBlob = new Blob([encThumb.ciphertext], { type: 'application/octet-stream' });

            try {
                thumbnailCid = await uploadToPinata(encThumbBlob, config);
            } catch {
                thumbnailCid = await uploadToLocalIPFS(encThumbBlob);
            }
        }
    }

    onProgress?.(100);

    return {
        cid,
        encryptionKey: keyString,
        iv: btoa(String.fromCharCode(...iv)),
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        thumbnailCid,
        thumbnailKey,
    };
};

/**
 * Validate file before upload.
 */
export const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (file.size > MAX_FILE_SIZE) {
        return {
            valid: false,
            error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
        };
    }

    const allTypes = [
        ...SUPPORTED_TYPES.image,
        ...SUPPORTED_TYPES.video,
        ...SUPPORTED_TYPES.audio,
        ...SUPPORTED_TYPES.file,
    ];

    if (!allTypes.includes(file.type)) {
        return {
            valid: false,
            error: `Unsupported file type: ${file.type}`
        };
    }

    return { valid: true };
};

/**
 * Get file type category.
 */
export const getFileCategory = (
    mimeType: string
): 'image' | 'video' | 'audio' | 'file' => {
    if (SUPPORTED_TYPES.image.includes(mimeType)) return 'image';
    if (SUPPORTED_TYPES.video.includes(mimeType)) return 'video';
    if (SUPPORTED_TYPES.audio.includes(mimeType)) return 'audio';
    return 'file';
};

/**
 * Format file size for display.
 */
export const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
};
