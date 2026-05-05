-- Migration 003: Add risk_scores, bonus_wagering, and casino_events tables
-- Required by risk.ts, bonus.ts, and events.ts services

CREATE TABLE IF NOT EXISTS risk_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    overall_score INTEGER NOT NULL DEFAULT 0,
    blocked BOOLEAN NOT NULL DEFAULT false,
    reasons JSONB NOT NULL DEFAULT '[]',
    signals JSONB NOT NULL DEFAULT '[]',
    scored_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_risk_scores_player_id ON risk_scores(player_id);
CREATE INDEX idx_risk_scores_scored_at ON risk_scores(scored_at);

CREATE TABLE IF NOT EXISTS bonus_wagering (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bonus_id VARCHAR(100) NOT NULL,
    player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    required_wager BIGINT NOT NULL,
    total_wagered BIGINT NOT NULL DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bonus_wagering_player_id ON bonus_wagering(player_id);
CREATE INDEX idx_bonus_wagering_bonus_id ON bonus_wagering(bonus_id);

CREATE TABLE IF NOT EXISTS casino_events (
    event_id UUID PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_casino_events_player_id ON casino_events(player_id);
CREATE INDEX idx_casino_events_event_type ON casino_events(event_type);
CREATE INDEX idx_casino_events_created_at ON casino_events(created_at);
