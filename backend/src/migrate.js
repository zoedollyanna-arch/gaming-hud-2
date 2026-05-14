const fs = require("fs");
const path = require("path");
const { query } = require("./db/pool");

async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS __migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

function getSqlFiles() {
  const sqlDir = path.join(__dirname, "..", "sql");
  const files = fs.readdirSync(sqlDir).filter((f) => f.endsWith(".sql"));
  files.sort();
  return files;
}

async function hasApplied(filename) {
  const result = await query(
    `SELECT 1 FROM __migrations WHERE filename = $1 LIMIT 1`,
    [filename]
  );
  return result.rows.length > 0;
}

async function markApplied(filename) {
  await query(`INSERT INTO __migrations (filename) VALUES ($1)`, [filename]);
}

async function runMigration(sqlFile) {
  const sqlDir = path.join(__dirname, "..", "sql");
  const fullPath = path.join(sqlDir, sqlFile);
  const sql = fs.readFileSync(fullPath, "utf8");

  // split on statements is non-trivial; simplest is to run as a single script.
  // pg can execute multiple statements if semicolons are used.
  await query(sql);
}

async function main() {
  const files = getSqlFiles();
  if (files.length === 0) {
    console.log("No SQL migrations found.");
    return;
  }

  await ensureMigrationsTable();

  for (const file of files) {
    const applied = await hasApplied(file);
    if (applied) {
      console.log(`Skipping already-applied migration: ${file}`);
      continue;
    }

    console.log(`Applying migration: ${file}`);
    await runMigration(file);
    await markApplied(file);
    console.log(`Applied: ${file}`);
  }

  console.log("Migrations complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration error:", err);
    process.exit(1);
  });
