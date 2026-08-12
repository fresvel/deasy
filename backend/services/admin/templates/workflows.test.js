// Tests unitarios de los flujos de llenado y firma.
//
// Es el corazón del contrato de firma, y su lógica es silenciosa: normaliza y
// DESCARTA sin lanzar errores. Un firmante que desaparece de un flujo legal no da
// ningún síntoma hasta que alguien no puede firmar. Estos tests fijan qué se
// conserva y qué se descarta.

import test from "node:test";
import assert from "node:assert/strict";

import {
  authoredWorkflowHasSteps,
  buildStepResolver,
  buildWorkflowsDocument,
  normalizeFillSteps,
  normalizeSignatureSigner,
  normalizeSignatureSteps,
  resolveStepCargoId,
  collectAuthoredWorkflowIssues,
  webFillResolverTypesForScope,
  FILL_RESOLVER_TYPES,
  FILL_UNIT_SCOPE_TYPES,
  SIGNATURE_RESOLVER_TYPES,
  SIGNATURE_UNIT_SCOPE_TYPES,
} from "./workflows.js";

// --- authoredWorkflowHasSteps: ¿hay flujo que ESCRIBIR? ----------------------
//
// Es el predicado que decide si `_persistAuthoredFlow` inserta filas. Sustituye a los dos
// `isArtifact*WorkflowSyncEnabled` del sub-paso 8 del §0.8, que además exigían
// `sync_mode: "artifact_to_db"` — una clave del `meta.yaml` que ya no existe. Estos tests fijan que
// los otros dos términos se conservan: si alguien vuelve a añadir un tercero, el escritor deja de
// escribir EN SILENCIO, que es el modo de fallo que este sub-paso tenía que evitar.

test("authoredWorkflowHasSteps exige required y al menos un paso", () => {
  const ok = { required: true, steps: [{ order: 1 }] };
  assert.equal(authoredWorkflowHasSteps(ok), true);
  assert.equal(authoredWorkflowHasSteps({ ...ok, steps: [] }), false, "sin pasos no hay nada que escribir");
  assert.equal(authoredWorkflowHasSteps({ ...ok, required: false }), false);
  assert.equal(authoredWorkflowHasSteps({}), false);
  assert.equal(authoredWorkflowHasSteps(), false);
});

test("authoredWorkflowHasSteps NO mira sync_mode (la clave del meta.yaml retirado)", () => {
  // El documento que produce `buildWorkflowsDocument` ya no lleva `sync_mode`. Si el predicado lo
  // exigiera, el flujo autorado no se escribiría nunca y no fallaría nada.
  const doc = buildWorkflowsDocument({ fillWorkflow: { steps: [{ order: 1, name: "Entrega" }] } });
  assert.equal(Object.hasOwn(doc.workflows.fill, "sync_mode"), false, "el documento ya no emite sync_mode");
  assert.equal(authoredWorkflowHasSteps(doc.workflows.fill), true);
});

// --- buildStepResolver: qué campos emite según el tipo -----------------------

test("buildStepResolver usa task_assignee/auto_one por defecto", () => {
  assert.deepEqual(buildStepResolver({}), { type: "task_assignee", selection_mode: "auto_one" });
});

test("buildStepResolver para cargo en unidad exacta incluye unit_id, no unit_type_id", () => {
  const r = buildStepResolver({
    resolver_type: "cargo_in_scope",
    cargo_id: "4",
    unit_scope_type: "unit_exact",
    unit_id: "8",
    unit_type_id: "3",
  });
  assert.equal(r.type, "cargo_in_scope");
  assert.equal(r.cargo_id, 4);
  assert.equal(r.unit_id, 8);
  assert.equal(r.unit_scope_type, "unit_exact");
  assert.equal("unit_type_id" in r, false, "unit_exact no fija unit_type_id");
});

test("buildStepResolver para un tipo de unidad incluye unit_type_id, no unit_id", () => {
  const r = buildStepResolver({
    resolver_type: "cargo_in_scope",
    cargo_id: 4,
    unit_scope_type: "unit_type",
    unit_id: 8,
    unit_type_id: 3,
  });
  assert.equal(r.unit_type_id, 3);
  assert.equal("unit_id" in r, false, "un tipo de unidad no fija una unidad concreta");
});

// --- LOS SEIS RESOLUTORES RETIRADOS (sub-paso 8 del §0.8, decision 1) --------
//
// «Lo que la web no autora, no existe». El `meta.yaml` era el unico productor de `document_owner`,
// `position`, `manual_pick`, `context_subtree` y `context_ancestor_type`.
//
// Estos tests existen por la TRAMPA DE ORDEN que el plan avisa: retirar un tipo del catalogo mientras
// aun tuviera productor no habria fallado, habria DEGRADADO el paso en silencio a `manual_pick`, que
// resuelve a nadie. Fijan las dos mitades: que el catalogo no los acepta, y que lo dice en voz alta.

test("los cinco resolutores/ambitos retirados ya no estan en ningun catalogo", () => {
  for (const tipo of ["document_owner", "position", "manual_pick"]) {
    assert.equal(FILL_RESOLVER_TYPES.has(tipo), false, `entrega: ${tipo} sigue vivo`);
    assert.equal(SIGNATURE_RESOLVER_TYPES.has(tipo), false, `firma: ${tipo} sigue vivo`);
  }
  for (const ambito of ["context_subtree", "context_ancestor_type"]) {
    assert.equal(FILL_UNIT_SCOPE_TYPES.has(ambito), false, `entrega: ${ambito} sigue vivo`);
    assert.equal(SIGNATURE_UNIT_SCOPE_TYPES.has(ambito), false, `firma: ${ambito} sigue vivo`);
  }
});

test("los que SI tienen productor se quedan: specific_person, unit_subtree y all_units", () => {
  // `specific_person` se retiraba solo «en plantillas official», y eso lo decide el gating por scope,
  // no el catalogo: en `ad_hoc` la web sí lo autora. `unit_subtree` y `all_units` no los ofrece el
  // formulario, pero `materializeRuntimeFlowForTaskItem` deriva `all_units` en el flujo de runtime.
  assert.equal(FILL_RESOLVER_TYPES.has("specific_person"), true);
  assert.equal(webFillResolverTypesForScope("ad_hoc").has("specific_person"), true);
  assert.equal(webFillResolverTypesForScope("official").has("specific_person"), false);
  assert.equal(FILL_UNIT_SCOPE_TYPES.has("all_units"), true);
  assert.equal(FILL_UNIT_SCOPE_TYPES.has("unit_subtree"), true);
});

test("normalizeFillSteps LANZA ante un resolutor retirado, en vez de degradarlo en silencio", () => {
  // El fallback antiguo convertia cualquier tipo desconocido en `manual_pick`, que resuelve a NADIE:
  // el paso se materializaba y no se asignaba a nadie, sin un solo sintoma. Y desde que `manual_pick`
  // sale del catalogo, ese mismo fallback reventaria contra el CHECK de la tabla en tiempo de
  // ejecucion. Un error de autoria con el nombre del tipo dentro es lo unico que se lee.
  const conRetirado = { steps: [{ order: 1, resolver: { type: "document_owner" } }] };
  assert.throws(() => normalizeFillSteps(conRetirado), /document_owner/);
  const inventado = { steps: [{ order: 1, resolver: { type: "lo_que_sea" } }] };
  assert.throws(() => normalizeFillSteps(inventado), /lo_que_sea/);
});

test("normalizeFillSteps sigue aceptando los tres que quedan", () => {
  const ok = {
    steps: [
      { order: 1, resolver: { type: "task_assignee" } },
      { order: 2, resolver: { type: "cargo_in_scope", cargo_id: 4 } },
      { order: 3, resolver: { type: "specific_person", person_id: 7 } },
    ],
  };
  assert.deepEqual(
    normalizeFillSteps(ok).map((paso) => paso.resolverType),
    ["task_assignee", "cargo_in_scope", "specific_person"],
  );
});

test("buildStepResolver para persona específica solo lleva person_id", () => {
  const r = buildStepResolver({ resolver_type: "specific_person", person_id: "7" });
  assert.deepEqual(r, { type: "specific_person", selection_mode: "auto_one", person_id: 7 });
});

// --- resolveStepCargoId: id directo, o código/alias contra el catálogo -------

const cargoCodeMap = new Map([
  ["coordinador", 1],
  ["director", 4],
  ["responsable", 3],
]);

test("resolveStepCargoId prefiere el cargo_id directo", () => {
  assert.equal(resolveStepCargoId({ cargo_id: "9" }, "", cargoCodeMap), 9);
});

test("resolveStepCargoId resuelve por código contra el catálogo", () => {
  assert.equal(resolveStepCargoId({ cargo_code: "director" }, "", cargoCodeMap), 4);
});

test("resolveStepCargoId resuelve un alias antes de buscar en el catálogo", () => {
  // "director_escuela" es alias de "director" (CARGO_CODE_ALIASES).
  assert.equal(resolveStepCargoId({ cargo_code: "director_escuela" }, "", cargoCodeMap), 4);
  assert.equal(resolveStepCargoId({ cargo_code: "coordinador_carrera" }, "", cargoCodeMap), 1);
});

test("resolveStepCargoId devuelve null si el código no está en el catálogo", () => {
  assert.equal(resolveStepCargoId({ cargo_code: "inexistente" }, "", cargoCodeMap), null);
  assert.equal(resolveStepCargoId({}, "", cargoCodeMap), null);
});

// --- normalizeSignatureSigner: cómo un cargo se vuelve resoluble --------------

test("normalizeSignatureSigner resuelve el cargo requerido por alias", () => {
  const s = normalizeSignatureSigner(
    { type: "cargo_in_scope", cargo_code: "director_escuela" },
    { cargoCodeMap },
  );
  assert.equal(s.requiredCargoId, 4);
  assert.equal(s.resolverType, "cargo_in_scope");
});

test("normalizeSignatureSigner cae a valores seguros ante campos inválidos", () => {
  const s = normalizeSignatureSigner({ type: "loquesea", selection_mode: "xxx", unit_scope_type: "yyy" });
  assert.equal(s.resolverType, "cargo_in_scope");
  assert.equal(s.selectionMode, "auto_all");
  assert.equal(s.unitScopeType, "context_exact");
});

// --- normalizeSignatureSteps: los DESCARTES silenciosos ----------------------

test("normalizeSignatureSteps descarta el firmante por cargo sin cargo resoluble", () => {
  const wf = {
    steps: [
      { order: 1, signers: [{ type: "cargo_in_scope", cargo_code: "no-existe" }] },
    ],
  };
  // El único firmante no resuelve -> el paso se queda sin firmantes -> no se materializa.
  assert.deepEqual(normalizeSignatureSteps(wf, { cargoCodeMap }), []);
});

test("normalizeSignatureSteps conserva el paso si al menos un firmante resuelve", () => {
  const wf = {
    steps: [
      {
        order: 1,
        signers: [
          { type: "cargo_in_scope", cargo_code: "no-existe" },
          { type: "cargo_in_scope", cargo_code: "director" },
        ],
      },
    ],
  };
  const out = normalizeSignatureSteps(wf, { cargoCodeMap });
  assert.equal(out.length, 1);
  assert.equal(out[0].signers.length, 1, "solo sobrevive el firmante resoluble");
  assert.equal(out[0].signers[0].requiredCargoId, 4);
});

test("normalizeSignatureSteps ordena los pasos por order y espeja el firmante principal", () => {
  const wf = {
    steps: [
      { order: 2, signers: [{ type: "specific_person", person_id: 5 }] },
      { order: 1, signers: [{ type: "specific_person", person_id: 7 }] },
    ],
  };
  const out = normalizeSignatureSteps(wf);
  assert.deepEqual(out.map((s) => s.stepOrder), [1, 2]);
  assert.equal(out[0].assignedPersonId, 7, "las columnas del paso espejan el primer firmante");
});

test("normalizeSignatureSteps admite la meta antigua con un único resolver", () => {
  const wf = { steps: [{ order: 1, resolver: { type: "specific_person", person_id: 7 } }] };
  const out = normalizeSignatureSteps(wf);
  assert.equal(out.length, 1);
  assert.equal(out[0].signers[0].assignedPersonId, 7);
});

test("normalizeSignatureSteps normaliza un approval_mode inválido a 'and'", () => {
  const wf = { steps: [{ order: 1, approval_mode: "loquesea", signers: [{ type: "specific_person", person_id: 7 }] }] };
  assert.equal(normalizeSignatureSteps(wf)[0].approvalMode, "and");
});

// --- buildWorkflowsDocument: la ENTRADA del escritor directo ------------------
//
// Hasta el sub-paso 8 del §0.8 este objeto tenía dos consumidores —`buildWorkflowsYaml`, que lo
// serializaba al `meta.yaml`, y el escritor directo, que lo normaliza e inserta— y los tests de
// aquí fijaban la equivalencia entre los dos. Retirada la serialización, queda un solo consumidor y
// lo que hay que fijar es lo que el documento LLEVA, que es de donde salen las columnas.

test("buildWorkflowsDocument deriva can_reject del orden del paso", () => {
  const doc = buildWorkflowsDocument({
    fillWorkflow: { steps: [{ order: 1, name: "Entrega" }, { order: 2, name: "Revisión" }] },
  });
  // El primer paso nunca puede devolver (no hay paso anterior); el segundo sí.
  assert.equal(doc.workflows.fill.steps[0].can_reject, false);
  assert.equal(doc.workflows.fill.steps[1].can_reject, true);
});

test("buildWorkflowsDocument marca signatures.required solo si hay pasos de firma", () => {
  const sinFirmas = buildWorkflowsDocument({ signatureWorkflow: { required: true, steps: [] } });
  assert.equal(sinFirmas.workflows.signatures.required, false, "sin pasos, la firma no es requerida");
});

test("buildWorkflowsDocument conserva code y name del paso de entrega", () => {
  const doc = buildWorkflowsDocument({
    fillWorkflow: { steps: [{ order: 1, code: "entrega", name: "Entrega" }] },
  });

  assert.equal(doc.workflows.fill.steps[0].code, "entrega");
  assert.equal(doc.workflows.fill.steps[0].name, "Entrega");
});

test("normalizeFillSteps propaga code y name del paso de entrega", () => {
  // La regresión que esto evita: las columnas existían (sub-paso 1-bis) pero el normalizador las
  // descartaba, así que el nombre del paso solo vivía en el `meta.yaml` y la inversión lo perdía.
  const doc = buildWorkflowsDocument({
    fillWorkflow: { steps: [{ order: 1, code: "owner_fill", name: "Entrega del responsable" }] },
  });
  const [paso] = normalizeFillSteps(doc.workflows.fill);

  assert.equal(paso.code, "owner_fill");
  assert.equal(paso.name, "Entrega del responsable");
});

test("normalizeFillSteps deja code en null cuando el paso no lo trae", () => {
  // `buildWorkflowsDocument` solo emite `code` si el formulario lo mandó, pero SIEMPRE emite `name`
  // (con el relleno "Paso N"). Las columnas son NULLABLE justo por esto.
  const doc = buildWorkflowsDocument({ fillWorkflow: { steps: [{ order: 2 }] } });
  const [paso] = normalizeFillSteps(doc.workflows.fill);

  assert.equal(paso.code, null);
  assert.equal(paso.name, "Paso 2");
});

// --- collectAuthoredWorkflowIssues -------------------------------------------------------------
// 216 líneas de validación que decidían si se puede guardar un flujo autorado y NO tenían un solo
// test. Es la puerta de todo el editor de flujos: un falso "válido" deja pasos que no resolverán
// nunca, y un falso "inválido" bloquea al usuario sin motivo. Estos tests son su red antes de
// partir la función.

const collect = (overrides = {}) =>
  collectAuthoredWorkflowIssues({
    fillWorkflow: null,
    signatureWorkflow: null,
    ...overrides,
  });

const fillStep = (extra = {}) => ({ order: 1, resolver_type: "task_assignee", ...extra });

test("collectAuthoredWorkflowIssues: sin flujos no hay nada que objetar", () => {
  assert.deepEqual(collect(), { errors: [], warnings: [] });
  assert.deepEqual(collect({ fillWorkflow: { steps: [] } }), { errors: [], warnings: [] });
});

test("collectAuthoredWorkflowIssues: el orden debe ser entero >= 1 y sin repetir", () => {
  const sinOrden = collect({ fillWorkflow: { steps: [fillStep({ order: 0 })] } });
  assert.match(sinOrden.errors[0], /el orden debe ser un entero/);

  const duplicado = collect({
    fillWorkflow: { steps: [fillStep({ order: 1 }), fillStep({ order: 1 })] },
  });
  assert.match(duplicado.errors[0], /orden duplicado \(1\)/);
});

test("collectAuthoredWorkflowIssues: el tipo de responsable depende del ámbito de la plantilla", () => {
  const steps = [fillStep({ resolver_type: "specific_person", person_id: 1 })];
  // `specific_person` solo existe en plantillas ad_hoc.
  const oficial = collect({ fillWorkflow: { steps }, templateScope: "official" });
  assert.match(oficial.errors[0], /responsable no permitido/);
  assert.match(oficial.errors[0], /"Responsable del entregable" o "Por cargo"/);

  const adHoc = collect({
    fillWorkflow: { steps },
    templateScope: "ad_hoc",
    referenceIds: { personIds: new Set([1]) },
  });
  assert.deepEqual(adHoc.errors, []);
});

test("collectAuthoredWorkflowIssues: el ámbito de unidad también depende del tipo de plantilla", () => {
  const steps = [fillStep({ resolver_type: "cargo_in_scope", cargo_id: 7, unit_scope_type: "unit_type", unit_type_id: 3 })];
  // `unit_type` vale en official pero no en ad_hoc.
  assert.deepEqual(
    collect({ fillWorkflow: { steps }, templateScope: "official", referenceIds: { unitTypeIds: new Set([3]) } }).errors,
    []
  );
  const adHoc = collect({ fillWorkflow: { steps }, templateScope: "ad_hoc" });
  assert.match(adHoc.errors[0], /ámbito no permitido/);
});

test("collectAuthoredWorkflowIssues: valida que las referencias existan, pero solo si se le dio el catálogo", () => {
  const steps = [fillStep({ resolver_type: "specific_person", person_id: 99 })];
  const base = { fillWorkflow: { steps }, templateScope: "ad_hoc" };

  // Con catálogo poblado y la persona fuera: error.
  const conCatalogo = collect({ ...base, referenceIds: { personIds: new Set([1, 2]) } });
  assert.match(conCatalogo.errors[0], /la persona seleccionada \(99\) no existe/);

  // Sin catálogo (no se pudo cargar) NO se inventa el error: las FKs son el backstop.
  assert.deepEqual(collect(base).errors, []);

  // Y sin persona seleccionada, el error es de campo obligatorio.
  const sinPersona = collect({
    fillWorkflow: { steps: [fillStep({ resolver_type: "specific_person" })] },
    templateScope: "ad_hoc",
  });
  assert.match(sinPersona.errors[0], /requiere seleccionar una persona/);
});

test("collectAuthoredWorkflowIssues: el ámbito de contexto no resuelve si el proceso no tiene reglas", () => {
  const steps = [fillStep({ resolver_type: "cargo_in_scope", cargo_id: 7, unit_scope_type: "context_exact" })];
  const sinReglas = collect({ fillWorkflow: { steps }, processScope: { has_rules: false } });
  assert.match(sinReglas.errors[0], /no tiene reglas objetivo/);

  assert.deepEqual(collect({ fillWorkflow: { steps }, processScope: { has_rules: true } }).errors, []);
});

test("collectAuthoredWorkflowIssues: un cargo sin puesto hoy es AVISO, no error (late-binding)", () => {
  const steps = [fillStep({ resolver_type: "cargo_in_scope", cargo_id: 7, unit_scope_type: "context_exact" })];
  const resultado = collect({
    fillWorkflow: { steps },
    processScope: { has_rules: true },
    resolvableCargoIds: { ctx: new Set([1, 2]) },
  });
  // Clave: NO bloquea el guardado. El ocupante se enlaza después.
  assert.deepEqual(resultado.errors, []);
  assert.match(resultado.warnings[0], /quedará pendiente y se resolverá/);
});

test("collectAuthoredWorkflowIssues: la unidad específica exige unidad y que exista", () => {
  const sinUnidad = collect({
    fillWorkflow: { steps: [fillStep({ resolver_type: "cargo_in_scope", cargo_id: 7, unit_scope_type: "unit_exact" })] },
  });
  assert.match(sinUnidad.errors[0], /requiere seleccionar una unidad/);

  const unidadInexistente = collect({
    fillWorkflow: { steps: [fillStep({ resolver_type: "cargo_in_scope", cargo_id: 7, unit_scope_type: "unit_exact", unit_id: 42 })] },
    referenceIds: { unitIds: new Set([8]) },
  });
  assert.match(unidadInexistente.errors[0], /la unidad seleccionada \(42\) no existe/);
});

test("collectAuthoredWorkflowIssues: en entrega solo valen los modos de selección automáticos", () => {
  const manual = collect({ fillWorkflow: { steps: [fillStep({ selection_mode: "manual" })] } });
  assert.match(manual.errors[0], /modo no permitido en entrega/);
  assert.deepEqual(collect({ fillWorkflow: { steps: [fillStep({ selection_mode: "auto_all" })] } }).errors, []);
});

test("collectAuthoredWorkflowIssues: firma valida el modo de aprobación y cada firmante", () => {
  const modoMalo = collect({
    signatureWorkflow: { steps: [{ order: 1, approval_mode: "quizas", resolver_type: "cargo_in_scope", cargo_id: 7 }] },
    processScope: { has_rules: true },
  });
  assert.match(modoMalo.errors[0], /modo de aprobación inválido \(quizas\)/);

  // Multi-firmante: cada firmante se valida y el mensaje lo identifica.
  const multi = collect({
    signatureWorkflow: {
      steps: [{
        order: 1,
        approval_mode: "and",
        signers: [
          { resolver_type: "cargo_in_scope", cargo_id: 7, unit_scope_type: "context_exact" },
          { resolver_type: "specific_person", person_id: 5 },
        ],
      }],
    },
    processScope: { has_rules: true },
    templateScope: "official",
  });
  assert.equal(multi.errors.length, 1, JSON.stringify(multi));
  assert.match(multi.errors[0], /firmante 2: firmante no permitido/);
});

test("collectAuthoredWorkflowIssues: acepta el responsable anidado además del plano", () => {
  // El formulario web manda los campos planos; la forma anidada se admite por robustez.
  const anidado = collect({
    fillWorkflow: { steps: [{ order: 1, resolver: { type: "specific_person", person_id: 99 } }] },
    templateScope: "ad_hoc",
    referenceIds: { personIds: new Set([1]) },
  });
  assert.match(anidado.errors[0], /la persona seleccionada \(99\) no existe/);
});
