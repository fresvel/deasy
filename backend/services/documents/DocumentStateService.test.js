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
  DOCUMENT_STATUSES,
  DOCUMENT_TERMINAL_STATUSES,
  DOCUMENT_RELAYABLE_STATUSES,
  isDocumentRelayable,
  isDocumentPending,
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


// ── LA LISTA QUE ESTÁ DUPLICADA (DR1, 2026-08-23) ──────────────────────────────────────────
// `DOCUMENT_RELAYABLE_STATUSES` decide hasta dónde llega el relevo automático de un entregable, y
// vive en DOS sitios porque no hay forma de que uno lea al otro:
//
//   · aquí, en JavaScript, para el backfill y el traspaso manual;
//   · en `postgres_schema.sql`, dentro de los tres triggers de relevo.
//
// Una duplicación así no se vigila sola. Si se separan, el trigger y el backfill relevarían cosas
// distintas —y el síntoma sería un entregable que a veces se mueve y a veces no, según qué camino
// lo tocara—: de los peores de diagnosticar. Por eso lo que sigue LEE EL ESQUEMA y compara.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ESQUEMA = path.resolve(AQUI, "../../database/postgres_schema.sql");

test("la lista del esquema y la de JavaScript son la MISMA", () => {
  const sql = fs.readFileSync(ESQUEMA, "utf8");
  const apariciones = [...sql.matchAll(/ti\.document_status IN \(([^)]*)\)/g)];
  assert.ok(apariciones.length >= 3, `el predicado debe estar en los tres triggers de relevo, y hay ${apariciones.length}`);

  for (const [, lista] of apariciones) {
    const enSql = lista.split(",").map((x) => x.trim().replace(/^'|'$/g, ""));
    assert.deepEqual(
      enSql,
      [...DOCUMENT_RELAYABLE_STATUSES],
      "el esquema y `DOCUMENT_RELAYABLE_STATUSES` han derivado: el trigger y el backfill relevarían cosas distintas",
    );
  }
});

test("lo relevable y lo cerrado no se solapan, y ninguno inventa estados", () => {
  for (const estado of DOCUMENT_RELAYABLE_STATUSES) {
    assert.ok(DOCUMENT_STATUSES.includes(estado), `${estado} no está en el catálogo`);
    assert.ok(!DOCUMENT_TERMINAL_STATUSES.includes(estado), `${estado} no puede ser relevable Y cerrado`);
  }
});

test("el corte está al ENTRAR en la fase de firma, no al estamparse la primera firma", () => {
  // Es la decisión DR1, y lo que la hace verificable: «Listo para firma» todavía se releva —el
  // llenado acabó pero no se ha convocado a nadie— y «Pendiente de firma» ya no.
  assert.ok(isDocumentRelayable("Listo para firma"), "el llenado acabado todavía se releva");
  assert.ok(!isDocumentRelayable("Pendiente de firma"), "convocada la firma, ya no");
  assert.ok(!isDocumentRelayable("Firmado parcial"));
});

test("un documento CERRADO no se releva, y eso ya no depende de que estuviera empezado", () => {
  // Antes esto se protegía de rebote: los cerrados no se relevaban porque tenían `user_started_at`
  // sellado, no porque estuvieran cerrados. Al abrir el relevo de lo empezado esa protección
  // desapareció, así que ahora es explícita. Sin este caso, un documento «Final» volvería a moverse.
  for (const estado of DOCUMENT_TERMINAL_STATUSES) {
    assert.ok(!isDocumentRelayable(estado), `un documento ${estado} no se releva`);
    assert.ok(!isDocumentPending(estado));
  }
});

test("sin estado todavía se releva: aún no ha empezado nada", () => {
  assert.ok(isDocumentRelayable(null));
  assert.ok(isDocumentRelayable(""));
});
