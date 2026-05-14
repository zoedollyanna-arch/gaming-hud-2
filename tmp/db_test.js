const { Pool } = require("pg");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const pgSslMode = process.env.PGSSLMODE;

  if (!databaseUrl) {
    console.error("Missing env: DATABASE_URL");
    process.exit(2);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: pgSslMode === "require" ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const r = await pool.query("select 1 as ok");
    console.log("DB_OK", r.rows[0]);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("DB_FAIL", e);
  process.exit(1);
});
