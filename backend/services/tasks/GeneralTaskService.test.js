import test from "node:test";
import assert from "node:assert/strict";

import {
  parseGeneralTaskInput,
  resolveUserPositionInUnit,
  createGeneralTaskForUser,
} from "./GeneralTaskService.js";

// --- parseGeneralTaskInput -------------------------------------------------------------------

test("un cuerpo vacío cae en el modo libre con todo a null", () => {
  assert.deepEqual(parseGeneralTaskInput({}), {
    mode: "free",
    title: "",
    description: null,
    customTerm: null,
    sourceTaskId: null,
    sourceTaskItemId: null,
    requestedUnitId: null,
    processDefinitionTemplateId: null,
    recipientPersonId: null,
    runtimeFlow: null,
  });
});

test("tolera un cuerpo ausente sin lanzar", () => {
  assert.equal(parseGeneralTaskInput(undefined).mode, "free");
  assert.equal(parseGeneralTaskInput(null).title, "");
});

test("el modo se normaliza a minúsculas y sin espacios", () => {
  assert.equal(parseGeneralTaskInput({ mode: "  DERIVED " }).mode, "derived");
});

test("título y descripción se recortan; una descripción vacía es null", () => {
  const input = parseGeneralTaskInput({ title: "  Informe  ", description: "   " });
  assert.equal(input.title, "Informe");
  assert.equal(input.description, null);
});

test("source_task_id manda sobre parent_task_id, y parent_task_id es el respaldo", () => {
  assert.equal(parseGeneralTaskInput({ source_task_id: "5", parent_task_id: "9" }).sourceTaskId, 5);
  assert.equal(parseGeneralTaskInput({ parent_task_id: "9" }).sourceTaskId, 9);
});

test("los identificadores llegan como números", () => {
  const input = parseGeneralTaskInput({
    source_task_item_id: "3",
    unit_id: "12",
    process_definition_template_id: "44",
    recipient_person_id: "8",
  });
  assert.equal(input.sourceTaskItemId, 3);
  assert.equal(input.requestedUnitId, 12);
  assert.equal(input.processDefinitionTemplateId, 44);
  assert.equal(input.recipientPersonId, 8);
});

test("el flujo de runtime solo se acepta si es un objeto", () => {
  const flow = { entrega: [], firma: [] };
  assert.equal(parseGeneralTaskInput({ flow }).runtimeFlow, flow);
  assert.equal(parseGeneralTaskInput({ flow: "entrega" }).runtimeFlow, null);
  assert.equal(parseGeneralTaskInput({}).runtimeFlow, null);
});

// --- resolveUserPositionInUnit ---------------------------------------------------------------

test("sin unidad no hay posición que resolver, y no se consulta nada", async () => {
  let consultas = 0;
  const conn = { query: async () => { consultas += 1; return [[]]; } };
  assert.equal(await resolveUserPositionInUnit(conn, 7, null), null);
  assert.equal(consultas, 0);
});

// --- createGeneralTaskForUser: transacción y guards ------------------------------------------

const makeConnection = (handler) => {
  const calls = [];
  return {
    calls,
    beginTransaction: async () => { calls.push("begin"); },
    commit: async () => { calls.push("commit"); },
    rollback: async () => { calls.push("rollback"); },
    release: () => { calls.push("release"); },
    query: async (sql, params) => handler(sql, params, calls),
  };
};

const makePool = (connection) => ({ getConnection: async () => connection });

test("sin proceso 'default' activo aborta con rollback y libera la conexión", async () => {
  const connection = makeConnection((sql) => {
    if (sql.includes("WHERE p.slug = ?")) return [[]];
    throw new Error(`consulta inesperada: ${sql.slice(0, 60)}`);
  });

  await assert.rejects(
    () => createGeneralTaskForUser(makePool(connection), {
      authenticatedUserId: 7,
      input: parseGeneralTaskInput({ title: "Algo" }),
    }),
    /El proceso General no está disponible/
  );
  assert.deepEqual(connection.calls, ["begin", "rollback", "release"]);
});

test("en modo derivado, una tarea de origen inexistente aborta con rollback", async () => {
  const connection = makeConnection((sql) => {
    if (sql.includes("WHERE p.slug = ?")) return [[{ id: 42 }]];
    if (sql.includes("FROM tasks t")) return [[]];
    throw new Error(`consulta inesperada: ${sql.slice(0, 60)}`);
  });

  await assert.rejects(
    () => createGeneralTaskForUser(makePool(connection), {
      authenticatedUserId: 7,
      input: parseGeneralTaskInput({ mode: "derived", title: "Algo", source_task_id: 3 }),
    }),
    /La tarea de origen no existe/
  );
  assert.deepEqual(connection.calls, ["begin", "rollback", "release"]);
});

test("sin posición vigente en la unidad de la tarea origen, aborta", async () => {
  const connection = makeConnection((sql) => {
    if (sql.includes("WHERE p.slug = ?")) return [[{ id: 42 }]];
    if (sql.includes("FROM tasks t")) return [[{ id: 3, process_definition_id: 42, scope_unit_id: 100 }]];
    if (sql.includes("FROM position_assignments pa")) return [[]];
    throw new Error(`consulta inesperada: ${sql.slice(0, 60)}`);
  });

  await assert.rejects(
    () => createGeneralTaskForUser(makePool(connection), {
      authenticatedUserId: 7,
      input: parseGeneralTaskInput({ mode: "derived", title: "Algo", source_task_id: 3 }),
    }),
    /No tienes una posición vigente en la unidad de la tarea origen/
  );
});

test("una plantilla de instancia única no admite réplicas ni envíos", async () => {
  const connection = makeConnection((sql) => {
    if (sql.includes("WHERE p.slug = ?")) return [[{ id: 42 }]];
    if (sql.includes("FROM tasks t")) return [[{ id: 3, process_definition_id: 42, scope_unit_id: 100 }]];
    if (sql.includes("FROM position_assignments pa")) return [[{ id: 55 }]];
    if (sql.includes("item_mode, process_definition_id")) {
      return [[{ id: 44, template_artifact_id: 9, item_mode: "single", process_definition_id: 42 }]];
    }
    throw new Error(`consulta inesperada: ${sql.slice(0, 60)}`);
  });

  await assert.rejects(
    () => createGeneralTaskForUser(makePool(connection), {
      authenticatedUserId: 7,
      input: parseGeneralTaskInput({
        mode: "derived",
        title: "Algo",
        source_task_id: 3,
        process_definition_template_id: 44,
      }),
    }),
    /instancia única/
  );
});

test("una plantilla de otro proceso se rechaza antes de mirar su modo", async () => {
  const connection = makeConnection((sql) => {
    if (sql.includes("WHERE p.slug = ?")) return [[{ id: 42 }]];
    if (sql.includes("FROM tasks t")) return [[{ id: 3, process_definition_id: 42, scope_unit_id: 100 }]];
    if (sql.includes("FROM position_assignments pa")) return [[{ id: 55 }]];
    if (sql.includes("item_mode, process_definition_id")) {
      return [[{ id: 44, template_artifact_id: 9, item_mode: "single", process_definition_id: 99 }]];
    }
    throw new Error(`consulta inesperada: ${sql.slice(0, 60)}`);
  });

  await assert.rejects(
    () => createGeneralTaskForUser(makePool(connection), {
      authenticatedUserId: 7,
      input: parseGeneralTaskInput({
        mode: "derived",
        title: "Algo",
        source_task_id: 3,
        process_definition_template_id: 44,
      }),
    }),
    /no pertenece al proceso de la tarea origen/
  );
});

test("routed sin destinatario y sin flujo de runtime exige elegir destinatario", async () => {
  const connection = makeConnection((sql) => {
    if (sql.includes("WHERE p.slug = ?")) return [[{ id: 42 }]];
    if (sql.includes("FROM tasks t")) return [[{ id: 3, process_definition_id: 42, scope_unit_id: 100 }]];
    if (sql.includes("FROM position_assignments pa")) return [[{ id: 55 }]];
    if (sql.includes("item_mode, process_definition_id")) {
      return [[{ id: 44, template_artifact_id: 9, item_mode: "routed", process_definition_id: 42 }]];
    }
    throw new Error(`consulta inesperada: ${sql.slice(0, 60)}`);
  });

  await assert.rejects(
    () => createGeneralTaskForUser(makePool(connection), {
      authenticatedUserId: 7,
      input: parseGeneralTaskInput({
        mode: "derived",
        title: "Algo",
        source_task_id: 3,
        process_definition_template_id: 44,
      }),
    }),
    /Debes elegir el destinatario del envío/
  );
});

test("routed con un destinatario que no existe se rechaza", async () => {
  const connection = makeConnection((sql) => {
    if (sql.includes("WHERE p.slug = ?")) return [[{ id: 42 }]];
    if (sql.includes("FROM tasks t")) return [[{ id: 3, process_definition_id: 42, scope_unit_id: 100 }]];
    if (sql.includes("FROM position_assignments pa")) return [[{ id: 55 }]];
    if (sql.includes("item_mode, process_definition_id")) {
      return [[{ id: 44, template_artifact_id: 9, item_mode: "routed", process_definition_id: 42 }]];
    }
    if (sql.includes("FROM persons WHERE id = ?")) return [[]];
    throw new Error(`consulta inesperada: ${sql.slice(0, 60)}`);
  });

  await assert.rejects(
    () => createGeneralTaskForUser(makePool(connection), {
      authenticatedUserId: 7,
      input: parseGeneralTaskInput({
        mode: "derived",
        title: "Algo",
        source_task_id: 3,
        process_definition_template_id: 44,
        recipient_person_id: 8,
      }),
    }),
    /El destinatario no es válido/
  );
});

test("en modo libre, sin unidad no hay posición y la tarea no se crea", async () => {
  const connection = makeConnection((sql) => {
    if (sql.includes("WHERE p.slug = ?")) return [[{ id: 42 }]];
    throw new Error(`consulta inesperada: ${sql.slice(0, 60)}`);
  });

  await assert.rejects(
    () => createGeneralTaskForUser(makePool(connection), {
      authenticatedUserId: 7,
      input: parseGeneralTaskInput({ title: "Algo" }),
    }),
    /No tienes una posición vigente en la unidad indicada/
  );
  assert.deepEqual(connection.calls, ["begin", "rollback", "release"]);
});

test("en modo libre, sin el tipo de periodo Custom la tarea no se crea", async () => {
  const connection = makeConnection((sql) => {
    if (sql.includes("WHERE p.slug = ?")) return [[{ id: 42 }]];
    if (sql.includes("FROM position_assignments pa")) return [[{ id: 55 }]];
    if (sql.includes("FROM term_types")) return [[]];
    throw new Error(`consulta inesperada: ${sql.slice(0, 60)}`);
  });

  await assert.rejects(
    () => createGeneralTaskForUser(makePool(connection), {
      authenticatedUserId: 7,
      input: parseGeneralTaskInput({ title: "Algo", unit_id: 100 }),
    }),
    /No existe el tipo de periodo Custom/
  );
});

test("la conexión se libera aunque el rollback falle", async () => {
  const calls = [];
  const connection = {
    calls,
    beginTransaction: async () => { calls.push("begin"); },
    commit: async () => { calls.push("commit"); },
    rollback: async () => { calls.push("rollback"); throw new Error("rollback roto"); },
    release: () => { calls.push("release"); },
    query: async () => { throw new Error("consulta rota"); },
  };

  await assert.rejects(
    () => createGeneralTaskForUser(makePool(connection), {
      authenticatedUserId: 7,
      input: parseGeneralTaskInput({ title: "Algo" }),
    }),
    /consulta rota/
  );
  assert.deepEqual(calls, ["begin", "rollback", "release"]);
});
