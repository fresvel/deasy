// Tests unitarios de las reglas de negocio del CRUD administrativo.
//
// `validateTableRules` es la última barrera antes de escribir en ~24 tablas del
// núcleo del motor de procesos (complejidad cognitiva 99). Un `case` roto deja
// entrar datos inconsistentes: series sin origen, versiones sin semver, documentos
// huérfanos.
//
// Ojo con lo que estos tests NO dicen: en producción, `SqlAdminService.create()`
// comprueba los campos requeridos antes de llamar aquí, y algunas tablas tienen
// guards propios aún antes. El mensaje que ve el usuario está fijado por los
// characterization tests (`flows/admin_crud.test.mjs`); aquí se prueba la función
// aislada.

import test from "node:test";
import assert from "node:assert/strict";

import {
  validateTableRules,
  ensureDateOrder,
  parseJsonObject,
} from "./validation.js";

const throwsWith = (fn, fragment) =>
  assert.throws(fn, (error) => error.message.includes(fragment), `debía mencionar "${fragment}"`);

// --- Tabla sin reglas ---------------------------------------------------------

test("validateTableRules no hace nada con una tabla sin reglas", () => {
  assert.doesNotThrow(() => validateTableRules("tabla_cualquiera", {}));
  assert.doesNotThrow(() => validateTableRules("vacancies", {}));
  assert.doesNotThrow(() => validateTableRules("processes", {}));
  assert.doesNotThrow(() => validateTableRules("role_assignments", {}));
});

// --- Tablas de reglas declarativas -------------------------------------------
// Diez tablas cuya regla entera es "estos campos, en este orden, y opcionalmente
// las fechas al final". Antes del cut #10 eran `case` de un switch sin ninguna
// prueba propia; se fijan aquí porque el orden de los mensajes ES el contrato:
// el primer campo ausente decide qué ve el usuario.

test("validateTableRules exige los campos del periodo de una configuracion, en orden", () => {
  throwsWith(
    () => validateTableRules("process_definition_period_types", {}),
    "Selecciona una configuracion de proceso.",
  );
  throwsWith(
    () => validateTableRules("process_definition_period_types", { process_definition_id: 1 }),
    "Selecciona el tipo de periodo en que corre el proceso.",
  );
  assert.doesNotThrow(() =>
    validateTableRules("process_definition_period_types", { process_definition_id: 1, term_type_id: 2 }),
  );
});

test("validateTableRules exige configuracion y periodo antes de mirar las fechas de la tarea", () => {
  throwsWith(() => validateTableRules("tasks", {}), "Selecciona una configuracion de proceso.");
  throwsWith(
    () => validateTableRules("tasks", { process_definition_id: 1 }),
    "Selecciona un periodo para la tarea.",
  );
  // Con un requerido ausente gana su mensaje aunque las fechas también estén mal.
  throwsWith(
    () => validateTableRules("tasks", { process_definition_id: 1, start_date: "2026-06-01", end_date: "2026-01-01" }),
    "Selecciona un periodo para la tarea.",
  );
  throwsWith(
    () =>
      validateTableRules("tasks", {
        process_definition_id: 1,
        term_id: 3,
        start_date: "2026-06-01",
        end_date: "2026-01-01",
      }),
    "en tareas",
  );
  assert.doesNotThrow(() => validateTableRules("tasks", { process_definition_id: 1, term_id: 3 }));
});

test("validateTableRules exige la plantilla de proceso configurado en los dos tipos de flujo", () => {
  for (const table of ["fill_flow_templates", "signature_flow_templates"]) {
    throwsWith(
      () => validateTableRules(table, {}),
      "Selecciona la plantilla de proceso configurado.",
    );
    assert.doesNotThrow(() => validateTableRules(table, { process_definition_template_id: 7 }));
  }
});

test("validateTableRules exige plantilla y orden en un paso de entrega", () => {
  throwsWith(() => validateTableRules("fill_flow_steps", {}), "Selecciona la plantilla de entrega.");
  throwsWith(
    () => validateTableRules("fill_flow_steps", { fill_flow_template_id: 4 }),
    "Define el orden del paso.",
  );
  // Semántica falsy deliberada: el paso 0 NO es un orden válido hoy.
  throwsWith(
    () => validateTableRules("fill_flow_steps", { fill_flow_template_id: 4, step_order: 0 }),
    "Define el orden del paso.",
  );
  assert.doesNotThrow(() => validateTableRules("fill_flow_steps", { fill_flow_template_id: 4, step_order: 1 }));
});

test("validateTableRules exige plantilla y version en una instancia de entrega", () => {
  throwsWith(() => validateTableRules("document_fill_flows", {}), "Selecciona la plantilla de entrega.");
  throwsWith(
    () => validateTableRules("document_fill_flows", { fill_flow_template_id: 4 }),
    "Selecciona la version de documento.",
  );
  assert.doesNotThrow(() =>
    validateTableRules("document_fill_flows", { fill_flow_template_id: 4, document_version_id: 9 }),
  );
});

test("validateTableRules exige instancia y paso en una solicitud de entrega", () => {
  throwsWith(() => validateTableRules("fill_requests", {}), "Selecciona la instancia de entrega.");
  throwsWith(
    () => validateTableRules("fill_requests", { document_fill_flow_id: 2 }),
    "Selecciona el paso de entrega.",
  );
  assert.doesNotThrow(() =>
    validateTableRules("fill_requests", { document_fill_flow_id: 2, fill_flow_step_id: 5 }),
  );
});

test("validateTableRules exige tarea y puesto en una asignacion", () => {
  throwsWith(() => validateTableRules("task_assignments", {}), "Selecciona una tarea para asignar.");
  throwsWith(
    () => validateTableRules("task_assignments", { task_id: 1 }),
    "Selecciona un puesto para la asignacion.",
  );
  assert.doesNotThrow(() => validateTableRules("task_assignments", { task_id: 1, position_id: 6 }));
});

test("validateTableRules valida las fechas de periodos y contratos con su propia etiqueta", () => {
  throwsWith(
    () => validateTableRules("terms", { start_date: "2026-06-01", end_date: "2026-01-01" }),
    "en periodos",
  );
  throwsWith(
    () => validateTableRules("contracts", { start_date: "2026-06-01", end_date: "2026-01-01" }),
    "en contratos",
  );
  assert.doesNotThrow(() => validateTableRules("terms", {}));
  assert.doesNotThrow(() => validateTableRules("contracts", { start_date: "2026-01-01", end_date: "2026-06-01" }));
});

// --- process_definition_series: origen excluyente ----------------------------

test("validateTableRules exige un origen de serie válido", () => {
  throwsWith(() => validateTableRules("process_definition_series", {}), "origen de la serie");
  throwsWith(
    () => validateTableRules("process_definition_series", { source_type: "inventado" }),
    "origen de la serie",
  );
});

test("validateTableRules exige el discriminante que corresponde a cada origen", () => {
  throwsWith(
    () => validateTableRules("process_definition_series", { source_type: "unit_type" }),
    "requiere seleccionar un tipo de unidad",
  );
  throwsWith(
    () => validateTableRules("process_definition_series", { source_type: "cargo" }),
    "requiere seleccionar un cargo",
  );
});

test("validateTableRules prohíbe mezclar tipo de unidad y cargo en una serie", () => {
  throwsWith(
    () => validateTableRules("process_definition_series", { source_type: "unit_type", unit_type_id: 1, cargo_id: 2 }),
    "no admite cargo",
  );
  throwsWith(
    () => validateTableRules("process_definition_series", { source_type: "cargo", cargo_id: 2, unit_type_id: 1 }),
    "no admite tipo de unidad",
  );
  throwsWith(
    () => validateTableRules("process_definition_series", { source_type: "default", cargo_id: 2 }),
    "no admite tipo de unidad ni cargo",
  );
});

test("validateTableRules acepta las series bien formadas", () => {
  assert.doesNotThrow(() => validateTableRules("process_definition_series", { source_type: "unit_type", unit_type_id: 1 }));
  assert.doesNotThrow(() => validateTableRules("process_definition_series", { source_type: "cargo", cargo_id: 2 }));
  assert.doesNotThrow(() => validateTableRules("process_definition_series", { source_type: "default" }));
});

// --- process_definition_versions: semver de tres segmentos -------------------

test("validateTableRules exige un semver de tres segmentos en la configuración", () => {
  const base = { process_id: 1, series_id: 1, effective_from: "2026-01-01" };
  throwsWith(
    () => validateTableRules("process_definition_versions", { ...base, definition_version: "1.0" }),
    "tres segmentos",
  );
  assert.doesNotThrow(() =>
    validateTableRules("process_definition_versions", { ...base, definition_version: "1.0.0" }),
  );
});

test("validateTableRules valida el orden de las fechas de vigencia", () => {
  throwsWith(
    () =>
      validateTableRules("process_definition_versions", {
        process_id: 1,
        series_id: 1,
        definition_version: "1.0.0",
        effective_from: "2026-06-01",
        effective_to: "2026-01-01",
      }),
    "posterior a la fecha de inicio",
  );
});

// --- process_target_rules -----------------------------------------------------

test("validateTableRules exige puesto exacto cuando la política lo es", () => {
  throwsWith(
    () =>
      validateTableRules("process_target_rules", {
        process_definition_id: 1,
        recipient_policy: "exact_position",
      }),
    "requiere un puesto exacto",
  );
});

test("validateTableRules exige una base para el alcance por unidad", () => {
  throwsWith(
    () => validateTableRules("process_target_rules", { process_definition_id: 1, unit_scope_type: "unit_subtree" }),
    "requiere una unidad base",
  );
  // Un puesto sirve como base, no solo la unidad.
  assert.doesNotThrow(() =>
    validateTableRules("process_target_rules", {
      process_definition_id: 1,
      unit_scope_type: "unit_subtree",
      position_id: 5,
    }),
  );
});

// --- task_items: el entregable depende del origen -----------------------------

test("validateTableRules exige el entregable solo si el item nace del proceso", () => {
  const base = { task_id: 1, template_artifact_id: 9 };
  throwsWith(
    () => validateTableRules("task_items", { ...base }),
    "entregable definido por proceso",
  );
  // origin_kind distinto de "process_defined" libera el requisito.
  assert.doesNotThrow(() => validateTableRules("task_items", { ...base, origin_kind: "ad_hoc" }));
});

// --- documents / document_versions: NORMALIZACIÓN IN-PLACE -------------------
// Estas dos ramas no solo validan: MUTAN el candidato. Un refactor que las mueva
// sin preservar la mutación rompería la escritura sin que ningún error lo delate.

test("validateTableRules normaliza el estado del documento in-place", () => {
  const candidate = { owner_person_id: 3, status: "rechazado" };
  validateTableRules("documents", candidate);
  assert.equal(candidate.status, "Observado", "el estado legacy debe quedar normalizado en el candidato");
});

test("validateTableRules no inventa un estado si el candidato no lo trae", () => {
  const candidate = { owner_person_id: 3 };
  validateTableRules("documents", candidate);
  assert.equal("status" in candidate, false);
});

test("validateTableRules normaliza el estado de la versión documental in-place", () => {
  const candidate = { status: "aprobado" };
  validateTableRules("document_versions", candidate);
  assert.equal(candidate.status, "Final");
});

test("validateTableRules exige un documento con item de tarea o propietario", () => {
  throwsWith(() => validateTableRules("documents", {}), "item de tarea o define un propietario");
  assert.doesNotThrow(() => validateTableRules("documents", { task_item_id: 1 }));
});

test("validateTableRules rechaza una versión documental menor que 0.1", () => {
  throwsWith(() => validateTableRules("document_versions", { version: 0 }), "mayor o igual a 0.1");
  throwsWith(() => validateTableRules("document_versions", { version: "abc" }), "mayor o igual a 0.1");
  assert.doesNotThrow(() => validateTableRules("document_versions", { version: 0.1 }));
});

// --- template_artifacts -------------------------------------------------------

test("validateTableRules exige al menos un formato disponible en el artifact", () => {
  throwsWith(
    () => validateTableRules("template_artifacts", { base_object_prefix: "x", available_formats: "{}" }),
    "al menos un formato",
  );
  assert.doesNotThrow(() =>
    validateTableRules("template_artifacts", {
      base_object_prefix: "x",
      available_formats: '{"pdf":"x/doc.pdf"}',
    }),
  );
});

// --- Guards INTERCALADOS ------------------------------------------------------
// Cuatro tablas no comprueban "todos los requeridos y luego lo demás": meten un
// condicional o las fechas EN MEDIO de sus requeridos. El orden es el contrato —
// decide qué mensaje ve el usuario — y es lo primero que rompería un refactor que
// las normalizara a la plantilla declarativa. Estos tests lo clavan.

test("process_target_rules valida las fechas ANTES que su configuracion requerida", () => {
  // Con ambas cosas mal, gana la fecha: el ensureDateOrder va primero en el cuerpo.
  throwsWith(
    () => validateTableRules("process_target_rules", { effective_from: "2026-06-01", effective_to: "2026-01-01" }),
    "en reglas de alcance",
  );
  throwsWith(() => validateTableRules("process_target_rules", {}), "Selecciona una configuracion de proceso.");
  throwsWith(
    () => validateTableRules("process_target_rules", { process_definition_id: 1, unit_scope_type: "unit_type" }),
    "El alcance por tipo requiere un tipo de unidad.",
  );
  assert.doesNotThrow(() => validateTableRules("process_target_rules", { process_definition_id: 1 }));
});

test("process_definition_versions intercala el semver entre sus requeridos", () => {
  throwsWith(() => validateTableRules("process_definition_versions", {}), "Selecciona un proceso base");
  throwsWith(
    () => validateTableRules("process_definition_versions", { process_id: 1 }),
    "Selecciona una serie de configuracion.",
  );
  // El semver se exige ANTES que effective_from, aunque este también falte.
  throwsWith(
    () => validateTableRules("process_definition_versions", { process_id: 1, series_id: 1 }),
    "tres segmentos",
  );
  throwsWith(
    () => validateTableRules("process_definition_versions", { process_id: 1, series_id: 1, definition_version: "1.0.0" }),
    "Selecciona la fecha de vigencia inicial",
  );
});

test("task_items intercala el guard de origen entre sus dos requeridos", () => {
  throwsWith(() => validateTableRules("task_items", {}), "Selecciona una tarea.");
  // Sin origin_kind explícito cuenta como "process_defined", y ese guard gana al
  // requerido de plantilla documental que viene después.
  throwsWith(
    () => validateTableRules("task_items", { task_id: 1 }),
    "entregable definido por proceso",
  );
  throwsWith(
    () => validateTableRules("task_items", { task_id: 1, origin_kind: "ad_hoc" }),
    "Selecciona la plantilla documental.",
  );
  throwsWith(
    () =>
      validateTableRules("task_items", {
        task_id: 1,
        origin_kind: "ad_hoc",
        template_artifact_id: 3,
        start_date: "2026-06-01",
        end_date: "2026-01-01",
      }),
    "en items de tarea",
  );
});

test("template_artifacts exige el prefijo base antes de mirar los formatos", () => {
  throwsWith(
    () => validateTableRules("template_artifacts", { available_formats: "{}" }),
    "Debes registrar el prefijo base del artifact.",
  );
  throwsWith(
    () => validateTableRules("template_artifacts", { base_object_prefix: "x" }),
    "al menos un formato",
  );
});

// --- Las dos tablas restantes sin cobertura -----------------------------------

test("unit_relations solo compara padre e hija cuando llegan las dos", () => {
  throwsWith(
    () => validateTableRules("unit_relations", { parent_unit_id: 4, child_unit_id: 4 }),
    "no pueden ser la misma",
  );
  // Comparación numérica: "4" y 4 son la misma unidad.
  throwsWith(
    () => validateTableRules("unit_relations", { parent_unit_id: "4", child_unit_id: 4 }),
    "no pueden ser la misma",
  );
  assert.doesNotThrow(() => validateTableRules("unit_relations", { parent_unit_id: 4, child_unit_id: 5 }));
  // Con una sola de las dos no valida nada: el mensaje real lo da el hook de create().
  assert.doesNotThrow(() => validateTableRules("unit_relations", { parent_unit_id: 4 }));
  assert.doesNotThrow(() => validateTableRules("unit_relations", {}));
});

test("template_seeds exige codigo y ruta fuente con un unico mensaje", () => {
  throwsWith(() => validateTableRules("template_seeds", {}), "codigo y la ruta fuente");
  throwsWith(() => validateTableRules("template_seeds", { seed_code: "x" }), "codigo y la ruta fuente");
  throwsWith(() => validateTableRules("template_seeds", { source_path: "y" }), "codigo y la ruta fuente");
  assert.doesNotThrow(() => validateTableRules("template_seeds", { seed_code: "x", source_path: "y" }));
});

test("document_versions ignora la version cuando el candidato no la trae", () => {
  assert.doesNotThrow(() => validateTableRules("document_versions", {}));
});

// --- Helpers extraídos junto a la función -------------------------------------

test("ensureDateOrder solo se queja cuando el fin precede al inicio", () => {
  assert.doesNotThrow(() => ensureDateOrder("2026-01-01", "2026-06-01", "pruebas"));
  assert.doesNotThrow(() => ensureDateOrder("2026-01-01", null, "pruebas"), "sin fecha de fin no valida nada");
  assert.doesNotThrow(() => ensureDateOrder(null, "2026-01-01", "pruebas"));
  throwsWith(() => ensureDateOrder("2026-06-01", "2026-01-01", "pruebas"), "en pruebas");
});

test("parseJsonObject acepta objetos y JSON de objeto, y rechaza el resto", () => {
  assert.deepEqual(parseJsonObject({ a: 1 }, "campo"), { a: 1 });
  assert.deepEqual(parseJsonObject('{"a":1}', "campo"), { a: 1 });
  assert.equal(parseJsonObject("", "campo"), null);
  assert.equal(parseJsonObject(null, "campo"), null);
  throwsWith(() => parseJsonObject("[1,2]", "campo"), "JSON valido");
  throwsWith(() => parseJsonObject("{roto", "campo"), "JSON valido");
  throwsWith(() => parseJsonObject(42, "campo"), "JSON valido");
});
