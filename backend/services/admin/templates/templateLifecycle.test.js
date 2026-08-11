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
