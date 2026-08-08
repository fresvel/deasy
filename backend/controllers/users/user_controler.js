import path from "node:path";
import os from "node:os";
import fs from "fs-extra";
import { randomUUID } from "node:crypto";
import whatsappBot from "../../services/whatsapp/WhatsAppBot.js";
import UserRepository from "../../services/auth/UserRepository.js";
import RbacService from "../../services/auth/RbacService.js";
import { getPostgresPool } from "../../config/postgres.js";
import {
  launchProcessDefinitionInTerm
} from "../../services/admin/TaskGenerationService.js";
import {
  addDocumentObservation,
  listDocumentObservations,
  getObservationById,
  resolveDocumentObservation,
  isUserInTaskItemChain
} from "../../services/documents/DocumentObservationService.js";
import { sendEmailVerification } from "../../services/mail/sendEmailVerification.js";
import { generateUniqueToken } from "../../utils/tokenGenerator.js";
import {
  ensureBucketExists,
  uploadFileToMinio,
  statMinioObject,
  getMinioObjectStream,
  removeMinioObject
} from "../../services/storage/minio_service.js";
import { transitionDocumentVersionState } from "../../services/documents/DocumentStateService.js";
import { resetDocumentWorkflowForTaskItem } from "../../services/documents/DocumentWorkflowResetService.js";
import SqlAdminService from "../../services/admin/SqlAdminService.js";
import { parseAvailableFormats } from "../../services/admin/templates/artifacts.js";
import {
  sanitizeStorageSegment,
  buildCanonicalDocumentVersionBasePath,
  buildWorkingObjectPathForUpload,
  buildAttachmentObjectPath,
  mapAttachmentRow,
  getNumericUserId,
  getAuthenticatedUserId,
  isAuthorizedUserScope
} from "./user_controler.primitives.js";
import {
  MINIO_DOCUMENTS_BUCKET,
  MINIO_DOCUMENTS_PREFIX,
  MINIO_TEMPLATES_BUCKET,
  resolveStoredDocumentObject,
  collectDeliverableTemplateResources,
  writeMinioObjectToFile,
  createZipArchive
} from "./user_controler.storage.js";
import {
  getUserDocumentCenterRows,
  getUserGlobalPendingSignatureRows,
  getAccessibleTaskItemForUser,
  getAccessibleTaskItemDocumentForUser
} from "./user_controler.queries.js";
import { buildUserProcessDefinitionPanel } from "./user_controler.panel.js";
import { buildUserMenu } from "../../services/users/UserMenuService.js";
import {
  parseGeneralTaskInput,
  createGeneralTaskForUser
} from "../../services/tasks/GeneralTaskService.js";
import { isUniqueViolation } from "../../errors/sqlErrors.js";


const userRepository = new UserRepository();
const rbacService = new RbacService();
const sqlAdminService = new SqlAdminService();


export const createUser = async (req, res) => {
  console.log("Creando usuario");
  try {
    const token = await generateUniqueToken(); // ← aquí, dentro del try

    const userPayload = {
      cedula: req.body.cedula,
      email: req.body.email,
      password: req.body.password,
      first_name: req.body.first_name ?? req.body.nombre,
      last_name: req.body.last_name ?? req.body.apellido,
      whatsapp: req.body.whatsapp,
      direccion: req.body.direccion,
      pais: req.body.pais,
      pais_residencia: req.body.pais_residencia,
      provincia_residencia: req.body.provincia_residencia,
      ciudad_residencia: req.body.ciudad_residencia,
      calle_primaria: req.body.calle_primaria,
      calle_secundaria: req.body.calle_secundaria,
      codigo_postal: req.body.codigo_postal,
      status: req.body.status,
      verify_email: req.body.verify?.email,
      verify_whatsapp: req.body.verify?.whatsapp,
      photo_url: req.body.photoUrl ?? req.body.photo_url ?? null,
      token
    };

    const createdUser = await userRepository.create(userPayload);
    console.log(`Usuario creado en PostgreSQL con id ${createdUser.id}`);

    try {
      await sendEmailVerification({
        personId: createdUser.id,
        email: createdUser.email
      });

      console.log("Correo de verificación enviado");
    } catch (error) {
      console.error("No se pudo enviar el correo de verificación:", error.message);
    }

    if (whatsappBot.isReady && createdUser.whatsapp) {
      try {
        const userName = `${createdUser.first_name ?? createdUser.nombre} ${createdUser.last_name ?? createdUser.apellido}`.trim();
        await whatsappBot.sendWelcomeMessage(createdUser.whatsapp, userName);
        console.log(`Mensaje de bienvenida enviado a ${createdUser.whatsapp}`);
      } catch (error) {
        console.log(`No se pudo enviar mensaje de WhatsApp: ${error.message}`);
      }
    }

    res.json({ result: "ok", user: userRepository.toPublicUser(createdUser) });
  } catch (error) {
    console.log("Error Creating User");
    console.error(error);

    if (isUniqueViolation(error)) {
      // Sin `error: error.message`: ese campo devolvia el texto interno de PostgreSQL
      // ("duplicate key value violates unique constraint \"persons_cedula_key\""), que expone el
      // esquema al cliente y anula el sentido de tener un mensaje de negocio.
      return res.status(409).send({ message: "La cédula o el correo ya existen" });
    }

    res.status(400).send({
      message: "Error al crear el usuario",
      error: error.message
    });
  }
};

export const getUsers = async (req, res) => {
  console.log("Buscando todos los usuarios");

  try {
    const term = req.query?.search ?? "";
    const limit = req.query?.limit ?? 20;
    const status = req.query?.status ?? null;
    const unitTypeId = req.query?.unit_type_id ?? null;
    const unitId = req.query?.unit_id ?? null;
    const cargoId = req.query?.cargo_id ?? null;
    const users = await userRepository.search(term, limit, status, {
      unitTypeId,
      unitId,
      cargoId
    });
    res.json(users.map((user) => userRepository.toPublicUser(user)));
  } catch (error) {
    console.log("Error Buscando Usuarios");
    console.error(error.message);
    res.status(500).send({ message: "Error en la petición" });
  }
};

// updateUserPhoto vive ahora en user_photo_controller.js, junto a la lectura.

export const getUserMenu = async (req, res) => {
  try {
    const userIdRaw = req.params?.id ?? req.query?.user_id ?? req.query?.userId ?? req.body?.user_id ?? req.body?.userId;
    const userId = Number(userIdRaw);
    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ message: "Se requiere el id del usuario." });
    }

    const pool = getPostgresPool();
    if (!pool) {
      return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
    }

    res.json(await buildUserMenu(pool, userId));
  } catch (error) {
    // Fallo de configuracion con contrato propio (falta la relacion 'org'): responde sin el
    // campo `error`, igual que antes del corte.
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("Error construyendo el menu del usuario:", error);
    res.status(500).json({ message: "Error al obtener el menú del usuario", error: error.message });
  }
};

export const getUserProcessDefinitionPanel = async (req, res) => {
  try {
    const userId = getNumericUserId(req);
    const definitionId = Number(req.params?.definitionId);
    if (!userId || Number.isNaN(userId) || !definitionId || Number.isNaN(definitionId)) {
      return res.status(400).json({ message: "Se requieren el usuario y la configuracion del proceso." });
    }

    const scopeUnitId = req.query?.scope_unit_id ? Number(req.query.scope_unit_id) : null;

    const pool = getPostgresPool();
    if (!pool) {
      return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
    }

    const panel = await buildUserProcessDefinitionPanel(pool, userId, definitionId, scopeUnitId);
    if (!panel) {
      return res.status(404).json({
        message: "La configuracion no esta activa o el usuario no tiene acceso operativo a ella."
      });
    }

    res.json(panel);
  } catch (error) {
    console.error("Error obteniendo panel operativo de la configuracion:", error);
    res.status(500).json({
      message: "Error al obtener el panel operativo de la configuracion",
      error: error.message
    });
  }
};

export const getUserDocumentCenter = async (req, res) => {
  try {
    const userId = getNumericUserId(req);
    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ message: "Se requiere el usuario." });
    }
    if (!isAuthorizedUserScope(req, userId)) {
      return res.status(403).json({ message: "No tienes permiso para consultar este centro documental." });
    }

    const pool = getPostgresPool();
    if (!pool) {
      return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
    }

    const rows = await getUserDocumentCenterRows(pool, userId);
    const documents = rows.map((row) => {
      const preloadFilePath = row.final_file_path || row.working_file_path || null;
      const preloadPdfPath = [row.final_file_path, row.working_file_path]
        .map((value) => String(value || "").trim())
        .find((value) => value.toLowerCase().endsWith(".pdf")) || null;
      return {
        document_id: Number(row.document_id),
        task_item_id: Number(row.task_item_id),
        task_id: Number(row.task_id),
        process_definition_id: Number(row.process_definition_id),
        process_id: Number(row.process_id),
        process_name: row.process_name,
        process_slug: row.process_slug,
        definition_name: row.definition_name,
        template_artifact_name: row.template_artifact_name || null,
        unit_id: row.unit_id ? Number(row.unit_id) : null,
        unit_label: row.unit_label || null,
        term_id: row.term_id ? Number(row.term_id) : null,
        term_name: row.term_name || null,
        term_type_name: row.term_type_name || null,
        term_year: row.term_year ? Number(row.term_year) : null,
        document_version_id: row.document_version_id ? Number(row.document_version_id) : null,
        document_version: row.document_version || null,
        document_status: row.document_status || null,
        document_version_status: row.document_version_status || null,
        working_file_path: row.working_file_path || null,
        final_file_path: row.final_file_path || null,
        preloadFilePath,
        preloadPdfPath,
        pending_fill_count: Number(row.pending_fill_count || 0),
        pending_signature_count: Number(row.pending_signature_count || 0),
      };
    });

    res.json({
      user_id: userId,
      total: documents.length,
      documents
    });
  } catch (error) {
    console.error("Error obteniendo el centro documental del usuario:", error);
    res.status(500).json({
      message: "Error al obtener el centro documental del usuario",
      error: error.message
    });
  }
};

export const getUserGlobalSignatureCenter = async (req, res) => {
  try {
    const userId = getNumericUserId(req);
    if (!userId || Number.isNaN(userId)) {
      return res.status(400).json({ message: "Se requiere el usuario." });
    }
    if (!isAuthorizedUserScope(req, userId)) {
      return res.status(403).json({ message: "No tienes permiso para consultar esta bandeja de firmas." });
    }

    const pool = getPostgresPool();
    if (!pool) {
      return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
    }

    const rows = await getUserGlobalPendingSignatureRows(pool, userId);
    const signatures = rows.map((row) => {
      const preloadFilePath = row.final_file_path || row.working_file_path || null;
      const preloadPdfPath = [row.final_file_path, row.working_file_path]
        .map((value) => String(value || "").trim())
        .find((value) => value.toLowerCase().endsWith(".pdf")) || null;
      return {
        signature_request_id: Number(row.signature_request_id),
        document_id: Number(row.document_id),
        task_item_id: Number(row.task_item_id),
        task_id: Number(row.task_id),
        process_definition_id: Number(row.process_definition_id),
        process_id: Number(row.process_id),
        process_name: row.process_name,
        process_slug: row.process_slug,
        definition_name: row.definition_name,
        template_artifact_name: row.template_artifact_name || null,
        unit_id: row.unit_id ? Number(row.unit_id) : null,
        unit_label: row.unit_label || null,
        term_id: row.term_id ? Number(row.term_id) : null,
        term_name: row.term_name || null,
        term_type_name: row.term_type_name || null,
        term_year: row.term_year ? Number(row.term_year) : null,
        document_version_id: row.document_version_id ? Number(row.document_version_id) : null,
        document_version: row.document_version || null,
        document_status: row.document_status || null,
        document_version_status: row.document_version_status || null,
        signature_request_status_code: row.signature_request_status_code || null,
        signature_request_status_name: row.signature_request_status_name || null,
        requested_at: row.requested_at || null,
        step_order: row.step_order ? Number(row.step_order) : null,
        step_name: row.step_name || null,
        working_file_path: row.working_file_path || null,
        final_file_path: row.final_file_path || null,
        preloadFilePath,
        preloadPdfPath,
      };
    });

    res.json({
      user_id: userId,
      total: signatures.length,
      signatures
    });
  } catch (error) {
    console.error("Error obteniendo la bandeja global de firmas:", error);
    res.status(500).json({
      message: "Error al obtener la bandeja global de firmas",
      error: error.message
    });
  }
};

export const createUserProcessTask = async (req, res) => {
  const userId = getNumericUserId(req);
  const definitionId = Number(req.params?.definitionId);
  if (!userId || Number.isNaN(userId) || !definitionId || Number.isNaN(definitionId)) {
    return res.status(400).json({ message: "Se requieren el usuario y la configuracion del proceso." });
  }

  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }

  const accessPanel = await buildUserProcessDefinitionPanel(pool, userId, definitionId);
  if (!accessPanel) {
    return res.status(404).json({
      message: "La configuracion no esta activa o el usuario no tiene acceso operativo a ella."
    });
  }

  if (!accessPanel.permissions?.can_launch_manual) {
    return res.status(400).json({
      message: "Esta configuracion no permite lanzarse manualmente (revisa Periodos del proceso)."
    });
  }

  // Modelo 2026-06: lanzar manualmente = misma corrida/reparto que el automático. Se delega en
  // launchProcessDefinitionInTerm (process_run + una task por unidad + task_items por destino);
  // relanzar crea una corrida nueva superseiendo la activa (Opción X). Los periodos custom se
  // deprecaron: el lanzamiento siempre es contra un periodo existente del tipo del proceso.
  const termId = req.body?.term_id ? Number(req.body.term_id) : null;
  if (!termId || Number.isNaN(termId)) {
    return res.status(400).json({ message: "Debes seleccionar un periodo para lanzar el proceso." });
  }
  const relaunch = Boolean(req.body?.relaunch);
  const reason = req.body?.reason ? String(req.body.reason) : null;

  try {
    const result = await launchProcessDefinitionInTerm(definitionId, termId, {
      createdByUserId: userId,
      relaunch,
      reason
    });
    return res.json({ result: "ok", ...result });
  } catch (error) {
    console.error("Error lanzando la configuracion de proceso:", error);
    return res.status(400).json({ message: error.message || "No se pudo lanzar el proceso." });
  }
};

// --- Observaciones del entregable (hilo compartido revisión/firma) ---

export const listTaskItemObservations = async (req, res) => {
  const userId = getNumericUserId(req);
  const definitionId = Number(req.params?.definitionId);
  const taskItemId = Number(req.params?.taskItemId);
  if (!userId || !definitionId || Number.isNaN(definitionId) || !taskItemId || Number.isNaN(taskItemId)) {
    return res.status(400).json({ message: "Se requieren la configuración y el entregable." });
  }
  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }
  try {
    const taskItem = await getAccessibleTaskItemForUser(pool, userId, definitionId, taskItemId);
    if (!taskItem) {
      return res.status(404).json({ message: "No se encontró el entregable solicitado." });
    }
    const isOwner = Number(taskItem.resolved_owner_person_id || 0) === Number(userId);
    const inChain = await isUserInTaskItemChain(pool, userId, taskItem.task_item_id);
    const observations = await listDocumentObservations(taskItem.task_item_id, pool);
    return res.json({
      task_item_id: taskItem.task_item_id,
      can_add: isOwner || inChain,
      observations: observations.map((observation) => ({
        ...observation,
        can_resolve: !observation.resolved_at
          && (Number(observation.author_person_id) === Number(userId) || isOwner)
      }))
    });
  } catch (error) {
    console.error("Error listando observaciones del entregable:", error);
    return res.status(500).json({ message: "No se pudieron obtener las observaciones.", error: error.message });
  }
};

export const addTaskItemObservation = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const userId = getNumericUserId(req);
  const definitionId = Number(req.params?.definitionId);
  const taskItemId = Number(req.params?.taskItemId);
  if (!authenticatedUserId || !userId || authenticatedUserId !== userId) {
    return res.status(403).json({ message: "No autorizado." });
  }
  if (!definitionId || Number.isNaN(definitionId) || !taskItemId || Number.isNaN(taskItemId)) {
    return res.status(400).json({ message: "Se requieren la configuración y el entregable." });
  }
  const message = String(req.body?.message || "").trim();
  if (!message) {
    return res.status(400).json({ message: "Escribe el contenido de la observación." });
  }
  const phase = String(req.body?.phase || "review").trim();
  const kind = String(req.body?.kind || "observation").trim();
  const targetPersonId = req.body?.target_person_id ? Number(req.body.target_person_id) : null;

  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }
  const connection = await pool.getConnection();
  try {
    const taskItem = await getAccessibleTaskItemForUser(connection, userId, definitionId, taskItemId);
    if (!taskItem) {
      return res.status(404).json({ message: "No se encontró el entregable solicitado." });
    }
    const isOwner = Number(taskItem.resolved_owner_person_id || 0) === Number(userId);
    const inChain = await isUserInTaskItemChain(connection, userId, taskItem.task_item_id);
    if (!isOwner && !inChain) {
      return res.status(403).json({ message: "Solo el dueño o los responsables de la cadena pueden agregar observaciones." });
    }
    await connection.beginTransaction();
    const observationId = await addDocumentObservation(connection, {
      taskItemId: taskItem.task_item_id,
      phase,
      kind,
      message,
      authorPersonId: userId,
      targetPersonId
    });
    await connection.commit();
    if (!observationId) {
      return res.status(400).json({ message: "No se pudo registrar la observación (el entregable no tiene versión documental)." });
    }
    return res.status(201).json({ id: observationId });
  } catch (error) {
    await connection.rollback().catch(() => {});
    console.error("Error agregando observación del entregable:", error);
    return res.status(400).json({ message: error.message || "No se pudo agregar la observación." });
  } finally {
    connection.release();
  }
};

export const resolveTaskItemObservation = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const userId = getNumericUserId(req);
  const definitionId = Number(req.params?.definitionId);
  const taskItemId = Number(req.params?.taskItemId);
  const observationId = Number(req.params?.observationId);
  if (!authenticatedUserId || !userId || authenticatedUserId !== userId) {
    return res.status(403).json({ message: "No autorizado." });
  }
  if (!definitionId || !taskItemId || !observationId || Number.isNaN(observationId)) {
    return res.status(400).json({ message: "Parámetros inválidos." });
  }
  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }
  try {
    const taskItem = await getAccessibleTaskItemForUser(pool, userId, definitionId, taskItemId);
    if (!taskItem) {
      return res.status(404).json({ message: "No se encontró el entregable solicitado." });
    }
    const observation = await getObservationById(observationId, pool);
    if (!observation || Number(observation.task_item_id) !== Number(taskItem.task_item_id)) {
      return res.status(404).json({ message: "Observación no encontrada." });
    }
    const isOwner = Number(taskItem.resolved_owner_person_id || 0) === Number(userId);
    const isAuthor = Number(observation.author_person_id) === Number(userId);
    if (!isOwner && !isAuthor) {
      return res.status(403).json({ message: "Solo el autor o el dueño del entregable pueden resolver la observación." });
    }
    await resolveDocumentObservation(observationId, userId, pool);
    return res.json({ resolved: true, id: observationId });
  } catch (error) {
    console.error("Error resolviendo observación del entregable:", error);
    return res.status(500).json({ message: "No se pudo resolver la observación.", error: error.message });
  }
};

export const uploadDeliverablePdf = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  const definitionId = Number(req.params?.definitionId);
  const taskItemId = Number(req.params?.taskItemId);
  const documentId = Number(req.body?.document_id || req.query?.document_id || 0) || null;
  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado para subir el entregable." });
  }
  if (!definitionId || Number.isNaN(definitionId) || !taskItemId || Number.isNaN(taskItemId)) {
    return res.status(400).json({ message: "Se requieren la configuración y el entregable." });
  }
  const uploadedFile = req.file;
  if (!uploadedFile) {
    return res.status(400).json({ message: "Debes seleccionar un archivo del entregable." });
  }

  const pool = getPostgresPool();
  if (!pool) {
    await fs.remove(uploadedFile.path).catch(() => {});
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }

  const connection = await pool.getConnection();
  try {
    const target = await getAccessibleTaskItemDocumentForUser(connection, authenticatedUserId, definitionId, taskItemId, { documentId });
    if (!target?.document_version_id) {
      return res.status(404).json({ message: "No se encontró un documento activo para ese entregable." });
    }
    if (target.requires_document_selection) {
      return res.status(409).json({
        message: "Debes seleccionar la instancia documental sobre la que deseas cargar el archivo.",
        requires_document_selection: true,
      });
    }

    // usage_role deprecado: todo entregable de proceso (siempre 'primary') admite carga manual.
    if (!target.scope_unit_id || !target.process_id || !target.term_id || !target.term_type_id || !target.task_id || !target.document_id) {
      return res.status(400).json({
        message: "No se pudo determinar la ruta documental canónica para este entregable."
      });
    }

    const originalName = String(uploadedFile.originalname || "entregable.pdf");
    const extension = path.extname(originalName).replace(/^\./, "").toLowerCase() || "pdf";
    const relativeObjectPath = buildWorkingObjectPathForUpload({
      basePath: buildCanonicalDocumentVersionBasePath(target),
      originalName,
      extension
    });
    const minioObjectName = `${MINIO_DOCUMENTS_PREFIX}/${relativeObjectPath}`;

    await ensureBucketExists(MINIO_DOCUMENTS_BUCKET);
    await uploadFileToMinio(MINIO_DOCUMENTS_BUCKET, minioObjectName, uploadedFile.path, {
      "Content-Type": uploadedFile.mimetype || "application/octet-stream",
      "Original-Name": originalName
    });

    await connection.beginTransaction();
    await connection.query(
      `UPDATE document_versions
       SET working_file_path = ?
       WHERE id = ?`,
      [relativeObjectPath, Number(target.document_version_id)]
    );

    const currentStatus = String(target.document_version_status || "").trim();
    if (currentStatus === "Borrador" || currentStatus === "Pendiente de llenado" || currentStatus === "Observado") {
      await transitionDocumentVersionState(connection, Number(target.document_version_id), "En llenado");
    }

    await connection.commit();

    return res.json({
      message: "El archivo del entregable se cargó correctamente.",
      task_item_id: Number(target.task_item_id),
      document_id: Number(target.document_id),
      document_version_id: Number(target.document_version_id),
      working_file_path: relativeObjectPath,
      file_extension: extension,
      template_artifact_name: target.template_artifact_name || `Entregable #${target.task_item_id}`
    });
  } catch (error) {
    await connection.rollback().catch(() => {});
    console.error("Error al subir el archivo del entregable:", error);
    return res.status(500).json({
      message: "No se pudo cargar el archivo del entregable.",
      error: error.message
    });
  } finally {
    connection.release();
    await fs.remove(uploadedFile.path).catch(() => {});
  }
};

export const downloadDeliverableTemplate = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  const definitionId = Number(req.params?.definitionId);
  const taskItemId = Number(req.params?.taskItemId);
  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado para descargar la plantilla." });
  }
  if (!definitionId || Number.isNaN(definitionId) || !taskItemId || Number.isNaN(taskItemId)) {
    return res.status(400).json({ message: "Se requieren la configuración y el entregable." });
  }

  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }

  try {
    const [rows] = await pool.query(
      `SELECT
         ti.id AS task_item_id,
         tar_dl.template_seed_id,
         tar_dl.display_name AS template_artifact_name,
         tar.available_formats
       FROM task_items ti
       INNER JOIN tasks t ON t.id = ti.task_id
       INNER JOIN template_artifacts tar ON tar.id = ti.template_artifact_id
     LEFT JOIN deliverables tar_dl ON tar_dl.id = tar.deliverable_id
       WHERE ti.id = ?
         AND t.process_definition_id = ?
         AND (
           t.created_by_user_id = ?
           OR ti.target_person_id = ?
           OR ti.assigned_person_id = ?
           OR EXISTS (
             SELECT 1
             FROM task_assignments ta
             LEFT JOIN position_assignments pa
               ON pa.position_id = ta.position_id
              AND pa.is_current = 1
              AND pa.person_id = ?
             WHERE ta.task_id = t.id
               -- Mismo guard que getAccessibleTaskItemForUser (ver el IDOR arreglado allí).
               -- Aquí no hay fuga de datos (la plantilla es la misma para todos los entregables
               -- de la configuración), pero se alinea el predicado para que no quede una copia
               -- laxa que alguien reutilice como referencia.
               AND (ti.responsible_position_id IS NULL OR ta.position_id = ti.responsible_position_id)
               AND (
                 ta.assigned_person_id = ?
                 OR (ta.assigned_person_id IS NULL AND pa.person_id = ?)
               )
           )
         )
       LIMIT 1`,
      [
        taskItemId,
        definitionId,
        authenticatedUserId,
        authenticatedUserId,
        authenticatedUserId,
        authenticatedUserId,
        authenticatedUserId,
        authenticatedUserId
      ]
    );
    const target = rows?.[0];
    if (!target) {
      return res.status(404).json({ message: "No se encontró el entregable solicitado." });
    }
    const availableFormats = parseAvailableFormats(target.available_formats);
    const resources = await collectDeliverableTemplateResources(availableFormats);

    if (!resources.length) {
      return res.status(404).json({
        message: "El entregable no tiene recursos descargables publicados en MinIO para esta plantilla."
      });
    }

    const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "deliverable-template-"));
    const zipPath = path.join(
      os.tmpdir(),
      `${sanitizeStorageSegment(target.template_artifact_name || "plantilla", "plantilla")}-${randomUUID()}.zip`
    );
    const downloadFileName = `${sanitizeStorageSegment(target.template_artifact_name || "plantilla", "plantilla")}.zip`;

    try {
      for (const resource of resources) {
        const destinationPath = path.join(workspace, resource.archiveName);
        await writeMinioObjectToFile(MINIO_TEMPLATES_BUCKET, resource.objectName, destinationPath);
      }
      await createZipArchive(workspace, zipPath);
      res.setHeader("Content-Type", "application/zip");
      return res.download(zipPath, downloadFileName, async () => {
        await fs.remove(zipPath).catch(() => {});
        await fs.remove(workspace).catch(() => {});
      });
    } catch (zipError) {
      await fs.remove(zipPath).catch(() => {});
      await fs.remove(workspace).catch(() => {});
      throw zipError;
    }
  } catch (error) {
    console.error("Error al descargar la plantilla del entregable:", error);
    return res.status(404).json({
      message: error.message || "No se pudo descargar la plantilla del entregable."
    });
  }
};

export const downloadDeliverableFile = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  const definitionId = Number(req.params?.definitionId);
  const taskItemId = Number(req.params?.taskItemId);
  const documentId = Number(req.query?.document_id || 0) || null;
  const requestedKind = String(req.query?.kind || "best").trim().toLowerCase();
  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado para descargar el archivo del entregable." });
  }
  if (!definitionId || Number.isNaN(definitionId) || !taskItemId || Number.isNaN(taskItemId)) {
    return res.status(400).json({ message: "Se requieren la configuración y el entregable." });
  }

  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }

  try {
    const target = await getAccessibleTaskItemDocumentForUser(pool, authenticatedUserId, definitionId, taskItemId, { documentId });
    if (!target?.document_version_id) {
      return res.status(404).json({ message: "No se encontró un documento activo para ese entregable." });
    }
    if (target.requires_document_selection) {
      return res.status(409).json({
        message: "Debes seleccionar la instancia documental que deseas descargar.",
        requires_document_selection: true,
      });
    }

    const candidatePaths =
      requestedKind === "final"
        ? [target.final_file_path]
        : requestedKind === "working"
          ? [target.working_file_path]
          : [target.final_file_path, target.working_file_path];
    const normalizedCandidatePaths = candidatePaths
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    if (!normalizedCandidatePaths.length) {
      return res.status(404).json({ message: "El entregable todavía no tiene un archivo vinculado." });
    }

    let selectedObject = null;
    let selectedStat = null;
    let lastResolutionError = null;

    for (const storedPath of normalizedCandidatePaths) {
      const resolvedObject = resolveStoredDocumentObject(storedPath);
      if (!resolvedObject) {
        continue;
      }
      try {
        const stat = await statMinioObject(resolvedObject.bucket, resolvedObject.objectName);
        selectedObject = resolvedObject;
        selectedStat = stat;
        break;
      } catch (error) {
        lastResolutionError = error;
      }
    }

    if (!selectedObject || !selectedStat) {
      const message =
        lastResolutionError?.message || "No se encontró un archivo válido del entregable en almacenamiento.";
      return res.status(404).json({ message });
    }

    const stream = await getMinioObjectStream(selectedObject.bucket, selectedObject.objectName);
    const fileName = path.basename(selectedObject.objectName);
    const contentType =
      selectedStat?.metaData?.["content-type"]
      || selectedStat?.metaData?.["Content-Type"]
      || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", selectedStat.size);
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
    stream.on("error", (streamError) => {
      console.error("Error transmitiendo el archivo del entregable:", streamError);
      if (!res.headersSent) {
        res.status(500).json({ message: "No se pudo transmitir el archivo del entregable." });
      } else {
        res.destroy(streamError);
      }
    });
    stream.pipe(res);
  } catch (error) {
    console.error("Error descargando el archivo del entregable:", error);
    return res.status(500).json({
      message: "No se pudo descargar el archivo del entregable.",
      error: error.message
    });
  }
};

export const resetDeliverableWorkflow = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  const definitionId = Number(req.params?.definitionId);
  const taskItemId = Number(req.params?.taskItemId);
  const documentId = Number(req.body?.document_id || req.query?.document_id || 0) || null;

  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado para resetear el flujo del entregable." });
  }
  if (!definitionId || Number.isNaN(definitionId) || !taskItemId || Number.isNaN(taskItemId)) {
    return res.status(400).json({ message: "Se requieren la configuración y el entregable." });
  }

  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }

  const connection = await pool.getConnection();
  try {
    const target = await getAccessibleTaskItemDocumentForUser(connection, authenticatedUserId, definitionId, taskItemId, { documentId });
    if (target?.requires_document_selection) {
      return res.status(409).json({
        message: "Debes seleccionar la instancia documental que deseas resetear.",
        requires_document_selection: true,
      });
    }
    await connection.beginTransaction();
    const result = await resetDocumentWorkflowForTaskItem({
      connection,
      userId: authenticatedUserId,
      definitionId,
      taskItemId,
      documentId: documentId || target?.document_id || null,
    });
    await connection.commit();

    return res.json({
      message: "El flujo del entregable se reseteó correctamente.",
      document_id: result.documentId,
      previous_document_version_id: result.previousDocumentVersionId,
      previous_document_version: result.previousDocumentVersion,
      new_document_version_id: result.newDocumentVersionId,
      new_document_version: result.newDocumentVersion,
      reset_by: result.resetBy,
    });
  } catch (error) {
    await connection.rollback().catch(() => {});
    const statusCode = Number(error?.statusCode || 500);
    console.error("Error reseteando el flujo del entregable:", error);
    return res.status(statusCode).json({
      message: error?.message || "No se pudo resetear el flujo del entregable.",
    });
  } finally {
    connection.release();
  }
};

//update user data
export const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.uid;

    const payload = {
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      whatsapp: req.body.whatsapp,
      direccion: req.body.direccion,
      pais: req.body.pais
    };

    const updatedUser = await userRepository.update(userId, payload);
    const access = await rbacService.getUserAccess(userId);

    res.json({
      result: "ok",
      user: {
        ...updatedUser,
        access,
        roles: access.roleNames,
        permissions: access.permissions,
        role: access.primaryRole
      }
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error actualizando perfil"
    });
  }
};

//get user by id
export const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.uid;

    const user = await userRepository.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "Usuario no encontrado"
      });
    }

    const access = await rbacService.getUserAccess(userId);

    res.json({
      result: "ok",
      user: userRepository.toPublicUser(user, access)
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error obteniendo perfil"
    });
  }
};

// ──────────────────────────────────────────────────────────────────────────
// Anexos heterogéneos del entregable (document_attachments).
// Archivos auxiliares (evidencias, soportes) adicionales al documento principal.
// ──────────────────────────────────────────────────────────────────────────

const ATTACHMENT_ALLOWED_KINDS = new Set(["annex", "evidence", "source", "other"]);

export const listDeliverableAttachments = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  const definitionId = Number(req.params?.definitionId);
  const taskItemId = Number(req.params?.taskItemId);
  const documentId = Number(req.query?.document_id || 0) || null;
  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado para consultar los anexos." });
  }
  if (!definitionId || Number.isNaN(definitionId) || !taskItemId || Number.isNaN(taskItemId)) {
    return res.status(400).json({ message: "Se requieren la configuración y el entregable." });
  }

  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }

  try {
    const target = await getAccessibleTaskItemDocumentForUser(pool, authenticatedUserId, definitionId, taskItemId, { documentId });
    if (!target?.document_version_id) {
      return res.status(404).json({ message: "No se encontró un documento activo para ese entregable." });
    }
    const [rows] = await pool.query(
      `SELECT * FROM document_attachments
       WHERE document_version_id = ?
       ORDER BY sort_order ASC, id ASC`,
      [Number(target.document_version_id)]
    );
    return res.json({
      document_version_id: Number(target.document_version_id),
      attachments: (rows || []).map(mapAttachmentRow),
    });
  } catch (error) {
    console.error("Error al listar los anexos del entregable:", error);
    return res.status(500).json({ message: "No se pudieron listar los anexos.", error: error.message });
  }
};

export const uploadDeliverableAttachment = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  const definitionId = Number(req.params?.definitionId);
  const taskItemId = Number(req.params?.taskItemId);
  const documentId = Number(req.body?.document_id || req.query?.document_id || 0) || null;
  const requestedKind = String(req.body?.kind || "annex").trim().toLowerCase();
  const description = String(req.body?.description || "").trim().slice(0, 255) || null;
  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado para subir anexos." });
  }
  if (!definitionId || Number.isNaN(definitionId) || !taskItemId || Number.isNaN(taskItemId)) {
    return res.status(400).json({ message: "Se requieren la configuración y el entregable." });
  }
  const uploadedFile = req.file;
  if (!uploadedFile) {
    return res.status(400).json({ message: "Debes seleccionar un archivo para el anexo." });
  }
  const kind = ATTACHMENT_ALLOWED_KINDS.has(requestedKind) ? requestedKind : "annex";

  const pool = getPostgresPool();
  if (!pool) {
    await fs.remove(uploadedFile.path).catch(() => {});
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }

  const connection = await pool.getConnection();
  try {
    const target = await getAccessibleTaskItemDocumentForUser(connection, authenticatedUserId, definitionId, taskItemId, { documentId });
    if (!target?.document_version_id) {
      return res.status(404).json({ message: "No se encontró un documento activo para ese entregable." });
    }
    if (target.requires_document_selection) {
      return res.status(409).json({
        message: "Debes seleccionar la instancia documental sobre la que deseas adjuntar el archivo.",
        requires_document_selection: true,
      });
    }
    if (!target.scope_unit_id || !target.process_id || !target.term_id || !target.term_type_id || !target.task_id || !target.document_id) {
      return res.status(400).json({ message: "No se pudo determinar la ruta documental canónica para este entregable." });
    }

    const originalName = String(uploadedFile.originalname || "anexo");
    const extension = path.extname(originalName).replace(/^\./, "").toLowerCase() || "bin";
    const relativeObjectPath = buildAttachmentObjectPath({
      basePath: buildCanonicalDocumentVersionBasePath(target),
      originalName,
      extension
    });
    const minioObjectName = `${MINIO_DOCUMENTS_PREFIX}/${relativeObjectPath}`;

    await ensureBucketExists(MINIO_DOCUMENTS_BUCKET);
    await uploadFileToMinio(MINIO_DOCUMENTS_BUCKET, minioObjectName, uploadedFile.path, {
      "Content-Type": uploadedFile.mimetype || "application/octet-stream",
      "Original-Name": originalName
    });

    const [orderRows] = await connection.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order
       FROM document_attachments WHERE document_version_id = ?`,
      [Number(target.document_version_id)]
    );
    const sortOrder = Number(orderRows?.[0]?.next_order || 1);

    const [insertResult] = await connection.query(
      `INSERT INTO document_attachments
        (document_version_id, kind, file_path, file_name, mime_type, size_bytes, description, uploaded_by_person_id, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(target.document_version_id),
        kind,
        relativeObjectPath,
        originalName.slice(0, 255),
        (uploadedFile.mimetype || null)?.slice(0, 120) || null,
        Number(uploadedFile.size || 0) || null,
        description,
        authenticatedUserId,
        sortOrder
      ]
    );

    return res.json({
      message: "El anexo se cargó correctamente.",
      attachment: {
        id: Number(insertResult.insertId),
        document_version_id: Number(target.document_version_id),
        kind,
        file_path: relativeObjectPath,
        file_name: originalName,
        mime_type: uploadedFile.mimetype || null,
        size_bytes: Number(uploadedFile.size || 0) || null,
        description,
        uploaded_by_person_id: authenticatedUserId,
        sort_order: sortOrder,
      }
    });
  } catch (error) {
    console.error("Error al subir el anexo del entregable:", error);
    return res.status(500).json({ message: "No se pudo cargar el anexo.", error: error.message });
  } finally {
    connection.release();
    await fs.remove(uploadedFile.path).catch(() => {});
  }
};

export const deleteDeliverableAttachment = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  const definitionId = Number(req.params?.definitionId);
  const taskItemId = Number(req.params?.taskItemId);
  const attachmentId = Number(req.params?.attachmentId);
  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado para eliminar anexos." });
  }
  if (!definitionId || Number.isNaN(definitionId) || !taskItemId || Number.isNaN(taskItemId) || !attachmentId || Number.isNaN(attachmentId)) {
    return res.status(400).json({ message: "Se requieren la configuración, el entregable y el anexo." });
  }

  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }

  try {
    const target = await getAccessibleTaskItemDocumentForUser(pool, authenticatedUserId, definitionId, taskItemId, {});
    if (!target?.task_item_id) {
      return res.status(404).json({ message: "No se encontró el entregable." });
    }
    // El anexo debe pertenecer a una versión documental de este task_item (cualquier instancia).
    const [rows] = await pool.query(
      `SELECT da.id, da.file_path
       FROM document_attachments da
       INNER JOIN document_versions dv ON dv.id = da.document_version_id
       INNER JOIN documents d ON d.id = dv.document_id
       WHERE da.id = ? AND d.task_item_id = ?
       LIMIT 1`,
      [attachmentId, Number(target.task_item_id)]
    );
    const attachment = rows?.[0];
    if (!attachment) {
      return res.status(404).json({ message: "El anexo no existe o no pertenece a este entregable." });
    }

    await pool.query(`DELETE FROM document_attachments WHERE id = ?`, [attachmentId]);

    const resolved = resolveStoredDocumentObject(attachment.file_path);
    if (resolved) {
      await removeMinioObject(resolved.bucket, resolved.objectName).catch((err) => {
        console.warn("No se pudo eliminar el objeto del anexo en MinIO:", err?.message);
      });
    }

    return res.json({ message: "El anexo se eliminó correctamente.", attachment_id: attachmentId });
  } catch (error) {
    console.error("Error al eliminar el anexo del entregable:", error);
    return res.status(500).json({ message: "No se pudo eliminar el anexo.", error: error.message });
  }
};

export const downloadDeliverableAttachment = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  const definitionId = Number(req.params?.definitionId);
  const taskItemId = Number(req.params?.taskItemId);
  const attachmentId = Number(req.params?.attachmentId);
  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado para descargar el anexo." });
  }
  if (!definitionId || Number.isNaN(definitionId) || !taskItemId || Number.isNaN(taskItemId) || !attachmentId || Number.isNaN(attachmentId)) {
    return res.status(400).json({ message: "Se requieren la configuración, el entregable y el anexo." });
  }

  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }

  try {
    const target = await getAccessibleTaskItemDocumentForUser(pool, authenticatedUserId, definitionId, taskItemId, {});
    if (!target?.task_item_id) {
      return res.status(404).json({ message: "No se encontró el entregable." });
    }
    const [rows] = await pool.query(
      `SELECT da.file_path, da.file_name, da.mime_type
       FROM document_attachments da
       INNER JOIN document_versions dv ON dv.id = da.document_version_id
       INNER JOIN documents d ON d.id = dv.document_id
       WHERE da.id = ? AND d.task_item_id = ?
       LIMIT 1`,
      [attachmentId, Number(target.task_item_id)]
    );
    const attachment = rows?.[0];
    if (!attachment) {
      return res.status(404).json({ message: "El anexo no existe o no pertenece a este entregable." });
    }

    const resolved = resolveStoredDocumentObject(attachment.file_path);
    if (!resolved) {
      return res.status(404).json({ message: "No se pudo resolver la ruta del anexo." });
    }
    const stat = await statMinioObject(resolved.bucket, resolved.objectName).catch(() => null);
    if (!stat) {
      return res.status(404).json({ message: "El archivo del anexo no se encontró en almacenamiento." });
    }

    const stream = await getMinioObjectStream(resolved.bucket, resolved.objectName);
    const fileName = attachment.file_name || path.basename(resolved.objectName);
    const contentType = attachment.mime_type
      || stat?.metaData?.["content-type"]
      || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
    stream.on("error", (streamError) => {
      console.error("Error transmitiendo el anexo:", streamError);
      if (!res.headersSent) res.status(500).json({ message: "No se pudo transmitir el anexo." });
      else res.destroy(streamError);
    });
    stream.pipe(res);
  } catch (error) {
    console.error("Error al descargar el anexo del entregable:", error);
    return res.status(500).json({ message: "No se pudo descargar el anexo.", error: error.message });
  }
};

// ──────────────────────────────────────────────────────────────────────────
// Fase B: tareas sueltas (proceso default) y entregables agregados.
// - Libre: tarea del proceso default, periodo custom, asignada al creador.
// - Derivada: agrega un task_item.user_added en la tarea origen; no crea tarea hija.
// ──────────────────────────────────────────────────────────────────────────

// Plantillas del proceso de una tarea que admiten alta on-demand (modos replicated/routed).
// Alimenta las afford. "Agregar réplica" / "Enviar" del frontend.
export const listAddableDeliverables = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado." });
  }
  const taskId = req.query?.task_id ? Number(req.query.task_id) : null;
  const requestedDefinitionId = req.query?.definition_id ? Number(req.query.definition_id) : null;
  if ((!taskId || Number.isNaN(taskId)) && (!requestedDefinitionId || Number.isNaN(requestedDefinitionId))) {
    return res.status(400).json({ message: "Se requiere task_id o definition_id." });
  }
  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }
  const connection = await pool.getConnection();
  try {
    // Por definición (proceso de envíos aunque no tenga tarea) o resuelto desde la tarea.
    let definitionId = requestedDefinitionId || null;
    if (!definitionId) {
      const [taskRows] = await connection.query(
        `SELECT process_definition_id FROM tasks WHERE id = ? LIMIT 1`,
        [taskId]
      );
      definitionId = taskRows?.[0]?.process_definition_id
        ? Number(taskRows[0].process_definition_id)
        : null;
    }
    if (!definitionId) {
      return res.status(404).json({ message: "Configuración no encontrada." });
    }
    const [rows] = await connection.query(
      `SELECT pdt.id,
              pdt.template_artifact_id,
              pdt.item_mode,
              pdt.sort_order,
              COALESCE(dl.display_name, dl.code) AS name
       FROM process_definition_templates pdt
       LEFT JOIN template_artifacts ta ON ta.id = pdt.template_artifact_id
       LEFT JOIN deliverables dl ON dl.id = ta.deliverable_id
       WHERE pdt.process_definition_id = ?
         AND pdt.item_mode IN ('replicated', 'routed')
       ORDER BY pdt.sort_order ASC, pdt.id ASC`,
      [definitionId]
    );
    return res.json({ result: "ok", task_id: taskId, definition_id: definitionId, deliverables: rows });
  } catch (error) {
    console.error("listAddableDeliverables error:", error);
    return res.status(500).json({ message: "No se pudieron cargar los entregables agregables." });
  } finally {
    connection.release();
  }
};

// Búsqueda de destinatarios (cualquier persona activa) para entregables ruteados (memo/oficio).
export const searchTaskRecipients = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado." });
  }
  const q = String(req.query?.q || "").trim();
  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }
  const connection = await pool.getConnection();
  try {
    const params = [];
    let where = "p.is_active = 1";
    if (q) {
      const like = `%${q}%`;
      where +=
        " AND (p.first_name LIKE ? OR p.last_name LIKE ? OR p.cedula LIKE ? OR p.email LIKE ? OR CONCAT(p.first_name, ' ', p.last_name) LIKE ?)";
      params.push(like, like, like, like, like);
    }
    const [rows] = await connection.query(
      `SELECT p.id, p.cedula, p.first_name, p.last_name, p.email,
              CONCAT(p.first_name, ' ', p.last_name) AS full_name
       FROM persons p
       WHERE ${where}
       ORDER BY p.first_name ASC, p.last_name ASC
       LIMIT 25`,
      params
    );
    return res.json({ result: "ok", recipients: rows });
  } catch (error) {
    console.error("searchTaskRecipients error:", error);
    return res.status(500).json({ message: "No se pudieron cargar los destinatarios." });
  } finally {
    connection.release();
  }
};

// Catálogo para el flow-builder routed "Por cargo": unidades + cargos activos (elegir cargo + unidad).
export const listFlowCatalog = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado." });
  }
  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }
  const connection = await pool.getConnection();
  try {
    const [units] = await connection.query(
      `SELECT id, name FROM units WHERE is_active = 1 ORDER BY name ASC LIMIT 1000`
    );
    const [cargos] = await connection.query(
      `SELECT id, name FROM cargos WHERE is_active = 1 ORDER BY name ASC LIMIT 500`
    );
    return res.json({ result: "ok", units, cargos });
  } catch (error) {
    console.error("listFlowCatalog error:", error);
    return res.status(500).json({ message: "No se pudo cargar el catálogo de cargos/unidades." });
  } finally {
    connection.release();
  }
};

// R4: consolidado "Mis envíos" — todo lo que el usuario ha enviado (items routed) entre TODOS los
// tipos/procesos, con su tipo, destinatario, estado y fecha. Los recibidos viven en firmas/documental.
export const listMySends = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado." });
  }
  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      `SELECT
         ti.id,
         ti.title AS label,
         ti.status,
         ti.created_at,
         ti.target_person_id,
         NULLIF(TRIM(CONCAT(COALESCE(recip.first_name, ''), ' ', COALESCE(recip.last_name, ''))), '') AS recipient_name,
         p.id AS process_id,
         p.name AS process_name,
         pdv.id AS definition_id,
         d.status AS document_status
       FROM task_items ti
       JOIN process_definition_templates pdt
         ON pdt.id = ti.process_definition_template_id AND pdt.item_mode = 'routed'
       JOIN tasks t ON t.id = ti.task_id
       JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
       JOIN processes p ON p.id = pdv.process_id
       LEFT JOIN persons recip ON recip.id = ti.target_person_id
       LEFT JOIN documents d ON d.task_item_id = ti.id
       WHERE ti.created_by_person_id = ?
       ORDER BY ti.created_at DESC, ti.id DESC
       LIMIT 200`,
      [authenticatedUserId]
    );
    return res.json({ result: "ok", sends: rows });
  } catch (error) {
    console.error("listMySends error:", error);
    return res.status(500).json({ message: "No se pudieron cargar tus envíos." });
  } finally {
    connection.release();
  }
};

// "Recibidos" — items routed que le LLEGARON al usuario para ACTUAR: es el destinatario ("Para:"),
// o el flujo lo asignó a ELABORAR (fill_request) o FIRMAR (signature_request). Simétrico a listMySends.
// Nota: el asignado suele resolverse por CARGO (cargo_in_scope), por eso no basta con target_person_id.
export const listMyReceived = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado." });
  }
  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }
  // Subconsultas EXISTS reutilizables: ¿la persona es asignada de llenado / firma del documento del item?
  const FILL_EXISTS = `EXISTS (
    SELECT 1 FROM fill_requests fr
      JOIN document_fill_flows dff ON dff.id = fr.document_fill_flow_id
      JOIN document_versions dv ON dv.id = dff.document_version_id
      JOIN documents dd ON dd.id = dv.document_id
     WHERE dd.task_item_id = ti.id AND fr.assigned_person_id = ?
  )`;
  const SIGN_EXISTS = `EXISTS (
    SELECT 1 FROM signature_requests sr
      JOIN signature_flow_instances sfi ON sfi.id = sr.instance_id
      JOIN document_versions dv ON dv.id = sfi.document_version_id
      JOIN documents dd ON dd.id = dv.document_id
     WHERE dd.task_item_id = ti.id AND sr.assigned_person_id = ?
  )`;
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      `SELECT
         ti.id,
         ti.title AS label,
         ti.status,
         ti.created_at,
         ti.created_by_person_id,
         NULLIF(TRIM(CONCAT(COALESCE(sender.first_name, ''), ' ', COALESCE(sender.last_name, ''))), '') AS sender_name,
         p.id AS process_id,
         p.name AS process_name,
         pdv.id AS definition_id,
         d.status AS document_status,
         ${FILL_EXISTS} AS needs_fill,
         ${SIGN_EXISTS} AS needs_sign,
         (ti.target_person_id = ?) AS is_recipient
       FROM task_items ti
       JOIN process_definition_templates pdt
         ON pdt.id = ti.process_definition_template_id AND pdt.item_mode = 'routed'
       JOIN tasks t ON t.id = ti.task_id
       JOIN process_definition_versions pdv ON pdv.id = t.process_definition_id
       JOIN processes p ON p.id = pdv.process_id
       LEFT JOIN persons sender ON sender.id = ti.created_by_person_id
       LEFT JOIN documents d ON d.task_item_id = ti.id
       WHERE (ti.created_by_person_id IS NULL OR ti.created_by_person_id <> ?)
         AND ( ti.target_person_id = ? OR ${FILL_EXISTS} OR ${SIGN_EXISTS} )
       ORDER BY ti.created_at DESC, ti.id DESC
       LIMIT 200`,
      [
        authenticatedUserId, // FILL_EXISTS (select)
        authenticatedUserId, // SIGN_EXISTS (select)
        authenticatedUserId, // is_recipient (select)
        authenticatedUserId, // created_by <> (where)
        authenticatedUserId, // target = (where)
        authenticatedUserId, // FILL_EXISTS (where)
        authenticatedUserId, // SIGN_EXISTS (where)
      ]
    );
    return res.json({ result: "ok", received: rows });
  } catch (error) {
    console.error("listMyReceived error:", error);
    return res.status(500).json({ message: "No se pudieron cargar los documentos recibidos." });
  } finally {
    connection.release();
  }
};

export const createGeneralTask = async (req, res) => {
  const authenticatedUserId = getAuthenticatedUserId(req);
  const routeUserId = getNumericUserId(req);
  if (!authenticatedUserId || !routeUserId || authenticatedUserId !== routeUserId) {
    return res.status(403).json({ message: "No autorizado para crear la tarea." });
  }

  const input = parseGeneralTaskInput(req.body);

  if (!input.title) {
    return res.status(400).json({ message: "Debes indicar un título para la tarea." });
  }
  if (input.mode === "derived" && (!input.sourceTaskId || Number.isNaN(input.sourceTaskId))) {
    return res.status(400).json({ message: "Se requiere la tarea de origen para agregar el entregable." });
  }

  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }

  try {
    const payload = await createGeneralTaskForUser(pool, { authenticatedUserId, input });
    return res.json(payload);
  } catch (error) {
    console.error("Error creando tarea general:", error);
    // 400 por defecto (error de negocio); el servicio marca `statusCode` cuando el fallo es de
    // infraestructura, como no poder adquirir la conexión, que antes del corte salía como 500.
    return res.status(error.statusCode ?? 400).json({ message: error.message || "No se pudo crear la tarea." });
  }
};
