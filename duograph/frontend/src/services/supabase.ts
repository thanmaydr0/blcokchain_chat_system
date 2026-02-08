/**
 * Supabase Client Configuration
 * 
 * Enhanced Supabase client with typed database operations.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Signal } from './database.types';

// ============================================================================
// Configuration
// ============================================================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
        'Supabase credentials not found. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
    );
}

// ============================================================================
// Supabase Client
// ============================================================================

export const supabase: SupabaseClient = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key',
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
        },
        realtime: {
            params: {
                eventsPerSecond: 10,
            },
        },
    }
);

// ============================================================================
// Auth Helper Functions
// ============================================================================

/**
 * Sign up with email/password.
 */
export const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });
    return { data, error };
};

/**
 * Sign in with email/password.
 */
export const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    return { data, error };
};

/**
 * Sign in with wallet message signature.
 */
export const signInWithWallet = async (walletAddress: string, signedMessage: string, nonce: string) => {
    // This requires a Supabase Edge Function to verify the signature
    const { data, error } = await supabase.functions.invoke('wallet-auth', {
        body: {
            walletAddress,
            signedMessage,
            nonce,
        },
    });
    return { data, error };
};

/**
 * Sign out current user.
 */
export const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
};

/**
 * Get current authenticated user.
 */
export const getCurrentUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
};

/**
 * Get current session.
 */
export const getSession = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    return { session, error };
};

/**
 * Listen for auth state changes.
 */
export const onAuthStateChange = (callback: (event: string, session: unknown) => void) => {
    return supabase.auth.onAuthStateChange(callback);
};

// ============================================================================
// Realtime Subscriptions
// ============================================================================

/**
 * Subscribe to signals for a pact.
 */
export const subscribeToSignals = (
    pactId: string,
    callback: (signal: Signal) => void
) => {
    return supabase
        .channel(`signals:${pactId}`)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'ephemeral_signals',
                filter: `pact_id=eq.${pactId}`,
            },
            (payload) => {
                callback(payload.new as Signal);
            }
        )
        .subscribe();
};

/**
 * Unsubscribe from a channel.
 */
export const unsubscribe = async (channel: ReturnType<typeof supabase.channel>) => {
    return supabase.removeChannel(channel);
};

export default supabase;
