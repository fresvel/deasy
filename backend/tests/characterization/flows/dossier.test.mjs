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
import { get, post } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";
import { snapshotShape } from "../lib/normalize.mjs";
import { matchSnapshot } from "../lib/snapshot.mjs";
import { waitForReady } from "../lib/readiness.mjs";

const SUITE = "dossier";
const CEDULA = "1122334455";
const DOSSIER_OPTS = { maskIdKeys: true, drop: ["usuario", "__v"] };

before(async () => {
  await waitForReady();
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
