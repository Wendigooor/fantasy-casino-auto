CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(512) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'admin')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Wallets table
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    balance BIGINT NOT NULL DEFAULT 0,
    state VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'frozen', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Ledger entries (append-only)
CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'deposit', 'bet_reserve', 'bet_debit', 'win_credit',
        'bonus_credit', 'wager_contribution', 'reversal'
    )),
    amount BIGINT NOT NULL,
    currency VARCHAR(10) NOT NULL,
    balance_after BIGINT NOT NULL,
    reference_id VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Idempotency keys
CREATE TABLE idempotency_keys (
    key VARCHAR(255) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    result JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Game catalog
CREATE TABLE games (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    provider VARCHAR(100) NOT NULL DEFAULT 'internal',
    min_bet BIGINT NOT NULL DEFAULT 10,
    max_bet BIGINT NOT NULL DEFAULT 10000,
    config JSONB,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Game rounds
CREATE TABLE game_rounds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_id VARCHAR(100) NOT NULL REFERENCES games(id),
    bet_amount BIGINT NOT NULL,
    win_amount BIGINT NOT NULL DEFAULT 0,
    state VARCHAR(20) NOT NULL DEFAULT 'created' CHECK (state IN (
        'created', 'debit_reserved', 'settled', 'failed', 'voided'
    )),
    currency VARCHAR(10) NOT NULL,
    ledger_debit_id UUID REFERENCES ledger_entries(id),
    ledger_credit_id UUID REFERENCES ledger_entries(id),
    result JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    settled_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_ledger_entries_wallet_id ON ledger_entries(wallet_id);
CREATE INDEX idx_ledger_entries_user_id ON ledger_entries(user_id);
CREATE INDEX idx_ledger_entries_created_at ON ledger_entries(created_at);
CREATE INDEX idx_idempotency_keys_key ON idempotency_keys(key);
CREATE INDEX idx_game_rounds_user_id ON game_rounds(user_id);
CREATE INDEX idx_game_rounds_created_at ON game_rounds(created_at);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_wallets_currency ON wallets(currency);

-- Seed games
INSERT INTO games (id, name, type, provider, min_bet, max_bet) VALUES
    ('slot-basic', 'Basic Slots', 'slot', 'internal', 10, 10000);
