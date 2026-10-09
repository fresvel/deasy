// DOCUMENTOS y FLUJO DE LLENADO de una tarea: materializar el documento de un
// task_item, resolver su propietario/unidad de origen y montar el flujo de llenado.
// Extraído de TaskGenerationService en la Fase 3. Ver docs/docs-md-antiguos/refactor-2026-07/auditoria-refactor-2026-07.md
//
// `ensureSignatureFlowForDocumentVersion` es hoy un delegador de una línea a
// DocumentSignatureWorkflowService: la firma se movió allí, aquí solo queda el punto de
// entrada que conservan los consumidores.
import {
  participantesDeUnPasoDeEntrega,
  participantesDeUnPasoDeFirma,
  reemplazarReceta,
  resolverReceta
} from "../../../dominios/plantillas/index.js";
import { abrirRecorrido, abrirTurno, buscarRecorrido } from "../../../dominios/tareas/index.js";
import { repararTurnos, resolverPasoCompleto } from "./assignees.js";
import { transitionDocumentVersionState } from "../../documents/DocumentStateService.js";
import { ensureSignatureFlowForDocumentVersion as ensureDocumentSignatureWorkflowForDocumentVersion } from "../../documents/DocumentSignatureWorkflowService.js";
import {
  getDocumentVersionFillContext,
  getTaskItemsForDocumentMaterialization
} from "./queries.js";

export const ensureSignatureFlowForDocumentVersion = async (connection, documentVersionId) => {
  return ensureDocumentSignatureWorkflowForDocumentVersion(connection, documentVersionId);
};
export const ensureFillFlowForDocumentVersion = async (connection, documentVersionId) => {
  const context = await getDocumentVersionFillContext(connection, documentVersionId);
  if (!context?.vinculo_id) {
    return null;
  }

  // LA RECETA SE RESUELVE DE UNA, sin buscar cabecera: el paso lleva su origen. Dos escalones, el
  // del entregable y el de la edicion, en `resolverReceta` (frente 24, fase 4).
  const receta = await resolverReceta(connection, {
    accion: "entrega",
    taskItemId: context.task_item_id,
    vinculoId: context.vinculo_id,
  });

  const abierto = await buscarRecorrido(connection, documentVersionId, "entrega");
  if (abierto) {
    if (receta.pasos.length) {
      await repararTurnos(connection, {
        recorridoId: Number(abierto.id), accion: "entrega", pasos: receta.pasos, context,
      });
    }
    await ensureSignatureFlowForDocumentVersion(connection, documentVersionId);
    return Number(abierto.id);
  }

  if (!receta.pasos.length) {
    await transitionDocumentVersionState(connection, Number(documentVersionId), "Listo para firma");
    await ensureSignatureFlowForDocumentVersion(connection, documentVersionId);
    return null;
  }

  const recorridoId = await abrirRecorrido(connection, {
    documentVersionId,
    accion: "entrega",
    pasoActual: Number(receta.pasos[0].orden),
  });

  for (const paso of receta.pasos) {
    for (const turno of await resolverPasoCompleto(connection, paso, context)) {
      await abrirTurno(connection, { recorridoId: recorridoId, accion: "entrega", ...turno });
    }
  }

  await transitionDocumentVersionState(connection, Number(documentVersionId), "Pendiente de llenado");
  await ensureSignatureFlowForDocumentVersion(connection, documentVersionId);

  return recorridoId;
};
// `resolveOwnerPersonIdForTaskItem` VIVIO AQUI hasta el 2026-08-23, y su historia entera cabe en un
// parrafo: empezo siendo una cascada de CUATRO escalones —el «Para:», el puesto del entregable, el
// puesto de la tarea y «el primer asignado de la tarea por id»—, se le fueron cayendo tres al
// medirlos (uno era el destinatario, dos leian una foto que nadie refrescaba y el ultimo era una
// loteria) y lo que quedaba era `return taskItem.assigned_person_id`.
//
// Una funcion que devuelve un campo no es una funcion, es un campo. Y `documents.owner_person_id`
// tampoco era un hecho: era una copia de ese mismo campo, tomada al crear el documento y
// refrescada por UNO de los cuatro caminos de relevo, asi que a partir del primer relevo automatico
// el documento seguia figurando a nombre de quien se fue.
//
// Quien responde de un documento es quien responde de su entregable, y eso vive en su tenencia.
export const resolveOriginUnitIdForTaskItem = async (connection, taskItem, responsiblePersonId = null) => {
  if (taskItem?.target_unit_id) {
    return Number(taskItem.target_unit_id);
  }

  // 1. Posición explícita del task_item (más específica)
  if (taskItem?.responsible_position_id) {
    const [rows] = await connection.query(
      `SELECT unit_id FROM unit_positions WHERE id = ? AND unit_id IS NOT NULL LIMIT 1`,
      [taskItem.responsible_position_id]
    );
    if (rows?.[0]?.unit_id) return Number(rows[0].unit_id);
  }

  // 2. Posición del task padre (contexto de la unidad que generó el task)
  if (taskItem?.task_id) {
    const [rows] = await connection.query(
      `SELECT t.scope_unit_id AS unit_id
       FROM tasks t
       WHERE t.id = ? AND t.scope_unit_id IS NOT NULL
       LIMIT 1`,
      [taskItem.task_id]
    );
    if (rows?.[0]?.unit_id) return Number(rows[0].unit_id);
  }

  // 3. Última opción: primera posición activa de QUIEN RESPONDE (sólo cuando no hay contexto de
  // task). Antes se le pasaba el «dueño» del documento; es la misma persona, leída del sitio bueno.
  const normalizedResponsibleId = Number(responsiblePersonId || 0) || null;
  if (normalizedResponsibleId) {
    const [ownerRows] = await connection.query(
      `SELECT up.unit_id
       FROM position_assignments pa
       INNER JOIN unit_positions up ON up.id = pa.position_id
       WHERE pa.person_id = ?
         AND pa.is_current = 1
         AND up.unit_id IS NOT NULL
       ORDER BY pa.id ASC, up.id ASC
       LIMIT 1`,
      [normalizedResponsibleId]
    );
    if (ownerRows?.[0]?.unit_id) return Number(ownerRows[0].unit_id);
  }

  return null;
};
// LA RECETA QUE EL USUARIO DEFINE AL ENVIAR: el modo `routed`. Cuelga del ENTREGABLE, que es el
// primer escalon de la resolucion.
//
// ── DE 132 LINEAS A 60 (frente 24, fase 4, paso 4) ──────────────────────────────────────────────
//
// Escribia la receta DOS VECES: primero las cuatro tablas viejas --una cabecera y sus pasos por
// lado, con 10 y 16 columnas escritas a mano, el JSONB `signers` serializado y un `primary` que
// duplicaba al primer firmante en las columnas del paso-- y despues la forma nueva. Hoy escribe una.
//
// Y con las tablas viejas se va la normalizacion que existia para ellas:
//   · `approval_mode` y `required_min`: el cupo entero, retirado (§10 del plan). El constructor solo
//     emitia `and`.
//   · `unit_type_id` y el ambito `unit_type`: ninguna pantalla los produce, y desde el paso 3b
//     `unit_type` NO ES UN VALOR LEGAL. Era una mina: el dia que un formulario enviara un tipo de
//     unidad sin unidad, el convertidor habria reventado con «no esta en el vocabulario».
export const materializeRuntimeFlowForTaskItem = async (
  connection,
  { taskItemId, flow }
) => {
  // Firmante/responsable -> la forma que consume el convertidor de la receta.
  const normSigner = (raw) => {
    if (raw && raw.cargo_id) {
      const unitId = raw.unit_id ? Number(raw.unit_id) : null;
      return {
        type: "cargo_in_scope",
        cargo_id: Number(raw.cargo_id),
        unit_id: unitId,
        unit_scope_type: raw.unit_scope_type || (unitId ? "unit_exact" : "all_units"),
      };
    }
    const pid = Number(raw?.person_id ?? raw) || null;
    return pid ? { type: "specific_person", person_id: pid } : null;
  };
  // Paso de firma -> { signers: [...] }. Acepta `{ signers: [...] }` o un firmante suelto.
  const normFirmaStep = (raw) => {
    const rawSigners = Array.isArray(raw?.signers) ? raw.signers : [raw];
    const signers = rawSigners.map(normSigner).filter(Boolean);
    return signers.length ? { signers } : null;
  };

  const entrega = (Array.isArray(flow?.entrega) ? flow.entrega : []).map(normSigner).filter(Boolean);
  const firma = (Array.isArray(flow?.firma) ? flow.firma : []).map(normFirmaStep).filter(Boolean);

  await reemplazarReceta(connection, {
    origen: "entregable", origenId: Number(taskItemId), accion: "entrega",
    pasos: entrega.map((s, i) => ({
      orden: i + 1,
      code: null,
      nombre: null,
      participantes: participantesDeUnPasoDeEntrega(s, `entregable ${taskItemId}, paso ${i + 1} de entrega`),
    })),
  });

  // EL HUECO LO ACUÑA ESTE ESCRITOR como `firma_<orden>`, y se lo queda el PRIMER firmante del paso;
  // a los demas el convertidor les deriva el suyo. Antes compartian uno solo y solo el primero tenia
  // marca en el PDF.
  await reemplazarReceta(connection, {
    origen: "entregable", origenId: Number(taskItemId), accion: "firma",
    pasos: firma.map((step, i) => ({
      orden: i + 1,
      code: `firma_${i + 1}`,
      nombre: `Firma ${i + 1}`,
      participantes: participantesDeUnPasoDeFirma(
        { ...step, slot: `firma_${i + 1}` },
        `entregable ${taskItemId}, paso ${i + 1} de firma`
      ),
    })),
  });

  return { fillSteps: entrega.length, signatureSteps: firma.length };
};
export const ensureDocumentForTaskItem = async (connection, taskItem) => {
  const originUnitId = await resolveOriginUnitIdForTaskItem(connection, taskItem, taskItem?.assigned_person_id ?? null);

  // LA MESA DE EN MEDIO DESAPARECIO (2026-08-23). Aqui se buscaba —y si no, se creaba— una fila en
  // `documents` de la que colgar las versiones. Esa tabla era 1:1 estricta con el entregable y no
  // tenia ni un hecho propio, asi que las versiones cuelgan ya del entregable y esta funcion hace
  // dos cosas en vez de cuatro: sellar la unidad de origen y asegurar la version inicial.
  //
  // El nombre se conserva —lo llaman cinco sitios— pero lo que asegura es la PRIMERA VERSION.
  //
  // La unidad de origen lleva `COALESCE` porque materializar es idempotente: se llama en cada
  // lanzamiento y una vez resuelta no se recalcula.
  if (originUnitId) {
    await connection.query(
      `UPDATE task_items
       SET origin_unit_id = COALESCE(origin_unit_id, ?)
       WHERE id = ?`,
      [originUnitId, taskItem.id]
    );
  }

  const [versionRows] = await connection.query(
    `SELECT id
     FROM document_versions
     WHERE task_item_id = ?
     ORDER BY version ASC, id ASC
     LIMIT 1`,
    [taskItem.id]
  );

  if (!versionRows?.length) {
    // CON QUE VERSION DE PLANTILLA SE ABRE ESTA RONDA, LEIDA DEL VINCULO (frente 23, F2.2 —
    // 2026-10-04). Antes salia de `taskItem.edicion_id`, o sea de una COPIA que el
    // entregable guardaba del vinculo; esa columna se retiro. Se consulta aqui, y no se exige que
    // el llamador la traiga, porque los cinco llamadores proyectan filas DISTINTAS: dos de ellos
    // (`loadDerivedTaskItemRow` y `loadFreeTaskItemRow`) no seleccionan el vinculo.
    const [artifactRows] = await connection.query(
      `SELECT pdt.edicion_id
         FROM task_items ti
         INNER JOIN vinculos pdt ON pdt.id = ti.vinculo_id
        WHERE ti.id = ?
        LIMIT 1`,
      [taskItem.id]
    );
    const roundArtifactId = artifactRows?.[0]?.edicion_id ?? null;
    const [insertResult] = await connection.query(
      `INSERT INTO document_versions (
         task_item_id,
         version,
         edicion_id,
         status
       ) VALUES (?, ?, ?, ?)`,
      [
        taskItem.id,
        // La RONDA 1. Era `0.1`, y ese numero mentia: sugeria «primera correccion» cuando es la
        // primera ronda completa del flujo. El segundo digito nace en 0 y lo mueve la primera
        // subida del archivo.
        1,
        roundArtifactId,
        "Borrador"
      ]
    );
    await ensureFillFlowForDocumentVersion(connection, Number(insertResult.insertId));
  } else {
    await ensureFillFlowForDocumentVersion(connection, Number(versionRows[0].id));
  }

  // Devuelve el ENTREGABLE, que es lo que ahora identifica al documento. Antes devolvia el id de la
  // fila de `documents`, y ningun llamador lo usaba para otra cosa que saber que hubo documento.
  return taskItem.id;
};
export const ensureDocumentsForTask = async (connection, taskId) => {
  const taskItems = await getTaskItemsForDocumentMaterialization(connection, taskId);
  let createdOrEnsured = 0;
  for (const taskItem of taskItems) {
    await ensureDocumentForTaskItem(connection, taskItem);
    createdOrEnsured += 1;
  }
  return createdOrEnsured;
};
