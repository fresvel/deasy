// Tests unitarios de `finishTemplateUpdate` — el paso 2 del update guiado.
//
// Lo que fijan (defecto 1.12): activar una configuración PUBLICA sus plantillas en borrador. Eso ya
// lo hacía el camino del CRUD (`tableHooks.js:605`) y NO lo hacía el update guiado, que publicaba
// solo la plantilla que versionaba y pasaba al gate. El char lo congela extremo a extremo; aquí se
// fija el ORDEN de las operaciones dentro de la transacción, que es la parte frágil:
//
//   1. retirar hermanas publicadas de la plantilla versionada
//   2. publicarla (deja is_active = 1)          <- el gate de artefactos ACTIVOS depende de esto
//   3. publicar el RESTO de borradores de la config
//   4. el gate
//   5. retirar la config activa anterior y activar esta
//
// El paso 3 va DESPUÉS del 2 a propósito: `publishDraftTemplatesForDefinition` filtra por
// `lifecycle_state = 'draft'` y no toca `is_active`, así que si se adelantara publicaría la
// plantilla versionada sin dejarla activa y el gate del paso 4 la rechazaría.

import test from "node:test";
import assert from "node:assert/strict";

import TemplateLifecycleService from "./templateLifecycle.js";

const TPL_ID = 10;
const CFG_ID = 20;
const COLADO_ID = 99;

// Construye el servicio con un doble de pool/conexión que REGISTRA lo que ocurre, en orden.
// `draftRows` son los borradores que quedan enlazados a la config (sin contar la que se versiona).
const buildService = ({ draftRows = [], fillSteps = 1 } = {}) => {
  const events = [];

  const connection = {
    beginTransaction: async () => { events.push("begin"); },
    commit: async () => { events.push("commit"); },
    rollback: async () => { events.push("rollback"); },
    release: () => { events.push("release"); },
    query: async (sql, params) => {
      if (sql.includes("ta.lifecycle_state = 'draft'")) {
        events.push("select:borradores-de-la-config");
        return [draftRows];
      }
      if (sql.includes("lifecycle_state = 'published', is_active = 1")) {
        events.push(`publica-y-activa:${params[0]}`);
        return [{}];
      }
      if (sql.includes("SET lifecycle_state = 'published'")) {
        events.push(`publica:${params[0]}`);
        return [{}];
      }
      if (sql.includes("SET status = 'active'")) {
        events.push(`activa-config:${params[0]}`);
        return [{}];
      }
      events.push(`sql-no-esperado:${sql}`);
      return [[]];
    },
  };

  const pool = {
    getConnection: async () => connection,
    query: async (sql) => {
      if (sql.includes("FROM process_definition_versions")) {
        return [[{ id: CFG_ID, process_id: 1, variation_key: "general", definition_version: "1.1.0", status: "draft" }]];
      }
      if (sql.includes("FROM process_definition_templates")) {
        return [[{ id: 500, item_mode: "single" }]];
      }
      return [[]];
    },
  };

  const service = new TemplateLifecycleService(pool, {
    getByKeys: async () => ({ id: TPL_ID, lifecycle_state: "draft", storage_version: "1.1.0" }),
    // `fillSteps` describe SOLO al borrador colado. La plantilla versionada siempre trae su paso:
    // su readiness se comprueba antes de la transacción y no es lo que estos casos ejercitan.
    loadTemplateArtifactMetaDocument: async (artifact) => {
      const pasos = Number(artifact?.id) === TPL_ID ? 1 : fillSteps;
      return { workflows: { fill: { steps: Array.from({ length: pasos }, (_, i) => ({ order: i + 1 })) } } };
    },
    retirePriorPublishedSiblings: async (_conn, id) => { events.push(`retira-hermanas:${id}`); },
    retireActiveDefinitionsInSeries: async () => { events.push("retira-config-anterior"); return 1; },
    ensureDefinitionHasActiveRulesForActivation: async () => { events.push("gate:reglas"); },
    ensureDefinitionHasActivePeriodTypesForActivation: async () => { events.push("gate:periodos"); },
    ensureDefinitionHasArtifactsForActivation: async () => { events.push("gate:entregables"); },
  });

  return { service, events };
};

const finish = (service) =>
  service.finishTemplateUpdate({ templateArtifactId: TPL_ID, configDefinitionId: CFG_ID });

// El camino que ya funcionaba: si la config no tiene más borradores, la secuencia no cambia.
test("sin mas borradores en la config, finish publica la plantilla y activa la config", async () => {
  const { service, events } = buildService();
  const result = await finish(service);

  assert.equal(result.template_lifecycle_state, "published");
  assert.equal(result.config_status, "active");
  assert.deepEqual(events, [
    "begin",
    "gate:reglas",
    "gate:periodos",
    `retira-hermanas:${TPL_ID}`,
    `publica-y-activa:${TPL_ID}`,
    "select:borradores-de-la-config",
    "gate:entregables",
    "retira-config-anterior",
    `activa-config:${CFG_ID}`,
    "commit",
    "release",
  ]);
});

// El defecto 1.12: el borrador colado se publica ANTES del gate, no se queda dentro de una config
// que acaba de quedar activa.
test("un borrador colado en la config se publica antes del gate (1.12)", async () => {
  const { service, events } = buildService({
    draftRows: [{ id: COLADO_ID, item_mode: "single", deliverable_name: "Informe de evento" }],
  });
  await finish(service);

  const publicado = events.indexOf(`publica:${COLADO_ID}`);
  const gate = events.indexOf("gate:entregables");
  assert.notEqual(publicado, -1, "el borrador colado debe publicarse");
  assert.ok(publicado < gate, "debe publicarse ANTES del gate de entregables");
  assert.ok(events.indexOf(`publica-y-activa:${TPL_ID}`) < publicado,
    "la plantilla versionada se publica PRIMERO: el gate de activos depende de su is_active");
  assert.ok(events.includes(`retira-hermanas:${COLADO_ID}`),
    "publicar el colado retira las publicadas previas de su mismo entregable");
});

// `publishDraftTemplatesForDefinition` filtra por `lifecycle_state = 'draft'`, así que la plantilla
// versionada —ya publicada en el paso anterior— no vuelve a pasar por ahí.
test("la plantilla ya publicada no se re-publica en la segunda pasada", async () => {
  const { service, events } = buildService({
    draftRows: [{ id: COLADO_ID, item_mode: "single", deliverable_name: "Informe de evento" }],
  });
  await finish(service);

  assert.equal(events.filter((e) => e === `publica-y-activa:${TPL_ID}`).length, 1);
  assert.ok(!events.includes(`publica:${TPL_ID}`), "no debe publicarse dos veces por dos vias distintas");
});

// `routed` no autora flujo (se define al enviar), así que se publica sin exigirle paso de entrega.
test("un borrador colado en modo routed se publica sin exigirle flujo de entrega", async () => {
  const { service, events } = buildService({
    draftRows: [{ id: COLADO_ID, item_mode: "routed", deliverable_name: "Tarea ad-hoc" }],
    fillSteps: 0,
  });
  await finish(service);
  assert.ok(events.includes(`publica:${COLADO_ID}`));
});

// Atomicidad: publicar el resto ocurre DENTRO de la transacción, así que un borrador que no está
// listo aborta la activación entera en vez de dejar la config activa a medias.
test("un borrador colado sin paso de entrega aborta la activacion y hace rollback", async () => {
  const { service, events } = buildService({
    draftRows: [{ id: COLADO_ID, item_mode: "single", deliverable_name: "Informe de evento" }],
    fillSteps: 0,
  });

  await assert.rejects(finish(service), /debe definir al menos un paso de flujo de entrega/);
  assert.ok(events.includes("rollback"), "debe deshacerse la transaccion");
  assert.ok(!events.includes("commit"), "no debe confirmarse nada");
  assert.ok(!events.includes(`activa-config:${CFG_ID}`), "la config NO debe quedar activa");
});

// --- La transacción del borrador (sub-paso 3 del §0.8) ------------------------------------------
//
// `saveTemplateArtifactDraft` no tenía transacción: compensaba a mano con una pila de deshacer. El
// flujo autorado NO se podía escribir así —cuelga del artifact por FK—, y el sub-paso 3 abrió una de
// verdad alrededor de los tres efectos de base. Estos tests fijan lo único que importa de ella: que
// un fallo a mitad NO deja nada escrito, y que la escritura del flujo va DENTRO.
//
// El resto de `saveTemplateArtifactDraft` (MinIO, staging en disco, formatos) queda fuera a
// propósito: es lo que el characterization ya recorre extremo a extremo.

const DRAFT_ARTIFACT_ID = 77;

const buildDraftService = ({ falla = null } = {}) => {
  const events = [];

  const connection = {
    beginTransaction: async () => { events.push("begin"); },
    commit: async () => { events.push("commit"); },
    rollback: async () => { events.push("rollback"); },
    release: () => { events.push("release"); },
    query: async (sql) => {
      const texto = String(sql).replace(/\s+/g, " ").trim();
      if (/^SELECT process_id/i.test(texto)) return [[{ process_id: 1, variation_key: "general" }]];
      if (/^SELECT id FROM deliverables/i.test(texto)) return [[]];
      if (/^INSERT INTO deliverables/i.test(texto)) { events.push("insert:deliverable"); return [{ insertId: 5 }]; }
      if (/^INSERT INTO template_artifacts/i.test(texto)) { events.push("insert:artifact"); return [{ insertId: DRAFT_ARTIFACT_ID }]; }
      if (/^UPDATE template_artifacts/i.test(texto)) { events.push("update:artifact"); return [{}]; }
      if (/^UPDATE deliverables/i.test(texto)) { events.push("update:deliverable"); return [{}]; }
      if (/^SELECT id FROM process_definition_templates/i.test(texto)) return [[]];
      if (/^INSERT INTO process_definition_templates/i.test(texto)) { events.push("insert:vinculo"); return [{ insertId: 9 }]; }
      if (/flow_templates/i.test(texto) || /flow_steps/i.test(texto)) { events.push("escribe:flujo"); return [[]]; }
      return [[]];
    },
  };

  const pool = { getConnection: async () => connection, query: async () => [[]] };

  const service = new TemplateLifecycleService(pool, {
    // El vínculo resuelve el proceso destino con `getByKeys`; devolver null es el camino real del
    // error "El proceso destino seleccionado no existe.", que es donde se rompía la compensación.
    getByKeys: async () => (falla === "vinculo" ? null : { id: 1 }),
    getCargoCodeMap: async () => new Map(),
    getUnitTypeNameMap: async () => new Map(),
  });

  if (falla === "flujo") {
    service._persistAuthoredFlow = async () => { throw new Error("fallo al escribir el flujo"); };
  }

  return { service, events };
};

const persistir = (service, extra = {}) =>
  service._persistDraftToDatabase({
    isEdit: false,
    almacenamiento: { storageVersion: "1.0.0", availableFormats: {} },
    identidad: { templateCode: "draft_x", displayName: "Borrador X" },
    processDefinitionId: 1,
    itemMode: "single",
    workflowsDocument: { workflows: { fill: { required: true, sync_mode: "artifact_to_db", steps: [{ order: 1 }] }, signatures: { steps: [] } } },
    ...extra,
  });

test("el borrador se persiste dentro de UNA transaccion, con el flujo incluido", async () => {
  const { service, events } = buildDraftService();
  const artifactId = await persistir(service);

  assert.equal(artifactId, DRAFT_ARTIFACT_ID);
  // Las cinco sentencias de flujo son: buscar la cabecera de entrega, crearla, borrar sus pasos,
  // insertar el paso, y buscar la de firma (que no llega a crearse porque el flujo no trae firmas).
  assert.deepEqual(events, [
    "begin",
    "insert:deliverable",
    "insert:artifact",
    "insert:vinculo",
    ...Array(5).fill("escribe:flujo"),
    "commit",
    "release",
  ]);
});

test("si falla el VINCULO, la transaccion se deshace y no se escribe el flujo", async () => {
  const { service, events } = buildDraftService({ falla: "vinculo" });

  await assert.rejects(persistir(service), /El proceso destino seleccionado no existe/);
  assert.ok(events.includes("rollback"), "debe deshacerse la transaccion");
  assert.ok(!events.includes("commit"), "no debe confirmarse nada");
  assert.ok(!events.includes("escribe:flujo"), "el flujo no llega a escribirse");
  assert.equal(events.at(-1), "release", "la conexion vuelve al pool pase lo que pase");
});

test("si falla al escribir el FLUJO, el artifact y el vinculo tampoco quedan escritos", async () => {
  // Esto es lo que la compensación manual no podía dar: el flujo cuelga del artifact por FK, así que
  // o se escriben los dos o ninguno.
  const { service, events } = buildDraftService({ falla: "flujo" });

  await assert.rejects(persistir(service), /fallo al escribir el flujo/);
  assert.ok(events.includes("insert:artifact"), "el INSERT llegó a ejecutarse...");
  assert.ok(events.includes("rollback"), "...y es el ROLLBACK quien lo deshace");
  assert.ok(!events.includes("commit"));
});

// Efecto lateral bueno de la transacción, y no era el objetivo: la pila de deshacer NO apilaba en
// EDICIÓN, así que una edición que fallaba al vincular dejaba aplicado el UPDATE de
// `template_artifacts`. Ahora también se deshace.
test("una EDICION que falla al vincular tambien se deshace (antes no)", async () => {
  const { service, events } = buildDraftService({ falla: "vinculo" });

  await assert.rejects(
    persistir(service, { isEdit: true, existingArtifact: { id: DRAFT_ARTIFACT_ID, deliverable_id: 5 } }),
    /El proceso destino seleccionado no existe/,
  );
  assert.ok(events.includes("update:artifact"), "el UPDATE llegó a ejecutarse...");
  assert.ok(events.includes("rollback"), "...y ahora se deshace");
});

test("sin flujo autorado la transaccion sigue siendo la misma, sin escribir flujo", async () => {
  const { service, events } = buildDraftService();
  await persistir(service, { workflowsDocument: null });

  assert.ok(!events.includes("escribe:flujo"));
  assert.ok(events.includes("commit"));
});
