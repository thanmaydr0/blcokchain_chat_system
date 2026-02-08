/**
 * Pact Manager Module
 * 
 * Handles pact creation, invitations, and management.
 */

import { ethers } from 'ethers';
import {
    CONTRACT_ADDRESSES,
    getPactFactory,
    getBinaryPact,
    signPactCreation,
    type PactMetadata
} from './contracts';
import { getSigner } from './wallet';
import { getProvider } from '../lib/web3';
import { executeGasless, type GaslessResult } from './gasless';
import { supabase } from '../lib/supabase';

// ============================================================================
// Types
// ============================================================================

export interface InviteData {
    /** Inviter's wallet address */
    inviter: string;
    /** Inviter's ECDH public key (hex) */
    publicKey: string;
    /** Invite expiration timestamp */
    expiresAt: number;
    /** Signature for verification */
    signature: string;
}

export interface PactCreationResult {
    success: boolean;
    pactId?: bigint;
    pactAddress?: string;
    txHash?: string;
    error?: string;
}

export interface PactDetails {
    pactId: bigint;
    pactAddress: string;
    user1: string;
    user2: string;
    createdAt: Date;
    isActive: boolean;
    myPublicKey: string | null;
    partnerPublicKey: string | null;
}

// ============================================================================
// Invite Generation & Parsing
// ============================================================================

/**
 * Generate an invite link/QR code data.
 */
export const generateInvite = async (publicKey: string): Promise<InviteData | null> => {
    const signer = await getSigner();
    if (!signer) return null;

    try {
        const inviter = await signer.getAddress();
        const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60; // 24 hours

        // Sign the invite data
        const message = ethers.solidityPackedKeccak256(
            ['address', 'bytes', 'uint256'],
            [inviter, publicKey, expiresAt]
        );
        const signature = await signer.signMessage(ethers.getBytes(message));

        return {
            inviter,
            publicKey,
            expiresAt,
            signature,
        };
    } catch (error) {
        console.error('Failed to generate invite:', error);
        return null;
    }
};

/**
 * Encode invite data for QR code.
 */
export const encodeInvite = (invite: InviteData): string => {
    return btoa(JSON.stringify(invite));
};

/**
 * Parse invite from encoded string.
 */
export const parseInvite = (encoded: string): InviteData | null => {
    try {
        const decoded = atob(encoded);
        const invite = JSON.parse(decoded) as InviteData;

        // Validate structure
        if (!invite.inviter || !invite.publicKey || !invite.expiresAt || !invite.signature) {
            return null;
        }

        // Check expiration
        if (invite.expiresAt < Math.floor(Date.now() / 1000)) {
            return null;
        }

        return invite;
    } catch {
        return null;
    }
};

/**
 * Verify invite signature.
 */
export const verifyInvite = (invite: InviteData): boolean => {
    try {
        const message = ethers.solidityPackedKeccak256(
            ['address', 'bytes', 'uint256'],
            [invite.inviter, invite.publicKey, invite.expiresAt]
        );

        const recoveredAddress = ethers.verifyMessage(ethers.getBytes(message), invite.signature);
        return recoveredAddress.toLowerCase() === invite.inviter.toLowerCase();
    } catch {
        return false;
    }
};

// ============================================================================
// Pact Creation
// ============================================================================

/**
 * Create a pact via direct transaction (requires gas).
 */
export const createPact = async (
    user1: string,
    user2: string
): Promise<PactCreationResult> => {
    const signer = await getSigner();
    if (!signer) {
        return { success: false, error: 'No signer available' };
    }

    try {
        const factory = getPactFactory(signer);

        // Check if pact already exists
        const [exists] = await factory.checkPactExists(user1, user2);
        if (exists) {
            return { success: false, error: 'Pact already exists between these users' };
        }

        // Create pact
        const tx = await factory.createPact(user1, user2);
        const receipt = await tx.wait();

        // Parse event to get pact ID and address
        const pactCreatedEvent = receipt.logs.find(
            (log: { topics: string[] }) => log.topics[0] === ethers.id('PactCreated(uint256,address,address,address,uint256)')
        );

        if (pactCreatedEvent) {
            const iface = new ethers.Interface([
                'event PactCreated(uint256 indexed pactId, address indexed pactAddress, address indexed user1, address user2, uint256 timestamp)'
            ]);
            const parsed = iface.parseLog(pactCreatedEvent);

            // Sync to Supabase
            await syncPactToSupabase(
                parsed?.args.pactId,
                parsed?.args.pactAddress,
                user1,
                user2
            );

            return {
                success: true,
                pactId: parsed?.args.pactId,
                pactAddress: parsed?.args.pactAddress,
                txHash: receipt.hash,
            };
        }

        return {
            success: true,
            txHash: receipt.hash,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create pact',
        };
    }
};

/**
 * Create a pact via gasless transaction (ERC-4337).
 */
export const createPactGasless = async (
    user1: string,
    user2: string
): Promise<PactCreationResult> => {
    try {
        // Encode createPact calldata
        const factoryInterface = new ethers.Interface([
            'function createPact(address user1, address user2) returns (uint256 pactId, address pactAddress)',
        ]);

        const callData = factoryInterface.encodeFunctionData('createPact', [user1, user2]);

        // Execute via gasless
        const result = await executeGasless({
            target: CONTRACT_ADDRESSES.PACT_FACTORY,
            data: callData,
        });

        if (!result.success) {
            // Fallback to direct transaction
            return await createPact(user1, user2);
        }

        return {
            success: true,
            txHash: result.txHash,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Gasless pact creation failed',
        };
    }
};

/**
 * Create pact with EIP-712 signature (meta-transaction style).
 */
export const createPactWithSignature = async (
    user1: string,
    user2: string,
    deadline: bigint
): Promise<PactCreationResult> => {
    const signer = await getSigner();
    if (!signer) {
        return { success: false, error: 'No signer available' };
    }

    try {
        const provider = getProvider();
        const factory = getPactFactory(provider);

        // Get nonce
        const nonce = await factory.nonces(user1);

        // Sign the typed data
        const sig = await signPactCreation(signer, user1, user2, nonce, deadline);

        // Anyone can submit this (including a relayer)
        const tx = await factory.createPactWithSignature(
            user1,
            user2,
            deadline,
            sig.v,
            sig.r,
            sig.s
        );
        const receipt = await tx.wait();

        return {
            success: true,
            txHash: receipt.hash,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Signature-based creation failed',
        };
    }
};

// ============================================================================
// Pact Queries
// ============================================================================

/**
 * Get pact details by pact address.
 */
export const getPactDetails = async (
    pactAddress: string,
    userAddress: string
): Promise<PactDetails | null> => {
    const provider = getProvider();

    try {
        const pact = getBinaryPact(pactAddress, provider);

        const [
            pactId,
            user1,
            user2,
            createdAt,
            isDissolved,
            myPublicKey,
        ] = await Promise.all([
            pact.pactId(),
            pact.user1(),
            pact.user2(),
            pact.createdAt(),
            pact.isDissolved(),
            pact.publicKeys(userAddress),
        ]);

        const partner = user1.toLowerCase() === userAddress.toLowerCase() ? user2 : user1;
        const partnerPublicKey = await pact.publicKeys(partner);

        return {
            pactId,
            pactAddress,
            user1,
            user2,
            createdAt: new Date(Number(createdAt) * 1000),
            isActive: !isDissolved,
            myPublicKey: myPublicKey || null,
            partnerPublicKey: partnerPublicKey || null,
        };
    } catch (error) {
        console.error('Failed to get pact details:', error);
        return null;
    }
};

/**
 * Get all pacts for a user.
 */
export const getUserPacts = async (userAddress: string): Promise<PactMetadata[]> => {
    const provider = getProvider();
    const factory = getPactFactory(provider);

    try {
        const pactIds: bigint[] = await factory.getUserPacts(userAddress);

        const pacts = await Promise.all(
            pactIds.map(async (id) => {
                const pact = await factory.getPact(id);
                return {
                    pactId: pact.pactId,
                    pactAddress: pact.pactAddress,
                    user1: pact.user1,
                    user2: pact.user2,
                    createdAt: pact.createdAt,
                    isActive: pact.isActive,
                } as PactMetadata;
            })
        );

        return pacts.filter(p => p.isActive);
    } catch (error) {
        console.error('Failed to get user pacts:', error);
        return [];
    }
};

/**
 * Check if two users have an active pact.
 */
export const checkPactExists = async (
    user1: string,
    user2: string
): Promise<{ exists: boolean; pactId?: bigint }> => {
    const provider = getProvider();
    const factory = getPactFactory(provider);

    try {
        const [exists, pactId] = await factory.checkPactExists(user1, user2);
        return { exists, pactId: exists ? pactId : undefined };
    } catch {
        return { exists: false };
    }
};

// ============================================================================
// Public Key Management
// ============================================================================

/**
 * Register public key on pact contract.
 */
export const registerPublicKey = async (
    pactAddress: string,
    publicKey: string
): Promise<GaslessResult> => {
    try {
        const pactInterface = new ethers.Interface([
            'function registerPublicKey(bytes calldata publicKey)',
        ]);

        const callData = pactInterface.encodeFunctionData('registerPublicKey', [publicKey]);

        return await executeGasless({
            target: pactAddress,
            data: callData,
        });
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to register public key',
        };
    }
};

// ============================================================================
// Supabase Sync
// ============================================================================

/**
 * Sync pact data to Supabase for quick lookup.
 */
const syncPactToSupabase = async (
    pactId: bigint,
    pactAddress: string,
    user1: string,
    user2: string
): Promise<void> => {
    try {
        await supabase.from('pacts').upsert({
            pact_id: pactId.toString(),
            pact_address: pactAddress,
            user1: user1.toLowerCase(),
            user2: user2.toLowerCase(),
            chain_id: 11155111, // Sepolia
            created_at: new Date().toISOString(),
        });
    } catch (error) {
        console.warn('Failed to sync pact to Supabase:', error);
        // Non-critical, continue
    }
};
