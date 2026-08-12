// Tests unitarios del escritor de FILAS de flujo.
//
// Qué protegen, y por qué no basta el characterization. El char observa el resultado con la base
// llena y el sync corriendo al lado; aquí se mira el escritor solo, y sobre todo se fija LA FORMA DE
// LA CABECERA. Esa forma no es una convención: el escalón 3 del resolvedor
// (`generation/queries.js`) busca `template_artifact_id = X AND process_definition_template_id IS
// NULL AND task_item_id IS NULL AND is_active = 1`. Si el escritor pusiera cualquiera de los otros
// dos portadores, el flujo quedaría escrito y NO lo leería nadie — y eso no da error en ningún
// sitio, solo un entregable que no arranca.

import test from "node:test";
import assert from "node:assert/strict";

import {
  copyAuthoredFlowToArtifact,
  hasFillStepsForArtifact,
  readAuthoredFlowForArtifact,
  replaceAuthoredFlowForArtifact,
  replaceFillFlowSteps,
  replaceSignatureFlowSteps,
} from "./flowRows.js";

const ARTIFACT_ID = 42;

// Doble de conexión que REGISTRA cada sentencia con sus parámetros y responde a los SELECT según
// `cabecerasExistentes`. Devuelve la forma de mysql2 que usa el adaptador (`[filas]` / `[header]`).
const buildConnection = ({ fillHeaderId = null, signatureHeaderId = null } = {}) => {
  const calls = [];
  let nextInsertId = 900;

  const connection = {
    calls,
    query: async (sql, params = []) => {
      calls.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
      if (/^SELECT id\s+FROM fill_flow_templates/i.test(sql.trim())) {
        return [fillHeaderId ? [{ id: fillHeaderId }] : []];
      }
      if (/^SELECT id\s+FROM signature_flow_templates/i.test(sql.trim())) {
        return [signatureHeaderId ? [{ id: signatureHeaderId }] : []];
      }
      if (/^INSERT INTO/i.test(sql.trim())) {
        nextInsertId += 1;
        return [{ insertId: nextInsertId, affectedRows: 1 }];
      }
      return [{ affectedRows: 1 }];
    },
  };
  return connection;
};

const fillStep = (extra = {}) => ({
  stepOrder: 1,
  code: "owner_fill",
  name: "Entrega del responsable",
  resolverType: "task_assignee",
  assignedPersonId: null,
  unitScopeType: "unit_exact",
  unitId: null,
  unitTypeId: null,
  relationTypeId: null,
  cargoId: null,
  positionId: null,
  selectionMode: "auto_one",
  isRequired: 1,
  canReject: 0,
  ...extra,
});

const signatureStep = (extra = {}) => ({
  stepOrder: 1,
  code: "firma_1",
  name: "Firma 1",
  slot: "firma_1",
  resolverType: "cargo_in_scope",
  assignedPersonId: null,
  unitScopeType: "context_exact",
  unitId: null,
  unitTypeId: null,
  positionId: null,
  requiredCargoId: 2,
  selectionMode: "auto_all",
  approvalMode: "and",
  requiredSignersMin: 1,
  requiredSignersMax: null,
  isRequired: 1,
  anchorRefs: [],
  signers: [{ resolverType: "cargo_in_scope", requiredCargoId: 2 }],
  ...extra,
});

const find = (connection, pattern) => connection.calls.filter((call) => pattern.test(call.sql));

// --- Los pasos: DELETE + INSERT, con code y name ------------------------------------------------

test("replaceFillFlowSteps borra los pasos previos antes de insertar", async () => {
  const connection = buildConnection();
  await replaceFillFlowSteps(connection, 7, [fillStep(), fillStep({ stepOrder: 2, canReject: 1 })]);

  assert.match(connection.calls[0].sql, /^DELETE FROM fill_flow_steps/);
  assert.deepEqual(connection.calls[0].params, [7]);
  assert.equal(find(connection, /^INSERT INTO fill_flow_steps/).length, 2);
});

test("replaceFillFlowSteps escribe code y name del paso de entrega", async () => {
  // La columna existía desde el 1-bis y el INSERT no la listaba: el nombre del paso se perdía al
  // proyectarlo a la base. Este test es el que impide que vuelva a pasar.
  const connection = buildConnection();
  await replaceFillFlowSteps(connection, 7, [fillStep()]);

  const [insert] = find(connection, /^INSERT INTO fill_flow_steps/);
  assert.match(insert.sql, /code, name,/);
  assert.equal(insert.params[2], "owner_fill");
  assert.equal(insert.params[3], "Entrega del responsable");
});

test("replaceFillFlowSteps admite un paso sin code (columna NULLABLE)", async () => {
  const connection = buildConnection();
  await replaceFillFlowSteps(connection, 7, [fillStep({ code: null, name: null })]);

  const [insert] = find(connection, /^INSERT INTO fill_flow_steps/);
  assert.equal(insert.params[2], null);
  assert.equal(insert.params[3], null);
});

test("replaceSignatureFlowSteps serializa anchor_refs y signers como JSON", async () => {
  const connection = buildConnection();
  await replaceSignatureFlowSteps(connection, 9, [signatureStep()]);

  const [insert] = find(connection, /^INSERT INTO signature_flow_steps/);
  assert.equal(insert.params[17], "[]");
  assert.deepEqual(JSON.parse(insert.params[18]), [{ resolverType: "cargo_in_scope", requiredCargoId: 2 }]);
});

test("un flujo vacio solo borra: no inserta ningun paso", async () => {
  const connection = buildConnection();
  await replaceFillFlowSteps(connection, 7, []);

  assert.equal(connection.calls.length, 1);
  assert.match(connection.calls[0].sql, /^DELETE FROM fill_flow_steps/);
});

// --- La cabecera: la forma que el escalón 3 exige ------------------------------------------------

test("sin cabecera previa, se crea una colgada del artifact y con los otros portadores a NULL", async () => {
  const connection = buildConnection();
  const resultado = await replaceAuthoredFlowForArtifact(connection, {
    artifactId: ARTIFACT_ID,
    displayName: "Informe general",
    fillSteps: [fillStep()],
    signatureSteps: [signatureStep()],
  });

  const [insertFill] = find(connection, /^INSERT INTO fill_flow_templates/);
  // Las columnas listadas SON el contrato con el resolvedor: si apareciera
  // `process_definition_template_id` o `task_item_id`, el escalón 3 dejaría de encontrar la fila.
  assert.match(insertFill.sql, /INSERT INTO fill_flow_templates \(template_artifact_id, name, is_active\)/);
  assert.deepEqual(insertFill.params, [ARTIFACT_ID, "Flujo de entrega - Informe general"]);

  const [insertSig] = find(connection, /^INSERT INTO signature_flow_templates/);
  assert.deepEqual(insertSig.params, [ARTIFACT_ID, "Flujo de firma - Informe general"]);

  assert.equal(resultado.fill.steps, 1);
  assert.equal(resultado.signatures.steps, 1);
});

test("la busqueda de la cabecera exige los otros dos portadores a NULL", async () => {
  const connection = buildConnection();
  await replaceAuthoredFlowForArtifact(connection, { artifactId: ARTIFACT_ID, fillSteps: [fillStep()] });

  const [select] = find(connection, /^SELECT id FROM fill_flow_templates/);
  assert.match(select.sql, /template_artifact_id = \?/);
  assert.match(select.sql, /process_definition_template_id IS NULL/);
  assert.match(select.sql, /task_item_id IS NULL/);
  assert.deepEqual(select.params, [ARTIFACT_ID]);
});

test("con cabecera previa se REUTILIZA y se reactiva, no se crea otra", async () => {
  // Guardar el mismo borrador dos veces no puede ir dejando cabeceras: el escalón 3 coge la de id
  // mayor y las anteriores quedarían como basura activa apuntando al mismo artifact.
  const connection = buildConnection({ fillHeaderId: 300 });
  await replaceAuthoredFlowForArtifact(connection, {
    artifactId: ARTIFACT_ID,
    displayName: "Informe general",
    fillSteps: [fillStep()],
  });

  assert.equal(find(connection, /^INSERT INTO fill_flow_templates/).length, 0);
  const [update] = find(connection, /^UPDATE fill_flow_templates/);
  assert.match(update.sql, /SET name = \?, is_active = 1/);
  assert.deepEqual(update.params, ["Flujo de entrega - Informe general", 300]);
});

test("sin pasos y sin cabecera previa no se escribe nada de ese lado", async () => {
  const connection = buildConnection();
  const resultado = await replaceAuthoredFlowForArtifact(connection, {
    artifactId: ARTIFACT_ID,
    fillSteps: [fillStep()],
    signatureSteps: [],
  });

  assert.equal(resultado.signatures, null);
  assert.equal(find(connection, /signature_flow_steps/).length, 0);
  assert.equal(find(connection, /^INSERT INTO signature_flow_templates/).length, 0);
});

test("quitar el flujo de firma desactiva su cabecera y borra sus pasos", async () => {
  // Sin esto quedaría un flujo fantasma que el escalón 3 podría servir el día que el del vínculo
  // deje de existir (sub-paso 8), y el entregable pediría firmas que el autor ya había quitado.
  const connection = buildConnection({ signatureHeaderId: 400 });
  const resultado = await replaceAuthoredFlowForArtifact(connection, {
    artifactId: ARTIFACT_ID,
    displayName: "Informe general",
    fillSteps: [fillStep()],
    signatureSteps: [],
  });

  const [borrado] = find(connection, /^DELETE FROM signature_flow_steps/);
  assert.deepEqual(borrado.params, [400]);
  const [update] = find(connection, /^UPDATE signature_flow_templates/);
  assert.match(update.sql, /SET is_active = 0/);
  assert.deepEqual(resultado.signatures, { flowTemplateId: 400, steps: 0 });
});

test("sin id de artifact se falla en vez de escribir un flujo huerfano", async () => {
  const connection = buildConnection();
  await assert.rejects(
    () => replaceAuthoredFlowForArtifact(connection, { fillSteps: [fillStep()] }),
    /requiere el id del template_artifact/,
  );
  assert.equal(connection.calls.length, 0);
});

// --- El conteo del gate (sub-paso 4 del §0.8) ---------------------------------------------------
//
// `hasFillStepsForArtifact` es lo que responde "¿esta plantilla define flujo de entrega?" a los
// CUATRO gates de publicación. Lo que se fija aquí es la FORMA de la consulta, porque un WHERE de
// más o de menos no da error en ningún sitio: solo deja pasar (o rechaza) una plantilla por una
// razón equivocada, que es exactamente el defecto que este sub-paso vino a cerrar.

// Doble que devuelve el `EXISTS` pedido y guarda la sentencia para poder mirarla.
const buildCountConnection = ({ hasSteps = 1, falla = false } = {}) => {
  const calls = [];
  return {
    calls,
    query: async (sql, params = []) => {
      calls.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
      if (falla) throw new Error("la base no responde");
      return [[{ has_steps: hasSteps }]];
    },
  };
};

test("el gate cuenta los pasos por los DOS portadores: el artifact y sus vinculos", async () => {
  // Andamiaje explícito hasta el sub-paso 8: lo sembrado por el sync cuelga del VÍNCULO y lo que
  // escribe el formulario cuelga del ARTIFACT. Medido en la base de dev: todas las plantillas de la
  // fixture tienen 0 pasos por artifact y 1 por vínculo. Contar solo por artifact rechazaría todo lo
  // que no se haya vuelto a guardar por el formulario.
  const connection = buildCountConnection();
  assert.equal(await hasFillStepsForArtifact(connection, ARTIFACT_ID), true);

  const [{ sql, params }] = connection.calls;
  assert.match(sql, /f\.template_artifact_id = \? AND f\.process_definition_template_id IS NULL/);
  assert.match(sql, /f\.process_definition_template_id IN \( SELECT pdt\.id FROM process_definition_templates/);
  assert.deepEqual(params, [ARTIFACT_ID, ARTIFACT_ID], "el id va dos veces: una por portador");
});

test("el gate excluye el flujo de RUNTIME y las cabeceras desactivadas", async () => {
  // `task_item_id IS NULL`: el flujo de runtime lleva vínculo Y entregable, así que sin esta guarda
  // un `routed` "definiría flujo de entrega" en cuanto alguien enviara un entregable.
  // `is_active = 1`: el sync DESACTIVA cabeceras sin borrarles los pasos, que seguirían contando.
  const connection = buildCountConnection();
  await hasFillStepsForArtifact(connection, ARTIFACT_ID);

  const [{ sql }] = connection.calls;
  assert.match(sql, /f\.task_item_id IS NULL/);
  assert.match(sql, /f\.is_active = 1/);
});

test("sin pasos el gate dice que no, y sin id ni consulta a la base", async () => {
  const conSteps = buildCountConnection({ hasSteps: 0 });
  assert.equal(await hasFillStepsForArtifact(conSteps, ARTIFACT_ID), false);

  const sinId = buildCountConnection();
  assert.equal(await hasFillStepsForArtifact(sinId, null), false);
  assert.equal(sinId.calls.length, 0);
});

test("un error de la base SUBE: no se traduce en 'no define flujo'", async () => {
  // ESTE es el motivo del sub-paso 4. La lectura vieja envolvía el `meta.yaml` de MinIO en un
  // `catch {}` mudo, así que un MinIO caído valía "0 pasos" y bloqueaba la publicación con un
  // mensaje que mentía sobre la causa. Aquí no hay `catch` y no lo puede volver a haber.
  const connection = buildCountConnection({ falla: true });
  await assert.rejects(() => hasFillStepsForArtifact(connection, ARTIFACT_ID), /la base no responde/);
});

// --- La relectura del editor (sub-paso 5 del §0.8) -----------------------------------------------
//
// `readAuthoredFlowForArtifact` es lo que rellena el editor al reabrir una plantilla. Devuelve la
// forma del DOCUMENTO `workflows:` —la misma que produce `buildWorkflowsDocument`— porque el
// endpoint ya sabía aplanar esa forma y así su contrato HTTP no se mueve.
//
// Lo que se fija aquí es lo que el characterization NO puede ver de un solo golpe: el ORDEN de los
// dos portadores, la INVERSA de `buildStepResolver` (que es donde una lectura ingenua se equivoca) y
// las dos convenciones del JSONB `signers`.

// Doble que responde a las consultas del lector. Las cabeceras van EN MAPAS POR ARTIFACT porque el
// tercer escalón sube por `parent_version_id` y hay que poder decir «este artifact no tiene, su padre
// sí». `is_active` viaja con la cabecera: existir y estar activa son dos cosas distintas y el lector
// las distingue.
const buildReadConnection = ({
  fillHeaders = {},
  fillLinkHeaders = {},
  signatureHeaders = {},
  signatureLinkHeaders = {},
  parents = {},
  fillRows = [],
  signatureRows = [],
  falla = false,
} = {}) => {
  const calls = [];
  const cabecera = (mapa, artifactId) => {
    const found = mapa[artifactId];
    if (!found) return [];
    return [{ id: found.id, is_active: found.is_active === undefined ? 1 : found.is_active }];
  };
  return {
    calls,
    query: async (sql, params = []) => {
      const flat = sql.replace(/\s+/g, " ").trim();
      calls.push({ sql: flat, params });
      if (falla) throw new Error("la base no responde");
      const artifactId = params[0];
      if (/^SELECT id, is_active FROM fill_flow_templates/.test(flat)) {
        return [cabecera(/WHERE template_artifact_id = \?/.test(flat) ? fillHeaders : fillLinkHeaders, artifactId)];
      }
      if (/^SELECT id, is_active FROM signature_flow_templates/.test(flat)) {
        return [cabecera(/WHERE template_artifact_id = \?/.test(flat) ? signatureHeaders : signatureLinkHeaders, artifactId)];
      }
      if (/^SELECT parent_version_id FROM template_artifacts/.test(flat)) {
        return [parents[artifactId] ? [{ parent_version_id: parents[artifactId] }] : [{ parent_version_id: null }]];
      }
      if (/FROM fill_flow_steps/.test(flat)) return [fillRows];
      if (/FROM signature_flow_steps/.test(flat)) return [signatureRows];
      return [[]];
    },
  };
};

const fillRow = (extra = {}) => ({
  step_order: 1,
  code: null,
  name: "Entrega del responsable",
  resolver_type: "task_assignee",
  assigned_person_id: null,
  // El valor que `normalizeFillSteps` mete por defecto aunque el ámbito no signifique nada para
  // este resolutor. Es exactamente lo que NO debe salir en el contrato.
  unit_scope_type: "unit_exact",
  unit_id: null,
  unit_type_id: null,
  relation_type_id: null,
  cargo_id: null,
  position_id: null,
  selection_mode: "auto_one",
  is_required: 1,
  ...extra,
});

const signatureRow = (extra = {}) => ({
  step_order: 1,
  code: "firma_cargo",
  name: "Firma por cargo",
  slot: "firma_cargo",
  resolver_type: "cargo_in_scope",
  assigned_person_id: null,
  unit_scope_type: "unit_exact",
  unit_id: 8,
  unit_type_id: null,
  position_id: null,
  required_cargo_id: 2,
  selection_mode: "auto_all",
  approval_mode: "and",
  required_signers_min: 1,
  required_signers_max: null,
  is_required: 1,
  signers: [],
  ...extra,
});

test("el lector prefiere el flujo colgado del ARTIFACT y ni pregunta por el del vinculo", async () => {
  const connection = buildReadConnection({
    fillHeaders: { [ARTIFACT_ID]: { id: 13 } },
    signatureHeaders: { [ARTIFACT_ID]: { id: 4 } },
    fillRows: [fillRow()],
  });
  const flujo = await readAuthoredFlowForArtifact(connection, ARTIFACT_ID);

  assert.equal(flujo.fill.steps.length, 1);
  const porVinculo = connection.calls.filter((call) => /process_definition_templates/.test(call.sql));
  assert.equal(porVinculo.length, 0, "con cabecera propia no se baja al segundo escalon");
});

test("sin flujo propio se lee el que el sync sembro en el VINCULO (andamiaje hasta el sub-paso 8)", async () => {
  // Toda plantilla que no se haya vuelto a guardar por el formulario —las del bootstrap— solo tiene
  // esta copia. Sin este escalón, reabrirlas mostraría el flujo vacío y el guardado siguiente lo
  // borraría: es el hallazgo 2 del §0.8.
  const connection = buildReadConnection({
    fillLinkHeaders: { [ARTIFACT_ID]: { id: 2 } },
    fillRows: [fillRow({ code: "owner_fill" })],
  });
  const flujo = await readAuthoredFlowForArtifact(connection, ARTIFACT_ID);

  assert.equal(flujo.fill.steps.length, 1);
  const [porVinculo] = connection.calls.filter((call) => /process_definition_templates/.test(call.sql));
  assert.match(porVinculo.sql, /task_item_id IS NULL/, "el flujo de runtime nunca es el de la plantilla");
});

test("una VERSION sin portador propio hereda el flujo de su padre (andamiaje, ya sin productor)", async () => {
  // `createTemplateArtifactVersion` copiaba MinIO en binario y no creaba ni filas ni vínculo: la
  // versión nacía sin portador propio y su flujo lo llevaba el `meta.yaml` copiado, o sea el del
  // padre. MEDIDO EN EL NAVEGADOR: sin este escalón, versionar y reabrir mostraba el flujo vacío.
  // Desde el sub-paso 6 el versionado COPIA LAS FILAS, así que este escalón ya no tiene productor
  // nuevo — solo lo alcanzan los artifacts versionados antes de aquel commit. Se conserva mientras
  // esos existan; quitarlo es cambio de comportamiento y lleva commit propio.
  const HIJA = 11;
  const connection = buildReadConnection({
    parents: { [HIJA]: ARTIFACT_ID },
    fillLinkHeaders: { [ARTIFACT_ID]: { id: 4 } },
    fillRows: [fillRow({ code: "owner_fill", resolver_type: "document_owner" })],
  });
  const flujo = await readAuthoredFlowForArtifact(connection, HIJA);

  assert.equal(flujo.fill.steps.length, 1, "la hija ve el flujo del padre");
  assert.equal(flujo.fill.steps[0].code, "owner_fill");
});

test("el ascenso por el linaje TERMINA: ni sin padre ni con un padre circular se cuelga", async () => {
  const sinPadre = buildReadConnection();
  assert.deepEqual((await readAuthoredFlowForArtifact(sinPadre, ARTIFACT_ID)).fill.steps, []);

  const circular = buildReadConnection({ parents: { [ARTIFACT_ID]: 7, 7: ARTIFACT_ID } });
  assert.deepEqual((await readAuthoredFlowForArtifact(circular, ARTIFACT_ID)).fill.steps, []);
});

test("una cabecera DESACTIVADA es una respuesta, no un hueco: no se hereda del padre", async () => {
  // Quitarle todos los pasos a un lado desactiva su cabecera (`replaceArtifactFlowSide`) en vez de
  // borrarla. Si el lector la ignorara por no estar activa, seguiría subiendo y resucitaría desde el
  // padre los pasos que el autor acaba de quitar.
  const HIJA = 11;
  const connection = buildReadConnection({
    parents: { [HIJA]: ARTIFACT_ID },
    fillHeaders: { [HIJA]: { id: 20, is_active: 0 }, [ARTIFACT_ID]: { id: 13 } },
    fillRows: [fillRow()],
  });
  const flujo = await readAuthoredFlowForArtifact(connection, HIJA);

  assert.deepEqual(flujo.fill.steps, [], "el flujo quitado sigue quitado");
  assert.equal(connection.calls.some((call) => /FROM fill_flow_steps/.test(call.sql)), false);
});

test("un resolutor que no es por cargo vuelve SIN ambito, aunque la columna lo lleve", async () => {
  // Es el fallo que midió el experimento desechable: volcar la columna cruda mueve
  // `unit_scope_type` de `context_exact` a `unit_exact` en todo paso no-cargo, incluida la
  // plantilla de la fixture. `buildStepResolver` solo emite el ámbito para `cargo_in_scope`.
  const connection = buildReadConnection({ fillHeaders: { [ARTIFACT_ID]: { id: 13 } }, fillRows: [fillRow()] });
  const [paso] = (await readAuthoredFlowForArtifact(connection, ARTIFACT_ID)).fill.steps;

  assert.deepEqual(paso.resolver, { type: "task_assignee", selection_mode: "auto_one" });
  assert.equal(paso.name, "Entrega del responsable");
  assert.equal(paso.required, true);
  assert.equal("code" in paso, false, "un paso sin code no lo inventa");
});

test("un paso por cargo vuelve con su cargo, su ambito y su unidad", async () => {
  const connection = buildReadConnection({
    fillHeaders: { [ARTIFACT_ID]: { id: 13 } },
    fillRows: [fillRow({
      step_order: 2,
      resolver_type: "cargo_in_scope",
      cargo_id: 2,
      unit_scope_type: "unit_exact",
      unit_id: 8,
      is_required: 0,
    })],
  });
  const [paso] = (await readAuthoredFlowForArtifact(connection, ARTIFACT_ID)).fill.steps;

  assert.deepEqual(paso.resolver, {
    type: "cargo_in_scope",
    selection_mode: "auto_one",
    cargo_id: 2,
    unit_scope_type: "unit_exact",
    unit_id: 8,
  });
  assert.equal(paso.required, false);
});

test("el JSONB signers se lee en sus DOS convenciones de nombre", async () => {
  // camelCase lo escribe la autoría de plantilla (`normalizeSignatureSigner`); snake_case lo escribe
  // el flujo de runtime (`generation/documents.js`). Devolver la fila cruda le daría al formulario
  // `requiredCargoId` donde espera `cargo_id`, y perdería a todos los firmantes.
  const connection = buildReadConnection({
    signatureHeaders: { [ARTIFACT_ID]: { id: 4 } },
    signatureRows: [
      signatureRow({
        signers: [{ resolverType: "cargo_in_scope", requiredCargoId: 2, unitScopeType: "unit_exact", unitId: 8, selectionMode: "auto_all" }],
      }),
      signatureRow({ step_order: 2, signers: '[{"type":"specific_person","person_id":7}]' }),
    ],
  });
  const { steps } = (await readAuthoredFlowForArtifact(connection, ARTIFACT_ID)).signatures;

  assert.deepEqual(steps[0].signers, [{
    type: "cargo_in_scope",
    selection_mode: "auto_all",
    cargo_id: 2,
    unit_scope_type: "unit_exact",
    unit_id: 8,
  }]);
  assert.deepEqual(steps[1].signers, [{ type: "specific_person", person_id: 7 }]);
});

test("un paso de firma sin lista signers se lee con las columnas del propio paso", async () => {
  // Back-compat, espejo de la que ya tenía el lector del meta: ahí un paso podía traer un `resolver`
  // único en vez de la lista.
  const connection = buildReadConnection({
    signatureHeaders: { [ARTIFACT_ID]: { id: 4 } },
    signatureRows: [signatureRow({ signers: [] })],
  });
  const [paso] = (await readAuthoredFlowForArtifact(connection, ARTIFACT_ID)).signatures.steps;

  assert.deepEqual(paso.signers, [{
    type: "cargo_in_scope",
    selection_mode: "auto_all",
    cargo_id: 2,
    unit_scope_type: "unit_exact",
    unit_id: 8,
  }]);
});

test("las dos banderas 'required' se derivan sin columna: entrega SIEMPRE, firma si hay pasos", async () => {
  // `fill.required` es `true` en todo lo que produce el formulario y es el valor que el endpoint ya
  // devolvía por defecto. `signatures.required` equivale al `sig.required === true` del meta: las
  // filas SOLO existen si el escritor vio la bandera puesta.
  const vacio = await readAuthoredFlowForArtifact(buildReadConnection(), ARTIFACT_ID);
  assert.deepEqual(vacio, {
    fill: { required: true, steps: [] },
    signatures: { required: false, steps: [] },
  });

  const conFirma = await readAuthoredFlowForArtifact(
    buildReadConnection({ signatureHeaders: { [ARTIFACT_ID]: { id: 4 } }, signatureRows: [signatureRow()] }),
    ARTIFACT_ID,
  );
  assert.equal(conFirma.signatures.required, true);
});

test("sin id no se consulta la base, y un error de la base SUBE", async () => {
  // El mismo criterio del sub-paso 4, y aquí pesa más: este lector es lo que rellena el editor, así
  // que un "flujo vacío" inventado se convierte en BORRADO del flujo en cuanto el usuario guarda.
  const sinId = buildReadConnection();
  assert.deepEqual((await readAuthoredFlowForArtifact(sinId, null)).fill, { required: true, steps: [] });
  assert.equal(sinId.calls.length, 0);

  await assert.rejects(
    () => readAuthoredFlowForArtifact(buildReadConnection({ falla: true }), ARTIFACT_ID),
    /la base no responde/,
  );
});

// --- La copia del versionado (sub-paso 6 del §0.8) ----------------------------------------------
//
// `createTemplateArtifactVersion` y `forkDeliverableForConfig` copiaban los objetos de MinIO en
// binario y NINGUNA fila. Con el flujo ya en la base, eso dejaba la versión nueva sin flujo: el gate
// de publicación —que cuenta filas— la rechazaba con "debe definir al menos un paso de flujo de
// entrega". Lo que se fija aquí es lo que el characterization no puede separar: DE DÓNDE se copia,
// qué NO se copia nunca, y que la fila llega entera.
const buildCopyConnection = ({
  fillHeaders = {},
  fillLinkHeaders = {},
  signatureHeaders = {},
  signatureLinkHeaders = {},
  parents = {},
  fillRows = [],
  signatureRows = [],
} = {}) => {
  const calls = [];
  let nextInsertId = 500;
  const cabecera = (mapa, artifactId) => {
    const found = mapa[artifactId];
    if (!found) return [];
    return [{ id: found.id, is_active: found.is_active === undefined ? 1 : found.is_active }];
  };
  return {
    calls,
    query: async (sql, params = []) => {
      const flat = sql.replace(/\s+/g, " ").trim();
      calls.push({ sql: flat, params });
      const artifactId = params[0];
      // Búsqueda del ORIGEN (el escalonado del lector: artifact -> vínculo -> padre).
      if (/^SELECT id, is_active FROM fill_flow_templates/.test(flat)) {
        return [cabecera(/WHERE template_artifact_id = \?/.test(flat) ? fillHeaders : fillLinkHeaders, artifactId)];
      }
      if (/^SELECT id, is_active FROM signature_flow_templates/.test(flat)) {
        return [cabecera(/WHERE template_artifact_id = \?/.test(flat) ? signatureHeaders : signatureLinkHeaders, artifactId)];
      }
      if (/^SELECT parent_version_id FROM template_artifacts/.test(flat)) {
        return [parents[artifactId] ? [{ parent_version_id: parents[artifactId] }] : [{ parent_version_id: null }]];
      }
      // Búsqueda de la cabecera del DESTINO (el escritor): una versión recién creada no tiene.
      if (/^SELECT id FROM (fill|signature)_flow_templates/.test(flat)) return [[]];
      if (/^SELECT step_order.*FROM fill_flow_steps/.test(flat)) return [fillRows];
      if (/^SELECT step_order.*FROM signature_flow_steps/.test(flat)) return [signatureRows];
      if (/^INSERT INTO/.test(flat)) {
        nextInsertId += 1;
        return [{ insertId: nextInsertId, affectedRows: 1 }];
      }
      return [{ affectedRows: 1 }];
    },
  };
};

const HIJA_ID = 99;

// La fila CRUDA del padre, con las columnas que el documento del editor NO lleva (`can_reject`).
const fillCopyRow = (extra = {}) => ({
  step_order: 1,
  code: "owner_fill",
  name: "Entrega del responsable",
  resolver_type: "document_owner",
  assigned_person_id: null,
  unit_scope_type: "unit_exact",
  unit_id: null,
  unit_type_id: null,
  relation_type_id: null,
  cargo_id: null,
  position_id: null,
  selection_mode: "auto_one",
  is_required: 1,
  can_reject: 0,
  ...extra,
});

const signatureCopyRow = (extra = {}) => ({
  step_order: 1,
  code: "firma_cargo",
  name: "Firma por cargo",
  slot: "firma_cargo",
  resolver_type: "cargo_in_scope",
  assigned_person_id: null,
  unit_scope_type: "unit_exact",
  unit_id: 8,
  unit_type_id: null,
  position_id: null,
  required_cargo_id: 2,
  selection_mode: "auto_all",
  approval_mode: "and",
  required_signers_min: 1,
  required_signers_max: null,
  is_required: 1,
  anchor_refs: [],
  signers: [{ resolverType: "cargo_in_scope", requiredCargoId: 2, unitScopeType: "unit_exact", unitId: 8 }],
  ...extra,
});

test("versionar copia los pasos de ENTREGA y de FIRMA a la hija, colgados de SU artifact", async () => {
  // El caso del contrato del sub-paso: los dos lados a la vez. Las cabeceras nuevas son de la HIJA
  // (ids nuevos) y llevan la forma que exige el escalón 3 del resolvedor.
  const connection = buildCopyConnection({
    fillHeaders: { [ARTIFACT_ID]: { id: 13 } },
    signatureHeaders: { [ARTIFACT_ID]: { id: 4 } },
    fillRows: [fillCopyRow(), fillCopyRow({ step_order: 2, code: "revision", can_reject: 1 })],
    signatureRows: [signatureCopyRow()],
  });

  const resultado = await copyAuthoredFlowToArtifact(connection, {
    sourceArtifactId: ARTIFACT_ID,
    targetArtifactId: HIJA_ID,
    displayName: "Informe general",
  });

  const [cabeceraFill] = find(connection, /^INSERT INTO fill_flow_templates/);
  assert.deepEqual(cabeceraFill.params, [HIJA_ID, "Flujo de entrega - Informe general"]);
  const [cabeceraFirma] = find(connection, /^INSERT INTO signature_flow_templates/);
  assert.deepEqual(cabeceraFirma.params, [HIJA_ID, "Flujo de firma - Informe general"]);

  assert.equal(find(connection, /^INSERT INTO fill_flow_steps/).length, 2);
  assert.equal(find(connection, /^INSERT INTO signature_flow_steps/).length, 1);
  assert.equal(resultado.fill.steps, 2);
  assert.equal(resultado.signatures.steps, 1);
  // Ids distintos: los pasos cuelgan de la cabecera NUEVA, no de la 13 ni de la 4 del padre.
  const [pasoFill] = find(connection, /^INSERT INTO fill_flow_steps/);
  assert.equal(pasoFill.params[0], resultado.fill.flowTemplateId);
  assert.notEqual(pasoFill.params[0], 13);
});

test("la copia arrastra la fila ENTERA, incluido lo que el documento del editor pierde", async () => {
  // `can_reject` no sale en el documento `workflows:`, y `slot`/`anchor_refs`/`signers` viajan sin
  // reinterpretar. Copiar leyendo la proyección del editor perdería las cuatro cosas.
  const connection = buildCopyConnection({
    fillHeaders: { [ARTIFACT_ID]: { id: 13 } },
    signatureHeaders: { [ARTIFACT_ID]: { id: 4 } },
    fillRows: [fillCopyRow({ can_reject: 1, relation_type_id: 3 })],
    signatureRows: [signatureCopyRow({ required_signers_max: 2, approval_mode: "at_least" })],
  });

  await copyAuthoredFlowToArtifact(connection, { sourceArtifactId: ARTIFACT_ID, targetArtifactId: HIJA_ID });

  const [pasoFill] = find(connection, /^INSERT INTO fill_flow_steps/);
  assert.equal(pasoFill.params[2], "owner_fill");
  assert.equal(pasoFill.params[4], "document_owner");
  assert.equal(pasoFill.params[9], 3, "relation_type_id");
  assert.equal(pasoFill.params[14], 1, "can_reject");

  const [pasoFirma] = find(connection, /^INSERT INTO signature_flow_steps/);
  assert.equal(pasoFirma.params[4], "firma_cargo", "slot");
  assert.equal(pasoFirma.params[13], "at_least", "approval_mode");
  assert.equal(pasoFirma.params[15], 2, "required_signers_max");
  assert.equal(pasoFirma.params[17], "[]", "anchor_refs");
  assert.match(pasoFirma.params[18], /"requiredCargoId":2/, "el JSONB signers no se reinterpreta");
});

test("la copia NUNCA busca una cabecera de RUNTIME", async () => {
  // Es la garantía del grupo de control: la cabecera de runtime es el flujo que un usuario definió
  // al enviar UN entregable concreto en modo `routed`. Copiarla convertiría esa decisión en la
  // definición de todas las versiones futuras. Las dos consultas del origen la excluyen.
  const connection = buildCopyConnection({ fillHeaders: { [ARTIFACT_ID]: { id: 13 } }, fillRows: [fillCopyRow()] });
  await copyAuthoredFlowToArtifact(connection, { sourceArtifactId: ARTIFACT_ID, targetArtifactId: HIJA_ID });

  const busquedas = connection.calls.filter((call) => /^SELECT id, is_active FROM/.test(call.sql));
  assert.ok(busquedas.length > 0);
  for (const busqueda of busquedas) {
    assert.match(busqueda.sql, /task_item_id IS NULL/);
  }
});

test("si el padre no tiene flujo propio, se copia el que el sync sembro en su VINCULO", async () => {
  // MEDIDO en la base de dev: la plantilla de la fixture tiene 0 cabeceras por artifact y 1 por
  // vínculo, porque su flujo lo sembró el sync desde `BASE_META_YAML`. Sin este escalón, versionarla
  // copiaría CERO filas y publicar la versión seguiría dando 400. Andamiaje hasta el sub-paso 8.
  const connection = buildCopyConnection({
    fillLinkHeaders: { [ARTIFACT_ID]: { id: 2 } },
    fillRows: [fillCopyRow()],
  });
  await copyAuthoredFlowToArtifact(connection, { sourceArtifactId: ARTIFACT_ID, targetArtifactId: HIJA_ID });

  assert.equal(find(connection, /^INSERT INTO fill_flow_steps/).length, 1);
});

test("un padre SIN flujo no le crea a la hija ninguna cabecera vacia", async () => {
  const connection = buildCopyConnection();
  const resultado = await copyAuthoredFlowToArtifact(connection, {
    sourceArtifactId: ARTIFACT_ID,
    targetArtifactId: HIJA_ID,
  });

  assert.deepEqual(resultado, { fill: null, signatures: null });
  assert.equal(find(connection, /^INSERT INTO/).length, 0);
});

test("una cabecera DESACTIVADA en el padre no se copia: el flujo quitado sigue quitado", async () => {
  // Desactivada significa "el autor quitó el flujo de este lado". Copiarla resucitaría los pasos que
  // el autor acaba de quitar; y la hija, sin cabecera propia, responde lo mismo que el padre.
  const connection = buildCopyConnection({
    fillHeaders: { [ARTIFACT_ID]: { id: 13, is_active: 0 } },
    fillRows: [fillCopyRow()],
  });
  const resultado = await copyAuthoredFlowToArtifact(connection, {
    sourceArtifactId: ARTIFACT_ID,
    targetArtifactId: HIJA_ID,
  });

  assert.equal(resultado.fill, null);
  assert.equal(connection.calls.some((call) => /FROM fill_flow_steps/.test(call.sql)), false);
});

test("copiar exige los DOS ids y no toca la base sin ellos", async () => {
  const connection = buildCopyConnection();
  await assert.rejects(
    () => copyAuthoredFlowToArtifact(connection, { sourceArtifactId: ARTIFACT_ID }),
    /requiere el id de origen y el de destino/,
  );
  await assert.rejects(
    () => copyAuthoredFlowToArtifact(connection, { targetArtifactId: HIJA_ID }),
    /requiere el id de origen y el de destino/,
  );
  assert.equal(connection.calls.length, 0);
});
