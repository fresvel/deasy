// Characterization: los textos legales que se aceptan al registrarse.
//
// ⚠️ ESTE FLUJO NACIO DE UN AGUJERO MEDIDO EL 2026-09-02, y el agujero era INVISIBLE para las otras
// 327 pruebas. Al mudar el texto legal de una columna `TEXT` a MinIO, la fila que indexa el objeto
// pasó a crearla la ADOPCION, que corre al arrancar el backend. Pero `test:char:fixture` vacía la
// base SIN reiniciar el backend: medido, `GET /legal/documentos` devolvía `{"documentos":[]}`.
//
// Y lo peor no es que devolviera vacío, sino que NADIE SE ENTERABA: `idsDeConsentimiento` devuelve
// `[]`, el alta lo acepta, y `validarAceptacion` da por VALIDA una lista vacía porque no hay clases
// publicadas que exigir. El registro seguía en verde **sin registrar un solo consentimiento** — que
// es exactamente el agujero que el frente 17 vino a cerrar.
//
// Por eso aquí hay ASERCIONES EXPLICITAS y no sólo un golden: un snapshot de `[]` se captura tan
// contento y congela el fallo. Lo que protege es exigir que HAYA documentos.

import { test, before } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { get } from "../lib/http.mjs";
import { matchSnapshot } from "../lib/snapshot.mjs";
import { waitForReady } from "../lib/readiness.mjs";

const SUITE = "legal";

// La misma normalización que `backend/services/legal/huella.js`: `\r\n` -> `\n` y recorte del final.
// Se reescribe aquí A PROPOSITO en vez de importarla — si el test usara la función del sistema,
// comprobaría que es consistente consigo misma, que no prueba nada.
const huellaDe = (texto) =>
  crypto.createHash("sha256").update(String(texto ?? "").replace(/\r\n/g, "\n").trimEnd(), "utf8").digest("hex");

const CLASES_ESPERADAS = ["terminos_de_uso", "tratamiento_de_datos"];

before(async () => {
  await waitForReady();
});

// PUBLICO A PROPOSITO: lo consume el REGISTRO, que por definición usa quien todavía no tiene cuenta.
test("GET /legal/documentos sin token -> los textos vigentes, y NO una lista vacía", async () => {
  const res = await get("/legal/documentos");
  assert.equal(res.status, 200);

  const documentos = res.body?.documentos ?? [];

  // ⬇️ LA ASERCION QUE IMPORTA. Sin ella todo lo demás pasa en vacío.
  assert.ok(
    documentos.length >= CLASES_ESPERADAS.length,
    `No hay textos legales publicados (${documentos.length}). Nadie tiene nada que aceptar y el alta ` +
    `registraría CERO consentimientos sin que ninguna prueba se queje. Suele ser que la adopción del ` +
    `archivo legal no corrió tras el reset: mira 'conectarArchivoLegal' en SystemBootstrapService.`
  );

  const clases = documentos.map((d) => d.clase).sort();
  assert.deepEqual(clases, [...CLASES_ESPERADAS].sort(), "Faltan clases publicadas o sobra alguna.");
});

// El Art. 5 del Reglamento exige poder demostrar QUE DECIA el texto. Aquí se comprueba que la huella
// guardada es la del texto que de verdad se sirve — no un literal escrito a mano, que es lo que era
// hasta el 2026-09-02.
test("la huella de cada documento es la del texto que se sirve", async () => {
  const { body } = await get("/legal/documentos");
  for (const doc of body?.documentos ?? []) {
    assert.ok(String(doc.texto ?? "").length > 0, `${doc.clase} se sirve VACIO.`);
    assert.equal(
      doc.contenidoHash,
      huellaDe(doc.texto),
      `La huella de ${doc.clase} ${doc.version} no es la del texto servido: lo aceptado no es demostrable.`
    );
  }
});

// El golden congela la IDENTIDAD de lo publicado -clase, versión y huella-, no el texto entero: son
// 10 KB y el diff sería ilegible. La huella ya delata cualquier cambio del contenido, que es
// justamente para lo que existe.
test("golden: qué está publicado y con qué huella", async () => {
  const { body } = await get("/legal/documentos");
  const identidad = (body?.documentos ?? [])
    .map((d) => ({ clase: d.clase, version: d.version, contenidoHash: d.contenidoHash, caracteres: String(d.texto ?? "").length }))
    .sort((a, b) => a.clase.localeCompare(b.clase));
  matchSnapshot(SUITE, "documentos_publicados", identidad);
});
