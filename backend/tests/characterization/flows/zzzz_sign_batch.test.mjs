// Characterization: DOMINIO DE FIRMA — `sign_controller.js` (853 L, cogn. 144).
//
// Por qué existe: la Fase D del plan de calidad (§5-D) tiene que sacar de este controller el motor
// de batch (`BatchSigningService`) y el plan de almacenamiento + firma (`PdfSigningService`). Antes
// de este fichero, la única red sobre `/sign` eran TRES casos en `signature.test.mjs`, y ninguno
// tocaba el controller: dos GET de `user_controler` y un 401. Es decir, `requestSign`,
// `requestSignBatch`, `requestSignBatchStart`, `getSignBatchStatus`, `downloadSignBatch`,
// `downloadSigned`, `validateSignedDocument` y `getSignatureFlow` se iban a partir A CIEGAS.
//
// Lo que se fija aquí son sobre todo CAMINOS DE ERROR, porque es lo que un refactor rompe sin que
// nadie se entere: el ORDEN de los guards y el CÓDIGO concreto de cada rechazo (regla 5 de §6).
// Un `if` reordenado que convierte un 404 en un 403 pasa desapercibido en revisión y aquí no.
//
// ⚠️ PREFIJO "zzzz_" DELIBERADO. Los flows corren en orden alfabético con --test-concurrency=1.
// Este ordena DESPUÉS de `zzz_artifact_draft` (que ya se puso el último por el mismo motivo) y
// ANTES de `zzzz_sign_workflow` ('b' < 'w'). Este fichero es autolimpiante — la única fila que
// escribe la borra en el `after` — pero su hermano NO lo es, así que no los intercales.
//
// LO QUE NO SE CUBRE, y por qué (para que el siguiente sepa dónde va a ciegas):
//   · La firma REAL (camino feliz de `requestSign` / `batch/start`) exige un PKCS#12 en MinIO y el
//     microservicio Python por RabbitMQ. El bootstrap NO siembra certificados (`person_certificates`
//     está vacía), así que `buildSignContext` siempre corta en "Certificado no encontrado".
//     Consecuencia: los guards POSTERIORES a la búsqueda del certificado —`statMinioObject` sobre el
//     certificado y "Modo de firma inválido"— NO tienen golden.
//   · `validateSignedDocument` más allá del 400: subiría al spool de MinIO y llamaría al firmante.
//   · El ZIP de `downloadSignBatch` con documentos reales.
//
// ✅ DEFECTOS 1 y 2, ARREGLADOS EL 2026-08-09 junto con el corte de la fase D. Se deja escrito
// porque el método vale para los que queden:
//   1. TODA la validación de entrada de `requestSign` salía como **500**: faltar el certificado, la
//      contraseña o el sello es culpa del cliente y se respondía como error de servidor. Ahora los
//      errores de negocio llevan `statusCode` (`errors/HttpError.js`) y el controller los honra:
//      400 para lo que falta, 404 para un certificado que no es tuyo (no se distingue de uno
//      inexistente, a propósito). El diff de `sign_sin_*` y `sign_certificado_inexistente`
//      (500 -> 400/404) ES la prueba del arreglo. Lo que NO lleva `statusCode` —MinIO o PostgreSQL
//      caídos— sigue saliendo 500, que es lo que es.
//   2. El `fileFilter` de multer rechazaba con un `Error` pelado que nadie capturaba: Express
//      contestaba con su página HTML por defecto **y el stack trace completo**, revelando rutas del
//      contenedor. Hoy el router monta `handleUploadError` y responde JSON `{ message, code }`.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { get, post } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";
import { normalize, snapshotShape } from "../lib/normalize.mjs";
import { matchSnapshot } from "../lib/snapshot.mjs";
import { waitForReady } from "../lib/readiness.mjs";
import {
  upsertSignatureBatchJob,
  deleteSignatureBatchJob,
  countSignatureBatchJobs,
  closeDb,
} from "../lib/db.mjs";
import { FIXTURE, USERS } from "../config.mjs";

const SUITE = "sign_batch";

// Los ids del lote son claves primarias que elegimos nosotros: literales fijos, no autoincrementos.
// `job_id` es CHAR(36) — deben medir exactamente 36 para no acabar con relleno de espacios.
const JOB_PROPIO = "c4a12000-0000-4000-8000-000000000001";
const JOB_AJENO = "c4a12000-0000-4000-8000-000000000002";

// Mismo criterio que el resto de flows: rutas/URLs de almacenamiento son infra, no comportamiento.
const OBJ_OPTS = { extraMask: ["url", "signedUrl", "downloadUrl", "path"], maskIdKeys: true };

// PDF mínimo con estructura válida. Ninguna prueba llega a firmarlo: solo sirve para pasar el
// `fileFilter` de multer y llegar a la validación del controller.
const MINI_PDF = {
  filename: "documento.pdf",
  contentType: "application/pdf",
  content:
    "%PDF-1.4\n" +
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n" +
    "trailer<</Root 1 0 R>>\n" +
    "%%EOF\n",
};

const usuarioPersonId = FIXTURE.usuarioPersonId;
const adminPersonId = FIXTURE.adminPersonId;

// Precondición de la sección 5. Se siembra JUSTO ANTES del primer caso que la necesita —no en el
// `before`— para que la sección 4 pueda contar filas de `signature_batch_jobs` sin restar la
// fixture. Es idempotente (upsert), así que llamarla de más no cambia nada.
let jobsSembrados = false;
const sembrarJobsDeLote = async () => {
  if (jobsSembrados) return;
  await upsertSignatureBatchJob({
    jobId: JOB_PROPIO,
    userId: usuarioPersonId,
    signMode: "coordinates",
    status: "completed",
    total: 1,
    processed: 1,
    successCount: 0,
    failedCount: 1,
    results: [{ fileName: "documento.pdf", status: "error", error: "fallo simulado" }],
  });
  await upsertSignatureBatchJob({
    jobId: JOB_AJENO,
    userId: adminPersonId,
    signMode: "token",
    status: "completed",
    total: 1,
    processed: 1,
    successCount: 1,
    failedCount: 0,
    results: [{ fileName: "ajeno.pdf", status: "success", signedPath: "users/x/signed/ajeno.pdf" }],
  });
  jobsSembrados = true;
};

before(async () => {
  await waitForReady();
  // Idempotencia: si una corrida anterior murió a medias, los restos se van antes de empezar.
  await deleteSignatureBatchJob(JOB_PROPIO);
  await deleteSignatureBatchJob(JOB_AJENO);
});

after(async () => {
  await deleteSignatureBatchJob(JOB_PROPIO);
  await deleteSignatureBatchJob(JOB_AJENO);
  await closeDb();
});

// ─── 1. La puerta de autenticación va PRIMERO en las ocho rutas de /sign ─────────────────────────
//
// Es el guard más barato de romper al mover código (basta reordenar el array de middlewares en el
// router) y el más caro si se rompe. Se fija para TODAS las rutas, no para una de muestra.

const RUTAS_SIN_TOKEN = [
  ["POST", "/sign"],
  ["POST", "/sign/validate"],
  ["POST", "/sign/batch"],
  ["POST", "/sign/batch/start"],
  ["GET", "/sign/batch/cualquiera"],
  ["GET", "/sign/batch/cualquiera/download"],
  ["GET", "/sign/download?path=cualquiera"],
  ["GET", "/sign/documents/1/signature-flow"],
];

for (const [method, path] of RUTAS_SIN_TOKEN) {
  test(`${method} ${path} sin token -> 401`, async () => {
    const res = method === "GET" ? await get(path) : await post(path);
    assert.equal(res.status, 401, `${method} ${path} debe exigir token`);
    matchSnapshot(SUITE, `sin_token_${method}_${path.replace(/[^a-z0-9]+/gi, "_")}`, snapshotShape(res));
  });
}

// ─── 2. `requestSign`: la cadena de validación, en orden ────────────────────────────────────────
//
// El orden ES el contrato. Hoy: fichero PDF → certificate_id → password → stampText → certificado
// del usuario. Cada caso omite UNA cosa y aporta las anteriores, así que si alguien reordena dos
// comprobaciones, el mensaje del golden deja de coincidir.

const signForm = (overrides = {}) => {
  const base = {
    pdf: MINI_PDF,
    certificate_id: "999999",
    password: "irrelevante",
    stampText: "Sello de prueba",
  };
  const merged = { ...base, ...overrides };
  for (const key of Object.keys(merged)) {
    if (merged[key] === undefined) delete merged[key];
  }
  return merged;
};

test("POST /sign sin fichero PDF -> 400 (el único rechazo que SÍ es 4xx)", async () => {
  const token = await tokenFor("usuario");
  const res = await post("/sign", { token, form: signForm({ pdf: undefined }) });
  assert.equal(res.status, 400);
  matchSnapshot(SUITE, "sign_sin_pdf", snapshotShape(res, OBJ_OPTS));
});

test("POST /sign con cuerpo JSON (sin multipart) -> 400", async () => {
  const token = await tokenFor("usuario");
  const res = await post("/sign", { token, body: {} });
  matchSnapshot(SUITE, "sign_body_json", snapshotShape(res, OBJ_OPTS));
});

test("POST /sign sin certificate_id -> 400", async () => {
  const token = await tokenFor("usuario");
  const res = await post("/sign", { token, form: signForm({ certificate_id: undefined }) });
  assert.equal(res.status, 400, "falta un dato del cliente: 400, no 500");
  matchSnapshot(SUITE, "sign_sin_certificado", snapshotShape(res, OBJ_OPTS));
});

test("POST /sign sin password -> 400", async () => {
  const token = await tokenFor("usuario");
  const res = await post("/sign", { token, form: signForm({ password: undefined }) });
  assert.equal(res.status, 400);
  matchSnapshot(SUITE, "sign_sin_password", snapshotShape(res, OBJ_OPTS));
});

test("POST /sign sin texto de sello -> 400", async () => {
  const token = await tokenFor("usuario");
  const res = await post("/sign", { token, form: signForm({ stampText: undefined }) });
  assert.equal(res.status, 400);
  matchSnapshot(SUITE, "sign_sin_sello", snapshotShape(res, OBJ_OPTS));
});

test("POST /sign con certificado inexistente -> 404 (y no revela si existe de otro dueño)", async () => {
  const token = await tokenFor("usuario");
  const res = await post("/sign", { token, form: signForm() });
  assert.equal(res.status, 404, "el certificado de otro y uno inexistente son el MISMO 404");
  matchSnapshot(SUITE, "sign_certificado_inexistente", snapshotShape(res, OBJ_OPTS));
});

// El `fileFilter` del router rechaza el fichero y `handleUploadError` lo convierte en JSON. Lo que
// se fija NO es el texto exacto (cambiaría con cualquier retoque de redacción) sino LA FORMA: que
// sea JSON, que NO lleve HTML ni stack trace, y que diga de qué se queja. Antes de arreglarlo esto
// mismo devolvía `esHtml: true` y `filtra_stack_trace: true`.
test("POST /sign con un no-PDF en el campo pdf -> 400 JSON, sin HTML ni stack trace", async () => {
  const token = await tokenFor("usuario");
  const res = await post("/sign", {
    token,
    form: signForm({ pdf: { filename: "malicioso.txt", contentType: "text/plain", content: "no soy un pdf" } }),
  });
  const cuerpo = typeof res.body === "string" ? res.body : JSON.stringify(res.body ?? "");
  matchSnapshot(SUITE, "sign_mimetype_rechazado", {
    status: res.status,
    esHtml: cuerpo.includes("<!DOCTYPE html>"),
    esJson: typeof res.body === "object" && res.body !== null,
    filtra_stack_trace: cuerpo.includes("at fileFilter") || cuerpo.includes("/app/backend/"),
    menciona_el_campo: cuerpo.includes("Tipo de archivo no permitido"),
    // El contrato objetivo de `docs/contrato-errores-api.md` §4: mensaje humano + código estable.
    claves: typeof res.body === "object" && res.body !== null ? Object.keys(res.body).sort() : null,
  });
});

test("POST /sign/validate sin fichero PDF -> 400", async () => {
  const token = await tokenFor("usuario");
  const res = await post("/sign/validate", { token, form: { cedula: USERS.usuario.identifier } });
  matchSnapshot(SUITE, "validate_sin_pdf", snapshotShape(res, OBJ_OPTS));
});

// ─── 3. El endpoint legacy de lote: 410 Gone con su código de migración ─────────────────────────

test("POST /sign/batch (legacy) -> 410 Gone y apunta al sustituto", async () => {
  const token = await tokenFor("usuario");
  const res = await post("/sign/batch", { token, form: { pdf: MINI_PDF } });
  assert.equal(res.status, 410);
  matchSnapshot(SUITE, "batch_legacy_gone", snapshotShape(res, OBJ_OPTS));
});

// ─── 4. `requestSignBatchStart`: rechaza ANTES de crear el job ──────────────────────────────────

test("POST /sign/batch/start sin ficheros -> 400", async () => {
  const token = await tokenFor("usuario");
  const res = await post("/sign/batch/start", { token, form: { certificate_id: "1" } });
  matchSnapshot(SUITE, "batch_start_sin_ficheros", snapshotShape(res, OBJ_OPTS));
});

// El orden importa MUCHO aquí: si el refactor mueve `createBatchJob` por delante de
// `buildSignContext`, cada intento fallido dejaría un job huérfano "processing" para siempre.
// Esto lo fija: la validación va primero y la tabla no crece.
test("POST /sign/batch/start con certificado inexistente -> 404 y NO deja job huérfano", async () => {
  const token = await tokenFor("usuario");
  const antes = await countSignatureBatchJobs();
  const res = await post("/sign/batch/start", { token, form: signForm() });
  const despues = await countSignatureBatchJobs();

  matchSnapshot(SUITE, "batch_start_certificado_inexistente", {
    ...snapshotShape(res, OBJ_OPTS),
    jobs_creados: despues - antes,
  });
  assert.equal(despues, antes, "una validación fallida no debe persistir un job de lote");
});

// ─── 5. Guards de consulta y descarga del lote ──────────────────────────────────────────────────
//
// Orden congelado: existencia (404) ANTES que propiedad (403), y propiedad ANTES que el estado del
// lote (400 "sin documentos firmados"). Un job inexistente NO debe distinguirse de uno ajeno por el
// código de estado... y hoy SÍ se distingue: 404 vs 403 permite enumerar jobs de otros usuarios.
// Se congela tal cual: es el comportamiento actual, no una recomendación.

test("GET /sign/batch/:jobId propio -> 200 con el contrato de forma del job", async () => {
  await sembrarJobsDeLote();
  const token = await tokenFor("usuario");
  const res = await get(`/sign/batch/${JOB_PROPIO}`, { token });
  assert.equal(res.status, 200);
  // `rowToBatchJob` es la proyección snake_case -> camelCase que el refactor podría alterar en
  // silencio. Se fija entera (ids enmascarados; createdAt/updatedAt ya son volátiles por defecto).
  matchSnapshot(SUITE, "batch_status_propio", snapshotShape(res, OBJ_OPTS));
});

test("GET /sign/batch/:jobId inexistente -> 404 (la existencia se comprueba ANTES que la propiedad)", async () => {
  const token = await tokenFor("usuario");
  const res = await get("/sign/batch/no-existe-este-job", { token });
  assert.equal(res.status, 404);
  matchSnapshot(SUITE, "batch_status_inexistente", snapshotShape(res, OBJ_OPTS));
});

test("GET /sign/batch/:jobId de OTRO usuario -> 403", async () => {
  await sembrarJobsDeLote();
  const token = await tokenFor("usuario");
  const res = await get(`/sign/batch/${JOB_AJENO}`, { token });
  assert.equal(res.status, 403, "el job de otro es 403, no 200 ni 404");
  matchSnapshot(SUITE, "batch_status_ajeno", snapshotShape(res, OBJ_OPTS));
});

test("GET /sign/batch/:jobId/download inexistente -> 404", async () => {
  const token = await tokenFor("usuario");
  const res = await get("/sign/batch/no-existe-este-job/download", { token });
  matchSnapshot(SUITE, "batch_download_inexistente", snapshotShape(res, OBJ_OPTS));
});

test("GET /sign/batch/:jobId/download de OTRO usuario -> 403 (antes de tocar el almacenamiento)", async () => {
  await sembrarJobsDeLote();
  const token = await tokenFor("usuario");
  const res = await get(`/sign/batch/${JOB_AJENO}/download`, { token });
  assert.equal(res.status, 403);
  matchSnapshot(SUITE, "batch_download_ajeno", snapshotShape(res, OBJ_OPTS));
});

test("GET /sign/batch/:jobId/download de un lote sin firmados -> 400", async () => {
  await sembrarJobsDeLote();
  const token = await tokenFor("usuario");
  const res = await get(`/sign/batch/${JOB_PROPIO}/download`, { token });
  assert.equal(res.status, 400, "propiedad OK pero lote vacío: 400, no 404 ni 500");
  matchSnapshot(SUITE, "batch_download_sin_firmados", snapshotShape(res, OBJ_OPTS));
});

// ─── 6. `downloadSigned`: parámetro, propiedad y existencia ─────────────────────────────────────

test("GET /sign/download sin parámetro path -> 400", async () => {
  const token = await tokenFor("usuario");
  const res = await get("/sign/download", { token });
  matchSnapshot(SUITE, "download_sin_path", snapshotShape(res, OBJ_OPTS));
});

test("GET /sign/download de una ruta documental ajena -> 403", async () => {
  const token = await tokenFor("usuario");
  // Ruta que NO empieza por `users/<mi cédula>/`: se resuelve contra document_versions y el
  // predicado de propiedad (dueño / responsable / creador de la tarea / firmante) no la encuentra.
  const res = await get("/sign/download?path=Unidades/inexistente/documento.pdf", { token });
  assert.equal(res.status, 403);
  matchSnapshot(SUITE, "download_ruta_ajena", snapshotShape(res, OBJ_OPTS));
});

// Contrato sutil y fácil de romper al extraer `PdfSigningService`: el prefijo `users/<cédula>/` es
// un ATAJO que se salta por completo la consulta de propiedad y va derecho a MinIO. Por eso una
// ruta propia inexistente da 404 y una ajena inexistente da 403.
test("GET /sign/download de una ruta propia inexistente -> 404 (el prefijo users/<cédula>/ salta el guard)", async () => {
  const token = await tokenFor("usuario");
  const res = await get(
    `/sign/download?path=users/${USERS.usuario.identifier}/signed/no-existe/documento.pdf`,
    { token },
  );
  assert.equal(res.status, 404);
  matchSnapshot(SUITE, "download_ruta_propia_inexistente", snapshotShape(res, OBJ_OPTS));
});

// ─── 7. `getSignatureFlow`: validación del id y contrato del "no existe" ────────────────────────

test("GET /sign/documents/:dv/signature-flow con id no numérico -> 400", async () => {
  const token = await tokenFor("usuario");
  const res = await get("/sign/documents/abc/signature-flow", { token });
  matchSnapshot(SUITE, "signature_flow_id_no_numerico", snapshotShape(res, OBJ_OPTS));
});

test("GET /sign/documents/0/signature-flow -> 400 (el cero cuenta como inválido)", async () => {
  const token = await tokenFor("usuario");
  const res = await get("/sign/documents/0/signature-flow", { token });
  matchSnapshot(SUITE, "signature_flow_id_cero", snapshotShape(res, OBJ_OPTS));
});

// OJO: una versión documental inexistente NO es 404 — devuelve 200 con un snapshot vacío y
// `readiness.reason = document_version_not_found`. Es deliberado (el frontend pinta el motivo),
// pero es justo el tipo de asimetría que un refactor "normaliza" sin querer.
test("GET /sign/documents/999999/signature-flow -> 200 con readiness=document_version_not_found", async () => {
  const token = await tokenFor("usuario");
  const res = await get("/sign/documents/999999/signature-flow", { token });
  assert.equal(res.status, 200, "hoy NO es 404: el snapshot vacío se devuelve con 200");
  matchSnapshot(SUITE, "signature_flow_inexistente", {
    status: res.status,
    body: normalize(res.body, OBJ_OPTS),
  });
});
