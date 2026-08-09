// Tests unitarios de los helpers puros extraídos de user_controler.js (Fase 3).
//
// Antes de la extracción estas funciones vivían enterradas en un fichero de 4118 L
// y no tenían cobertura directa: solo se ejercían de refilón por los characterization
// tests de los endpoints. Aquí se prueban aisladas, que es donde vive su lógica de
// ramas (resolución de jerarquías, coincidencia de reglas, permiso de reinicio).
//
// Ver docs/docs-md-antiguos/refactor-2026-07/auditoria-refactor-user-controler-2026-07.md

import test from "node:test";
import assert from "node:assert/strict";

import {
  sanitizeStorageSegment,
  buildDocumentVersionFolder,
  buildCanonicalDocumentVersionBasePath,
  buildWorkingObjectPathForUpload,
  getNumericUserId,
  getAuthenticatedUserId,
  isAuthorizedUserScope,
  createUnitSubtreeResolver,
  doesPositionMatchRule,
  buildRuleDisplayLabel,
  buildFillStepDisplayLabel,
  isPendingLikeFillStatus,
  isPendingLikeSignatureStatus,
  canCurrentUserResetWorkflow
} from "./user_controler.primitives.js";

test("sanitizeStorageSegment colapsa caracteres no seguros y recorta separadores", () => {
  assert.equal(sanitizeStorageSegment("Informe Final #2024/v1"), "Informe_Final_2024_v1");
  assert.equal(sanitizeStorageSegment("  ___  "), "na", "cadena vacía tras limpiar → fallback");
  assert.equal(sanitizeStorageSegment(null, "x"), "x");
  assert.equal(sanitizeStorageSegment(undefined), "na");
  assert.equal(sanitizeStorageSegment("a..b--c__d"), "a..b--c_d");
});

test("buildDocumentVersionFolder rellena a 4 dígitos y fuerza mínimo 1", () => {
  assert.equal(buildDocumentVersionFolder(1), "v0001");
  assert.equal(buildDocumentVersionFolder(42), "v0042");
  assert.equal(buildDocumentVersionFolder(0), "v0001", "0 se eleva al mínimo 1");
  assert.equal(buildDocumentVersionFolder(null), "v0001");
});

test("buildCanonicalDocumentVersionBasePath deriva el año y compone la ruta jerárquica", () => {
  const path = buildCanonicalDocumentVersionBasePath({
    scope_unit_id: 5,
    process_id: 9,
    term_year: 2024,
    term_type_id: 3,
    term_id: 7,
    task_id: 11,
    document_id: 21,
    document_version_sequence: 2
  });
  assert.equal(
    path,
    "5/PROCESOS/9/ANIOS/2024/TIPOS_PERIODO/3/PERIODOS/7/TAREAS/11/Documentos/21/v0002"
  );
});

test("buildCanonicalDocumentVersionBasePath usa term_start_date cuando falta term_year", () => {
  const path = buildCanonicalDocumentVersionBasePath({
    scope_unit_id: 1,
    process_id: 1,
    term_start_date: "2021-05-01",
    term_type_id: 1,
    term_id: 1,
    task_id: 1,
    document_id: 1,
    document_version_sequence: 1
  });
  assert.ok(path.includes("/ANIOS/2021/"), "el año sale de los 4 primeros chars de la fecha");
});

test("buildWorkingObjectPathForUpload sanea nombre y extensión y ubica bajo working/", () => {
  const objectPath = buildWorkingObjectPathForUpload({
    basePath: "5/Documentos/21/v0001",
    originalName: "Mi Archivo Final.PDF",
    extension: "PDF"
  });
  assert.ok(objectPath.startsWith("5/Documentos/21/v0001/working/pdf/"), "extensión en minúscula");
  assert.ok(objectPath.endsWith("-Mi_Archivo_Final.PDF"), "nombre saneado al final");
  assert.match(objectPath, /working\/pdf\/\d+-[0-9a-f-]{36}-/, "prefijo timestamp-uuid");
});

test("getNumericUserId lee params/query/body en orden y descarta no numéricos", () => {
  assert.equal(getNumericUserId({ params: { id: "7" } }), 7);
  assert.equal(getNumericUserId({ query: { user_id: "9" } }), 9);
  assert.equal(getNumericUserId({ body: { userId: "3" } }), 3);
  assert.equal(getNumericUserId({ params: { id: "abc" } }), null);
  assert.equal(getNumericUserId({}), null);
});

test("getAuthenticatedUserId extrae req.user.uid numérico", () => {
  assert.equal(getAuthenticatedUserId({ user: { uid: "12" } }), 12);
  assert.equal(getAuthenticatedUserId({ user: {} }), null);
  assert.equal(getAuthenticatedUserId({}), null);
});

test("isAuthorizedUserScope solo autoriza si el usuario pide su propio ámbito", () => {
  assert.equal(isAuthorizedUserScope({ user: { uid: 4 } }, 4), true);
  assert.equal(isAuthorizedUserScope({ user: { uid: 4 } }, "4"), true, "compara numéricamente");
  assert.equal(isAuthorizedUserScope({ user: { uid: 4 } }, 5), false);
  assert.equal(isAuthorizedUserScope({}, 5), false, "sin autenticación no hay ámbito");
});

test("createUnitSubtreeResolver recorre descendientes y cachea", () => {
  // 1 → {2,3}; 2 → {4}; 3,4 → hojas
  const children = new Map([
    [1, [2, 3]],
    [2, [4]]
  ]);
  const resolve = createUnitSubtreeResolver(children);
  assert.deepEqual([...resolve(1)].sort((a, b) => a - b), [1, 2, 3, 4]);
  assert.deepEqual([...resolve(2)].sort((a, b) => a - b), [2, 4]);
  assert.deepEqual([...resolve(4)], [4], "hoja se incluye a sí misma");
  assert.deepEqual([...resolve(null)], [], "unitId falsy → conjunto vacío");
  // segunda llamada golpea la caché y devuelve el mismo Set
  assert.equal(resolve(1), resolve(1));
});

test("createUnitSubtreeResolver no entra en bucle con ciclos", () => {
  const children = new Map([
    [1, [2]],
    [2, [1]] // ciclo
  ]);
  const resolve = createUnitSubtreeResolver(children);
  assert.deepEqual([...resolve(1)].sort((a, b) => a - b), [1, 2]);
});

test("doesPositionMatchRule: posición exacta manda sobre todo", () => {
  assert.equal(doesPositionMatchRule({ position_id: 8 }, { position_id: 8 }), true);
  assert.equal(doesPositionMatchRule({ position_id: 8 }, { position_id: 9 }), false);
});

test("doesPositionMatchRule: exact_position sin position_id nunca casa", () => {
  assert.equal(
    doesPositionMatchRule({ position_id: 8 }, { recipient_policy: "exact_position" }),
    false
  );
});

test("doesPositionMatchRule: filtra por cargo antes del alcance de unidad", () => {
  assert.equal(
    doesPositionMatchRule({ cargo_id: 2, unit_id: 5 }, { cargo_id: 3, unit_scope_type: "all_units" }),
    false,
    "cargo distinto corta aunque el alcance sea all_units"
  );
  assert.equal(
    doesPositionMatchRule({ cargo_id: 2, unit_id: 5 }, { cargo_id: 2, unit_scope_type: "all_units" }),
    true
  );
});

test("doesPositionMatchRule: alcance unit_subtree usa el resolver de jerarquía", () => {
  const subtree = (unitId) => (unitId === 1 ? new Set([1, 2, 3]) : new Set([unitId]));
  assert.equal(
    doesPositionMatchRule({ unit_id: 3 }, { unit_scope_type: "unit_subtree", unit_id: 1 }, subtree),
    true
  );
  assert.equal(
    doesPositionMatchRule({ unit_id: 9 }, { unit_scope_type: "unit_subtree", unit_id: 1 }, subtree),
    false
  );
});

test("doesPositionMatchRule: unit_exact / default exige misma unidad", () => {
  assert.equal(doesPositionMatchRule({ unit_id: 5 }, { unit_scope_type: "unit_exact", unit_id: 5 }), true);
  assert.equal(doesPositionMatchRule({ unit_id: 5 }, { unit_scope_type: "unit_exact", unit_id: 6 }), false);
  assert.equal(doesPositionMatchRule({ unit_id: 5 }, { unit_scope_type: "unit_exact" }), false, "sin unit_id no casa");
});

test("buildRuleDisplayLabel prioriza puesto exacto y luego compone unidad|cargo", () => {
  assert.equal(buildRuleDisplayLabel({ position_title: "Decano" }), "Puesto exacto: Decano");
  assert.equal(buildRuleDisplayLabel({ unit_scope_type: "all_units" }), "Todas las unidades");
  assert.equal(
    buildRuleDisplayLabel({ unit_scope_type: "unit_subtree", unit_name: "Facultad", cargo_name: "Director" }),
    "Unidad y jerarquía: Facultad | Cargo: Director"
  );
  assert.equal(buildRuleDisplayLabel({ id: 99 }), "Regla #99", "sin datos, fallback al id");
});

test("buildFillStepDisplayLabel: nombre asignado gana; si no, traduce el resolver", () => {
  assert.equal(buildFillStepDisplayLabel({ assigned_person_name: "Ana" }), "Ana");
  assert.equal(buildFillStepDisplayLabel({ resolver_type: "task_assignee" }), "Responsable de la tarea");
  assert.equal(
    buildFillStepDisplayLabel({ resolver_type: "cargo_in_scope", cargo_name: "Jefe", unit_name: "TI" }),
    "Jefe · TI"
  );
  assert.equal(buildFillStepDisplayLabel({ resolver_type: "desconocido" }), "Responsable no resuelto");
});

test("isPendingLikeFillStatus / isPendingLikeSignatureStatus normalizan y reconocen sinónimos", () => {
  assert.equal(isPendingLikeFillStatus(" Pending "), true);
  assert.equal(isPendingLikeFillStatus("in_progress"), true);
  assert.equal(isPendingLikeFillStatus("done"), false);
  assert.equal(isPendingLikeSignatureStatus("pendiente"), true);
  assert.equal(isPendingLikeSignatureStatus("en_progreso"), true);
  assert.equal(isPendingLikeSignatureStatus("firmado"), false);
});

test("canCurrentUserResetWorkflow: permite si el usuario es el responsable del paso de llenado actual", () => {
  const ok = canCurrentUserResetWorkflow({
    userId: 7,
    fillWorkflow: {
      current_step_order: 2,
      steps: [
        { step_order: 1, assigned_person_id: 5, request_status: "in_progress" },
        { step_order: 2, assigned_person_id: 7, request_status: "pending", responded_at: null }
      ]
    },
    signatureRequests: []
  });
  assert.equal(ok, true);
});

test("canCurrentUserResetWorkflow: niega si el paso actual ya fue respondido o es de otro", () => {
  const respondido = canCurrentUserResetWorkflow({
    userId: 7,
    fillWorkflow: {
      current_step_order: 2,
      steps: [{ step_order: 2, assigned_person_id: 7, request_status: "pending", responded_at: "2024-01-01" }]
    },
    signatureRequests: []
  });
  assert.equal(respondido, false, "responded_at corta el permiso");

  const deOtro = canCurrentUserResetWorkflow({
    userId: 7,
    fillWorkflow: { current_step_order: 1, steps: [{ step_order: 1, assigned_person_id: 99, request_status: "pending" }] },
    signatureRequests: []
  });
  assert.equal(deOtro, false);
});

test("canCurrentUserResetWorkflow: cae a firmas cuando no hay paso de llenado y respeta el orden mínimo pendiente", () => {
  const ok = canCurrentUserResetWorkflow({
    userId: 7,
    fillWorkflow: { current_step_order: 0, steps: [] },
    signatureRequests: [
      { step_order: 3, assigned_person_id: 7, status: "pendiente" },
      { step_order: 2, assigned_person_id: 7, status: "pendiente" }
    ]
  });
  assert.equal(ok, true, "el paso pendiente de menor orden (2) es del usuario 7");

  const noEsElPrimero = canCurrentUserResetWorkflow({
    userId: 7,
    fillWorkflow: { current_step_order: 0, steps: [] },
    signatureRequests: [
      { step_order: 2, assigned_person_id: 99, status: "pendiente" },
      { step_order: 3, assigned_person_id: 7, status: "pendiente" }
    ]
  });
  assert.equal(noEsElPrimero, false, "el firmante pendiente actual (orden 2) no es el usuario");

  assert.equal(
    canCurrentUserResetWorkflow({ userId: 0, fillWorkflow: {}, signatureRequests: [] }),
    false,
    "sin userId nunca autoriza"
  );
});
