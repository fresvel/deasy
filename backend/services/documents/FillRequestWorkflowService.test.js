// Red unitaria de la máquina de estados de `fill_requests`.
//
// Lo que la caracterización NO puede ver desde HTTP y aquí sí: el CÓDIGO que lleva cada error de
// negocio (`statusCode`), que un fallo de infraestructura NO se disfrace de 4xx, y las ramas que la
// fixture del harness no alcanza (flujos de más de un paso, aprobación del último paso).
import test from "node:test";
import assert from "node:assert/strict";

import {
  assertFillActionAllowed,
  getFillRequestContext,
  reactivatePreviousFillStepIfNeeded,
  requiresSignaturePdfForFinalFillApproval,
  updateFillRequestStatus,
} from "./FillRequestWorkflowService.js";

const PENDING = "pending";
const IN_PROGRESS = "in_progress";

// --- assertFillActionAllowed: los tres guards y su ORDEN ---------------------------------------

test("operar la solicitud de otro es 403", () => {
  assert.throws(
    () => assertFillActionAllowed({
      action: "start", currentStatus: PENDING, assignedPersonId: 7, currentUserId: 9, isManual: false,
    }),
    (error) => error.statusCode === 403 && /asignada a otro usuario/.test(error.message),
  );
});

test("el guard de propiedad va ANTES que el de transición: una solicitud ajena en estado terminal sigue siendo 403", () => {
  assert.throws(
    () => assertFillActionAllowed({
      action: "start", currentStatus: "approved", assignedPersonId: 7, currentUserId: 9, isManual: false,
    }),
    (error) => error.statusCode === 403,
  );
});

test("sin responsable y sin modo manual es 409, no 500 (era el defecto 3 de la caracterización)", () => {
  assert.throws(
    () => assertFillActionAllowed({
      action: "start", currentStatus: PENDING, assignedPersonId: null, currentUserId: 9, isManual: false,
    }),
    (error) => error.statusCode === 409 && /responsable resoluble/.test(error.message),
  );
});

test("sin responsable pero manual, el guard deja pasar (auto-reclamo)", () => {
  assert.doesNotThrow(() => assertFillActionAllowed({
    action: "start", currentStatus: PENDING, assignedPersonId: null, currentUserId: 9, isManual: true,
  }));
});

test("una transición ilegal es 409 y NOMBRA estado y acción (contrato del frontend)", () => {
  assert.throws(
    () => assertFillActionAllowed({
      action: "start", currentStatus: IN_PROGRESS, assignedPersonId: 9, currentUserId: 9, isManual: false,
    }),
    (error) => error.statusCode === 409
      && error.message === "La solicitud no puede pasar de in_progress usando la acción start.",
  );
});

test("start solo sale de pending; approve/return/reject/cancel salen también de in_progress", () => {
  const desde = (currentStatus, action) => {
    try {
      assertFillActionAllowed({ action, currentStatus, assignedPersonId: 9, currentUserId: 9, isManual: false });
      return true;
    } catch {
      return false;
    }
  };
  assert.equal(desde(PENDING, "start"), true);
  assert.equal(desde(IN_PROGRESS, "start"), false);
  for (const action of ["approve", "return", "reject", "cancel"]) {
    assert.equal(desde(PENDING, action), true, `${action} desde pending`);
    assert.equal(desde(IN_PROGRESS, action), true, `${action} desde in_progress`);
  }
});

test("los estados terminales cierran las cinco acciones", () => {
  for (const currentStatus of ["approved", "rejected", "cancelled", "returned"]) {
    for (const action of ["start", "approve", "return", "reject", "cancel"]) {
      assert.throws(
        () => assertFillActionAllowed({ action, currentStatus, assignedPersonId: 9, currentUserId: 9, isManual: false }),
        (error) => error.statusCode === 409,
        `${currentStatus} -> ${action}`,
      );
    }
  }
});

test("el estado se compara sin distinguir mayúsculas ni espacios", () => {
  assert.doesNotThrow(() => assertFillActionAllowed({
    action: "start", currentStatus: "  PENDING ", assignedPersonId: 9, currentUserId: 9, isManual: false,
  }));
});

test("una acción desconocida no cuela por el hueco del objeto de acciones permitidas", () => {
  assert.throws(
    () => assertFillActionAllowed({
      action: "toString", currentStatus: PENDING, assignedPersonId: 9, currentUserId: 9, isManual: false,
    }),
    (error) => error.statusCode === 409,
  );
});

// --- reactivatePreviousFillStepIfNeeded: la rama que la fixture NO alcanza ----------------------

const fakeConnection = (handler) => {
  const queries = [];
  return {
    queries,
    query: async (sql, params) => {
      queries.push({ sql, params });
      return handler(sql, params);
    },
    beginTransaction: async () => { queries.push({ sql: "BEGIN" }); },
    commit: async () => { queries.push({ sql: "COMMIT" }); },
    rollback: async () => { queries.push({ sql: "ROLLBACK" }); },
    release: () => { queries.push({ sql: "RELEASE" }); },
  };
};

test("en el primer paso no hay nada que reactivar y no se consulta nada", async () => {
  const connection = fakeConnection(() => { throw new Error("no debería consultar"); });
  assert.equal(await reactivatePreviousFillStepIfNeeded(connection, { step_order: 1 }), null);
  assert.equal(connection.queries.length, 0);
});

test("con dos pasos, devolver reactiva el paso anterior y lo deja en pending", async () => {
  const connection = fakeConnection((sql) => {
    if (sql.includes("SELECT ffs.id")) return [[{ id: 55 }]];
    return [{ affectedRows: 1 }];
  });
  const reactivado = await reactivatePreviousFillStepIfNeeded(connection, {
    step_order: 2,
    document_fill_flow_id: 3,
  });
  assert.equal(reactivado, 1);
  const update = connection.queries.at(-1);
  assert.match(update.sql, /UPDATE fill_requests/);
  assert.deepEqual(update.params, ["pending", 3, 55]);
});

test("si el paso anterior no existe en la plantilla, no se actualiza nada", async () => {
  const connection = fakeConnection((sql) => (sql.includes("SELECT ffs.id") ? [[]] : [{}]));
  assert.equal(await reactivatePreviousFillStepIfNeeded(connection, { step_order: 3, document_fill_flow_id: 3 }), null);
  assert.equal(connection.queries.length, 1, "solo la consulta de búsqueda");
});

// --- requiresSignaturePdfForFinalFillApproval ---------------------------------------------------

const contextoFinal = (overrides = {}) => ({
  process_definition_template_id: 10,
  fill_flow_template_id: 20,
  step_order: 2,
  working_file_path: "Unidades/x/entregable.docx",
  ...overrides,
});

const conPasosYFirmas = (maxStepOrder, totalFirmas) => fakeConnection((sql) => {
  if (sql.includes("MAX(step_order)")) return [[{ max_step_order: maxStepOrder }]];
  if (sql.includes("signature_flow_templates")) return [[{ total: totalFirmas }]];
  throw new Error(`consulta inesperada: ${sql.slice(0, 40)}`);
});

test("sin plantilla de proceso o sin flujo de entrega no se exige PDF", async () => {
  const connection = fakeConnection(() => { throw new Error("no debería consultar"); });
  assert.equal(await requiresSignaturePdfForFinalFillApproval(connection, contextoFinal({ process_definition_template_id: null })), false);
  assert.equal(await requiresSignaturePdfForFinalFillApproval(connection, contextoFinal({ fill_flow_template_id: null })), false);
});

test("si no es el ÚLTIMO paso, no se exige PDF", async () => {
  assert.equal(await requiresSignaturePdfForFinalFillApproval(conPasosYFirmas(3, 1), contextoFinal()), false);
});

test("si el proceso no tiene pasos de firma activos, no se exige PDF", async () => {
  assert.equal(await requiresSignaturePdfForFinalFillApproval(conPasosYFirmas(2, 0), contextoFinal()), false);
});

test("último paso + firma configurada + working que no es PDF -> se exige PDF", async () => {
  assert.equal(await requiresSignaturePdfForFinalFillApproval(conPasosYFirmas(2, 1), contextoFinal()), true);
});

test("el guard mira la EXTENSIÓN, no que el objeto exista, y no distingue mayúsculas", async () => {
  assert.equal(
    await requiresSignaturePdfForFinalFillApproval(conPasosYFirmas(2, 1), contextoFinal({ working_file_path: "  Unidades/x/E.PDF  " })),
    false,
  );
});

// --- getFillRequestContext ----------------------------------------------------------------------

test("el contexto es la primera fila, o null si no hay ninguna", async () => {
  assert.deepEqual(await getFillRequestContext(fakeConnection(() => [[{ id: 4 }]]), 4), { id: 4 });
  assert.equal(await getFillRequestContext(fakeConnection(() => [[]]), 4), null);
  assert.equal(await getFillRequestContext(fakeConnection(() => [undefined]), 4), null);
});

// --- updateFillRequestStatus: orquestación transaccional ----------------------------------------

const poolCon = (connection) => ({ getConnection: async () => connection });
const usuario = async (id) => ({ id });

test("sin pool no se acusa al cliente: el error sale SIN statusCode (o sea, 500)", async () => {
  await assert.rejects(
    () => updateFillRequestStatus(
      { userId: 9, requestId: 1, action: "start", nextStatus: IN_PROGRESS },
      { pool: null, findUserById: usuario },
    ),
    (error) => error.statusCode === undefined && /PostgreSQL/.test(error.message),
  );
});

test("un fallo al pedir conexión a la pool tampoco lleva statusCode: es infraestructura, no culpa del cliente", async () => {
  const pool = { getConnection: async () => { throw new Error("too many clients"); } };
  await assert.rejects(
    () => updateFillRequestStatus(
      { userId: 9, requestId: 1, action: "start", nextStatus: IN_PROGRESS },
      { pool, findUserById: usuario },
    ),
    (error) => error.statusCode === undefined && /too many clients/.test(error.message),
  );
});

test("un id de solicitud no numérico es 400 y no llega a abrir transacción", async () => {
  const connection = fakeConnection(() => { throw new Error("no debería consultar"); });
  await assert.rejects(
    () => updateFillRequestStatus(
      { userId: 9, requestId: "abc", action: "start", nextStatus: IN_PROGRESS },
      { pool: poolCon(connection), findUserById: usuario },
    ),
    (error) => error.statusCode === 400,
  );
  assert.deepEqual(connection.queries.map((q) => q.sql), ["ROLLBACK", "RELEASE"]);
});

test("el cero también es un id inválido", async () => {
  const connection = fakeConnection(() => { throw new Error("no debería consultar"); });
  await assert.rejects(
    () => updateFillRequestStatus(
      { userId: 9, requestId: 0, action: "start", nextStatus: IN_PROGRESS },
      { pool: poolCon(connection), findUserById: usuario },
    ),
    (error) => error.statusCode === 400,
  );
});

test("un actor inválido revienta ANTES que el id (el orden de los guards es contrato)", async () => {
  const connection = fakeConnection(() => { throw new Error("no debería consultar"); });
  await assert.rejects(
    () => updateFillRequestStatus(
      { userId: null, requestId: "abc", action: "start", nextStatus: IN_PROGRESS },
      { pool: poolCon(connection), findUserById: usuario },
    ),
    (error) => error.statusCode === undefined && /Usuario autenticado inválido/.test(error.message),
  );
});

test("una solicitud inexistente es 404, con rollback y liberación de la conexión", async () => {
  const connection = fakeConnection(() => [[]]);
  await assert.rejects(
    () => updateFillRequestStatus(
      { userId: 9, requestId: 1, action: "start", nextStatus: IN_PROGRESS },
      { pool: poolCon(connection), findUserById: usuario },
    ),
    (error) => error.statusCode === 404,
  );
  assert.deepEqual(connection.queries.at(-2).sql, "ROLLBACK");
  assert.deepEqual(connection.queries.at(-1).sql, "RELEASE");
});

const contextoDe = (overrides = {}) => ({
  id: 1,
  assigned_person_id: 9,
  status: PENDING,
  is_manual: 0,
  document_fill_flow_id: 3,
  document_version_id: 77,
  step_order: 1,
  working_file_path: "Unidades/x/e.pdf",
  task_item_id: 55,
  user_started_at: null,
  process_definition_template_id: null,
  fill_flow_template_id: null,
  ...overrides,
});

// La orquestación completa se prueba contra una conexión falsa que responde por forma de SQL.
// `ti.user_started_at` solo aparece en la consulta de contexto de ESTE servicio; el resto de
// consultas (las de `syncDocumentProgressFromFillRequest`) se quedan sin filas a propósito, para
// que la sincronización de progreso corte en su primer guard y no arrastre a su propio dominio.
const conexionDeFlujo = (context) => fakeConnection((sql) => {
  if (sql.includes("ti.user_started_at")) return [[context]];
  if (sql.includes("UPDATE")) return [{ affectedRows: 1 }];
  return [[]];
});

test("start marca in_progress, sella user_started_at y confirma la transacción", async () => {
  const connection = conexionDeFlujo(contextoDe());
  const resultado = await updateFillRequestStatus(
    { userId: 9, requestId: 1, action: "start", nextStatus: IN_PROGRESS },
    { pool: poolCon(connection), findUserById: usuario },
  );
  assert.deepEqual(resultado.status, IN_PROGRESS);
  assert.equal(resultado.fillRequestId, 1);
  // Sin progreso resuelto, la versión documental sale del contexto y el estado del flujo es null.
  assert.equal(resultado.documentVersionId, 77);
  assert.equal(resultado.flowStatus, null);
  const sqls = connection.queries.map((q) => q.sql);
  assert.ok(sqls.some((sql) => sql.includes("UPDATE task_items")), "start debe sellar user_started_at");
  assert.equal(sqls.at(-2), "COMMIT");
  assert.equal(sqls.at(-1), "RELEASE");
});

test("start NO sella user_started_at si ya estaba sellado", async () => {
  const connection = conexionDeFlujo(contextoDe({ user_started_at: "2026-01-01" }));
  await updateFillRequestStatus(
    { userId: 9, requestId: 1, action: "start", nextStatus: IN_PROGRESS },
    { pool: poolCon(connection), findUserById: usuario },
  );
  assert.ok(!connection.queries.some((q) => q.sql.includes("UPDATE task_items")));
});

test("in_progress no sella responded_at; los estados de respuesta sí", async () => {
  const enCurso = conexionDeFlujo(contextoDe());
  await updateFillRequestStatus(
    { userId: 9, requestId: 1, action: "start", nextStatus: IN_PROGRESS },
    { pool: poolCon(enCurso), findUserById: usuario },
  );
  const updateEnCurso = enCurso.queries.find((q) => q.sql.includes("UPDATE fill_requests"));
  assert.equal(updateEnCurso.params[2], null);

  const rechazo = conexionDeFlujo(contextoDe());
  await updateFillRequestStatus(
    { userId: 9, requestId: 1, action: "reject", nextStatus: "rejected" },
    { pool: poolCon(rechazo), findUserById: usuario },
  );
  const updateRechazo = rechazo.queries.find((q) => q.sql.includes("UPDATE fill_requests"));
  assert.ok(updateRechazo.params[2] instanceof Date);
});

test("una solicitud manual sin responsable se auto-asigna a quien la opera", async () => {
  const connection = conexionDeFlujo(contextoDe({ assigned_person_id: null, is_manual: 1 }));
  await updateFillRequestStatus(
    { userId: 4, requestId: 1, action: "start", nextStatus: IN_PROGRESS },
    { pool: poolCon(connection), findUserById: usuario },
  );
  const update = connection.queries.find((q) => q.sql.includes("UPDATE fill_requests"));
  assert.equal(update.params[0], 4, "el UPDATE debe poner al operador como responsable");
});

test("aprobar el último paso sin PDF en working es 409, no 500, y deshace la transacción", async () => {
  const connection = fakeConnection((sql) => {
    if (sql.includes("FROM fill_requests fr")) {
      return [[contextoDe({
        process_definition_template_id: 10,
        fill_flow_template_id: 20,
        step_order: 2,
        working_file_path: "Unidades/x/e.docx",
      })]];
    }
    if (sql.includes("MAX(step_order)")) return [[{ max_step_order: 2 }]];
    if (sql.includes("signature_flow_templates")) return [[{ total: 1 }]];
    throw new Error(`consulta inesperada: ${sql.slice(0, 40)}`);
  });
  await assert.rejects(
    () => updateFillRequestStatus(
      { userId: 9, requestId: 1, action: "approve", nextStatus: "approved" },
      { pool: poolCon(connection), findUserById: usuario },
    ),
    // El código ES el contrato: era 500 (defecto 1.2) y ahora es 409, como los otros dos guards de
    // estado del mismo servicio. Sin esta aserción, cambiarlo a `new Error` otra vez pasaría mudo.
    (error) => error.statusCode === 409 && /requiere un PDF en working/.test(error.message),
  );
  assert.equal(connection.queries.at(-2).sql, "ROLLBACK");
  assert.equal(connection.queries.at(-1).sql, "RELEASE");
});

test("un fallo a mitad de la escritura deshace la transacción y propaga el error tal cual", async () => {
  const connection = fakeConnection((sql) => {
    if (sql.includes("FROM fill_requests fr")) return [[contextoDe()]];
    throw new Error("se cayó la base");
  });
  await assert.rejects(
    () => updateFillRequestStatus(
      { userId: 9, requestId: 1, action: "cancel", nextStatus: "cancelled" },
      { pool: poolCon(connection), findUserById: usuario },
    ),
    (error) => error.statusCode === undefined && /se cayó la base/.test(error.message),
  );
  assert.equal(connection.queries.at(-2).sql, "ROLLBACK");
  assert.equal(connection.queries.at(-1).sql, "RELEASE");
});
