CREATE TABLE IF NOT EXISTS players (
    id BIGINT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    photo TEXT,
    balance_w BIGINT NOT NULL DEFAULT 10000,
    balance_b BIGINT NOT NULL DEFAULT 0,
    game_level INTEGER NOT NULL DEFAULT 0,
    claimed_level INTEGER NOT NULL DEFAULT 0,
    onboarding_done BOOLEAN NOT NULL DEFAULT FALSE,
    level_stats JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referrals (
    id SERIAL PRIMARY KEY,
    inviter_id BIGINT NOT NULL,
    friend_id BIGINT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    photo TEXT,
    reward_w BIGINT NOT NULL DEFAULT 5000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (inviter_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_inviter ON referrals (inviter_id);
CREATE INDEX IF NOT EXISTS idx_players_total ON players ((balance_w + balance_b * 10000) DESC);
