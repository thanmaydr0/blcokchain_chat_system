-- ============================================================
-- DuoGraph Supabase Schema
-- Migration: 001_initial_schema
-- 
-- IMPORTANT: This database stores ONLY encrypted metadata.
-- Actual message content is NEVER stored here.
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. USERS TABLE
-- Stores user profiles linked to wallet addresses
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address TEXT UNIQUE NOT NULL,
    public_key TEXT,
    display_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT wallet_address_lowercase CHECK (wallet_address = LOWER(wallet_address))
);

-- Index for quick wallet lookups
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);

-- ============================================================
-- 2. PACTS TABLE
-- Stores pact metadata (NOT message content)
-- ============================================================

CREATE TABLE IF NOT EXISTS pacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pact_id TEXT NOT NULL, -- On-chain pact ID
    pact_contract_address TEXT UNIQUE NOT NULL,
    chain_id INTEGER NOT NULL DEFAULT 11155111, -- Sepolia
    user1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shared_secret_hash TEXT, -- Hashed, NEVER plaintext
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'dissolved')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT different_users CHECK (user1_id != user2_id),
    CONSTRAINT pact_address_lowercase CHECK (pact_contract_address = LOWER(pact_contract_address))
);

-- Indexes for pact queries
CREATE INDEX IF NOT EXISTS idx_pacts_user1 ON pacts(user1_id);
CREATE INDEX IF NOT EXISTS idx_pacts_user2 ON pacts(user2_id);
CREATE INDEX IF NOT EXISTS idx_pacts_status ON pacts(status);
CREATE INDEX IF NOT EXISTS idx_pacts_contract ON pacts(pact_contract_address);

-- ============================================================
-- 3. EPHEMERAL SIGNALS TABLE
-- Temporary WebRTC signaling data (auto-expires)
-- ============================================================

CREATE TABLE IF NOT EXISTS ephemeral_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pact_id UUID NOT NULL REFERENCES pacts(id) ON DELETE CASCADE,
    ghost_id TEXT NOT NULL, -- Temporary anonymous identity
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    signal_type TEXT NOT NULL CHECK (signal_type IN ('offer', 'answer', 'ice', 'ping', 'pong')),
    encrypted_payload TEXT NOT NULL, -- Encrypted signaling data
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_consumed BOOLEAN DEFAULT FALSE
);

-- Indexes for signal queries
CREATE INDEX IF NOT EXISTS idx_signals_pact ON ephemeral_signals(pact_id);
CREATE INDEX IF NOT EXISTS idx_signals_ghost ON ephemeral_signals(ghost_id);
CREATE INDEX IF NOT EXISTS idx_signals_expires ON ephemeral_signals(expires_at);
CREATE INDEX IF NOT EXISTS idx_signals_unconsumed ON ephemeral_signals(pact_id, is_consumed) WHERE NOT is_consumed;

-- ============================================================
-- 4. SESSION KEYS TABLE
-- Encrypted session key versions
-- ============================================================

CREATE TABLE IF NOT EXISTS session_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pact_id UUID NOT NULL REFERENCES pacts(id) ON DELETE CASCADE,
    key_version INTEGER NOT NULL DEFAULT 1,
    key_hash TEXT NOT NULL, -- Hash of the key (for verification)
    encrypted_key TEXT NOT NULL, -- Encrypted with user's public key
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint per pact, user, version
    CONSTRAINT unique_session_key_version UNIQUE (pact_id, user_id, key_version)
);

-- Index for session key lookups
CREATE INDEX IF NOT EXISTS idx_session_keys_pact ON session_keys(pact_id);
CREATE INDEX IF NOT EXISTS idx_session_keys_user ON session_keys(user_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ephemeral_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_keys ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- USERS POLICIES
-- ============================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    USING (auth.uid()::text = id::text);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (auth.uid()::text = id::text);

-- Anyone can insert (signup flow)
CREATE POLICY "Enable insert for signup"
    ON users FOR INSERT
    WITH CHECK (true);

-- ============================================================
-- PACTS POLICIES
-- ============================================================

-- Users can view pacts they are part of
CREATE POLICY "Users can view own pacts"
    ON pacts FOR SELECT
    USING (
        user1_id::text = auth.uid()::text 
        OR user2_id::text = auth.uid()::text
    );

-- Users can insert pacts where they are one of the participants
CREATE POLICY "Users can create pacts they are in"
    ON pacts FOR INSERT
    WITH CHECK (
        user1_id::text = auth.uid()::text 
        OR user2_id::text = auth.uid()::text
    );

-- Users can update pacts they are part of
CREATE POLICY "Users can update own pacts"
    ON pacts FOR UPDATE
    USING (
        user1_id::text = auth.uid()::text 
        OR user2_id::text = auth.uid()::text
    );

-- ============================================================
-- EPHEMERAL SIGNALS POLICIES
-- ============================================================

-- Users can view signals for their pacts
CREATE POLICY "Users can view signals for own pacts"
    ON ephemeral_signals FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM pacts 
            WHERE pacts.id = ephemeral_signals.pact_id
            AND (pacts.user1_id::text = auth.uid()::text 
                 OR pacts.user2_id::text = auth.uid()::text)
        )
    );

-- Users can insert signals for their pacts
CREATE POLICY "Users can insert signals for own pacts"
    ON ephemeral_signals FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM pacts 
            WHERE pacts.id = ephemeral_signals.pact_id
            AND (pacts.user1_id::text = auth.uid()::text 
                 OR pacts.user2_id::text = auth.uid()::text)
        )
        AND sender_id::text = auth.uid()::text
    );

-- Users can update (consume) signals for their pacts
CREATE POLICY "Users can consume signals for own pacts"
    ON ephemeral_signals FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM pacts 
            WHERE pacts.id = ephemeral_signals.pact_id
            AND (pacts.user1_id::text = auth.uid()::text 
                 OR pacts.user2_id::text = auth.uid()::text)
        )
    );

-- ============================================================
-- SESSION KEYS POLICIES
-- ============================================================

-- Users can view session keys for their pacts
CREATE POLICY "Users can view session keys for own pacts"
    ON session_keys FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM pacts 
            WHERE pacts.id = session_keys.pact_id
            AND (pacts.user1_id::text = auth.uid()::text 
                 OR pacts.user2_id::text = auth.uid()::text)
        )
    );

-- Users can insert session keys for their pacts
CREATE POLICY "Users can insert session keys for own pacts"
    ON session_keys FOR INSERT
    WITH CHECK (
        user_id::text = auth.uid()::text
        AND EXISTS (
            SELECT 1 FROM pacts 
            WHERE pacts.id = session_keys.pact_id
            AND (pacts.user1_id::text = auth.uid()::text 
                 OR pacts.user2_id::text = auth.uid()::text)
        )
    );

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function to update last_seen on users
CREATE OR REPLACE FUNCTION update_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_seen = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at on pacts
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for pacts updated_at
CREATE TRIGGER pacts_updated_at
    BEFORE UPDATE ON pacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SCHEDULED CLEANUP (requires pg_cron extension)
-- ============================================================

-- Note: Run this manually or via Supabase Edge Function
-- DELETE FROM ephemeral_signals WHERE expires_at < NOW();

-- Create a function for cleanup (can be called by cron or edge function)
CREATE OR REPLACE FUNCTION cleanup_expired_signals()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM ephemeral_signals WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- HELPER VIEWS
-- ============================================================

-- View for user's active pacts with partner info
CREATE OR REPLACE VIEW user_pacts_view AS
SELECT 
    p.id,
    p.pact_id,
    p.pact_contract_address,
    p.status,
    p.created_at,
    CASE 
        WHEN p.user1_id::text = auth.uid()::text THEN p.user2_id
        ELSE p.user1_id
    END as partner_id
FROM pacts p
WHERE p.status = 'active'
AND (p.user1_id::text = auth.uid()::text OR p.user2_id::text = auth.uid()::text);
