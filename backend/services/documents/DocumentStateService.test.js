// Tests unitarios de la máquina de estados de documentos.
//
// Gobierna qué transiciones se permiten sobre documentos y sus versiones. Un fallo
// aquí deja firmar un documento cancelado, o saltarse la revisión de llenado.
// Son funciones puras: no tocan la base de datos.

import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeDocumentStatus,
  normalizeDocumentVersionStatus,
  assertDocumentStatusValue,
  canTransitionDocumentStatus,
  canTransitionDocumentVersionStatus,
  deriveDocumentStatusFromVersionStatus,
} from "./DocumentStateService.js";

// --- Normalización -----------------------------------------------------------

test("normalizeDocumentStatus traduce los estados legacy", () => {
  assert.equal(normalizeDocumentStatus("rechazado"), "Observado");
  assert.equal(normalizeDocumentStatus("aprobado"), "Final");
  // El mapeo legacy es insensible a mayúsculas.
  assert.equal(normalizeDocumentStatus("Rechazado"), "Observado");
});

test("normalizeDocumentStatus cae a Inicial ante entrada vacía o desconocida", () => {
  assert.equal(normalizeDocumentStatus(""), "Inicial");
  assert.equal(normalizeDocumentStatus(null), "Inicial");
  assert.equal(normalizeDocumentStatus("estado inventado"), "Inicial");
});

test("normalizeDocumentStatus conserva un estado válido y recorta espacios", () => {
  assert.equal(normalizeDocumentStatus("Firmado completo"), "Firmado completo");
  assert.equal(normalizeDocumentStatus("  Final  "), "Final");
});

test("normalizeDocumentVersionStatus cae a Borrador, no a Inicial", () => {
  assert.equal(normalizeDocumentVersionStatus(""), "Borrador");
  assert.equal(normalizeDocumentVersionStatus("basura"), "Borrador");
  assert.equal(normalizeDocumentVersionStatus("En llenado"), "En llenado");
});

// --- Transiciones de documento -----------------------------------------------

test("canTransitionDocumentStatus permite siempre la transición identidad", () => {
  assert.equal(canTransitionDocumentStatus("Final", "Final"), true);
  assert.equal(canTransitionDocumentStatus("Archivado", "Archivado"), true);
});

test("canTransitionDocumentStatus permite el avance normal del flujo", () => {
  assert.equal(canTransitionDocumentStatus("Listo para firma", "Pendiente de firma"), true);
  assert.equal(canTransitionDocumentStatus("Pendiente de firma", "Firmado completo"), true);
  assert.equal(canTransitionDocumentStatus("Firmado completo", "Final"), true);
});

test("canTransitionDocumentStatus prohíbe saltarse la firma", () => {
  assert.equal(canTransitionDocumentStatus("Inicial", "Firmado completo"), false);
  assert.equal(canTransitionDocumentStatus("Listo para firma", "Final"), false);
});

test("canTransitionDocumentStatus trata Archivado y Cancelado como terminales", () => {
  assert.equal(canTransitionDocumentStatus("Archivado", "Final"), false);
  assert.equal(canTransitionDocumentStatus("Cancelado", "En proceso"), false);
  // Pero se puede archivar desde casi cualquier punto.
  assert.equal(canTransitionDocumentStatus("En proceso", "Archivado"), true);
});

test("canTransitionDocumentVersionStatus admite la revisión de llenado", () => {
  assert.equal(canTransitionDocumentVersionStatus("En llenado", "En revisión de llenado"), true);
  assert.equal(canTransitionDocumentVersionStatus("En revisión de llenado", "Observado"), true);
  assert.equal(canTransitionDocumentVersionStatus("Firmado parcial", "Firmado completo"), true);
});

// --- Derivación del estado del documento desde la versión --------------------

test("deriveDocumentStatusFromVersionStatus colapsa los estados de llenado en 'En proceso'", () => {
  assert.equal(deriveDocumentStatusFromVersionStatus("En llenado"), "En proceso");
  assert.equal(deriveDocumentStatusFromVersionStatus("En revisión de llenado"), "En proceso");
});

test("deriveDocumentStatusFromVersionStatus mapea Borrador a Inicial", () => {
  assert.equal(deriveDocumentStatusFromVersionStatus("Borrador"), "Inicial");
});

test("deriveDocumentStatusFromVersionStatus es identidad para los estados de firma", () => {
  for (const status of ["Pendiente de firma", "Firmado parcial", "Firmado completo", "Final", "Archivado", "Cancelado"]) {
    assert.equal(deriveDocumentStatusFromVersionStatus(status), status);
  }
});

test("deriveDocumentStatusFromVersionStatus cae a Inicial ante un estado desconocido", () => {
  assert.equal(deriveDocumentStatusFromVersionStatus("no existe"), "Inicial");
});

// --- Trampa conocida: el guard `assert*` no puede lanzar nunca ---------------

test("assertDocumentStatusValue COERCE en vez de lanzar ante un estado inválido", () => {
  // Documenta el comportamiento actual, que no es el que su nombre sugiere:
  // `normalizeDocumentStatus` ya convierte cualquier basura en "Inicial", que es un
  // estado válido, así que el `throw` es inalcanzable.
  //
  // Hoy no es explotable (el único llamador con `allowDirect: true` es
  // `transitionDocumentVersionState`, que pasa un estado ya derivado y válido), pero
  // un futuro llamador que pase entrada sin validar degradaría el documento a
  // "Inicial" en silencio en vez de recibir un error.
  assert.equal(assertDocumentStatusValue("Firmadoo"), "Inicial");
  assert.doesNotThrow(() => assertDocumentStatusValue("estado inventado"));
});
