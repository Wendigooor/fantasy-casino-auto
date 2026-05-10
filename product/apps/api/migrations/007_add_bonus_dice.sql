-- Migration 007: Daily Bonus Dice
-- Single table tracks each player's dice rolls and rewards

CREATE TABLE IF NOT EXISTS bonus_dice_rolls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dice1 SMALLINT NOT NULL CHECK (dice1 BETWEEN 1 AND 6),
    dice2 SMALLINT NOT NULL CHECK (dice2 BETWEEN 1 AND 6),
    dice_sum SMALLINT NOT NULL CHECK (dice_sum BETWEEN 2 AND 12),
    reward_type VARCHAR(30) NOT NULL,
    reward_value BIGINT NOT NULL DEFAULT 0,
    reward_label VARCHAR(100),
    claimed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bonus_dice_user ON bonus_dice_rolls(user_id);
CREATE INDEX idx_bonus_dice_created ON bonus_dice_rolls(created_at DESC);
