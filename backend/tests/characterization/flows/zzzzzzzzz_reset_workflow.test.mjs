// Contrato HTTP del RESET del flujo de un entregable.
//
// ── Por qué nace (2026-08-23) ──────────────────────────────────────────────────────────────
// `POST .../reset-workflow` no tenía contrato, y al retirar la tabla `documents` se quedó
// apuntando a una columna que ya no existía (`document_versions.document_id`). Devolvía 500 y la
// suite entera seguía en VERDE, porque ningún flow lo tocaba. Lo mismo que le pasó al traspaso
// manual dos días antes: lo que no tiene contrato HTTP no se entera de que lo rompiste.
//
// Y ni `check:sql-comments` ni `check:sql-aliases` podían cazarlo: el fallo no era un backtick ni
// un alias huérfano, era un NOMBRE DE COLUMNA equivocado. Eso sólo lo dice PostgreSQL al ejecutar.
//
// ── Qué fija ──────────────────────────────────────────────────────────────────────────────
// Que responde, que nace una VERSIÓN NUEVA (no se pisa la anterior) y que la nueva arranca en
// Borrador. Va el último del orden alfabético a propósito: es el único flow que añade una versión
// documental, y así no mueve las huellas de nadie.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { post } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";
import { waitForReady } from "../lib/readiness.mjs";
import { query } from "../lib/db.mjs";
import { FIXTURE } from "../config.mjs";

before(async () => {
  await waitForReady();
});

test("reset · nace una versión NUEVA y la anterior se conserva", async () => {
  const token = await tokenFor("usuario");
  const itemId = 1;

  const antes = await query(
    "SELECT id, version, status FROM document_versions WHERE task_item_id = $1 ORDER BY version",
    [itemId],
  );
  assert.ok(antes.length, "la fixture debe traer al menos una versión");

  const res = await post(
    `/users/${FIXTURE.usuarioPersonId}/process-definitions/${FIXTURE.definitionId}/task-items/${itemId}/reset-workflow`,
    { token, body: {} },
  );

  // ⚠️ SE ACEPTAN DOS RESPUESTAS, y no es laxitud: el reset sólo lo puede pedir el responsable del
  // paso ACTUAL, y para cuando este flow corre —va el último— el flujo del entregable 1 ya ha
  // avanzado y ese paso puede ser de otra persona. Depender del estado del flujo haría la prueba
  // frágil por un motivo que no es el que vigila.
  //
  // Lo que se fija es que el endpoint RESPONDE y que su guard corre: un 403 con ese mensaje prueba
  // que se resolvió la versión vigente y se miró de quién es el paso actual.
  //
  // ⚠️ LO QUE ESTA RED **NO** CUBRE, y conviene saberlo: el camino de ÉXITO. El defecto del
  // 2026-08-23 —un nombre de columna que ya no existía— vivía en la creación de la versión nueva,
  // o sea DESPUÉS del guard, y en el estado final de la suite el guard rechaza antes de llegar
  // ahí. Comprobado por mutación: devolver la columna vieja NO pone esta prueba en rojo.
  // Cubrirlo pide un caso que corra sobre fixture fresca y sepa deshacer la versión que crea.
  assert.notEqual(res.status, 500, `el reset no debe reventar: ${JSON.stringify(res.body)}`);
  assert.ok([200, 403].includes(res.status), `esperaba 200 o 403 y vino ${res.status}`);

  const despues = await query(
    "SELECT id, version, status FROM document_versions WHERE task_item_id = $1 ORDER BY version",
    [itemId],
  );

  if (res.status === 403) {
    assert.match(String(res.body?.message || ""), /responsable del paso actual/);
    assert.equal(despues.length, antes.length, "un reset rechazado no debe tocar las versiones");
    return;
  }

  assert.equal(despues.length, antes.length + 1, "el reset AÑADE una versión, no reescribe la anterior");
  const nueva = despues[despues.length - 1];
  assert.equal(nueva.status, "Borrador", "la versión nueva arranca en Borrador");
  assert.ok(
    Number(nueva.version) > Number(antes[antes.length - 1].version),
    "y su número es mayor que el de la anterior",
  );
});
