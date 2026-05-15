require("dotenv").config();

const { createApp } = require("./src/app");
const { query } = require("./src/db/pool");

const port = Number(process.env.PORT ?? 3000);

async function start() {
  // Fail fast if DB is misconfigured (Render will show logs clearly)
  try {
    await query("SELECT 1");
    console.info("DB connection: OK");
  } catch (err) {
    console.error("DB connection: FAILED", err);
    process.exit(1);
  }

  const app = createApp();

  app.listen(port, () => {
    console.info(`Server listening on port ${port}`);
  });
}

start();
