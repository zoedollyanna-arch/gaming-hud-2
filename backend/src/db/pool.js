const { Pool } = require("pg");

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value.trim();
}

function summarizeSecret(value) {
  if (!value) return "missing";
  if (typeof value !== "string") return "not-a-string";
  const trimmed = value.trim();
  // Don’t print secrets; just include length + a tiny prefix/suffix
  const prefix = trimmed.slice(0, 6);
  const suffix = trimmed.slice(-4);
  return `present(len=${trimmed.length}, prefix=${prefix}..., suffix=...${suffix})`;
}

function logDbEnvForDebug() {
  // Keep this safe: never log full DATABASE_URL.
  // This runs only when env is missing/misconfigured.
  // eslint-disable-next-line no-console
  console.error("DB ENV DEBUG:", {
    DATABASE_URL: summarizeSecret(process.env.DATABASE_URL),
    PGSSLMODE: process.env.PGSSLMODE ? `present(${process.env.PGSSLMODE})` : "missing",
    PG_POOL_MAX: process.env.PG_POOL_MAX ? `present(${process.env.PG_POOL_MAX})` : "missing",
    PG_IDLE_TIMEOUT_MS: process.env.PG_IDLE_TIMEOUT_MS ? `present(${process.env.PG_IDLE_TIMEOUT_MS})` : "missing",
  });
}

let pool = null;

function createPool() {
  const databaseUrl = getRequiredEnv("DATABASE_URL");

  return new Pool({
    connectionString: databaseUrl,
    // Helps in Render/container environments
    ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.PG_POOL_MAX ?? 10),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30000),
  });
}

function ensurePool() {
  if (pool) return pool;

  try {
    pool = createPool();
    return pool;
  } catch (err) {
    logDbEnvForDebug();
    throw err;
  }
}

async function query(text, params) {
  const currentPool = ensurePool();
  return currentPool.query(text, params);
}

module.exports = {
  ensurePool,
  query,
};
