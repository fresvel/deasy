// COMPROBACION DEL PASO 3b DE LA FASE 4: la EJECUCION de la firma, sobre un recorrido de verdad.
//
// POR QUE HACE FALTA, y es una medida, no una intuicion: la caracterizacion abre el recorrido de
// firma --tras aprobar la entrega hay 1 recorrido y 1 turno con `accion = 'firma'`-- pero NO FIRMA.
// `document_signatures` se queda a cero, porque firmar necesita un certificado y el microservicio
// de firma. Asi que los 320 goldens cubren `ensureSignatureFlowForDocumentVersion` y dejan sin tocar
// `registerSignatureEvidence` y `syncDocumentProgressFromSignatureRequest`, que son justo las dos
// funciones que mueven el estado.
//
// Esto las ejecuta contra el recorrido que la caracterizacion dejo abierto, insertando la evidencia
// a mano --el unico atajo: la firma criptografica no se simula-- y comprobando los DOS EJES:
//
//   · una firma `firmado`  -> el turno cierra, el recorrido pasa a `completado` y el documento avanza
//   · una firma `invalido` -> el turno dice que respondio PERO la firma no vale: cuenta como RECHAZO,
//                             el recorrido pasa a `rechazado` y el documento vuelve a «Observado»
//
// El segundo es el que no se puede afirmar sin esto, y es el que el frente 24 arreglo en su §11.
//
// No deja rastro: cada escenario va en una transaccion que se deshace.
//
// ⚠️ Y NO ESCRIBE NINGUNA TABLA A MANO salvo `document_signatures`, que es la evidencia que no se
// puede simular. El turno se mueve por `actualizarTurno` y el estado de la version por
// `actualizarEstado`, los dos del `datos/` de `tareas`: un script que escribiera directo seria un
// SEGUNDO ESCRITOR de esas tablas, y la comprobacion C del mapa lo caza --como lo cazo al escribir
// esto, con razon-.
import { getPostgresPool, conTransaccion } from "../config/postgres.js";
import { syncDocumentProgressFromSignatureRequest } from "../services/documents/DocumentSignatureWorkflowService.js";
import { actualizarTurno } from "../dominios/tareas/datos/recorrido.js";
import { actualizarEstado } from "../dominios/tareas/datos/documentVersions.js";

const escenario = async (codigoDeFirma) => {
  let salida = null;
  try {
    await conTransaccion(async (cx) => {
      const [recorridos] = await cx.query(
        `SELECT r.id, r.document_version_id, r.estado, r.paso_actual
           FROM tareas.recorridos r
          WHERE r.accion = 'firma'
          ORDER BY r.id ASC
          LIMIT 1`
      );
      const recorrido = recorridos?.[0];
      if (!recorrido) throw new Error("no hay recorrido de firma: corre test:char:run antes");

      const [turnos] = await cx.query(
        `SELECT id, persona_id FROM tareas.turnos WHERE recorrido_id = ? ORDER BY id ASC`,
        [recorrido.id]
      );
      if (!turnos.length) throw new Error("el recorrido de firma no tiene turnos");

      const [estados] = await cx.query(
        `SELECT id FROM firmas.signature_statuses WHERE code = ? LIMIT 1`,
        [codigoDeFirma]
      );
      const estadoId = Number(estados?.[0]?.id || 0);
      if (!estadoId) throw new Error(`no existe el estado tecnico '${codigoDeFirma}'`);

      // LA VERSION SE COLOCA EN «Pendiente de firma», y hace falta decir por que: la
      // caracterizacion deja el recorrido de firma abierto pero la version en «En llenado» --un flow
      // posterior la mueve--, y `transitionDocumentVersionState` valida la matriz de transiciones,
      // asi que sin esto salta «Transicion invalida: En llenado -> Firmado completo». Lo que se
      // comprueba aqui es el avance del recorrido, no la matriz, que tiene sus propios unitarios.
      await actualizarEstado(cx, Number(recorrido.document_version_id), "Pendiente de firma");

      // Cada turno responde, y cada respuesta trae su evidencia. El estado del turno es
      // `completado` en los DOS escenarios a proposito: lo que cambia es si la firma VALE.
      for (const turno of turnos) {
        await actualizarTurno(cx, Number(turno.id), { estado: "completado", respondido: new Date() });
        await cx.query(
          `INSERT INTO tareas.document_signatures
             (turno_id, document_version_id, signer_user_id, signature_status_id, signed_at)
           VALUES (?, ?, ?, ?, NOW())`,
          [turno.id, recorrido.document_version_id, turno.persona_id, estadoId]
        );
      }

      const resultado = await syncDocumentProgressFromSignatureRequest(cx, Number(turnos[0].id));

      const [versiones] = await cx.query(
        `SELECT status FROM tareas.document_versions WHERE id = ?`,
        [recorrido.document_version_id]
      );
      const [despues] = await cx.query(
        `SELECT estado, paso_actual FROM tareas.recorridos WHERE id = ?`,
        [recorrido.id]
      );

      salida = {
        turnos: turnos.length,
        antes: recorrido.estado,
        recorrido: despues?.[0]?.estado,
        pasoActual: despues?.[0]?.paso_actual,
        documento: versiones?.[0]?.status,
        devuelto: resultado?.instanceStatusCode,
      };
      throw new Error("__rollback__");
    });
  } catch (e) {
    if (e.message !== "__rollback__") throw e;
  }
  return salida;
};

const main = async () => {
  const pool = getPostgresPool();
  if (!pool) throw new Error("sin conexion a PostgreSQL");

  const bien = await escenario("firmado");
  const mal = await escenario("invalido");

  console.log(`turnos del recorrido de firma: ${bien.turnos} · estado de partida: ${bien.antes}`);
  console.log(`firma VALIDA   -> recorrido ${bien.recorrido} · paso_actual ${bien.pasoActual} · documento "${bien.documento}"`);
  console.log(`firma INVALIDA -> recorrido ${mal.recorrido} · paso_actual ${mal.pasoActual} · documento "${mal.documento}"`);

  const ok =
    bien.recorrido === "completado"
    && bien.pasoActual === null
    && ["Firmado completo", "Final"].includes(bien.documento)
    && mal.recorrido === "rechazado"
    && mal.documento === "Observado";
  console.log(ok ? "✓ los dos ejes mandan, y cada uno manda donde debe." : "✗ algo no cuadra");
  await pool.end?.();
  process.exit(ok ? 0 : 1);
};

main();
