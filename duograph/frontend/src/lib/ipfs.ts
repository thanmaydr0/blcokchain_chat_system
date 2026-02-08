/**
 * IPFS utilities for decentralized media sharing
 * Uses IPFS HTTP API gateway for file storage
 */

// IPFS Gateway configuration
const IPFS_GATEWAY = import.meta.env.VITE_IPFS_GATEWAY || 'https://gateway.pinata.cloud';
const IPFS_API = import.meta.env.VITE_IPFS_API || 'https://api.pinata.cloud';
const PINATA_JWT = import.meta.env.VITE_PINATA_JWT;

export interface IPFSUploadResult {
    hash: string;
    size: number;
    url: string;
}

export interface IPFSFileMetadata {
    name: string;
    type: string;
    size: number;
    encryptedKey?: string; // Encrypted decryption key for the file
}

// Upload file to IPFS via Pinata
export const uploadToIPFS = async (
    file: File,
    metadata?: IPFSFileMetadata
): Promise<IPFSUploadResult> => {
    if (!PINATA_JWT) {
        throw new Error('IPFS API key not configured. Please set VITE_PINATA_JWT.');
    }

    const formData = new FormData();
    formData.append('file', file);

    if (metadata) {
        formData.append(
            'pinataMetadata',
            JSON.stringify({
                name: metadata.name,
                keyvalues: {
                    type: metadata.type,
                    size: metadata.size.toString(),
                    encryptedKey: metadata.encryptedKey || '',
                },
            })
        );
    }

    const response = await fetch(`${IPFS_API}/pinning/pinFileToIPFS`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${PINATA_JWT}`,
        },
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`IPFS upload failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
        hash: data.IpfsHash,
        size: data.PinSize,
        url: `${IPFS_GATEWAY}/ipfs/${data.IpfsHash}`,
    };
};

// Upload JSON data to IPFS
export const uploadJSONToIPFS = async (
    data: object,
    name: string
): Promise<IPFSUploadResult> => {
    if (!PINATA_JWT) {
        throw new Error('IPFS API key not configured.');
    }

    const response = await fetch(`${IPFS_API}/pinning/pinJSONToIPFS`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${PINATA_JWT}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            pinataContent: data,
            pinataMetadata: { name },
        }),
    });

    if (!response.ok) {
        throw new Error(`IPFS JSON upload failed: ${response.statusText}`);
    }

    const result = await response.json();

    return {
        hash: result.IpfsHash,
        size: 0, // JSON size not returned
        url: `${IPFS_GATEWAY}/ipfs/${result.IpfsHash}`,
    };
};

// Fetch file from IPFS
export const fetchFromIPFS = async (hash: string): Promise<Blob> => {
    const response = await fetch(`${IPFS_GATEWAY}/ipfs/${hash}`);

    if (!response.ok) {
        throw new Error(`Failed to fetch from IPFS: ${response.statusText}`);
    }

    return await response.blob();
};

// Fetch JSON from IPFS
export const fetchJSONFromIPFS = async <T>(hash: string): Promise<T> => {
    const response = await fetch(`${IPFS_GATEWAY}/ipfs/${hash}`);

    if (!response.ok) {
        throw new Error(`Failed to fetch JSON from IPFS: ${response.statusText}`);
    }

    return await response.json();
};

// Get IPFS URL for a hash
export const getIPFSUrl = (hash: string): string => {
    return `${IPFS_GATEWAY}/ipfs/${hash}`;
};

// Validate IPFS hash format
export const isValidIPFSHash = (hash: string): boolean => {
    // CIDv0 starts with Qm and is 46 characters
    // CIDv1 starts with b and varies in length
    return /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(hash) || /^b[a-z2-7]{58}$/.test(hash);
};

// Encrypt file before upload (for privacy)
export const encryptFile = async (
    file: File,
    encryptionKey: CryptoKey
): Promise<{ encryptedBlob: Blob; iv: Uint8Array }> => {
    const arrayBuffer = await file.arrayBuffer();
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        encryptionKey,
        arrayBuffer
    );

    return {
        encryptedBlob: new Blob([encryptedData], { type: 'application/octet-stream' }),
        iv,
    };
};

// Decrypt file after download
export const decryptFile = async (
    encryptedBlob: Blob,
    encryptionKey: CryptoKey,
    iv: Uint8Array,
    originalType: string
): Promise<Blob> => {
    const arrayBuffer = await encryptedBlob.arrayBuffer();

    const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as unknown as BufferSource },
        encryptionKey,
        arrayBuffer
    );

    return new Blob([decryptedData], { type: originalType });
};

// Create object URL for blob (remember to revoke when done)
export const createObjectURL = (blob: Blob): string => {
    return URL.createObjectURL(blob);
};

// Revoke object URL
export const revokeObjectURL = (url: string): void => {
    URL.revokeObjectURL(url);
};
