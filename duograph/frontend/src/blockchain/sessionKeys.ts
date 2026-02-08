/**
 * Session Keys Module
 * 
 * On-chain session key management for pacts.
 */

import { ethers } from 'ethers';
import { getBinaryPact, type SessionKey } from './contracts';
import { getProvider } from '../lib/web3';
import { executeGasless, type GaslessResult } from './gasless';

// ============================================================================
// Types
// ============================================================================

export interface SessionKeyInfo extends SessionKey {
    /** Whether this key is currently valid (not expired and active) */
    isValid: boolean;
    /** Time remaining until expiry (ms) */
    timeRemaining: number;
}

// ============================================================================
// Session Key Registration
// ============================================================================

/**
 * Register a new session key on the pact contract.
 */
export const registerSessionKey = async (
    pactAddress: string,
    keyHash: string,
    validityPeriodSeconds: number = 86400 // 24 hours default
): Promise<GaslessResult> => {
    try {
        const pactInterface = new ethers.Interface([
            'function registerSessionKey(bytes32 keyHash, uint256 validityPeriod)',
        ]);

        const callData = pactInterface.encodeFunctionData('registerSessionKey', [
            keyHash,
            validityPeriodSeconds,
        ]);

        return await executeGasless({
            target: pactAddress,
            data: callData,
        });
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to register session key',
        };
    }
};

/**
 * Rotate session key (revoke old, register new).
 */
export const rotateSessionKey = async (
    pactAddress: string,
    newKeyHash: string,
    validityPeriodSeconds: number = 86400
): Promise<GaslessResult> => {
    try {
        const pactInterface = new ethers.Interface([
            'function rotateSessionKey(bytes32 newKeyHash, uint256 validityPeriod)',
        ]);

        const callData = pactInterface.encodeFunctionData('rotateSessionKey', [
            newKeyHash,
            validityPeriodSeconds,
        ]);

        return await executeGasless({
            target: pactAddress,
            data: callData,
        });
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to rotate session key',
        };
    }
};

/**
 * Revoke a session key.
 */
export const revokeSessionKey = async (
    pactAddress: string,
    keyHash: string
): Promise<GaslessResult> => {
    try {
        const pactInterface = new ethers.Interface([
            'function revokeSessionKey(bytes32 keyHash)',
        ]);

        const callData = pactInterface.encodeFunctionData('revokeSessionKey', [keyHash]);

        return await executeGasless({
            target: pactAddress,
            data: callData,
        });
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to revoke session key',
        };
    }
};

// ============================================================================
// Session Key Queries
// ============================================================================

/**
 * Get all session keys for a user in a pact.
 */
export const getSessionKeys = async (
    pactAddress: string,
    userAddress: string
): Promise<SessionKeyInfo[]> => {
    const provider = getProvider();
    const pact = getBinaryPact(pactAddress, provider);

    try {
        const keys: SessionKey[] = await pact.getSessionKeys(userAddress);
        const now = BigInt(Math.floor(Date.now() / 1000));

        return keys.map(key => ({
            ...key,
            isValid: key.isActive && key.expiresAt > now,
            timeRemaining: key.expiresAt > now
                ? Number((key.expiresAt - now) * 1000n)
                : 0,
        }));
    } catch (error) {
        console.error('Failed to get session keys:', error);
        return [];
    }
};

/**
 * Get only active (valid) session keys.
 */
export const getActiveSessionKeys = async (
    pactAddress: string,
    userAddress: string
): Promise<SessionKeyInfo[]> => {
    const keys = await getSessionKeys(pactAddress, userAddress);
    return keys.filter(k => k.isValid);
};

/**
 * Check if user has any active session key.
 */
export const hasActiveSessionKey = async (
    pactAddress: string,
    userAddress: string
): Promise<boolean> => {
    const provider = getProvider();
    const pact = getBinaryPact(pactAddress, provider);

    try {
        return await pact.hasActiveSessionKey(userAddress);
    } catch {
        return false;
    }
};

// ============================================================================
// Session Key Generation Helpers
// ============================================================================

/**
 * Generate a random session key and return its hash.
 */
export const generateSessionKeyHash = (): { key: Uint8Array; hash: string } => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    const hash = ethers.keccak256(key);
    return { key, hash };
};

/**
 * Hash an existing key for on-chain registration.
 */
export const hashSessionKey = (key: Uint8Array | string): string => {
    const keyBytes = typeof key === 'string'
        ? ethers.getBytes(key)
        : key;
    return ethers.keccak256(keyBytes);
};
