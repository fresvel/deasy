import "dotenv/config"
import http from "node:http";
import express from "express";
import realtimeGateway from "./services/realtime/RealtimeGateway.js";
import user_router from "./routes/user_router.js";
import admin_router from "./routes/admin_router.js"; // Eliminar al pasar todas las funciones a empresa
import cors from "cors"
import { assertPostgresConnection } from "./config/postgres.js";
import { ensurePostgresSchema } from "./database/postgres_initializer.js";
import cookieParser from "cookie-parser"
import swaggerJsdoc from "swagger-jsdoc";
import { swaggerDefinition } from "./config/swagger/definition.js";
import swaggerUi from "swagger-ui-express";
import { ROUTES, DOCS_PATH, DOCS_JSON_PATH } from "./config/apiPaths.js";
import sign_router from "./routes/sign_router.js";

import program_router from "./routes/program_router.js";
import unit_router from "./routes/unit_router.js";
import tarea_router from "./routes/tarea_router.js"
import whatsapp_router from "./routes/whatsapp_router.js"
import dossier_router from "./routes/dossier_router.js"
import chat_router from "./routes/chat_router.js";
import notification_router from "./routes/notification_router.js";
import system_router from "./routes/system_router.js";
import reset_password_router from "./routes/reset_password_router.js";
import email_router from "./routes/email_router.js";

const app = express();
app.set("trust proxy", 1);


const PORT = process.env.PORT || 3030


const swaggerOptions = {
  definition: swaggerDefinition,
  apis: []
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

const whitelist = new Set([
  process.env.ORIGIN1,
  process.env.ORIGIN2,
  process.env.ORIGIN3,
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "https://localhost:8443",
  "https://127.0.0.1:8443",
  "https://localhost:9443",
  "https://127.0.0.1:9443",
  "https://localhost",
  "https://127.0.0.1"
].filter(Boolean))

const isPrivateOrLoopbackHost = (hostname = "") => {
  const value = String(hostname || "").trim().toLowerCase();

  if (!value) {
    return false;
  }

  if (value === "localhost" || value === "127.0.0.1" || value === "::1") {
    return true;
  }

  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value)) {
    return true;
  }

  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(value)) {
    return true;
  }

  const match172 = value.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (match172) {
    const secondOctet = Number(match172[1]);
    return secondOctet >= 16 && secondOctet <= 31;
  }

  return false;
};

const parseUrl = (value) => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const privateProxyPorts = new Set([
  String(process.env.PROXY_HTTPS_PORT || "").trim(),
  "8443",
  "9443"
].filter(Boolean));

const resolveCorsOrigin = (origin, callback) => {
  const originUrl = parseUrl(origin);
  const isPrivateProxyOrigin = Boolean(
    process.env.DEASY_ENV !== "prod" &&
    originUrl &&
    originUrl.protocol === "https:" &&
    privateProxyPorts.has(originUrl.port) &&
    isPrivateOrLoopbackHost(originUrl.hostname)
  );

  if (!origin || whitelist.has(origin) || isPrivateProxyOrigin) {
    return callback(null, true);
  }

  return callback("Error de cors: " + origin + " not authorized");
};

app.use((req, res, next) => cors({
  origin: (origin, callback) => {
    console.log(`Iniciando CORS`)
    console.log("Origin: " + origin);
    return resolveCorsOrigin(origin, callback);
  },
  credentials: true // Permite el envío de cookies y credenciales
})(req, res, next))


app.use(express.json());
app.use(cookieParser())

app.get("/health", async (req, res) => {
  try {
    await assertPostgresConnection();
    res.status(200).json({
      status: "ok",
      service: "backend",
      database: "ok",
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      service: "backend",
      database: "error",
      message: error.message,
    });
  }
});

app.use(DOCS_PATH, swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
app.get(DOCS_JSON_PATH, (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

app.use(ROUTES.users, user_router)
app.use(ROUTES.resetPassword, reset_password_router)
app.use(ROUTES.email, email_router)

app.use(ROUTES.admin, admin_router)

app.use(ROUTES.program, program_router)
app.use(ROUTES.units, unit_router)


app.use(ROUTES.tarea, tarea_router)

app.use(ROUTES.whatsapp, whatsapp_router)
app.use(ROUTES.chat, chat_router)
app.use(ROUTES.notifications, notification_router)

app.use(ROUTES.dossier, dossier_router)

app.use(ROUTES.sign, sign_router)
app.use(ROUTES.system, system_router)

app.use(express.static("public"));




const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const initializeDatabaseWithRetry = async () => {
  const shouldResetSchema = String(process.env.DB_RESET_SCHEMA_ON_START || "0") === "1";
  const maxAttempts = Number(process.env.DB_INIT_MAX_ATTEMPTS || 20);
  const retryDelayMs = Number(process.env.DB_INIT_RETRY_DELAY_MS || 3000);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await assertPostgresConnection(); // PostgreSQL vía el adaptador
      await ensurePostgresSchema({ reset: shouldResetSchema });
      console.log("✅ PostgreSQL inicializada correctamente");
      return;
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts;
      console.error(
        `⚠️  Falló la inicialización de PostgreSQL (intento ${attempt}/${maxAttempts}): ${error.message}`
      );
      if (isLastAttempt) {
        console.error("⚠️  Se agotaron los reintentos de PostgreSQL. El backend seguirá en ejecución.");
        return;
      }
      await sleep(retryDelayMs);
    }
  }
};

const startServer = async () => {
  await initializeDatabaseWithRetry();

  const httpServer = http.createServer(app);
  realtimeGateway.init(httpServer, { corsOrigin: resolveCorsOrigin, credentials: true });

  httpServer.listen(PORT, () => {
    console.log(`Servidor iniciado en: http://localhost:${PORT}/deasy/v1/`)
    console.log(`WebSocket (Socket.IO) escuchando en: ws://localhost:${PORT}/socket.io`)
  });

  // Auto-reparación: reconcilia flujos de plantillas cuya proyección en BD quedó desfasada
  // (cierra la ventana de la escritura dual meta.yaml->BD). Best-effort: no bloquea el arranque.
  (async () => {
    try {
      const { default: SqlAdminService } = await import("./services/admin/SqlAdminService.js");
      const summary = await new SqlAdminService().reconcileArtifactWorkflows({ onlyStale: true });
      if (summary.resynced || summary.failed) {
        console.log(
          `🔄 Reconciliación de flujos de plantillas: ${summary.resynced} re-sincronizada(s), ${summary.failed} con error (de ${summary.scanned} con vínculo).`
        );
      }
    } catch (error) {
      console.warn("Reconciliación de flujos de plantillas omitida:", error?.message);
    }
  })();
};

startServer();
