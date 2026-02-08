/**
 * Database Types
 * 
 * TypeScript types generated from Supabase schema.
 * 
 * IMPORTANT: These types match the 001_initial_schema.sql migration.
 */

export interface Database {
    public: {
        Tables: {
            users: {
                Row: {
                    id: string;
                    wallet_address: string;
                    public_key: string | null;
                    display_name: string | null;
                    created_at: string;
                    last_seen: string;
                };
                Insert: {
                    id?: string;
                    wallet_address: string;
                    public_key?: string | null;
                    display_name?: string | null;
                    created_at?: string;
                    last_seen?: string;
                };
                Update: {
                    id?: string;
                    wallet_address?: string;
                    public_key?: string | null;
                    display_name?: string | null;
                    created_at?: string;
                    last_seen?: string;
                };
            };
            pacts: {
                Row: {
                    id: string;
                    pact_id: string;
                    pact_contract_address: string;
                    chain_id: number;
                    user1_id: string;
                    user2_id: string;
                    shared_secret_hash: string | null;
                    status: 'active' | 'revoked' | 'dissolved';
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    pact_id: string;
                    pact_contract_address: string;
                    chain_id?: number;
                    user1_id: string;
                    user2_id: string;
                    shared_secret_hash?: string | null;
                    status?: 'active' | 'revoked' | 'dissolved';
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    pact_id?: string;
                    pact_contract_address?: string;
                    chain_id?: number;
                    user1_id?: string;
                    user2_id?: string;
                    shared_secret_hash?: string | null;
                    status?: 'active' | 'revoked' | 'dissolved';
                    created_at?: string;
                    updated_at?: string;
                };
            };
            ephemeral_signals: {
                Row: {
                    id: string;
                    pact_id: string;
                    ghost_id: string;
                    sender_id: string;
                    signal_type: 'offer' | 'answer' | 'ice' | 'ping' | 'pong';
                    encrypted_payload: string;
                    expires_at: string;
                    created_at: string;
                    is_consumed: boolean;
                };
                Insert: {
                    id?: string;
                    pact_id: string;
                    ghost_id: string;
                    sender_id: string;
                    signal_type: 'offer' | 'answer' | 'ice' | 'ping' | 'pong';
                    encrypted_payload: string;
                    expires_at?: string;
                    created_at?: string;
                    is_consumed?: boolean;
                };
                Update: {
                    id?: string;
                    pact_id?: string;
                    ghost_id?: string;
                    sender_id?: string;
                    signal_type?: 'offer' | 'answer' | 'ice' | 'ping' | 'pong';
                    encrypted_payload?: string;
                    expires_at?: string;
                    created_at?: string;
                    is_consumed?: boolean;
                };
            };
            session_keys: {
                Row: {
                    id: string;
                    pact_id: string;
                    key_version: number;
                    key_hash: string;
                    encrypted_key: string;
                    user_id: string;
                    expires_at: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    pact_id: string;
                    key_version?: number;
                    key_hash: string;
                    encrypted_key: string;
                    user_id: string;
                    expires_at?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    pact_id?: string;
                    key_version?: number;
                    key_hash?: string;
                    encrypted_key?: string;
                    user_id?: string;
                    expires_at?: string | null;
                    created_at?: string;
                };
            };
        };
        Views: {
            user_pacts_view: {
                Row: {
                    id: string;
                    pact_id: string;
                    pact_contract_address: string;
                    status: string;
                    created_at: string;
                    partner_id: string;
                };
            };
        };
        Functions: {
            cleanup_expired_signals: {
                Args: Record<string, never>;
                Returns: number;
            };
        };
    };
}

// ============================================================================
// Convenience Type Aliases
// ============================================================================

export type User = Database['public']['Tables']['users']['Row'];
export type UserInsert = Database['public']['Tables']['users']['Insert'];
export type UserUpdate = Database['public']['Tables']['users']['Update'];

export type Pact = Database['public']['Tables']['pacts']['Row'];
export type PactInsert = Database['public']['Tables']['pacts']['Insert'];
export type PactUpdate = Database['public']['Tables']['pacts']['Update'];

export type Signal = Database['public']['Tables']['ephemeral_signals']['Row'];
export type SignalInsert = Database['public']['Tables']['ephemeral_signals']['Insert'];
export type SignalUpdate = Database['public']['Tables']['ephemeral_signals']['Update'];

export type SessionKeyRow = Database['public']['Tables']['session_keys']['Row'];
export type SessionKeyInsert = Database['public']['Tables']['session_keys']['Insert'];
export type SessionKeyUpdate = Database['public']['Tables']['session_keys']['Update'];

export type PactStatus = 'active' | 'revoked' | 'dissolved';
export type SignalType = 'offer' | 'answer' | 'ice' | 'ping' | 'pong';
