const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const { playerRouter } = require("./routes/playerRoutes");

function createApp() {
  const app = express();

  // Security headers (safe defaults for an API)
  app.use(helmet());

  // MOAP HUD -> HTML frontend -> this API
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN ?? "*",
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type"],
    })
  );

  // Logging (Render logs)
  app.use(morgan(process.env.MORGAN_STYLE ?? "dev"));

  // Body parsing
  app.use(express.json({ limit: "100kb" }));

  // Serve the MOAP HTML frontend + assets (backend/public)
  app.use(express.static(path.join(__dirname, "..", "public")));

  // Routes
  app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));
  app.use("/api", playerRouter);

  // 404 JSON fallback (API-style)
  app.use((req, res) => {
    res.status(404).json({ error: "Not Found", path: req.path });
  });

  // Error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error("API_ERROR:", err);
    const status = Number(err.statusCode ?? 500);
    res.status(status).json({
      error: err.message ?? "Internal Server Error",
    });
  });

  return app;
}

module.exports = { createApp };
