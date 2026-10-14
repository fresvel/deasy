// ⚠️ AQUI HABIA CUATRO PRUEBAS DE `unit_subtree`, Y SE FUERON CON EL VALOR (frente 25, P19).
// Fijaban el resolutor del subárbol, su protección contra ciclos y la etiqueta «Unidad y
// jerarquía». El valor se retiró porque un subárbol CRUZA TIPOS DE UNIDAD y por tanto cargos, que
// es incompatible con una regla que hereda el cargo de su línea.

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
  doesPositionMatchRule,
  buildRuleDisplayLabel,
  buildFillStepDisplayLabel,
  estaAbiertoElTurno,
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

test("buildWorkingObjectPathForUpload sanea nombre y extensión y ubica bajo la CORRECCIÓN", () => {
  // La carpeta `m0003` es del 2026-08-23: el almacenamiento pasa a explicarse solo, `v0001/m0003`
  // se lee «ronda 1, corrección 3» sin consultar nada.
  const objectPath = buildWorkingObjectPathForUpload({
    basePath: "5/Documentos/21/v0001",
    originalName: "Mi Archivo Final.PDF",
    extension: "PDF",
    minor: 3
  });
  assert.ok(objectPath.startsWith("5/Documentos/21/v0001/m0003/working/pdf/"), "ronda, corrección y extensión en minúscula");
  assert.ok(objectPath.endsWith("-Mi_Archivo_Final.PDF"), "nombre saneado al final");
  assert.match(objectPath, /working\/pdf\/\d+-[0-9a-f-]{36}-/, "prefijo timestamp-uuid");
});

test("sin corrección indicada cae en la primera, y nunca en cero", () => {
  // El `m0000` no debe existir: la primera subida ES la corrección 1. Un cero ahí seria una carpeta
  // que no corresponde a ninguna fila de la bitácora.
  for (const minor of [undefined, 0, -4, null]) {
    const p = buildWorkingObjectPathForUpload({ basePath: "b", originalName: "a.pdf", extension: "pdf", minor });
    assert.ok(p.startsWith("b/m0001/working/"), `minor=${minor} debe caer en m0001 y vino ${p}`);
  }
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

// ⚠️ LOS CAMPOS LLEVAN PREFIJO `linea_` DESDE `P10` (frente 25, 2026-10-14), y el prefijo ES el
// contrato: el cargo y el ámbito salieron de `process_target_rules` —eran copia de `lineas`— así que
// la fila que entra aquí MEZCLA las dos tablas. Si alguien vuelve a pasar `cargo_id` a secas, el
// predicado deja de filtrar por cargo y **casa con todo el mundo en silencio**: por eso la primera
// aserción de aquí abajo es la que importa.
test("doesPositionMatchRule: filtra por cargo antes del alcance de unidad", () => {
  assert.equal(
    doesPositionMatchRule({ cargo_id: 2, unit_id: 5 }, { linea_cargo_id: 3, linea_unit_scope_type: "all_units" }),
    false,
    "cargo distinto corta aunque el alcance sea all_units"
  );
  assert.equal(
    doesPositionMatchRule({ cargo_id: 2, unit_id: 5 }, { linea_cargo_id: 2, linea_unit_scope_type: "all_units" }),
    true
  );
});

test("doesPositionMatchRule: un cargo SIN prefijo ya no filtra, y hay que saberlo", () => {
  // No es una curiosidad: es el modo de fallo del renombrado. La fila vieja traía `cargo_id`, y con
  // ese nombre el predicado ahora no ve cargo ninguno, así que `all_units` casa con CUALQUIER
  // puesto. Un fallo abierto —de más gente, no de menos— y sin un solo síntoma.
  assert.equal(
    doesPositionMatchRule({ cargo_id: 2 }, { cargo_id: 3, linea_unit_scope_type: "all_units" }),
    true,
    "con el nombre viejo el filtro de cargo desaparece"
  );
});

test("doesPositionMatchRule: unit_exact / default exige misma unidad", () => {
  assert.equal(doesPositionMatchRule({ unit_id: 5 }, { linea_unit_scope_type: "unit_exact", linea_unit_id: 5 }), true);
  assert.equal(doesPositionMatchRule({ unit_id: 5 }, { linea_unit_scope_type: "unit_exact", linea_unit_id: 6 }), false);
  assert.equal(doesPositionMatchRule({ unit_id: 5 }, { linea_unit_scope_type: "unit_exact" }), false, "sin unidad no casa");
});

test("buildRuleDisplayLabel prioriza puesto exacto y luego compone unidad|cargo", () => {
  assert.equal(buildRuleDisplayLabel({ position_title: "Decano" }), "Puesto exacto: Decano");
  assert.equal(buildRuleDisplayLabel({ linea_unit_scope_type: "all_units" }), "Todas las unidades");
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

test("estaAbiertoElTurno normaliza, y vale para los DOS lados", () => {
  // Una sola funcion desde la fase 3 del frente 24: eran dos, una por idioma.
  assert.equal(estaAbiertoElTurno(" Pendiente "), true);
  assert.equal(estaAbiertoElTurno("en_progreso"), true);
  assert.equal(estaAbiertoElTurno("completado"), false);
  // Y el vocabulario viejo ya NO se reconoce: tolerarlo era lo que escondia los dos idiomas.
  assert.equal(estaAbiertoElTurno("pending"), false);
  assert.equal(estaAbiertoElTurno("in_progress"), false);
  assert.equal(estaAbiertoElTurno("firmado"), false);
});

/* ⚠️ ESTOS FIXTURES SE ESCRIBEN CON LA FORMA QUE EL PANEL EMITE, no con una inventada: son la
   forma de `fillWorkflow` que construye `user_controler.panel.js` (`paso_actual`, `pasos`, y el
   `estado` de cada paso). Lo dice aqui porque el 2026-10-09 estas tres pruebas SIGUIERON EN VERDE
   mientras la funcion devolvia false para todo el mundo: el panel habia renombrado sus claves y el
   fixture, al ser propio, no se enteraba. Si cambias la forma del panel, cambia esto. */
test("canCurrentUserResetWorkflow: permite si el usuario es el responsable del paso de llenado actual", () => {
  const ok = canCurrentUserResetWorkflow({
    userId: 7,
    fillWorkflow: {
      paso_actual: 2,
      pasos: [
        { step_order: 1, assigned_person_id: 5, estado: "en_progreso" },
        { step_order: 2, assigned_person_id: 7, estado: "pendiente", responded_at: null }
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
      paso_actual: 2,
      pasos: [{ step_order: 2, assigned_person_id: 7, estado: "pendiente", responded_at: "2024-01-01" }]
    },
    signatureRequests: []
  });
  assert.equal(respondido, false, "responded_at corta el permiso");

  const deOtro = canCurrentUserResetWorkflow({
    userId: 7,
    fillWorkflow: { paso_actual: 1, pasos: [{ step_order: 1, assigned_person_id: 99, estado: "pendiente" }] },
    signatureRequests: []
  });
  assert.equal(deOtro, false);
});

test("canCurrentUserResetWorkflow: cae a firmas cuando no hay paso de llenado y respeta el orden mínimo pendiente", () => {
  const ok = canCurrentUserResetWorkflow({
    userId: 7,
    fillWorkflow: { paso_actual: 0, pasos: [] },
    signatureRequests: [
      { step_order: 3, assigned_person_id: 7, status: "pendiente" },
      { step_order: 2, assigned_person_id: 7, status: "pendiente" }
    ]
  });
  assert.equal(ok, true, "el paso pendiente de menor orden (2) es del usuario 7");

  const noEsElPrimero = canCurrentUserResetWorkflow({
    userId: 7,
    fillWorkflow: { paso_actual: 0, pasos: [] },
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
