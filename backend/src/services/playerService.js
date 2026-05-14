const { query } = require("../db/pool");

function requireNonEmptyString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
}

async function getOrCreatePlayer({ avatarUuid, username }) {
  requireNonEmptyString(avatarUuid, "avatarUuid");
  requireNonEmptyString(username, "username");

  // Upsert by avatar_uuid
  const sql = `
    INSERT INTO players (avatar_uuid, username, wins, losses, games_played)
    VALUES ($1, $2, 0, 0, 0)
    ON CONFLICT (avatar_uuid)
    DO UPDATE SET username = EXCLUDED.username
    RETURNING id, avatar_uuid, username, wins, losses, games_played, created_at
  `;

  const result = await query(sql, [avatarUuid.trim(), username.trim()]);
  return result.rows[0];
}

async function getPlayerStats({ avatarUuid }) {
  requireNonEmptyString(avatarUuid, "avatarUuid");

  const sql = `
    SELECT avatar_uuid, username, wins, losses, games_played, created_at
    FROM players
    WHERE avatar_uuid = $1
  `;

  const result = await query(sql, [avatarUuid.trim()]);
  return result.rows[0] ?? null;
}

async function recordGameResult({ avatarUuid, username, outcome }) {
  requireNonEmptyString(avatarUuid, "avatarUuid");
  requireNonEmptyString(username, "username");

  // outcome: "win" | "loss" | "tie"
  const normalized = outcome === "win" || outcome === "loss" || outcome === "tie" ? outcome : null;
  if (!normalized) throw new Error(`Invalid outcome: ${outcome}`);

  await getOrCreatePlayer({ avatarUuid, username });

  // Increment counters atomically
  const sql = `
    UPDATE players
    SET
      wins = wins + CASE WHEN $3 = 'win' THEN 1 ELSE 0 END,
      losses = losses + CASE WHEN $3 = 'loss' THEN 1 ELSE 0 END,
      games_played = games_played + 1,
      username = $2
    WHERE avatar_uuid = $1
    RETURNING avatar_uuid, username, wins, losses, games_played, created_at
  `;

  const result = await query(sql, [avatarUuid.trim(), username.trim(), normalized]);
  return result.rows[0];
}

module.exports = {
  getOrCreatePlayer,
  getPlayerStats,
  recordGameResult,
};
