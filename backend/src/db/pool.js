const { Pool } = require("pg");

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value.trim();
}

const databaseUrl = getRequiredEnv("DATABASE_URL");

// Supabase/pg supports both DATABASE_URL and individual vars; we keep it simple & explicit.
const pool = new Pool({
  connectionString: databaseUrl,
  // Helps in Render/container environments
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.PG_POOL_MAX ?? 10),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30000),
});

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = {
  pool,
  query,
};
