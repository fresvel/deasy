// Tests unitarios del escritor de FILAS de flujo.
//
// Qué protegen. Los dos INSERT venían de `WorkflowSyncService`, donde no tenían ni un test propio:
// los cubría el characterization de rebote, con la base llena y el sync corriendo al lado. Al
// extraerlos se les pone red aquí, que es donde se puede mirar el escritor solo — el orden
// DELETE→INSERT, las columnas que lista cada uno y cómo serializa el JSONB de firmantes.

import test from "node:test";
import assert from "node:assert/strict";

import { replaceFillFlowSteps, replaceSignatureFlowSteps } from "./flowRows.js";

// Doble de conexión que REGISTRA cada sentencia con sus parámetros. Devuelve la forma de mysql2 que
// usa el adaptador (`[filas]` / `[header]`).
const buildConnection = () => {
  const calls = [];
  let nextInsertId = 900;

  return {
    calls,
    query: async (sql, params = []) => {
      calls.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
      if (/^INSERT INTO/i.test(sql.trim())) {
        nextInsertId += 1;
        return [{ insertId: nextInsertId, affectedRows: 1 }];
      }
      return [{ affectedRows: 1 }];
    },
  };
};

const fillStep = (extra = {}) => ({
  stepOrder: 1,
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

// --- Los pasos: DELETE + INSERT -----------------------------------------------------------------

test("replaceFillFlowSteps borra los pasos previos antes de insertar", async () => {
  const connection = buildConnection();
  await replaceFillFlowSteps(connection, 7, [fillStep(), fillStep({ stepOrder: 2, canReject: 1 })]);

  assert.match(connection.calls[0].sql, /^DELETE FROM fill_flow_steps/);
  assert.deepEqual(connection.calls[0].params, [7]);
  assert.equal(find(connection, /^INSERT INTO fill_flow_steps/).length, 2);
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
