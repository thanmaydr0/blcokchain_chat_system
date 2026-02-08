/**
 * IPFS Module Exports
 * 
 * Central exports for IPFS media handling.
 */

// File Upload
export {
    // Types
    type UploadOptions,
    type UploadResult,
    type IPFSConfig,

    // Constants
    PUBLIC_GATEWAYS,
    MAX_FILE_SIZE,
    SUPPORTED_TYPES,

    // Encryption helpers
    generateFileKey,
    exportKey,
    importKey,
    encryptFile,

    // Upload
    uploadToIPFS,

    // Utilities
    validateFile,
    getFileCategory,
    formatFileSize,
} from './fileUpload';

// File Download
export {
    // Types
    type DownloadOptions,
    type DownloadResult,
    type GatewayConfig,

    // Download
    downloadFromIPFS,
    downloadThumbnail,
    preloadFile,

    // Cache
    clearFromCache,
    clearCache,
    getCacheSize,

    // Utilities
    isValidCID,
    getGatewayUrl,
    saveFile,
    downloadAndSave,

    // Streaming
    getDecryptedStream,
    createMediaSource,
} from './fileDownload';
