// Máquina de estados de `fill_requests` — la lógica que antes vivía en
// `controllers/sign/sign_workflow_controller.js` (fase D del plan de calidad, §5-D).
//
// Las cinco acciones del flujo de entrega —start, approve, return, reject, cancel— comparten un
// único recorrido: resolver al actor, cargar el contexto de la solicitud, comprobar que la acción
// es legal, escribir el nuevo estado y propagar el progreso del documento. El controller solo
// traduce esto a HTTP.
//
// EL ORDEN DE LOS GUARDS ES CONTRATO y está congelado por
// `tests/characterization/flows/zzzz_sign_workflow.test.mjs`:
//   pool caído (500) -> actor inválido (500) -> id inválido (400) -> no existe (404) ->
//   no es tuya (403) -> sin responsable resoluble (409) -> transición ilegal (409) ->
//   (solo approve) falta el PDF en working (409).
//
// Los errores de NEGOCIO llevan `statusCode` (ver `errors/HttpError.js`); los que no lo llevan son
// fallos de verdad y el controller los devuelve como 500. Ese contrato es el que impide que un
// fallo de infraestructura se disfrace de culpa del cliente.

import { UserRepository } from "../../dominios/identidad/index.js";
import { badRequest, conflict, forbidden, notFound } from "../../errors/HttpError.js";
import { idsDeTurnosDelPaso, reabrirTurnos, responderTurno } from "../../dominios/tareas/index.js";
import { resolverReceta } from "../../dominios/plantillas/index.js";
import { getPostgresPool } from "../../config/postgres.js";
import { ESTADO_RECORRIDO } from "./DocumentWorkflowCatalog.js";
import { syncDocumentProgressFromFillRequest } from "./DocumentProgressService.js";
import { addDocumentObservation } from "./DocumentObservationService.js";

let _userRepository = null;
const userRepository = () => (_userRepository ??= new UserRepository());

const getCurrentUser = async (rawUserId, findUserById) => {
  const userId = Number(rawUserId);
  if (!userId || Number.isNaN(userId)) {
    throw new Error("Usuario autenticado inválido.");
  }
  const user = await findUserById(userId);
  if (!user) {
    throw new Error("Usuario no encontrado.");
  }
  return user;
};

// EL CONTEXTO DE UN TURNO. Las claves conservan su nombre --`recorrido_id`,
// `step_order`...-- a proposito: las consume media docena de sitios y el guard las nombra en sus
// mensajes. Lo que cambia es de DONDE salen: el estado del turno, el orden del PASO DECLARADO.
export const getFillRequestContext = async (connection, turnoId) => {
  const [rows] = await connection.query(
    `SELECT
       t.id,
       t.participante_id,
       t.persona_id AS assigned_person_id,
       t.estado AS status,
       t.manual AS is_manual,
       r.id AS recorrido_id,
       r.document_version_id,
       p.orden AS step_order,
       p.id AS paso_id,
       dv.working_file_path,
       ti.id AS task_item_id,
       ti.vinculo_id,
       ti.user_started_at
     FROM turnos t
     INNER JOIN recorridos r ON r.id = t.recorrido_id
     INNER JOIN participantes_declarados pa ON pa.id = t.participante_id
     INNER JOIN pasos_declarados p ON p.id = pa.paso_id
     INNER JOIN document_versions dv ON dv.id = r.document_version_id
     LEFT JOIN task_items ti ON ti.id = dv.task_item_id
     WHERE t.id = ?
     LIMIT 1`,
    [turnoId]
  );
  return rows?.[0] || null;
};

export const reactivatePreviousFillStepIfNeeded = async (connection, context) => {
  const currentStepOrder = Number(context?.step_order || 0);
  if (currentStepOrder <= 1) {
    return null;
  }

  // DOS PASOS Y NO UNO, y es la regla de propiedad: saber QUE turnos son cruza a `plantillas` --hay
  // que mirar el paso declarado-- y eso es una lectura, asi que vive en `datos/consulta/`. La
  // escritura recibe ids y no cruza nada.
  const previousStepOrder = currentStepOrder - 1;
  const ids = await idsDeTurnosDelPaso(connection, context.recorrido_id, previousStepOrder);
  if (!ids.length) {
    return null;
  }
  await reabrirTurnos(connection, ids);

  return previousStepOrder;
};

export const requiresSignaturePdfForFinalFillApproval = async (connection, context) => {
  if (!context?.vinculo_id || !context?.recorrido_id) {
    return false;
  }

  const [fillRows] = await connection.query(
    `SELECT MAX(p.orden) AS max_step_order
       FROM turnos t
       INNER JOIN participantes_declarados pa ON pa.id = t.participante_id
       INNER JOIN pasos_declarados p ON p.id = pa.paso_id
      WHERE t.recorrido_id = ?`,
    [context.recorrido_id]
  );
  const maxStepOrder = Number(fillRows?.[0]?.max_step_order || 0);
  if (!maxStepOrder || Number(context.step_order) !== maxStepOrder) {
    return false;
  }

  // Los pasos del recorrido QUE DE VERDAD APLICA a este entregable, en el mismo orden que el
  // resolvedor: primero el suyo (`routed`), si no el de su edición. Antes contaba sólo los del
  // vínculo —el escalón 2—, que para un `routed` acertaba por accidente: el flujo de runtime
  // escribía las dos anclas. Frente 24, fase 2.
  //
  // Y DESDE EL PASO 3b DE LA FASE 4 no lleva su propia copia del escalón: aquí había un `COALESCE`
  // de dos subconsultas que repetía la prioridad entera. Hoy la resuelve `resolverReceta`, la misma
  // que usa el resto, y lo que queda es contar.
  const receta = await resolverReceta(connection, {
    accion: "firma",
    taskItemId: context.task_item_id,
    vinculoId: context.vinculo_id,
  });
  if (!receta.pasos.length) {
    return false;
  }

  // MIRA LA EXTENSIÓN A PROPÓSITO, NO QUE EL OBJETO EXISTA EN MinIO. Se evaluó añadir un
  // `statMinioObject` aquí (fila 1.2 del plan maestro) y se descartó, por este orden:
  //   1. La comprobación que GARANTIZA algo ya existe, en el punto de uso: `PdfSigningService.js`
  //      hace `statMinioObject` justo antes de mandar el PDF a firmar. Repetirla aquí no cierra
  //      nada — entre aprobar y firmar el objeto puede desaparecer igual (TOCTOU), así que este
  //      `stat` sería orientativo, nunca una garantía.
  //   2. Invertiría las capas. Este servicio no sabe en qué bucket vive la ruta; para saberlo
  //      necesita `resolveStoredDocumentObject` y las constantes de bucket, que viven en
  //      `controllers/users/user_controler.storage.js`. Un servicio importando de un controller
  //      rompe la regla de capas; copiar aquí el mapeo ruta→bucket lo duplica.
  //   3. Iría DENTRO de la transacción abierta por `updateFillRequestStatus`. Medido contra el
  //      MinIO de dev: 24 ms en frío, 3 ms en caliente — barato, sí, pero es una llamada a un
  //      servicio externo sosteniendo una conexión de PostgreSQL, y `minio_service.js` no fija
  //      ningún timeout: si MinIO se degrada, la transacción se queda abierta lo que él tarde.
  //   4. El error no mejoraría. Para el usuario, "la ruta no es un PDF" y "la ruta es .pdf pero el
  //      objeto no está" tienen el MISMO remedio (volver a subir el archivo) y hoy ya salen los dos
  //      con un 409 accionable.
  //   5. El camino normal no produce ese estado: la única escritura de `working_file_path` desde el
  //      usuario (`user_controler.js`) sube el objeto a MinIO ANTES de tocar la base, y la escritura
  //      es transaccional. Una ruta viva con el objeto ausente exige editar `document_versions` por
  //      el CRUD de admin o borrar el objeto a mano.
  const workingPath = String(context.working_file_path || "").trim().toLowerCase();
  return !workingPath.endsWith(".pdf");
};

// Estados desde los que cada acción es legal. Es un `Map` y no un objeto literal por una razón
// medida: con un objeto, `allowedByAction["toString"]` devuelve el método heredado de
// `Object.prototype` y `?.has` reventaba con un TypeError (500) en vez de con el 409 de siempre.
// Hoy la acción la fija el router, así que no era alcanzable; con un `Map` deja de depender de eso.
const ALLOWED_STATUSES_BY_ACTION = new Map([
  ["start", new Set([ESTADO_RECORRIDO.PENDIENTE])],
  ["approve", new Set([ESTADO_RECORRIDO.PENDIENTE, ESTADO_RECORRIDO.EN_PROGRESO])],
  ["return", new Set([ESTADO_RECORRIDO.PENDIENTE, ESTADO_RECORRIDO.EN_PROGRESO])],
  ["reject", new Set([ESTADO_RECORRIDO.PENDIENTE, ESTADO_RECORRIDO.EN_PROGRESO])],
  ["cancel", new Set([ESTADO_RECORRIDO.PENDIENTE, ESTADO_RECORRIDO.EN_PROGRESO])],
]);

export const assertFillActionAllowed = ({ action, currentStatus, assignedPersonId, currentUserId, isManual }) => {
  const normalizedStatus = String(currentStatus || "").trim().toLowerCase();

  if (assignedPersonId && Number(assignedPersonId) !== Number(currentUserId)) {
    throw forbidden("No puedes operar un turno de entrega asignado a otro usuario.");
  }

  // Sin responsable y sin modo manual no hay a quién comparar: el guard de propiedad de arriba no
  // puede pronunciarse. Eso NO lo convierte en un fallo del servidor —la petición es correcta y el
  // servidor está sano—, sino en un CONFLICTO con el estado del recurso: la solicitud está mal
  // configurada y no se puede operar hasta que alguien le asigne responsable. Por eso 409 y no 500
  // (antes era 500 y se lo llevaba cualquier usuario autenticado; ver `sin_responsable_*`).
  if (!assignedPersonId && !isManual) {
    throw conflict("El turno de entrega no tiene un responsable resoluble.");
  }

  if (!ALLOWED_STATUSES_BY_ACTION.get(action)?.has(normalizedStatus)) {
    throw conflict(`La solicitud no puede pasar de ${currentStatus} usando la acción ${action}.`);
  }
};

// Punto de entrada único de las cinco acciones. Devuelve el resultado de negocio; NO sabe de HTTP.
// El segundo argumento existe para las pruebas: en producción nadie lo pasa.
export const updateFillRequestStatus = async (
  { userId, requestId, action, nextStatus, note = null },
  { pool = getPostgresPool(), findUserById = (id) => userRepository().findById(id) } = {},
) => {
  if (!pool) {
    throw new Error("La conexión con PostgreSQL no está disponible.");
  }

  const connection = await pool.getConnection();
  try {
    const user = await getCurrentUser(userId, findUserById);
    const turnoId = Number(requestId);
    if (!turnoId || Number.isNaN(turnoId)) {
      throw badRequest("Turno de entrega inválido.");
    }

    await connection.beginTransaction();
    const context = await getFillRequestContext(connection, turnoId);
    if (!context) {
      throw notFound("Turno de entrega no encontrado.");
    }

    assertFillActionAllowed({
      action,
      currentStatus: context.status,
      assignedPersonId: context.assigned_person_id,
      currentUserId: user.id,
      isManual: Boolean(context.is_manual),
    });

    if (action === "approve") {
      const requiresPdf = await requiresSignaturePdfForFinalFillApproval(connection, context);
      if (requiresPdf) {
        // 409 y no 500: la petición está bien formada y el servidor está sano; lo que no admite la
        // operación es el ESTADO del recurso (el archivo de trabajo no es un PDF y el último paso
        // desemboca en firma). Mismo razonamiento —y mismo código— que el guard de "sin responsable
        // resoluble" de justo arriba y que el de transición ilegal. 400 diría "arregla tu petición",
        // y esta petición no tiene nada que arreglar: no lleva cuerpo, y el remedio es subir el PDF.
        throw conflict(
          "El último paso del flujo de entrega requiere un PDF en working para habilitar la firma."
        );
      }
    }

    const shouldRespondNow = nextStatus !== ESTADO_RECORRIDO.EN_PROGRESO;
    const assignedPersonId = context.assigned_person_id || (context.is_manual ? Number(user.id) : null);
    await responderTurno(connection, turnoId, {
      personaId: assignedPersonId,
      estado: nextStatus,
      respondido: shouldRespondNow ? new Date() : null,
      nota: note,
    });

    if (action === "return") {
      await reactivatePreviousFillStepIfNeeded(connection, context);
    }

    // Auto-captura: una devolución/rechazo de revisión con motivo queda como observación del hilo.
    if ((action === "return" || action === "reject") && note && context.task_item_id) {
      await addDocumentObservation(connection, {
        taskItemId: context.task_item_id,
        documentVersionId: context.document_version_id,
        turnoId,
        phase: "review",
        kind: action === "reject" ? "rejection_reason" : "return_reason",
        message: note,
        authorPersonId: user.id
      });
    }

    if (action === "start" && context.task_item_id && !context.user_started_at) {
      await connection.query(
        `UPDATE task_items
         SET user_started_at = CURRENT_TIMESTAMP
         WHERE id = ?
           AND user_started_at IS NULL`,
        [Number(context.task_item_id)]
      );
    }

    const progress = await syncDocumentProgressFromFillRequest(connection, turnoId);
    await connection.commit();

    return {
      turnoId,
      status: nextStatus,
      documentVersionId: progress?.documentVersionId ?? Number(context.document_version_id),
      flowStatus: progress?.flowStatus ?? null,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
