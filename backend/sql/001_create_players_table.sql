-- Create players table for Tic Tac Toe MOAP stats
-- Primary key: id (serial)
-- Unique: avatar_uuid (so each SL avatar has one stats row)

CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  avatar_uuid TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  games_played INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helpful index for lookups by avatar_uuid (already unique, but explicit index is fine)
CREATE INDEX IF NOT EXISTS idx_players_avatar_uuid ON players (avatar_uuid);
