// Characterization: el RELEVO de un entregable cuando cambia quién ocupa su puesto.
//
// Qué se fija aquí y por qué no estaba antes. La condición que protegía a los entregables
// "ya empezados" preguntaba por la ausencia de documento
// (`NOT EXISTS (SELECT 1 FROM documents d WHERE d.task_item_id = ti.id)`), y eso NUNCA se cumplía:
// el documento se crea al lanzar, en la misma transacción que el entregable. El backfill devolvía
// `{"reconciled":0}` SIEMPRE y los dos triggers de `position_assignments` no movían una sola fila.
// La señal correcta es `task_items.user_started_at`, que sella el `start` de un paso de entrega.
//
// `POST /admin/sql/task-items/reconcile-assignments` es la superficie HTTP de ese guard
// (`TaskAssignmentService.reconcileOpenTaskItemAssignments`), y comparte predicado literal con las
// tres sentencias de los triggers. Los dos sentidos del contrato quedan fijados: reasigna lo NO
// iniciado, y NO toca lo iniciado.
//
// Va el ÚLTIMO del orden alfabético a propósito: es el único flow que reasigna responsables de la
// fixture, y así no mueve las huellas `list_*` de admin_crud ni el espacio de trabajo de usuario.
// Es autolimpiante: el único cambio que introduce a mano (el responsable del entregable iniciado)
// se restaura, y el resto es idempotente por definición.

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { get, post, put } from "../lib/http.mjs";
import { matchSnapshot } from "../lib/snapshot.mjs";
import { waitForReady } from "../lib/readiness.mjs";
import { tokenFor } from "../lib/auth.mjs";

const SUITE = "task_item_relay";

const RECONCILE = "/admin/sql/task-items/reconcile-assignments";

const listTaskItems = async (token) => {
  const res = await get("/admin/sql/task_items", { token });
  assert.equal(res.status, 200, `list task_items debe responder 200: ${JSON.stringify(res.body)}`);
  const rows = Array.isArray(res.body) ? res.body : (res.body?.rows ?? res.body?.data ?? []);
  assert.ok(rows.length, "la fixture debe tener entregables");
  return rows;
};

const started = (rows) => {
  const row = rows.find((r) => r.user_started_at);
  assert.ok(row, "la fixture debe tener un entregable INICIADO (user_started_at sellado)");
  return row;
};

const notStarted = (rows) => rows.filter((r) => !r.user_started_at);

before(async () => {
  await waitForReady();
});

test("el backfill reasigna los entregables abiertos y NO iniciados al ocupante de su puesto", async () => {
  const token = await tokenFor("admin");
  const res = await post(RECONCILE, { token, body: {} });
  // Antes del arreglo esto era {"reconciled":0} en cualquier fixture y en cualquier base:
  // la condición del documento no se cumplía nunca.
  matchSnapshot(SUITE, "reconcile_first_pass", { status: res.status, body: res.body });
  assert.ok(res.body?.reconciled > 0, "el backfill debe mover al menos un entregable");

  const rows = await listTaskItems(token);
  for (const row of notStarted(rows)) {
    assert.ok(
      row.assigned_person_id,
      `el entregable ${row.id} (no iniciado) debe quedar con responsable tras el backfill`,
    );
  }
});

test("el backfill es idempotente: la segunda pasada no mueve nada", async () => {
  const token = await tokenFor("admin");
  const res = await post(RECONCILE, { token, body: {} });
  matchSnapshot(SUITE, "reconcile_second_pass", { status: res.status, body: res.body });
});

// ⚠️ ESTE CASO CAMBIO DE SIGNIFICADO el 2026-08-23 (decision D1 del dueño), y conviene leer por que.
//
// Se llamaba «un entregable YA INICIADO no lo toca el backfill». Esa regla congelaba a nombre de
// quien se fuera CUALQUIER entregable que alguien hubiera abierto, aunque no llevara nada dentro:
// bastaba pulsar «iniciar» para que ningun relevo volviera a moverlo nunca.
//
// Ahora el corte esta al ENTRAR EN LA FASE DE FIRMA, que es cuando hay gente convocada con
// solicitudes a su nombre. Lo empezado sin convocar a nadie SI se releva — y eso lo fija el caso
// siguiente, que es la otra mitad de esta frontera.
//
// La prueba seguia en verde con la regla nueva, pero POR OTRO MOTIVO: el entregable que usa acaba la
// suite en «Pendiente de firma». Pasaba por la razon correcta con el nombre equivocado, que es
// exactamente como una prueba deja de proteger sin que nadie se entere.
test("un entregable EN FASE DE FIRMA no lo toca el backfill, aunque su responsable no ocupe el puesto", async () => {
  const token = await tokenFor("admin");
  const antes = started(await listTaskItems(token));
  assert.ok(
    !["Inicial", "Pendiente de llenado", "En proceso", "Observado", "Listo para firma"].includes(antes.document_status),
    `el caso exige un entregable ya en firma, y vino "${antes.document_status}"`,
  );
  const original = antes.assigned_person_id;

  // Se le pone un responsable que NO es el ocupante vigente de su puesto: sin el guard, el
  // backfill lo devolvería al ocupante. Cualquier otra persona de la fixture vale.
  //
  // El caso se prepara por TRASPASO y no editando la tabla, y ése es el cambio del 2026-08-23:
  // `task_items.assigned_person_id` es una CACHE de la tenencia vigente y ahora es de solo lectura
  // en el editor genérico. Escribirla a mano producía un estado que el modelo dice que no existe
  // —la caché diciendo una cosa y `task_item_tenures` otra—, y esta misma prueba lo estaba
  // fabricando para montar su escenario.
  const intruso = Number(original) === 1 ? 2 : 1;
  const cambio = await post(`/admin/sql/task-items/${antes.id}/handover`, {
    token,
    body: { to_person_id: intruso, reason: "preparación del caso: responsable ajeno al puesto" },
  });
  assert.equal(cambio.status, 200, `no se pudo preparar el caso: ${JSON.stringify(cambio.body)}`);

  const res = await post(RECONCILE, { token, body: {} });
  matchSnapshot(SUITE, "reconcile_skips_started_item", { status: res.status, body: res.body });

  const despues = started(await listTaskItems(token));
  assert.equal(
    Number(despues.assigned_person_id),
    intruso,
    "un entregable en fase de firma debe conservar su responsable: el relevo automático no le aplica",
  );

  // Round-trip autolimpiante, por el mismo camino.
  if (original) {
    await post(`/admin/sql/task-items/${antes.id}/handover`, {
      token,
      body: { to_person_id: Number(original), reason: "restauración de la prueba" },
    });
  }
});

// La caché no se escribe a mano. Es la red de la invariante: si alguien vuelve a abrir
// `assigned_person_id` en el editor genérico, se puede dejar la caché y la tenencia diciendo cosas
// distintas sin que nada se queje — que es exactamente el defecto que `task_assignments` tenía.
test("la caché del responsable es de SOLO LECTURA: se mueve por traspaso, no editando la tabla", async () => {
  const token = await tokenFor("admin");
  const filas = await listTaskItems(token);
  const item = filas[0];
  const res = await put("/admin/sql/task_items", {
    token,
    body: { keys: { id: item.id }, data: { assigned_person_id: 1 } },
  });
  assert.notEqual(res.status, 200, "el editor genérico NO debe poder escribir la caché");
  assert.notEqual(res.status, 500, "y debe rechazarlo como entrada inválida, no reventar");
});

// ── El RELEVO MANUAL (`POST /admin/sql/task-items/:id/handover`) ────────────────────────────────
//
// No tenía contrato HTTP, y costó caro: su guard leía `task_items.status` contra siete literales
// que la columna nunca tomó, así que no bloqueaba nada; y al retirarse la columna el SELECT pasó a
// fallar en ejecución, dejando el endpoint entero en 500 con la suite en verde.
//
// Este caso fija lo mínimo que no puede volver a romperse: que RESPONDE, que MUEVE al responsable
// y que deja ASIENTO. Es autolimpiante — devuelve el entregable a su responsable original.
test("relevo manual · traspasa el entregable, mueve al dueño del documento y deja asiento", async () => {
  const token = await tokenFor("admin");
  const filas = await listTaskItems(token);
  const item = filas.find((r) => r.assigned_person_id) || filas[0];
  const original = item.assigned_person_id ? Number(item.assigned_person_id) : null;
  const destino = original === 1 ? 2 : 1;

  const res = await post(`/admin/sql/task-items/${item.id}/handover`, {
    token,
    body: { to_person_id: destino, reason: "prueba de contrato" },
  });
  assert.equal(res.status, 200, `el relevo manual debe responder 200 y vino ${res.status}: ${JSON.stringify(res.body)}`);
  assert.equal(Number(res.body?.to_person_id ?? res.body?.data?.to_person_id), destino, "traspasa a quien se pidió");

  const historial = await get(`/admin/sql/task-items/${item.id}/handovers`, { token });
  assert.equal(historial.status, 200, "el historial de relevos debe responder 200");
  const asientos = Array.isArray(historial.body) ? historial.body : (historial.body?.data ?? []);
  assert.ok(
    asientos.some((h) => Number(h.to_person_id) === destino && h.trigger_kind === "manual"),
    "el traspaso deja asiento con causa `manual`",
  );

  // Round-trip autolimpiante.
  if (original) {
    await post(`/admin/sql/task-items/${item.id}/handover`, {
      token,
      body: { to_person_id: original, reason: "restauracion de la prueba" },
    });
  }
});

// La OTRA MITAD de la frontera de D1, y la que el cambio del 2026-08-23 abre: un entregable cuyo
// documento ha avanzado pero AÚN NO ha entrado en la fase de firma sí se releva solo.
//
// Se usa el último estado relevable —«Listo para firma»— a propósito: es el borde exacto. El
// llenado terminó, pero todavía no se ha convocado a nadie a firmar. Un estado más y no se movería.
test("un entregable avanzado pero ANTES de la firma SÍ vuelve a su ocupante", async () => {
  const token = await tokenFor("admin");
  const candidato = (await listTaskItems(token)).find(
    (r) => r.document_status === "Listo para firma" && r.assigned_person_id,
  );
  assert.ok(candidato, "la fixture debe dejar un entregable en el borde («Listo para firma»)");

  const original = Number(candidato.assigned_person_id);
  const intruso = original === 1 ? 2 : 1;
  const cambio = await post(`/admin/sql/task-items/${candidato.id}/handover`, {
    token,
    body: { to_person_id: intruso, reason: "preparación del caso: responsable ajeno al puesto" },
  });
  assert.equal(cambio.status, 200, `no se pudo preparar el caso: ${JSON.stringify(cambio.body)}`);

  const res = await post(RECONCILE, { token, body: {} });
  assert.equal(res.status, 200);

  const despues = (await listTaskItems(token)).find((r) => Number(r.id) === Number(candidato.id));
  assert.notEqual(
    Number(despues.assigned_person_id),
    intruso,
    "🔴 el relevo dejó de alcanzar a lo avanzado-pero-sin-firmar: ha vuelto el guard de «ya iniciado»",
  );
  assert.equal(
    Number(despues.assigned_person_id),
    original,
    "y vuelve al ocupante vigente de su puesto, que es el original",
  );
});
