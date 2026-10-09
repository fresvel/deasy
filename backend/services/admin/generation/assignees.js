// QUIEN HACE EL PASO: traduce un PARTICIPANTE declarado --cargo en tal ambito, responsable del
// entregable, persona concreta-- a personas de carne y hueso. Si esto se equivoca, el trabajo le
// llega a quien no toca.
//
// ── UNA SOLA FUNCION PARA LOS DOS LADOS (frente 24, fase 4, paso 3) ─────────────────────────────
//
// Habia DOS resolutores, uno por mitad, y eran 44 lineas identicas de 50 en dominios distintos. La
// duplicacion no era el problema: era el SINTOMA de que las dos mitades son el mismo mecanismo. Con
// un solo recorrido, la pregunta «¿a quien le toca este turno?» tiene una sola respuesta.
//
// Y resuelve un PARTICIPANTE, no un paso. Esa es la otra mitad del cambio: antes el resolutor vivia
// en las columnas del paso --y en firma, ademas, duplicado dentro del JSONB `signers`, que ganaba--,
// asi que un paso solo sabia expresar UN modo de encontrar a alguien. Ahora un paso tiene 1..N
// participantes y cada uno trae el suyo.
//
// ── LO QUE YA NO ESTA, y por que ────────────────────────────────────────────────────────────────
//
//   · `document_owner`, `position`, `manual_pick` y los ambitos `context_subtree` /
//     `context_ancestor_type`: INALCANZABLES. Sobrevivian porque el JSONB `signers` no pasaba por
//     ningun CHECK; a filas, pasa.
//   · `unit_subtree` y `unit_type`: ninguna pantalla los produce. El editor de pasos ofrece dos
//     ambitos y el constructor de runtime emite `unit_exact` o `all_units`.
//   · `selection_mode`, y con el `auto_one`. Era «quedate con UNO», implementado como
//     `ORDER BY person_id ASC` + `slice(0, 1)`: o sea, el id mas bajo. No es una regla de negocio
//     --es la misma arbitrariedad que el repositorio ya retiro en `one_per_unit`-- y el dueno
//     decidio quitarla. CONSECUENCIA MEDIBLE: un participante por cargo convoca ahora a TODOS los
//     que encuentre, no a uno.
import { resolveScopeForStep } from "./primitives.js";
import {
  abrirTurno,
  actualizarTurno,
  borrarTurnos,
  leerTurnosDelRecorrido
} from "../../../dominios/tareas/index.js";

// Las personas que ocupan un cargo dentro de un ambito. Tres ambitos, no cinco.
export const resolverPersonasPorCargo = async (connection, participante, context = null) => {
  if (!participante?.cargoId) {
    return [];
  }

  // `resolveScopeForStep` habla en snake_case porque lo compartia con las columnas del paso.
  const scope = resolveScopeForStep(
    { unit_scope_type: participante.unitScopeType, unit_id: participante.unitId },
    context
  );
  const params = [participante.cargoId];
  let query = `
    SELECT DISTINCT pa.person_id
    FROM unit_positions up
    INNER JOIN units u ON u.id = up.unit_id
    INNER JOIN position_assignments pa
      ON pa.position_id = up.id
     AND pa.is_current = 1
    WHERE up.is_active = 1
      AND pa.person_id IS NOT NULL
      AND up.cargo_id = ?`;

  // `unit_exact` y `context_exact` producen EL MISMO filtro; lo que cambia es de donde sale la
  // unidad: la escrita en el participante, o la del documento. Lo resuelve `resolveScopeForStep`.
  if (scope.unitScopeType === "unit_exact" || scope.unitScopeType === "context_exact") {
    if (!scope.unitId) {
      return [];
    }
    query += "\n      AND up.unit_id = ?";
    params.push(scope.unitId);
  }
  // `all_units` no acota: cae aqui sin anadir filtro.

  query += "\n    ORDER BY pa.person_id ASC";

  const [rows] = await connection.query(query, params);
  return rows.map((row) => Number(row.person_id)).filter(Boolean);
};

// EL RESOLUTOR. Tres formas de nombrar a alguien, cerradas por CHECK en la base.
export const resolverParticipante = async (connection, participante, context) => {
  if (!participante || !context) {
    return [];
  }

  switch (participante.resolverType) {
    case "specific_person":
      return participante.personaId ? [Number(participante.personaId)] : [];
    case "task_assignee": {
      // La reserva era el creador de la TAREA (`tasks.created_by_user_id`), retirado el
      // 2026-08-23: estaba NULL en 12 de 13 tareas, asi que como reserva casi nunca respondia.
      // Ahora es quien ENCARGO el entregable, que es el dato equivalente y vive en la misma fila.
      const assignee = context.task_item_assigned_person_id || context.item_created_by_person_id;
      return assignee ? [Number(assignee)] : [];
    }
    case "cargo_in_scope":
      return resolverPersonasPorCargo(connection, participante, context);
    default:
      return [];
  }
};

// Todas las personas de un PASO: la union de lo que resuelve cada uno de sus participantes, sin
// repetir. Devuelve pares (participante, persona) porque el turno apunta al participante.
export const resolverPasoCompleto = async (connection, paso, context) => {
  const turnos = [];
  for (const participante of paso.participantes) {
    const personas = await resolverParticipante(connection, participante, context);
    if (!personas.length) {
      // Sin nadie resoluble: un turno APARCADO, sin persona y marcado manual. Es lo que permite el
      // auto-reclamo en entrega, y lo que avisa de que falta alguien en firma.
      turnos.push({ participanteId: participante.id, personaId: null, manual: 1 });
      continue;
    }
    for (const personaId of personas) {
      turnos.push({ participanteId: participante.id, personaId, manual: 0 });
    }
  }
  return turnos;
};

// LA REPARACION. Corre cuando la receta cambia debajo de un recorrido YA ABIERTO: reconcilia los
// turnos con lo que los participantes resuelven AHORA.
//
// El criterio es el mismo que tenia la version por solicitudes, y conviene no perderlo: un turno ya
// RESPONDIDO no se toca --ni se mueve ni se borra--, porque es un hecho. Lo que se reconcilia es lo
// que sigue abierto; un turno aparcado (sin persona) se REUTILIZA para la primera persona que ahora
// si resuelve, en vez de crear uno nuevo y dejar basura.
export const repararTurnos = async (connection, { recorridoId, accion, pasos, context }) => {
  const existentes = await leerTurnosDelRecorrido(connection, recorridoId);
  const porParticipante = new Map();
  for (const t of existentes) {
    if (!porParticipante.has(t.participante_id)) porParticipante.set(t.participante_id, []);
    porParticipante.get(t.participante_id).push(t);
  }

  const sobran = [];
  for (const paso of pasos) {
    for (const participante of paso.participantes) {
      const deEste = porParticipante.get(participante.id) || [];
      const respondidos = deEste.filter((t) => t.respondido);
      const abiertos = deEste.filter((t) => !t.respondido);
      const personas = await resolverParticipante(connection, participante, context);

      // Lo que ya respondio se queda, y su persona no vuelve a convocarse.
      const yaConvocadas = new Set(respondidos.map((t) => Number(t.persona_id)).filter(Boolean));
      const pendientesDeConvocar = personas.filter((p) => !yaConvocadas.has(Number(p)));

      const reutilizables = [...abiertos];
      for (const personaId of pendientesDeConvocar) {
        const mismo = reutilizables.find((t) => Number(t.persona_id) === Number(personaId));
        if (mismo) {
          reutilizables.splice(reutilizables.indexOf(mismo), 1);
          continue;
        }
        const aReutilizar = reutilizables.shift();
        if (aReutilizar) {
          await actualizarTurno(connection, aReutilizar.id, {
            estado: "pendiente", personaId, manual: 0, respondido: null, nota: null,
          });
        } else {
          await abrirTurno(connection, {
            recorridoId, accion, participanteId: participante.id, personaId, manual: 0,
          });
        }
      }

      // Lo que sobra: turnos abiertos que ya no corresponden a nadie. Si NO resuelve nadie, se deja
      // UNO aparcado --es la senal de que falta responsable-- y se tira el resto.
      if (!personas.length) {
        if (!deEste.length) {
          await abrirTurno(connection, {
            recorridoId, accion, participanteId: participante.id, personaId: null, manual: 1,
          });
        }
        sobran.push(...reutilizables.slice(1).map((t) => t.id));
      } else {
        sobran.push(...reutilizables.map((t) => t.id));
      }
    }
  }

  // Y los turnos de participantes que ya no existen en la receta.
  const vigentes = new Set(pasos.flatMap((p) => p.participantes.map((x) => x.id)));
  sobran.push(...existentes.filter((t) => !vigentes.has(t.participante_id) && !t.respondido).map((t) => t.id));

  await borrarTurnos(connection, [...new Set(sobran)]);
};
