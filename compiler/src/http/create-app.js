import express from "express";

import { requireServiceAuth } from "./auth.js";
import { logCompilerEvent } from "../services/observability.js";
import { compilerRouter } from "../routes/compiler-routes.js";

export const createApp = () => {
  const app = express();

  app.use(express.json({ limit: "2mb" }));
  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on("finish", () => {
      logCompilerEvent("http.request", {
        method: req.method,
        path: req.path,
        status_code: res.statusCode,
        duration_ms: Date.now() - startedAt,
      });
    });
    next();
  });
  app.use((req, res, next) => {
    if (req.path === "/health" || req.path === "/ready" || req.path === "/metrics") {
      next();
      return;
    }
    requireServiceAuth(req, res, next);
  });
  app.use(compilerRouter);

  app.use((error, req, res, next) => {
    logCompilerEvent("http.error", {
      method: req.method,
      path: req.path,
      message: error?.message || "Unexpected compiler service error",
    });
    res.status(500).json({
      error: {
        code: "internal_error",
        message: error?.message || "Unexpected compiler service error",
        stage: "http",
        retryable: false,
      },
    });
  });

  return app;
};
