-- Migration 005: Performance indexes for high-load paths
-- Required for Phase 8: load testing

-- Wallet queries by state
CREATE INDEX IF NOT EXISTS idx_wallets_state ON wallets(state);

-- Ledger queries by type + created_at for analytics
CREATE INDEX IF NOT EXISTS idx_ledger_entries_type_created ON ledger_entries(type, created_at);

-- Game rounds by user + created for history pagination
CREATE INDEX IF NOT EXISTS idx_game_rounds_user_created ON game_rounds(user_id, created_at DESC);

-- Game rounds by game for stats
CREATE INDEX IF NOT EXISTS idx_game_rounds_game_id ON game_rounds(game_id);

-- Users by email for login lookup
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));

-- Idempotency keys cleanup by age
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created ON idempotency_keys(created_at);
