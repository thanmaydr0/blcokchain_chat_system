/**
 * Zero-Knowledge Chat Audit Module
 * 
 * Merkle tree-based message integrity verification:
 * - Generate Merkle tree from message history
 * - Compute root hash using crypto.subtle
 * - Compare with remote peer's hash
 * - Detect MITM or tampering
 */

export interface MerkleNode {
    hash: string;
    left?: MerkleNode;
    right?: MerkleNode;
    data?: string;
}

export interface AuditResult {
    localRootHash: string;
    remoteRootHash: string | null;
    isValid: boolean;
    messageCount: number;
    auditedAt: number;
    mismatchDetails?: string;
}

export interface AuditConfig {
    enabled: boolean;
    autoAuditIntervalMs: number;
    alertOnMismatch: boolean;
}

export interface MessageForAudit {
    id: string;
    senderId: string;
    content: string;
    timestamp: number;
}

type AuditCallback = (result: AuditResult) => void;

const DEFAULT_CONFIG: AuditConfig = {
    enabled: true,
    autoAuditIntervalMs: 5 * 60 * 1000, // 5 minutes
    alertOnMismatch: true,
};

// Module state
let config: AuditConfig = { ...DEFAULT_CONFIG };
let auditHistory: AuditResult[] = [];
let auditListeners: AuditCallback[] = [];
let autoAuditTimer: number | null = null;

/**
 * Initialize the audit module
 */
export const initZkAudit = (customConfig?: Partial<AuditConfig>): void => {
    config = { ...DEFAULT_CONFIG, ...customConfig };
    console.log('[Security] ZK Audit module initialized');
};

/**
 * Compute SHA-256 hash of a string
 */
export const sha256 = async (data: string): Promise<string> => {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    return bufferToHex(hashBuffer);
};

/**
 * Compute hash of a message for Merkle tree
 */
export const hashMessage = async (message: MessageForAudit): Promise<string> => {
    const canonical = JSON.stringify({
        id: message.id,
        senderId: message.senderId,
        content: message.content,
        timestamp: message.timestamp,
    });
    return sha256(canonical);
};

/**
 * Build a Merkle tree from message hashes
 */
export const buildMerkleTree = async (
    messages: MessageForAudit[]
): Promise<MerkleNode | null> => {
    if (messages.length === 0) {
        return null;
    }

    // Hash all messages (leaf nodes)
    const leaves: MerkleNode[] = await Promise.all(
        messages.map(async (msg) => ({
            hash: await hashMessage(msg),
            data: msg.id,
        }))
    );

    // Build tree bottom-up
    let currentLevel = leaves;

    while (currentLevel.length > 1) {
        const nextLevel: MerkleNode[] = [];

        for (let i = 0; i < currentLevel.length; i += 2) {
            const left = currentLevel[i];
            const right = currentLevel[i + 1] || left; // Duplicate if odd

            const combinedHash = await sha256(left.hash + right.hash);

            nextLevel.push({
                hash: combinedHash,
                left,
                right: currentLevel[i + 1] ? right : undefined,
            });
        }

        currentLevel = nextLevel;
    }

    return currentLevel[0];
};

/**
 * Get root hash of message history
 */
export const computeRootHash = async (
    messages: MessageForAudit[]
): Promise<string> => {
    if (messages.length === 0) {
        return await sha256('EMPTY_HISTORY');
    }

    // Sort messages by timestamp for consistent ordering
    const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);

    const tree = await buildMerkleTree(sorted);
    return tree?.hash || await sha256('EMPTY_HISTORY');
};

/**
 * Generate a proof for a specific message
 */
export const generateMerkleProof = async (
    messages: MessageForAudit[],
    messageId: string
): Promise<{ path: string[]; positions: ('left' | 'right')[] } | null> => {
    const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);
    const index = sorted.findIndex(m => m.id === messageId);

    if (index === -1) return null;

    const leaves = await Promise.all(
        sorted.map(async (msg) => await hashMessage(msg))
    );

    const path: string[] = [];
    const positions: ('left' | 'right')[] = [];
    let currentLevel = leaves;
    let currentIndex = index;

    while (currentLevel.length > 1) {
        const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
        const sibling = currentLevel[siblingIndex] || currentLevel[currentIndex];

        path.push(sibling);
        positions.push(currentIndex % 2 === 0 ? 'right' : 'left');

        // Build next level
        const nextLevel: string[] = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
            const left = currentLevel[i];
            const right = currentLevel[i + 1] || left;
            nextLevel.push(await sha256(left + right));
        }

        currentLevel = nextLevel;
        currentIndex = Math.floor(currentIndex / 2);
    }

    return { path, positions };
};

/**
 * Verify a Merkle proof
 */
export const verifyMerkleProof = async (
    messageHash: string,
    rootHash: string,
    proof: { path: string[]; positions: ('left' | 'right')[] }
): Promise<boolean> => {
    let currentHash = messageHash;

    for (let i = 0; i < proof.path.length; i++) {
        const sibling = proof.path[i];
        const position = proof.positions[i];

        if (position === 'left') {
            currentHash = await sha256(sibling + currentHash);
        } else {
            currentHash = await sha256(currentHash + sibling);
        }
    }

    return currentHash === rootHash;
};

/**
 * Perform a full audit against remote hash
 */
export const performAudit = async (
    localMessages: MessageForAudit[],
    remoteRootHash: string | null
): Promise<AuditResult> => {
    const localRootHash = await computeRootHash(localMessages);

    const result: AuditResult = {
        localRootHash,
        remoteRootHash,
        isValid: remoteRootHash === null || localRootHash === remoteRootHash,
        messageCount: localMessages.length,
        auditedAt: Date.now(),
    };

    if (!result.isValid) {
        result.mismatchDetails = `Hash mismatch detected. Local: ${localRootHash.slice(0, 16)}... Remote: ${remoteRootHash?.slice(0, 16)}...`;

        if (config.alertOnMismatch) {
            console.error('[Security] AUDIT FAILURE - Potential MITM attack detected!');
        }
    }

    // Store result
    auditHistory.push(result);
    if (auditHistory.length > 50) {
        auditHistory = auditHistory.slice(-50);
    }

    // Notify listeners
    auditListeners.forEach(cb => {
        try {
            cb(result);
        } catch (e) {
            console.error('[Security] Audit callback error:', e);
        }
    });

    return result;
};

/**
 * Start automatic periodic audits
 */
export const startAutoAudit = (
    getMessages: () => Promise<MessageForAudit[]>,
    getRemoteHash: () => Promise<string | null>
): void => {
    if (autoAuditTimer) {
        clearInterval(autoAuditTimer);
    }

    autoAuditTimer = window.setInterval(async () => {
        try {
            const messages = await getMessages();
            const remoteHash = await getRemoteHash();
            await performAudit(messages, remoteHash);
        } catch (e) {
            console.error('[Security] Auto-audit failed:', e);
        }
    }, config.autoAuditIntervalMs);
};

/**
 * Stop automatic audits
 */
export const stopAutoAudit = (): void => {
    if (autoAuditTimer) {
        clearInterval(autoAuditTimer);
        autoAuditTimer = null;
    }
};

/**
 * Subscribe to audit results
 */
export const onAuditResult = (callback: AuditCallback): (() => void) => {
    auditListeners.push(callback);
    return () => {
        auditListeners = auditListeners.filter(cb => cb !== callback);
    };
};

/**
 * Get audit history
 */
export const getAuditHistory = (): AuditResult[] => {
    return [...auditHistory];
};

/**
 * Get latest audit result
 */
export const getLatestAudit = (): AuditResult | null => {
    return auditHistory[auditHistory.length - 1] || null;
};

/**
 * Clear audit history
 */
export const clearAuditHistory = (): void => {
    auditHistory = [];
};

/**
 * Export verification data for sharing with peer
 */
export const exportVerificationData = async (
    messages: MessageForAudit[]
): Promise<{ rootHash: string; messageCount: number; generatedAt: number }> => {
    const rootHash = await computeRootHash(messages);

    return {
        rootHash,
        messageCount: messages.length,
        generatedAt: Date.now(),
    };
};

// ============================================================================
// Internal Functions
// ============================================================================

const bufferToHex = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
};
