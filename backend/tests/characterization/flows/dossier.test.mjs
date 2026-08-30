// Characterization: dossier (expediente personal).
//
// El setup crea el dossier del usuario con un título, una experiencia (con
// funcion_catedra array) y un artículo de investigación. Este golden fija su
// forma observable — RED DE SEGURIDAD para migrar el dossier de MongoDB a
// PostgreSQL relacional: el mismo golden debe pasar antes (Mongo) y después (SQL).
//
// - maskIdKeys: enmascara los _id opacos (ObjectId hoy / enteros tras migrar).
// - drop [usuario, __v]: campos internos de Mongo que la versión SQL NO emite.

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { get, post, del } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";
import { snapshotShape } from "../lib/normalize.mjs";
import { matchSnapshot } from "../lib/snapshot.mjs";
import { waitForReady } from "../lib/readiness.mjs";

const SUITE = "dossier";
const CEDULA = "1122334459";
const DOSSIER_OPTS = { maskIdKeys: true, drop: ["usuario", "__v"] };

before(async () => {
  await waitForReady();
});

// UN NÚMERO DE DOCUMENTO NO IDENTIFICA A NADIE POR SÍ SOLO: la unicidad es (tipo, país, número), y
// dos pasaportes de países distintos con el mismo número son legales en el modelo.
//
// Las 22 rutas de este router entran por `:cedula`. Ante una colisión, el store devolvía `null` y los
// controladores lo traducían a 404 «no encontrado»: seguro —nunca daba el expediente de otra
// persona— pero el mensaje mentía, porque el expediente SÍ existe; lo que no se puede es saber de
// quién. Ahora lo corta un `router.param`, que cubre las veintidós de una vez.
//
// Este caso FABRICA la colisión y la retira. Es la única forma de probarlo: los datos sembrados no
// la tienen, y sin ella el camino no se ejecuta nunca.
test("GET /dossier/:cedula con el número repetido en dos personas -> 409, no 404", async () => {
  const token = await tokenFor("admin");

  const antes = await get(`/dossier/${CEDULA}`, { token });
  assert.equal(antes.status, 200, "sin colisión el expediente se lee");

  // Se le cuelga a OTRA persona un pasaporte con el mismo número. El país es obligatorio y tiene que
  // ser otro: dentro del mismo (tipo, país) el índice único ya lo impediría — la colisión que se
  // busca es precisamente la que el índice NO puede evitar.
  const paises = await get("/admin/sql/paises?q=espa&limit=1", { token });
  const paisId = (Array.isArray(paises.body) ? paises.body : [])[0]?.id;
  assert.ok(paisId, "hace falta un país distinto del de la institución");

  const gemelo = await post("/admin/sql/documentos_identidad", {
    token,
    body: { person_id: 2, tipo: "pasaporte", pais_id: paisId, numero: CEDULA }
  });
  const creadoId = gemelo.body?.id;
  assert.ok(creadoId, `no se pudo fabricar la colisión: ${JSON.stringify(gemelo.body)}`);

  const conColision = await get(`/dossier/${CEDULA}`, { token });
  matchSnapshot(SUITE, "dossier_numero_ambiguo", snapshotShape(conColision));
  assert.equal(conColision.status, 409, "con dos personas detrás, el expediente no se resuelve");

  await del("/admin/sql/documentos_identidad", { token, body: { keys: { id: creadoId } } });
  const despues = await get(`/dossier/${CEDULA}`, { token });
  assert.equal(despues.status, 200, "retirada la colisión, vuelve a leerse");
});

test("GET /dossier/:cedula (dueño) -> expediente con título/experiencia/artículo", async () => {
  const token = await tokenFor("usuario");
  const res = await get(`/dossier/${CEDULA}`, { token });
  matchSnapshot(SUITE, "dossier_usuario", snapshotShape(res, DOSSIER_OPTS));
});

test("GET /dossier/:cedula sin token -> 401", async () => {
  const res = await get(`/dossier/${CEDULA}`);
  matchSnapshot(SUITE, "dossier_no_token", snapshotShape(res));
});

// El `fileFilter` de este router rechaza el fichero llamando a `cb(error)`. Si nadie recoge ese
// error, Express contesta con SU página HTML, que incluye el stack trace completo: rutas absolutas
// dentro del contenedor, números de línea y nombres de fichero del servidor. Es una fuga de
// información y, además, el cliente recibe HTML donde espera JSON.
//
// Igual que en `zzzz_sign_batch.test.mjs` (`sign_mimetype_rechazado`), lo que se fija NO es el texto
// exacto sino LA FORMA: que sea JSON, que no lleve HTML ni stack trace, y que diga de qué se queja.
test("POST /dossier/:cedula/documentos/... con un no-PDF -> JSON, sin HTML ni stack trace", async () => {
  const token = await tokenFor("usuario");
  const res = await post(`/dossier/${CEDULA}/documentos/titulos/inexistente`, {
    token,
    form: { archivo: { filename: "malicioso.txt", contentType: "text/plain", content: "no soy un pdf" } },
  });
  const cuerpo = typeof res.body === "string" ? res.body : JSON.stringify(res.body ?? "");
  matchSnapshot(SUITE, "dossier_mimetype_rechazado", {
    status: res.status,
    esHtml: cuerpo.includes("<!DOCTYPE html>"),
    esJson: typeof res.body === "object" && res.body !== null,
    filtra_stack_trace: cuerpo.includes("at fileFilter") || cuerpo.includes("/app/backend/"),
    menciona_el_motivo: cuerpo.includes("Solo se permiten archivos PDF"),
    // El contrato objetivo de `docs/planes/referencia/contrato-errores-api.md` §4: mensaje humano + código estable.
    claves: typeof res.body === "object" && res.body !== null ? Object.keys(res.body).sort() : null,
  });
});
