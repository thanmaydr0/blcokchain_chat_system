/**
 * Services Module Exports
 * 
 * Central export point for all Supabase services.
 */

// Supabase client and auth
export {
    supabase,
    signUp,
    signIn,
    signInWithWallet,
    signOut,
    getCurrentUser,
    getSession,
    onAuthStateChange,
    subscribeToSignals,
    unsubscribe,
} from './supabase';

// Database types
export type {
    Database,
    User,
    UserInsert,
    UserUpdate,
    Pact,
    PactInsert,
    PactUpdate,
    Signal,
    SignalInsert,
    SignalUpdate,
    SessionKeyRow,
    SessionKeyInsert,
    SessionKeyUpdate,
    PactStatus,
    SignalType,
} from './database.types';

// Metadata operations
export {
    // User operations
    getOrCreateUser,
    updateUserPublicKey,
    getUserByWallet,

    // Pact operations
    createPactRecord,
    getUserPacts,
    getPactByAddress,
    updatePactStatus,

    // Signal operations
    sendSignal,
    getPendingSignals,
    consumeSignal,
    getSignalsByGhostId,

    // Session key operations
    storeSessionKey,
    getLatestSessionKey,
    getPactSessionKeys,

    // Cleanup
    cleanupExpiredSignals,
} from './metadata';

export type { ServiceResult } from './metadata';
