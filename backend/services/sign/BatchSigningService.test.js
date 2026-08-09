// Red unitaria del motor de firma masiva.
//
// La caracterización llega a los guards HTTP del lote (404/403/400) pero no al contenido: la
// proyección de la fila a job, el saneado de rutas del ZIP —que es donde vive el path traversal— y
// el parseo de la metadata por documento. Eso es lo que se cubre aquí.
import test from "node:test";
import assert from "node:assert/strict";

import {
  parseBatchDocumentContexts,
  parseBatchDocumentFields,
  rowToBatchJob,
  sanitizeRelativePdfPath,
  selectSignedResults,
} from "./BatchSigningService.js";

// --- sanitizeRelativePdfPath: la entrada del ZIP ------------------------------------------------

test("los segmentos '..' y '.' se descartan: no hay path traversal en el ZIP", () => {
  assert.equal(sanitizeRelativePdfPath("../../etc/passwd", "x.pdf", 0), "etc/passwd.pdf");
  assert.equal(sanitizeRelativePdfPath("./a/./b.pdf", "x.pdf", 0), "a/b.pdf");
});

test("una ruta que se queda sin segmentos cae en un nombre por posición", () => {
  assert.equal(sanitizeRelativePdfPath("../..", "", 0), "documento-1.pdf");
  assert.equal(sanitizeRelativePdfPath("", "", 4), "documento-5.pdf");
});

test("sin ruta relativa se usa el nombre del fichero", () => {
  assert.equal(sanitizeRelativePdfPath(null, "acta final.pdf", 0), "acta_final.pdf");
});

test("las barras invertidas de Windows también parten segmentos, y la extensión se garantiza", () => {
  assert.equal(sanitizeRelativePdfPath("carpeta\\sub\\acta", "x", 0), "carpeta/sub/acta.pdf");
});

test("un .pdf ya presente no se duplica, sin importar mayúsculas", () => {
  assert.equal(sanitizeRelativePdfPath("a/b.PDF", "x", 0), "a/b.PDF");
});

// --- rowToBatchJob: la proyección snake_case -> camelCase ---------------------------------------

const fila = (overrides = {}) => ({
  job_id: "j-1",
  user_id: 7,
  sign_mode: "coordinates",
  status: "completed",
  total: 2,
  processed: 2,
  success_count: 1,
  failed_count: 1,
  results: '[{"fileName":"a.pdf","status":"success"}]',
  created_at: "2026-01-01",
  updated_at: "2026-01-02",
  ...overrides,
});

test("sin fila no hay job", () => {
  assert.equal(rowToBatchJob(null), null);
  assert.equal(rowToBatchJob(undefined), null);
});

test("la fila se proyecta a camelCase y los resultados llegan como lista", () => {
  const job = rowToBatchJob(fila());
  assert.equal(job.jobId, "j-1");
  assert.equal(job.userId, 7);
  assert.equal(job.signMode, "coordinates");
  assert.equal(job.successCount, 1);
  assert.equal(job.failedCount, 1);
  assert.deepEqual(job.results, [{ fileName: "a.pdf", status: "success" }]);
});

test("los resultados valen tanto en texto como ya deserializados", () => {
  assert.deepEqual(rowToBatchJob(fila({ results: [{ fileName: "b.pdf" }] })).results, [{ fileName: "b.pdf" }]);
});

test("unos resultados ilegibles o de forma inesperada no rompen la consulta: lista vacía", () => {
  assert.deepEqual(rowToBatchJob(fila({ results: "{no soy json" })).results, []);
  assert.deepEqual(rowToBatchJob(fila({ results: null })).results, []);
  assert.deepEqual(rowToBatchJob(fila({ results: '{"a":1}' })).results, []);
});

// --- selectSignedResults ------------------------------------------------------------------------

test("solo se descargan los resultados firmados que dejaron ruta", () => {
  const job = {
    results: [
      { status: "success", signedPath: "users/1/a.pdf" },
      { status: "success" },
      { status: "error", signedPath: "users/1/b.pdf" },
      { status: "pending" },
    ],
  };
  assert.deepEqual(selectSignedResults(job), [{ status: "success", signedPath: "users/1/a.pdf" }]);
});

test("un job sin resultados no revienta", () => {
  assert.deepEqual(selectSignedResults({}), []);
  assert.deepEqual(selectSignedResults({ results: "roto" }), []);
  assert.deepEqual(selectSignedResults(null), []);
});

// --- parseBatchDocumentFields -------------------------------------------------------------------

test("sin configuración por documento, la lista es vacía", () => {
  assert.deepEqual(parseBatchDocumentFields(undefined), []);
  assert.deepEqual(parseBatchDocumentFields(""), []);
});

test("una configuración que no es lista es 400, no 500", () => {
  assert.throws(() => parseBatchDocumentFields('{"id":1}'), (error) => error.statusCode === 400);
});

test("las coordenadas por documento llegan como números y sin campos es lista vacía", () => {
  assert.deepEqual(
    parseBatchDocumentFields('[{"id":"a","name":"a.pdf","fields":[{"page":"1","x":"2","y":"3"}]},{"id":"b"}]'),
    [
      { id: "a", name: "a.pdf", fields: [{ page: 1, x: 2, y: 3 }] },
      { id: "b", name: undefined, fields: [] },
    ],
  );
});

// --- parseBatchDocumentContexts -----------------------------------------------------------------

test("sin metadata por documento, la lista es vacía; si no es lista, 400", () => {
  assert.deepEqual(parseBatchDocumentContexts(null), []);
  assert.throws(() => parseBatchDocumentContexts('"texto"'), (error) => error.statusCode === 400);
});

test("la metadata se normaliza: ids numéricos o null, textos recortados y relativePath opcional", () => {
  const [entrada] = parseBatchDocumentContexts(JSON.stringify([{
    id: "a",
    name: "a.pdf",
    relativePath: "  carpeta/a.pdf  ",
    metadata: {
      signatureRequestId: "5",
      documentVersionId: 0,
      processName: "  Silabo  ",
      termYear: 2026,
    },
  }]));
  assert.equal(entrada.relativePath, "carpeta/a.pdf");
  assert.equal(entrada.metadata.signatureRequestId, 5);
  assert.equal(entrada.metadata.documentVersionId, null, "el cero no es un id");
  assert.equal(entrada.metadata.processName, "Silabo");
  assert.equal(entrada.metadata.termYear, "2026");
  assert.equal(entrada.metadata.requestedAt, null);
});

test("una entrada vacía no revienta y deja todo en null o cadena vacía", () => {
  const [entrada] = parseBatchDocumentContexts("[{}]");
  assert.equal(entrada.id, null);
  assert.equal(entrada.relativePath, null);
  assert.equal(entrada.metadata.documentId, null);
  assert.equal(entrada.metadata.stepName, "");
});
