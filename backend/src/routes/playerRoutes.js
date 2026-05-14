const express = require("express");
const { getOrCreatePlayer, getPlayerStats, recordGameResult } = require("../services/playerService");

const playerRouter = express.Router();

function requireNonEmptyString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
}

function getAvatarUuidFromQuery(req) {
  const avatarUuid = req.query.avatarUuid;
  if (typeof avatarUuid !== "string") throw new Error("avatarUuid query param is required");
  return avatarUuid.trim();
}

function getUsernameFromQuery(req) {
  // username is used so the HUD keeps a readable handle
  const username = req.query.username;
  if (typeof username !== "string") throw new Error("username query param is required");
  return username.trim();
}

/**
 * GET /api/player/stats?avatarUuid=...&username=...
 * - Returns existing stats OR creates a profile if missing.
 */
playerRouter.get("/player/stats", async (req, res, next) => {
  try {
    const avatarUuid = getAvatarUuidFromQuery(req);
    const username = getUsernameFromQuery(req);

    console.info("GET player stats:", { avatarUuid });

    // Ensure the profile exists even if this is the first interaction
    const existing = await getPlayerStats({ avatarUuid });
    if (existing) {
      return res.json({ player: existing });
    }

    const created = await getOrCreatePlayer({ avatarUuid, username });
    return res.json({ player: created });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/player/profile
 * Body: { avatarUuid, username }
 * - Creates the profile if missing.
 */
playerRouter.post("/player/profile", async (req, res, next) => {
  try {
    const avatarUuid = req.body?.avatarUuid;
    const username = req.body?.username;

    requireNonEmptyString(avatarUuid, "avatarUuid");
    requireNonEmptyString(username, "username");

    console.info("POST create/update player profile:", { avatarUuid });

    const player = await getOrCreatePlayer({ avatarUuid, username });
    return res.status(201).json({ player });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/game/results
 * Body: { avatarUuid, username, outcome } where outcome is "win" | "loss" | "tie"
 * - Updates player totals and returns updated stats.
 */
playerRouter.post("/game/results", async (req, res, next) => {
  try {
    const avatarUuid = req.body?.avatarUuid;
    const username = req.body?.username;
    const outcome = req.body?.outcome;

    requireNonEmptyString(avatarUuid, "avatarUuid");
    requireNonEmptyString(username, "username");
    if (typeof outcome !== "string") throw new Error("outcome must be 'win' | 'loss' | 'tie'");

    const normalized = outcome.trim().toLowerCase();

    console.info("POST game result:", { avatarUuid, outcome: normalized });

    const player = await recordGameResult({ avatarUuid, username, outcome: normalized });
    return res.status(200).json({ player });
  } catch (err) {
    next(err);
  }
});

module.exports = { playerRouter };
