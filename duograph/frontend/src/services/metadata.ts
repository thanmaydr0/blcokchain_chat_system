/**
 * Metadata Service
 * 
 * CRUD operations for pact metadata and WebRTC signaling.
 * 
 * IMPORTANT: This service NEVER stores actual message content.
 * Only encrypted metadata for pact management and signaling coordination.
 */

import { supabase } from './supabase';
import type {
    User,
    UserInsert,
    Pact,
    PactInsert,
    Signal,
    SignalInsert,
    SessionKeyRow,
    SessionKeyInsert,
    PactStatus,
    SignalType,
} from './database.types';

// ============================================================================
// Types
// ============================================================================

export interface ServiceResult<T> {
    data: T | null;
    error: string | null;
}

// ============================================================================
// USER OPERATIONS
// ============================================================================

/**
 * Get or create user by wallet address.
 */
export const getOrCreateUser = async (
    walletAddress: string,
    publicKey?: string
): Promise<ServiceResult<User>> => {
    const normalizedAddress = walletAddress.toLowerCase();

    // Try to get existing user
    const { data: existing } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', normalizedAddress)
        .single();

    if (existing) {
        // Update last_seen
        await supabase
            .from('users')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', existing.id);

        return { data: existing, error: null };
    }

    // Create new user
    const newUser: UserInsert = {
        wallet_address: normalizedAddress,
        public_key: publicKey || null,
    };

    const { data: created, error: createError } = await supabase
        .from('users')
        .insert(newUser)
        .select()
        .single();

    if (createError) {
        return { data: null, error: createError.message };
    }

    return { data: created, error: null };
};

/**
 * Update user's public key.
 */
export const updateUserPublicKey = async (
    userId: string,
    publicKey: string
): Promise<ServiceResult<User>> => {
    const { data, error } = await supabase
        .from('users')
        .update({ public_key: publicKey })
        .eq('id', userId)
        .select()
        .single();

    if (error) {
        return { data: null, error: error.message };
    }

    return { data, error: null };
};

/**
 * Get user by wallet address.
 */
export const getUserByWallet = async (
    walletAddress: string
): Promise<ServiceResult<User>> => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', walletAddress.toLowerCase())
        .single();

    if (error) {
        return { data: null, error: error.message };
    }

    return { data, error: null };
};

// ============================================================================
// PACT OPERATIONS
// ============================================================================

/**
 * Create a new pact record.
 */
export const createPactRecord = async (
    pactData: {
        pactId: string;
        pactContractAddress: string;
        user1WalletAddress: string;
        user2WalletAddress: string;
        sharedSecretHash?: string;
        chainId?: number;
    }
): Promise<ServiceResult<Pact>> => {
    // Get or create both users
    const [user1Result, user2Result] = await Promise.all([
        getOrCreateUser(pactData.user1WalletAddress),
        getOrCreateUser(pactData.user2WalletAddress),
    ]);

    if (!user1Result.data || !user2Result.data) {
        return {
            data: null,
            error: 'Failed to get/create users'
        };
    }

    const newPact: PactInsert = {
        pact_id: pactData.pactId,
        pact_contract_address: pactData.pactContractAddress.toLowerCase(),
        user1_id: user1Result.data.id,
        user2_id: user2Result.data.id,
        shared_secret_hash: pactData.sharedSecretHash || null,
        chain_id: pactData.chainId || 11155111,
        status: 'active',
    };

    const { data, error } = await supabase
        .from('pacts')
        .insert(newPact)
        .select()
        .single();

    if (error) {
        return { data: null, error: error.message };
    }

    return { data, error: null };
};

/**
 * Get all pacts for a user.
 */
export const getUserPacts = async (
    userId: string,
    status?: PactStatus
): Promise<ServiceResult<Pact[]>> => {
    let query = supabase
        .from('pacts')
        .select('*')
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
        return { data: null, error: error.message };
    }

    return { data: data || [], error: null };
};

/**
 * Get pact by contract address.
 */
export const getPactByAddress = async (
    contractAddress: string
): Promise<ServiceResult<Pact>> => {
    const { data, error } = await supabase
        .from('pacts')
        .select('*')
        .eq('pact_contract_address', contractAddress.toLowerCase())
        .single();

    if (error) {
        return { data: null, error: error.message };
    }

    return { data, error: null };
};

/**
 * Update pact status.
 */
export const updatePactStatus = async (
    pactId: string,
    status: PactStatus
): Promise<ServiceResult<Pact>> => {
    const { data, error } = await supabase
        .from('pacts')
        .update({ status })
        .eq('id', pactId)
        .select()
        .single();

    if (error) {
        return { data: null, error: error.message };
    }

    return { data, error: null };
};

// ============================================================================
// SIGNAL OPERATIONS (WebRTC Signaling)
// ============================================================================

/**
 * Send a signaling message.
 */
export const sendSignal = async (
    signalData: {
        pactId: string;
        ghostId: string;
        senderId: string;
        signalType: SignalType;
        encryptedPayload: string;
        expiresInSeconds?: number;
    }
): Promise<ServiceResult<Signal>> => {
    const expiresAt = new Date(
        Date.now() + (signalData.expiresInSeconds || 300) * 1000
    ).toISOString();

    const newSignal: SignalInsert = {
        pact_id: signalData.pactId,
        ghost_id: signalData.ghostId,
        sender_id: signalData.senderId,
        signal_type: signalData.signalType,
        encrypted_payload: signalData.encryptedPayload,
        expires_at: expiresAt,
    };

    const { data, error } = await supabase
        .from('ephemeral_signals')
        .insert(newSignal)
        .select()
        .single();

    if (error) {
        return { data: null, error: error.message };
    }

    return { data, error: null };
};

/**
 * Get pending signals for a pact.
 */
export const getPendingSignals = async (
    pactId: string,
    excludeSenderId?: string
): Promise<ServiceResult<Signal[]>> => {
    let query = supabase
        .from('ephemeral_signals')
        .select('*')
        .eq('pact_id', pactId)
        .eq('is_consumed', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });

    if (excludeSenderId) {
        query = query.neq('sender_id', excludeSenderId);
    }

    const { data, error } = await query;

    if (error) {
        return { data: null, error: error.message };
    }

    return { data: data || [], error: null };
};

/**
 * Mark a signal as consumed.
 */
export const consumeSignal = async (
    signalId: string
): Promise<ServiceResult<boolean>> => {
    const { error } = await supabase
        .from('ephemeral_signals')
        .update({ is_consumed: true })
        .eq('id', signalId);

    if (error) {
        return { data: false, error: error.message };
    }

    return { data: true, error: null };
};

/**
 * Get signals by ghost ID (for anonymous signaling).
 */
export const getSignalsByGhostId = async (
    ghostId: string
): Promise<ServiceResult<Signal[]>> => {
    const { data, error } = await supabase
        .from('ephemeral_signals')
        .select('*')
        .eq('ghost_id', ghostId)
        .eq('is_consumed', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });

    if (error) {
        return { data: null, error: error.message };
    }

    return { data: data || [], error: null };
};

// ============================================================================
// SESSION KEY OPERATIONS
// ============================================================================

/**
 * Store encrypted session key.
 */
export const storeSessionKey = async (
    keyData: {
        pactId: string;
        userId: string;
        keyHash: string;
        encryptedKey: string;
        keyVersion?: number;
        expiresAt?: string;
    }
): Promise<ServiceResult<SessionKeyRow>> => {
    // Get current max version for this pact/user
    const { data: existing } = await supabase
        .from('session_keys')
        .select('key_version')
        .eq('pact_id', keyData.pactId)
        .eq('user_id', keyData.userId)
        .order('key_version', { ascending: false })
        .limit(1)
        .single();

    const newVersion = keyData.keyVersion || (existing?.key_version || 0) + 1;

    const newKey: SessionKeyInsert = {
        pact_id: keyData.pactId,
        user_id: keyData.userId,
        key_hash: keyData.keyHash,
        encrypted_key: keyData.encryptedKey,
        key_version: newVersion,
        expires_at: keyData.expiresAt || null,
    };

    const { data, error } = await supabase
        .from('session_keys')
        .insert(newKey)
        .select()
        .single();

    if (error) {
        return { data: null, error: error.message };
    }

    return { data, error: null };
};

/**
 * Get latest session key for a pact/user.
 */
export const getLatestSessionKey = async (
    pactId: string,
    userId: string
): Promise<ServiceResult<SessionKeyRow>> => {
    const { data, error } = await supabase
        .from('session_keys')
        .select('*')
        .eq('pact_id', pactId)
        .eq('user_id', userId)
        .order('key_version', { ascending: false })
        .limit(1)
        .single();

    if (error) {
        return { data: null, error: error.message };
    }

    return { data, error: null };
};

/**
 * Get all session keys for a pact (both users).
 */
export const getPactSessionKeys = async (
    pactId: string
): Promise<ServiceResult<SessionKeyRow[]>> => {
    const { data, error } = await supabase
        .from('session_keys')
        .select('*')
        .eq('pact_id', pactId)
        .order('created_at', { ascending: false });

    if (error) {
        return { data: null, error: error.message };
    }

    return { data: data || [], error: null };
};

// ============================================================================
// CLEANUP OPERATIONS
// ============================================================================

/**
 * Cleanup expired signals (call periodically).
 */
export const cleanupExpiredSignals = async (): Promise<ServiceResult<number>> => {
    const { data, error } = await supabase.rpc('cleanup_expired_signals');

    if (error) {
        return { data: null, error: error.message };
    }

    return { data: data || 0, error: null };
};
