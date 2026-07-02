// Configuración del harness de characterization tests.
//
// Todo se parametriza por entorno para poder apuntar el harness al stack
// dockerizado (dev / qa-local / worktree) sin tocar código.
//
//   BASE_URL   URL completa hasta el prefijo de la API, sin barra final.
//              Por defecto asume el backend directo en dev (puerto 3030).
//              Detrás del proxy Nginx sería, p.ej. http://localhost:8088/api
//   API_PREFIX Prefijo montado por el backend. Confirmado en config/apiPaths.js.
//
// Credenciales de los usuarios sembrados en dev (ver CLAUDE.md):
//   admin  -> cédula 1234567890
//   gestor -> cédula 0987654321
//   password para todos: Demo1234!

const stripTrailingSlash = (value) => value.replace(/\/+$/, "");

export const API_PREFIX = process.env.API_PREFIX ?? "/deasy/v1";

// BASE_URL debe incluir ya el prefijo si se apunta al proxy; si se apunta al
// backend directo dejamos que el harness lo componga con API_PREFIX.
const RAW_BASE = process.env.BASE_URL ?? "http://localhost:3030";
const BASE = stripTrailingSlash(RAW_BASE);

// Si BASE_URL ya termina en el prefijo, no lo dupliques.
export const API_BASE = BASE.endsWith(API_PREFIX) ? BASE : `${BASE}${API_PREFIX}`;

export const READINESS_TIMEOUT_MS = Number(process.env.READINESS_TIMEOUT_MS ?? 120_000);
export const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS ?? 20_000);

// Modo de snapshot: "compare" (falla si difiere) o "update" (reescribe golden).
// El golden-master se captura una vez contra el sistema ACTUAL (MariaDB/Mongo)
// y luego debe reproducirse idéntico tras migrar/refactorizar.
export const SNAPSHOT_MODE = process.env.SNAPSHOT_MODE === "update" ? "update" : "compare";

// Usuarios de prueba. La identificación es la CÉDULA (ver mapa de auth).
export const USERS = {
  admin: {
    label: "admin",
    identifier: process.env.TEST_ADMIN_ID ?? "1234567890",
    password: process.env.TEST_ADMIN_PASSWORD ?? "Demo1234!",
  },
  gestor: {
    label: "gestor",
    identifier: process.env.TEST_GESTOR_ID ?? "0987654321",
    password: process.env.TEST_GESTOR_PASSWORD ?? "Demo1234!",
  },
  // Usuario de baja privilegia (seed persons id:3) — objetivo del test de 403.
  usuario: {
    label: "usuario",
    identifier: process.env.TEST_USUARIO_ID ?? "1122334455",
    password: process.env.TEST_USUARIO_PASSWORD ?? "Demo1234!",
  },
};
