// GeneralTaskService — alta de tareas sueltas y de entregables añadidos por el usuario.
//
// Extraído de `controllers/users/user_controler.js::createGeneralTask` (362 L, CC 75) en la
// Fase D del plan de calidad. Los controllers son transporte: aquí viven la transacción, la
// resolución de la plantilla ligada, el modo de emisión (single/replicated/routed) y la
// materialización del flujo de runtime.
//
// Un mismo endpoint cubre DOS altas distintas, y por eso la entrada es común:
//   - mode="derived": añade un ENTREGABLE a una tarea que ya existe (réplica auto-asignada, o
//     envío routed a otra persona).
//   - mode="free": crea una TAREA suelta bajo el "Proceso por defecto" (el routed comodín de
//     las tareas ad-hoc), con su propio periodo Custom y un único entregable endosado.
//
// Los errores de negocio se lanzan como `Error` a secas, igual que antes: el controller los
// traduce todos a 400. No se ha introducido `HttpError` aquí porque eso cambiaría el contrato
// de error caracterizado, y esto es un refactor, no un arreglo.

import {
  ensureDocumentForTaskItem,
  materializeRuntimeFlowForTaskItem,
} from "../admin/TaskGenerationService.js";

const GENERAL_PROCESS_SLUG = "default";

// ---------------------------------------------------------------------------------------------
// Consultas de apoyo (movidas desde controllers/users/user_controler.queries.js, donde eran de
// uso exclusivo de createGeneralTask).
// ---------------------------------------------------------------------------------------------

/** Tipo de periodo "Custom": el único que admiten las tareas libres. */
export const getCustomTermType = async (connection) => {
  const [rows] = await connection.query(
    `SELECT id, code, name
     FROM term_types
     WHERE code = 'CUS'
     LIMIT 1`
  );
  return rows[0] || null;
};

/** Configuración activa del proceso "por defecto" (el comodín routed de las tareas ad-hoc). */
export const getActiveGeneralDefinition = async (conn) => {
  const [rows] = await conn.query(
    `SELECT pdv.id
     FROM process_definition_versions pdv
     INNER JOIN processes p ON p.id = pdv.process_id
     WHERE p.slug = ? AND pdv.status = 'active'
     ORDER BY pdv.id DESC
     LIMIT 1`,
    [GENERAL_PROCESS_SLUG]
  );
  return rows?.[0]?.id ? Number(rows[0].id) : null;
};

/**
 * Resuelve la posición vigente del usuario en una unidad concreta.
 * Sin unidad devuelve `null` — y eso es intencionado: quien llama lo trata como "no tienes
 * posición aquí", que es el guard que rechaza una tarea libre sin unidad de contexto.
 */
export const resolveUserPositionInUnit = async (conn, personId, unitId) => {
  if (!unitId) return null;
  const [rows] = await conn.query(
    `SELECT up.id
     FROM position_assignments pa
     INNER JOIN unit_positions up ON up.id = pa.position_id
     WHERE pa.person_id = ? AND pa.is_current = 1 AND up.unit_id = ?
     ORDER BY up.id ASC
     LIMIT 1`,
    [personId, unitId]
  );
  return rows?.[0]?.id ? Number(rows[0].id) : null;
};

// ---------------------------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------------------------

/**
 * Normaliza el cuerpo de la petición. Lo consume el controller para sus guards de entrada
 * (título obligatorio, tarea de origen en modo derivado) ANTES de abrir ninguna conexión, así
 * que el orden de los guards no cambia.
 */
export const parseGeneralTaskInput = (body) => {
  const source = body || {};
  return {
    mode: String(source.mode || "free").trim().toLowerCase(), // 'free' | 'derived'
    title: String(source.title || "").trim(),
    description: String(source.description || "").trim() || null,
    customTerm: source.custom_term ?? null,
    sourceTaskId: source.source_task_id
      ? Number(source.source_task_id)
      : (source.parent_task_id ? Number(source.parent_task_id) : null),
    sourceTaskItemId: source.source_task_item_id ? Number(source.source_task_item_id) : null,
    requestedUnitId: source.unit_id ? Number(source.unit_id) : null,
    // Plantilla ligada a replicar/rutear (modo replicated/routed). Sin ella = alta genérica legacy.
    processDefinitionTemplateId: source.process_definition_template_id
      ? Number(source.process_definition_template_id)
      : null,
    // Destinatario (compat legacy: routed simple = 1 destinatario firmante).
    recipientPersonId: source.recipient_person_id ? Number(source.recipient_person_id) : null,
    // P1 routed: flujo definido al enviar { entrega:[{person_id}...], firma:[{person_id}...] }.
    // "me" en el frontend se resuelve al creador antes de enviar.
    runtimeFlow: (source.flow && typeof source.flow === "object") ? source.flow : null,
  };
};

// ---------------------------------------------------------------------------------------------
// Piezas compartidas por los dos modos
// ---------------------------------------------------------------------------------------------

/** Destinatario existente y activo. Mismo contrato de error en los dos modos. */
const assertRecipientExists = async (connection, recipientPersonId) => {
  const [recipRows] = await connection.query(
    `SELECT id FROM persons WHERE id = ? AND is_active = 1 LIMIT 1`,
    [recipientPersonId]
  );
  if (!recipRows?.length) {
    throw new Error("El destinatario no es válido.");
  }
};

/**
 * Primera plantilla ligada de una configuración de proceso, en el orden que declara la propia
 * configuración. Devuelve la fila cruda: cada modo aplica DESPUÉS sus propias comprobaciones y
 * su propio mensaje, que no son los mismos (el legacy derivado exige `template_artifact_id`; la
 * tarea libre se conforma con que exista la plantilla).
 */
const getFirstProcessTemplate = async (connection, definitionId) => {
  const [rows] = await connection.query(
    `SELECT id, template_artifact_id
     FROM process_definition_templates
     WHERE process_definition_id = ?
     ORDER BY sort_order ASC, id ASC
     LIMIT 1`,
    [definitionId]
  );
  return rows?.[0] || null;
};

// ---------------------------------------------------------------------------------------------
// Modo "derived": entregable añadido a una tarea existente
// ---------------------------------------------------------------------------------------------

const loadSourceTask = async (connection, sourceTaskId) => {
  const [sourceRows] = await connection.query(
    `SELECT
       t.id,
       t.process_definition_id,
       t.term_id,
       t.scope_unit_id,
       t.start_date,
       t.end_date
     FROM tasks t
     WHERE t.id = ?
     LIMIT 1`,
    [sourceTaskId]
  );
  const sourceTask = sourceRows?.[0];
  if (!sourceTask) {
    throw new Error("La tarea de origen no existe.");
  }
  return sourceTask;
};

/**
 * Plantilla a instanciar y su modo de emisión.
 * - Con `process_definition_template_id`: la réplica/instancia hereda la config de la plantilla
 *   ligada del proceso origen, y se rechaza `single` (instancia única, no admite réplicas).
 * - Sin él: alta genérica legacy contra la plantilla base del proceso por defecto, que se trata
 *   como `replicated` (réplica auto-asignada al creador).
 */
const resolveDeliverableTemplate = async (
  connection,
  { processDefinitionTemplateId, sourceTask, definitionId }
) => {
  if (processDefinitionTemplateId) {
    const [tplRows] = await connection.query(
      `SELECT id, template_artifact_id, item_mode, process_definition_id
       FROM process_definition_templates
       WHERE id = ?
       LIMIT 1`,
      [processDefinitionTemplateId]
    );
    const tpl = tplRows?.[0];
    if (!tpl) {
      throw new Error("La plantilla del entregable no existe.");
    }
    if (Number(tpl.process_definition_id) !== Number(sourceTask.process_definition_id)) {
      throw new Error("La plantilla no pertenece al proceso de la tarea origen.");
    }
    const itemMode = String(tpl.item_mode || "single");
    if (itemMode === "single") {
      throw new Error("Este entregable es de instancia única: no admite réplicas ni envíos.");
    }
    return {
      definitionTemplateId: Number(tpl.id),
      templateArtifactId: Number(tpl.template_artifact_id),
      itemMode,
    };
  }

  // Legacy: entregable genérico del proceso default, auto-asignado al creador.
  const defaultTemplate = await getFirstProcessTemplate(connection, definitionId);
  const templateArtifactId = defaultTemplate?.template_artifact_id
    ? Number(defaultTemplate.template_artifact_id)
    : null;
  const definitionTemplateId = defaultTemplate?.id ? Number(defaultTemplate.id) : null;
  if (!templateArtifactId || !definitionTemplateId) {
    throw new Error("El proceso default no tiene una plantilla base para entregables agregados.");
  }
  return { definitionTemplateId, templateArtifactId, itemMode: "replicated" };
};

/**
 * Destinatario / dueño según modo:
 *  - replicated: auto-asignado al creador (target = creador → dueño = creador).
 *  - routed: el destinatario elegido es el dueño/firmante; el creador queda como autor (assignee).
 */
const resolveDerivedTarget = async (
  connection,
  { itemMode, recipientPersonId, runtimeFlow, authenticatedUserId, responsiblePositionId, sourceUnitId }
) => {
  if (itemMode !== "routed") {
    return {
      targetPersonId: authenticatedUserId,
      targetPositionId: responsiblePositionId,
      targetUnitId: sourceUnitId,
    };
  }

  // Con flujo runtime el flujo define los actores → el destinatario es opcional (metadato
  // "Para:"). Sin flujo (compat legacy) sigue siendo obligatorio 1 destinatario firmante.
  if (!recipientPersonId && !runtimeFlow) {
    throw new Error("Debes elegir el destinatario del envío.");
  }
  if (recipientPersonId) {
    await assertRecipientExists(connection, recipientPersonId);
  }
  return {
    targetPersonId: recipientPersonId || null, // "Para:" (puede ser null si la firma es por cargo)
    targetPositionId: null,                    // se rutea por el flujo, no por puesto
    targetUnitId: null,
  };
};

const insertDerivedTaskItem = async (connection, {
  sourceTaskId,
  definitionTemplateId,
  templateArtifactId,
  itemTitle,
  authenticatedUserId,
  sourceTaskItemId,
  targetUnitId,
  targetPositionId,
  targetPersonId,
  responsiblePositionId,
  sourceTask,
}) => {
  const [itemResult] = await connection.query(
    `INSERT INTO task_items (
       task_id,
       process_definition_template_id,
       template_artifact_id,
       origin_kind,
       title,
       sort_order,
       created_by_person_id,
       source_task_item_id,
       target_unit_id,
       target_position_id,
       target_person_id,
       responsible_position_id,
       assigned_person_id,
       start_date,
       end_date
     ) VALUES (?, ?, ?, 'user_added', ?, 999, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sourceTaskId,
      definitionTemplateId,
      templateArtifactId,
      itemTitle,
      authenticatedUserId,
      sourceTaskItemId || null,
      targetUnitId,
      targetPositionId,
      targetPersonId,
      responsiblePositionId,
      authenticatedUserId,
      sourceTask.start_date,
      sourceTask.end_date || null,
    ]
  );
  return Number(itemResult.insertId);
};

/**
 * Fila que consume `ensureDocumentForTaskItem` en el modo derivado. Lleva
 * `template_artifact_name` — la tarea libre NO lo selecciona, y esa asimetría es del código
 * original: no la unifiques sin comprobar qué hace el nombre aguas abajo.
 */
const loadDerivedTaskItemRow = async (connection, taskItemId) => {
  const [taskItemRows] = await connection.query(
    `SELECT
       ti.id,
       ti.task_id,
       ti.template_artifact_id,
       ti.assigned_person_id,
       ti.target_unit_id,
       ti.target_person_id,
       ti.responsible_position_id,
       COALESCE(ti.title, tar_dl.display_name) AS template_artifact_name
     FROM task_items ti
     LEFT JOIN template_artifacts tar ON tar.id = ti.template_artifact_id
 LEFT JOIN deliverables tar_dl ON tar_dl.id = tar.deliverable_id
     WHERE ti.id = ?
     LIMIT 1`,
    [taskItemId]
  );
  return taskItemRows[0];
};

const createDerivedDeliverable = async (connection, { authenticatedUserId, input, definitionId }) => {
  const sourceTask = await loadSourceTask(connection, input.sourceTaskId);

  const sourceUnitId = sourceTask.scope_unit_id || input.requestedUnitId || null;
  const responsiblePositionId = await resolveUserPositionInUnit(connection, authenticatedUserId, sourceUnitId);
  if (!responsiblePositionId) {
    throw new Error("No tienes una posición vigente en la unidad de la tarea origen.");
  }

  const { definitionTemplateId, templateArtifactId, itemMode } = await resolveDeliverableTemplate(connection, {
    processDefinitionTemplateId: input.processDefinitionTemplateId,
    sourceTask,
    definitionId,
  });

  const { targetPersonId, targetPositionId, targetUnitId } = await resolveDerivedTarget(connection, {
    itemMode,
    recipientPersonId: input.recipientPersonId,
    runtimeFlow: input.runtimeFlow,
    authenticatedUserId,
    responsiblePositionId,
    sourceUnitId,
  });

  const taskItemId = await insertDerivedTaskItem(connection, {
    sourceTaskId: input.sourceTaskId,
    definitionTemplateId,
    templateArtifactId,
    // Modos configurados: el título es la ETIQUETA limpia (se ve en la tarjeta).
    // Legacy genérico: conserva el "título + descripción" concatenado.
    itemTitle: input.processDefinitionTemplateId
      ? input.title
      : (input.description ? `${input.title}\n\n${input.description}` : input.title),
    authenticatedUserId,
    sourceTaskItemId: input.sourceTaskItemId,
    targetUnitId,
    targetPositionId,
    targetPersonId,
    responsiblePositionId,
    sourceTask,
  });

  const taskItemRow = await loadDerivedTaskItemRow(connection, taskItemId);

  // routed: si el usuario definió el flujo al enviar, se materializa POR INSTANCIA (specific_person).
  if (itemMode === "routed" && input.runtimeFlow) {
    await materializeRuntimeFlowForTaskItem(connection, {
      taskItemId,
      processDefinitionTemplateId: definitionTemplateId,
      flow: input.runtimeFlow,
    });
  }
  await ensureDocumentForTaskItem(connection, taskItemRow);

  return {
    result: "ok",
    mode: input.mode,
    item_mode: itemMode,
    recipient_person_id: itemMode === "routed" ? targetPersonId : null,
    task_id: input.sourceTaskId,
    task_item_id: taskItemId,
    definition_id: sourceTask.process_definition_id,
    unit_id: sourceUnitId,
    responsible_position_id: responsiblePositionId,
  };
};

// ---------------------------------------------------------------------------------------------
// Modo "free": tarea suelta bajo el proceso por defecto
// ---------------------------------------------------------------------------------------------

/** Periodo Custom propio de la tarea libre. Devuelve también las fechas ya normalizadas. */
const createCustomTerm = async (connection, { authenticatedUserId, title, customTerm }) => {
  const customType = await getCustomTermType(connection);
  if (!customType) {
    throw new Error("No existe el tipo de periodo Custom.");
  }
  const displayTermName = String(customTerm?.name || title).trim();
  const startDate = String(customTerm?.start_date || "").trim() || new Date().toISOString().slice(0, 10);
  // terms.end_date es NOT NULL: si no se indica, usa la fecha de inicio.
  const endDate = String(customTerm?.end_date || "").trim() || startDate;
  // terms.name es UNIQUE global: para tareas libres se sufija para evitar colisiones
  // entre usuarios/tareas. El nombre legible se conserva en term_name visible vía el periodo.
  const uniqueTermName = `${displayTermName} · #${authenticatedUserId}-${Date.now().toString(36)}`.slice(0, 180);

  const [termResult] = await connection.query(
    `INSERT INTO terms (name, term_type_id, start_date, end_date, is_active)
     VALUES (?, ?, ?, ?, 1)`,
    [uniqueTermName, customType.id, startDate, endDate]
  );
  return { termId: Number(termResult.insertId), startDate, endDate };
};

/**
 * Destinatario del entregable endosado. Endosarse a uno mismo no valida nada: el creador ya
 * está autenticado.
 */
const resolveFreeRecipient = async (connection, authenticatedUserId, recipientPersonId) => {
  if (!recipientPersonId || recipientPersonId === authenticatedUserId) {
    return authenticatedUserId;
  }
  await assertRecipientExists(connection, recipientPersonId);
  return recipientPersonId;
};

const insertFreeTaskItem = async (connection, {
  taskId,
  freeTpl,
  itemTitle,
  authenticatedUserId,
  unitId,
  freeTargetPersonId,
  responsiblePositionId,
  startDate,
  endDate,
}) => {
  const [freeItemResult] = await connection.query(
    `INSERT INTO task_items (
       task_id, process_definition_template_id, template_artifact_id, origin_kind, title,
       sort_order, created_by_person_id, target_unit_id, target_position_id, target_person_id,
       responsible_position_id, assigned_person_id, start_date, end_date
     ) VALUES (?, ?, ?, 'user_added', ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      taskId,
      freeTpl.id,
      freeTpl.template_artifact_id,
      itemTitle,
      authenticatedUserId,
      unitId,
      null,
      freeTargetPersonId,
      responsiblePositionId,
      authenticatedUserId,
      startDate,
      endDate,
    ]
  );
  return Number(freeItemResult.insertId);
};

const loadFreeTaskItemRow = async (connection, freeItemId) => {
  const [freeItemRows] = await connection.query(
    `SELECT id, task_id, template_artifact_id, assigned_person_id, target_unit_id,
            target_person_id, responsible_position_id
     FROM task_items WHERE id = ? LIMIT 1`,
    [freeItemId]
  );
  return freeItemRows[0];
};

const createFreeTask = async (connection, { authenticatedUserId, input, definitionId }) => {
  // Resolver unidad de contexto para tarea suelta.
  const unitId = input.requestedUnitId;

  // Posición del creador en la unidad (responsable de la nueva tarea).
  const responsiblePositionId = await resolveUserPositionInUnit(connection, authenticatedUserId, unitId);
  if (!responsiblePositionId) {
    throw new Error("No tienes una posición vigente en la unidad indicada para crear esta tarea.");
  }

  // Periodo: custom obligatorio para tareas libres/derivadas.
  const { termId, startDate, endDate } = await createCustomTerm(connection, {
    authenticatedUserId,
    title: input.title,
    customTerm: input.customTerm,
  });

  const composedTitle = input.description ? `${input.title}\n\n${input.description}` : input.title;

  const [taskResult] = await connection.query(
    `INSERT INTO tasks (
       process_definition_id, term_id, scope_unit_id, created_by_user_id,
       description, start_date, end_date, status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente')`,
    [
      definitionId,
      termId,
      unitId,
      authenticatedUserId,
      composedTitle,
      startDate,
      endDate,
    ]
  );
  const taskId = Number(taskResult.insertId);

  // Proceso por defecto = routed comodín: se crea UN entregable endosado a la persona
  // elegida (target_person_id = destinatario, que puede ser uno mismo). El dueño del
  // documento resuelve al destinatario, que es quien realiza/atiende la tarea (paso de
  // llenado `document_owner`); el creador queda como autor/delegador.
  const freeTpl = await getFirstProcessTemplate(connection, definitionId);
  if (!freeTpl) {
    throw new Error("El proceso por defecto no tiene una plantilla base.");
  }

  const freeTargetPersonId = await resolveFreeRecipient(connection, authenticatedUserId, input.recipientPersonId);

  const freeItemId = await insertFreeTaskItem(connection, {
    taskId,
    freeTpl,
    itemTitle: composedTitle,
    authenticatedUserId,
    unitId,
    freeTargetPersonId,
    responsiblePositionId,
    startDate,
    endDate,
  });
  const freeItemRow = await loadFreeTaskItemRow(connection, freeItemId);

  // Proceso por defecto (routed): flujo definido al enviar → materializado POR INSTANCIA.
  if (input.runtimeFlow) {
    await materializeRuntimeFlowForTaskItem(connection, {
      taskItemId: freeItemId,
      processDefinitionTemplateId: freeTpl.id,
      flow: input.runtimeFlow,
    });
  }
  await ensureDocumentForTaskItem(connection, freeItemRow);

  return {
    result: "ok",
    mode: input.mode,
    task_id: taskId,
    task_item_id: freeItemId,
    term_id: termId,
    definition_id: definitionId,
    unit_id: unitId,
    recipient_person_id: freeTargetPersonId,
    responsible_position_id: responsiblePositionId,
  };
};

// ---------------------------------------------------------------------------------------------
// Entrada pública
// ---------------------------------------------------------------------------------------------

/**
 * Crea la tarea (o el entregable) y devuelve el payload de respuesta ya montado.
 *
 * Posee la transacción entera: abre la conexión, la revierte ante cualquier error y la libera
 * siempre. Relanza el error tal cual y el controller decide el código HTTP: 400 por defecto, o el
 * `statusCode` que traiga el error.
 *
 * OJO con el fallo al ADQUIRIR la conexión. Antes del corte, `getConnection()` se hacía en el
 * controller FUERA de su `try`, así que ese fallo llegaba a Express como 500. Al mover la conexión
 * aquí dentro pasaría a caer en el `catch` del controller y saldría como 400 — un fallo de
 * infraestructura disfrazado de culpa del cliente. Se le marca `statusCode` para conservar el 500.
 */
export const createGeneralTaskForUser = async (pool, { authenticatedUserId, input }) => {
  let connection;
  try {
    connection = await pool.getConnection();
  } catch (error) {
    error.statusCode = 500;
    throw error;
  }
  try {
    await connection.beginTransaction();

    const definitionId = await getActiveGeneralDefinition(connection);
    if (!definitionId) {
      throw new Error("El proceso General no está disponible. Ejecuta el seed correspondiente.");
    }

    const payload = input.mode === "derived"
      ? await createDerivedDeliverable(connection, { authenticatedUserId, input, definitionId })
      : await createFreeTask(connection, { authenticatedUserId, input, definitionId });

    await connection.commit();
    return payload;
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
};
