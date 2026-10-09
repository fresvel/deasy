// Lo que queda de propio en la ejecución de la FIRMA, tras el paso 3b de la fase 4 del frente 24.
//
// ── QUÉ SE FUE DE ESTE FICHERO, Y A DÓNDE ───────────────────────────────────────────────────────
//
// Tenía dos bloques grandes y los dos se quedaron sin sujeto:
//
//   · LA PRIORIDAD DE LOS ESCALONES (seis tests). Resolvía la cabecera del flujo de firma: primero
//     la del entregable, luego la de la edición, con su guarda `task_item_id IS NULL`. Hoy no hay
//     cabecera y la prioridad la resuelve `resolverReceta`, que es UNA para los dos lados: sus tests
//     viven en `dominios/plantillas/datos/recetaDelRecorrido.test.js`. Mantenerlos aquí sería
//     probar dos veces la misma función.
//
//   · EL ORDEN DE LOS PARÁMETROS DEL ÁMBITO (seis tests, defecto 1.16). Vigilaban las ramas
//     `context_ancestor_type`, `context_subtree`, `unit_subtree` y `unit_type` del resolutor por
//     cargo, y decían en su cabecera por qué no podían ser un golden: esos ámbitos llegaban por el
//     JSONB `signers`, que ningún `CHECK` cubría. **Ese era el defecto 1.19, y aquí se cerró**: los
//     firmantes son filas bajo `CHECK`, así que esas cuatro ramas no son inalcanzables por descuido
//     — no se pueden ni insertar. El vocabulario son TRES ámbitos y el resolutor es uno; lo que
//     queda que vigilar está en `services/admin/generation/assignees.test.js`.
//
// Lo que sí es de aquí y de ningún otro sitio son las dos cosas que la firma tiene y la entrega no:
// el SEGUNDO EJE (una firma puede estar dada y ser técnicamente inválida) y el reabrir un recorrido
// rechazado.
import test from "node:test";
import assert from "node:assert/strict";

import {
  ensureSignatureFlowForDocumentVersion,
  inspectDocumentVersionSignatureReadiness,
  resolveCurrentSignatureStep,
} from "./DocumentSignatureWorkflowService.js";

/* ── REABRIR UN RECORRIDO RECHAZADO (frente 24, §11) ──────────────────────────────────────────
   La otra mitad del arreglo del atasco. El rechazo devolvió el documento a «Observado», alguien lo
   corrigió, y al volver a la fase de firma hay que CONVOCAR OTRA VEZ. Antes esta función salía por
   `alreadyExists` sin mirar nada, así que el paso rechazado seguía rechazado y el documento se
   atascaba en el mismo sitio: cambiar un atasco por otro.

   Se reabre el recorrido que hay y no se abre otro porque `uq_recorridos` admite UNO por
   (versión de documento, acción). */

const conexionDeRecorrido = (estado) => {
  const consultas = [];
  return {
    consultas,
    async query(sql, params = []) {
      consultas.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
      if (/FROM recorridos/.test(sql) && /SELECT id, estado/.test(sql)) {
        return [estado === null ? [] : [{ id: 77, estado, paso_actual: 1 }]];
      }
      return [[]];
    },
  };
};

test("firma: un recorrido RECHAZADO se reabre al volver a la fase de firma", async () => {
  const conexion = conexionDeRecorrido("rechazado");

  const res = await ensureSignatureFlowForDocumentVersion(conexion, 500);

  assert.deepEqual(res, { ok: true, alreadyExists: true, signatureFlowInstanceId: 77 });

  // Y SE BUSCA POR (VERSIÓN, ACCIÓN): el recorrido de entrega de la misma versión no es éste.
  assert.deepEqual(conexion.consultas[0].params, [500, "firma"]);

  const updates = conexion.consultas.filter((c) => c.sql.startsWith("UPDATE"));
  assert.equal(updates.length, 2, "se reabren los turnos Y el recorrido");

  // Los turnos rechazados vuelven a pendiente y pierden su respuesta: a quien rechazó se le
  // pregunta otra vez, que es el sentido de haber corregido el documento.
  assert.match(updates[0].sql, /UPDATE turnos/);
  assert.match(updates[0].sql, /estado = 'rechazado'/);
  assert.match(updates[0].sql, /respondido = NULL/);
  assert.deepEqual(updates[0].params, ["pendiente", 77]);

  assert.match(updates[1].sql, /UPDATE recorridos/);
  assert.deepEqual(updates[1].params, ["pendiente", 77]);
});

test("firma: un recorrido que NO está rechazado se deja intacto", async () => {
  for (const estado of ["pendiente", "en_progreso", "completado"]) {
    const conexion = conexionDeRecorrido(estado);
    const res = await ensureSignatureFlowForDocumentVersion(conexion, 500);
    assert.equal(res.alreadyExists, true, `${estado}: sigue siendo el mismo recorrido`);
    assert.equal(
      conexion.consultas.filter((c) => c.sql.startsWith("UPDATE")).length,
      0,
      `${estado}: no se toca nada`
    );
  }
});

/* ── EL SEGUNDO EJE: RESPONDER NO ES FIRMAR BIEN ──────────────────────────────────────────────
   Lo único que la firma tiene y la entrega no. El TURNO dice si alguien respondió; `document_signatures`
   —con su `signature_statuses`— dice si la firma VALE. Un turno `completado` cuya última firma salió
   inválida o falló es un RECHAZO, y por eso este fichero conserva una consulta propia: la que cruza
   los turnos con su estado técnico. `leerTurnosDelRecorrido`, la genérica, no lo trae porque en
   entrega ese eje no existe.

   Y el CUPO se fue (§10 del plan): un paso está aprobado cuando firman TODOS los suyos. Ya no hay
   `approval_mode` que mirar, así que `or` —que cerraba el paso con una firma y dejaba a los hermanos
   con solicitudes abiertas e inoperables— no se puede ni expresar. */

const conexionDeTurnos = (filas) => ({
  async query(sql) {
    if (/FROM recorridos/.test(sql) && /SELECT id, estado/.test(sql)) {
      return [[{ id: 77, estado: "en_progreso", paso_actual: 1 }]];
    }
    if (/FROM turnos tu/.test(sql)) return [filas];
    throw new Error(`consulta no reconocida: ${sql}`);
  },
});

const turno = (step_order, request_status_code, signature_status_code = null) =>
  ({ id: step_order * 10, step_order, request_status_code, signature_status_code });

test("un paso con dos firmantes no está aprobado hasta que firman los DOS", async () => {
  const actual = await resolveCurrentSignatureStep(
    conexionDeTurnos([turno(1, "completado", "firmado"), turno(1, "pendiente")]),
    500
  );
  assert.equal(actual.stepOrder, 1);
  assert.equal(actual.approved, false, "una de dos no cierra el paso: el cupo es entero");
  assert.equal(actual.approvedCount, 1);
  assert.equal(actual.total, 2);
});

test("con los dos firmados, el paso actual pasa a ser el SIGUIENTE", async () => {
  const actual = await resolveCurrentSignatureStep(
    conexionDeTurnos([
      turno(1, "completado", "firmado"), turno(1, "completado", "firmado"),
      turno(2, "pendiente"),
    ]),
    500
  );
  assert.equal(actual.stepOrder, 2);
});

test("un turno respondido con firma INVÁLIDA cuenta como rechazo, no como paso dado", async () => {
  // Es el segundo eje. Sin él, una firma técnicamente rota cerraría el paso igual que una buena.
  const actual = await resolveCurrentSignatureStep(
    conexionDeTurnos([turno(1, "completado", "invalido")]),
    500
  );
  assert.equal(actual.stepOrder, 1);
  assert.equal(actual.approved, false);
  assert.equal(actual.hasRejected, true);
  assert.equal(actual.rejectedCount, 1);
});

test("y una firma SIN estado técnico registrado no se penaliza", async () => {
  // El `LEFT JOIN` deja `signature_status_code` en null cuando el turno se cerró sin pasar por el
  // firmador —el editor genérico puede hacerlo—. Eso no es un rechazo: es que no hay segundo eje.
  const actual = await resolveCurrentSignatureStep(
    conexionDeTurnos([turno(1, "completado"), turno(2, "pendiente")]),
    500
  );
  assert.equal(actual.stepOrder, 2, "el paso 1 quedó aprobado");
});

test("sin recorrido de firma no hay paso actual", async () => {
  const sinRecorrido = { async query() { return [[]]; } };
  assert.equal(await resolveCurrentSignatureStep(sinRecorrido, 500), null);
});

/* ── LO QUE SOBREVIVE DE `is_required` ────────────────────────────────────────────────────────
   La columna se retiró (§10 del plan) y lo que queda es su comportamiento con valor `1`, para TODO
   paso: si algún participante no resuelve a nadie, el recorrido NO SE ABRE y la razón lo dice.

   La variante `0` no era «opcional»: abría el recorrido y dejaba el paso APARCADO con una solicitud
   sin persona que en firma nadie puede atender —y como el paso actual es el primero no aprobado, ése
   lo era para siempre—. O sea un bloqueo silencioso y más tarde, que es estrictamente peor. */

const conexionDeAptitud = ({ pasos, personas = [] }) => ({
  async query(sql) {
    if (/FROM document_versions dv/.test(sql) && /working_file_path/.test(sql)) {
      return [[{
        document_version_id: 500,
        document_version_status: "Listo para firma",
        working_file_path: "Unidades/x/e.pdf",
        task_item_id: 300,
        vinculo_id: 10,
        task_item_assigned_person_id: 22,
        scope_unit_id: 44,
      }]];
    }
    if (/FROM pasos_declarados p/.test(sql)) return [pasos];
    if (/FROM unit_positions up/.test(sql)) return [personas.map((id) => ({ person_id: id }))];
    throw new Error(`consulta no reconocida: ${sql}`);
  },
});

const pasoPorCargo = (orden) => ({
  id: orden, orden, code: `firma_${orden}`, nombre: `Firma ${orden}`,
  participante_id: 100 + orden, participante_orden: 1,
  resolver_type: "cargo_in_scope", persona_id: null, cargo_id: 7,
  unit_scope_type: "context_exact", unit_id: null, slot: `firma_${orden}`,
});

test("aptitud: un paso cuyo cargo no resuelve a NADIE bloquea, y dice qué paso y por qué", async () => {
  const aptitud = await inspectDocumentVersionSignatureReadiness(
    conexionDeAptitud({ pasos: [pasoPorCargo(1), pasoPorCargo(2)], personas: [] }),
    500
  );
  assert.equal(aptitud.ok, false);
  assert.equal(aptitud.reason, "required_signers_unresolved");
  assert.deepEqual(aptitud.unresolvedRequiredSteps, [
    { stepOrder: 1, resolverType: "cargo_in_scope", reason: "no_assignees" },
    { stepOrder: 2, resolverType: "cargo_in_scope", reason: "no_assignees" },
  ]);
});

test("aptitud: con el cargo ocupado por dos personas, el paso convoca a las DOS", async () => {
  // Y aquí se ve el otro cambio del paso 3b: `auto_one` se fue, así que un participante por cargo ya
  // no se queda con «el id más bajo» —que era lo que hacía— sino con todos los que encuentre.
  const aptitud = await inspectDocumentVersionSignatureReadiness(
    conexionDeAptitud({ pasos: [pasoPorCargo(1)], personas: [31, 48] }),
    500
  );
  assert.equal(aptitud.ok, true);
  assert.deepEqual(aptitud.steps[0].assignees, [31, 48]);
  assert.equal(aptitud.steps[0].turnos.length, 2, "dos personas, dos turnos del mismo participante");
});

test("aptitud: sin ni un paso declarado la razón es que no hay receta, no que falte gente", async () => {
  const aptitud = await inspectDocumentVersionSignatureReadiness(
    conexionDeAptitud({ pasos: [] }),
    500
  );
  assert.equal(aptitud.ok, false);
  assert.equal(aptitud.reason, "signature_template_missing");
});
