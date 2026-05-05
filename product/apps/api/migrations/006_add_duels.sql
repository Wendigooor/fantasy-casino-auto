-- Migration 006: PvP Duels

CREATE TABLE IF NOT EXISTS duels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES users(id),
    acceptor_id UUID REFERENCES users(id),
    game_id VARCHAR(100) NOT NULL REFERENCES games(id),
    bet_amount BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','active','settled','cancelled','expired')),
    creator_spin JSONB,
    acceptor_spin JSONB,
    creator_multiplier DECIMAL,
    acceptor_multiplier DECIMAL,
    winner_id UUID REFERENCES users(id),
    house_fee BIGINT,
    pot BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '5 minutes'
);

CREATE INDEX idx_duels_status ON duels(status);
CREATE INDEX idx_duels_creator ON duels(creator_id);
CREATE INDEX idx_duels_acceptor ON duels(acceptor_id);

CREATE TABLE IF NOT EXISTS duel_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    duel_id UUID NOT NULL REFERENCES duels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    event_type VARCHAR(30) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_duel_events_duel ON duel_events(duel_id);
