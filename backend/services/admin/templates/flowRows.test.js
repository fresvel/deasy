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
  hasFillStepsForArtifact,
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
