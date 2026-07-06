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
import { get } from "../lib/http.mjs";
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
