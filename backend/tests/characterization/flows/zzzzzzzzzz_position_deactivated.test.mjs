// Contrato del PUESTO DESACTIVADO (decisión DR2 del dueño, 2026-08-23).
//
// ── Qué pasaba antes ──────────────────────────────────────────────────────────────────────
// Nada. Ningún trigger tocaba `unit_positions`, y desactivar un puesto NI SIQUIERA cierra su
// ocupación: la persona seguía figurando como titular vigente de un puesto que la institución ya
// no reconoce. Sus entregables se quedaban en el limbo sin aparecer en ninguna parte — y a
// diferencia de una silla vacante, aquí NO VA A LLEGAR NADIE, porque la silla desapareció.
//
// El vocabulario de causas de relevo ya tenía el nombre `position_deactivated` reservado, sin un
// solo emisor. Esto es lo que lo estrena.
//
// ── Qué fija ──────────────────────────────────────────────────────────────────────────────
//  1. El entregable ANTES de la fase de firma queda huérfano, con causa propia.
//  2. El que YA está en firma NO se toca —hay gente convocada, y eso es coherente con D1— pero
//     SÍ aparece en el panel del jefe, que es quien decide.
//  3. El cerrado no se toca en absoluto.
//
// Va el último del orden alfabético: desactiva un puesto de la fixture, y aunque se restaura al
// final, es el cambio más invasivo de toda la suite.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { get, post } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";
import { waitForReady } from "../lib/readiness.mjs";
import { query } from "../lib/db.mjs";

// El puesto responsable del entregable de la fixture, y la unidad que lo contiene.
const PUESTO = 25;

const jefeToken = async () => {
  const res = await post("/users/login", { body: { cedula: "1700000217", password: "Demo1234!" } });
  assert.equal(res.status, 200, "el jefe de la unidad debe poder entrar");
  return res.body.token;
};

before(async () => {
  await waitForReady();
});

after(async () => {
  // Autolimpieza best-effort: reactivar el puesto NO deshace el relevo —no hay trigger de 0→1, y
  // no debería haberlo: reactivar una silla no devuelve el trabajo por su cuenta—, así que lo que
  // se restaura es el puesto, no la tenencia.
  await query("UPDATE unit_positions SET is_active = 1 WHERE id = $1", [PUESTO]);
  await query("DELETE FROM task_item_tenures WHERE task_item_id IN (SELECT id FROM task_items WHERE title LIKE 'zz char puesto desactivado%')");
  await query("DELETE FROM document_versions WHERE task_item_id IN (SELECT id FROM task_items WHERE title LIKE 'zz char puesto desactivado%')");
  await query("DELETE FROM task_items WHERE title LIKE 'zz char puesto desactivado%'");
});

test("desactivar un puesto deja huérfanos SÓLO los entregables que aún no llegaron a firma", async () => {
  const origen = await query(
    "SELECT id, task_id, process_definition_template_id, template_artifact_id, start_date, end_date FROM task_items WHERE responsible_position_id = $1 LIMIT 1",
    [PUESTO],
  );
  assert.ok(origen.length, "la fixture debe traer algún entregable en ese puesto");

  // ⚠️ EL CASO EN FIRMA SE SIEMBRA AQUI, no se espera de la fixture. Se probó por mutación: dejar
  // que el trigger huerfanase TODO no ponía nada en rojo, porque en ese punto de la suite ningún
  // entregable de este puesto había llegado a la firma. Una prueba que sólo comprueba la mitad que
  // el escenario le regala no protege la otra — y la otra es justo la decisión.
  await query(
    `INSERT INTO task_items
       (task_id, process_definition_template_id, template_artifact_id, origin_kind, title,
        sort_order, created_by_person_id, responsible_position_id, assigned_person_id,
        document_status, start_date, end_date)
     SELECT $1, $2, $3, 'user_added', 'zz char puesto desactivado (en firma)', 90, 24, $4, 3,
            'Pendiente de firma', $5, $6`,
    [origen[0].task_id, origen[0].process_definition_template_id, origen[0].template_artifact_id,
     PUESTO, origen[0].start_date, origen[0].end_date],
  );

  const antes = await query(
    "SELECT id, document_status, assigned_person_id FROM task_items WHERE responsible_position_id = $1 ORDER BY id",
    [PUESTO],
  );
  const relevables = ["Inicial", "Pendiente de llenado", "En proceso", "Observado", "Listo para firma"];
  const esperados = antes.filter((r) => relevables.includes(r.document_status)).map((r) => Number(r.id));
  assert.ok(esperados.length, "el caso exige algún entregable antes de la firma");
  assert.ok(
    esperados.length < antes.length,
    "y alguno YA en firma: es la mitad que la mutación destapó como no cubierta",
  );

  await query("UPDATE unit_positions SET is_active = 0 WHERE id = $1", [PUESTO]);

  const despues = await query(
    `SELECT ti.id, ti.assigned_person_id, t.opened_by
       FROM task_items ti
       LEFT JOIN task_item_tenures t ON t.task_item_id = ti.id AND t.ended_at IS NULL
      WHERE ti.responsible_position_id = $1 ORDER BY ti.id`,
    [PUESTO],
  );

  for (const fila of despues) {
    if (esperados.includes(Number(fila.id))) {
      assert.equal(fila.assigned_person_id, null, `el entregable ${fila.id} debía quedar sin responsable`);
      assert.equal(
        fila.opened_by,
        "position_deactivated",
        `y con causa propia: la que llevaba años sin emisor (entregable ${fila.id})`,
      );
    } else {
      // Se mira la TENENCIA, no la caché. Probado por mutación: si el trigger cierra la tenencia
      // sin abrir otra, `assigned_person_id` se queda como estaba —el sincronizador sólo actúa
      // sobre tenencias ABIERTAS— y una aserción sobre la caché no ve nada. Lo que delata el daño
      // es el entregable sin tenencia vigente: nadie responde de él y ni siquiera consta el hueco.
      assert.ok(
        fila.opened_by,
        `🔴 el entregable ${fila.id} está en firma o cerrado y se quedó SIN TENENCIA VIGENTE`,
      );
      assert.notEqual(
        fila.opened_by,
        "position_deactivated",
        `🔴 el entregable ${fila.id} ya estaba en firma: no se le puede quitar el responsable`,
      );
      assert.notEqual(fila.assigned_person_id, null, `el entregable ${fila.id} debe conservar responsable`);
    }
  }
});

test("y todos ellos aparecen en el panel del jefe, incluidos los que están en firma", async () => {
  // Éste es el término que hace falta y que no es obvio: desactivar NO cierra la ocupación, así que
  // un entregable en fase de firma sigue teniendo un titular «vigente» y los otros dos criterios del
  // panel lo dan por sano. Sin mirar `is_active`, desaparecería justo el que más necesita que lo
  // miren, porque el trigger tampoco lo toca.
  const token = await jefeToken();
  const res = await get("/tarea/supervised-stuck", { token });
  assert.equal(res.status, 200);

  const delPuesto = (res.body.items || []).filter((i) => Number(i.responsible_position_id) === PUESTO);
  assert.ok(delPuesto.length, "el panel debe listar los entregables del puesto desactivado");
  for (const item of delPuesto) {
    assert.equal(item.position_is_active, false);
    assert.equal(
      item.reason,
      "puesto_desactivado",
      "el motivo más específico manda: dice que no va a llegar nadie, no sólo que ahora no hay quien lo lleve",
    );
  }
});
