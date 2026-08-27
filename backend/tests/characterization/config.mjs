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
//   admin  -> cédula 1234567897
//   gestor -> cédula 0927654327
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
// Son los que crea el BOOTSTRAP con datos de ejemplo (ver setup/bootstrap_system.mjs),
// que es la fuente de verdad del sistema. Ojo: la contraseña del gestor NO es Demo1234!.
export const USERS = {
  admin: {
    label: "admin",
    identifier: process.env.TEST_ADMIN_ID ?? "1234567897",
    password: process.env.TEST_ADMIN_PASSWORD ?? "Demo1234!",
  },
  gestor: {
    label: "gestor",
    identifier: process.env.TEST_GESTOR_ID ?? "0927654327",
    password: process.env.TEST_GESTOR_PASSWORD ?? "Gestor1234!",
  },
  // Usuario de baja privilegia — objetivo del test de 403.
  usuario: {
    label: "usuario",
    identifier: process.env.TEST_USUARIO_ID ?? "1122334459",
    password: process.env.TEST_USUARIO_PASSWORD ?? "Demo1234!",
  },
};

// Identificadores de la fixture, en un único sitio. Antes estaban repartidos
// entre setup/seed_execution.mjs y literales dentro de los flows.
//
// Valores deterministas de un bootstrap con datos de ejemplo:
//   persons 1/2/3 = admin/gestor/usuario · process 1 = "Proceso por defecto"
//   unit_position 25 = Docente en la unidad 8 ("Tecnologías de la Información")
//
// El CARGO de la posición no es indiferente: `cargo_role_map` eleva DOCENTE a
// GestorEjecucionProcesos (que tiene documents.*), mientras que ASISTENTE no eleva
// nada. Con un cargo sin elevación, el test de ownership del document-center ajeno
// nunca llega a la comprobación de propiedad: lo corta antes la puerta genérica de
// RBAC, y el test pasaría (403) sin comprobar lo que dice comprobar.
export const FIXTURE = {
  adminPersonId: Number(process.env.FIXTURE_ADMIN_PERSON_ID ?? 1),
  gestorPersonId: Number(process.env.FIXTURE_GESTOR_PERSON_ID ?? 2),
  usuarioPersonId: Number(process.env.FIXTURE_USUARIO_PERSON_ID ?? 3),
  unitPositionId: Number(process.env.FIXTURE_UNIT_POSITION_ID ?? 25),
  // DEBE ser la unidad de `unitPositionId`. Que ambos se desincronizaran es lo que
  // rompía el setup; `setup/bootstrap_system.mjs` lo verifica y falla si divergen.
  unitId: Number(process.env.FIXTURE_UNIT_ID ?? 8),
  // El cargo esperado de `unitPositionId` (ver arriba). También se verifica.
  unitPositionCargoCode: process.env.FIXTURE_UNIT_POSITION_CARGO ?? "DOCENTE",
  processId: Number(process.env.FIXTURE_PROCESS_ID ?? 1),
  definitionId: Number(process.env.FIXTURE_DEFINITION_ID ?? 1),
};
