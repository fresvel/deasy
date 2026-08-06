import path from "node:path";
import os from "node:os";
import fs from "fs-extra";
import { randomUUID } from "node:crypto";
import whatsappBot from "../../services/whatsapp/WhatsAppBot.js";
import UserRepository from "../../services/auth/UserRepository.js";
import RbacService from "../../services/auth/RbacService.js";
import { getPostgresPool } from "../../config/postgres.js";
import {
  ensureDocumentForTaskItem,
  materializeRuntimeFlowForTaskItem,
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
import { parseAvailableFormats } from "../../services/admin/SqlAdminService.artifacts.js";
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
  getAccessibleTaskItemDocumentForUser,
  getUserOperationalProcessRows,
  getCustomTermType,
  getActiveGeneralDefinition,
  resolveUserPositionInUnit
} from "./user_controler.queries.js";
import { buildUserProcessDefinitionPanel } from "./user_controler.panel.js";
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

export const updateUserPhoto = async (req, res) => {
  const { cedula } = req.params;
  const file = req.file;

  if (!file) {
    return res.status(400).send({ message: "Debe adjuntar la foto en el campo 'photo'." });
  }

  try {
    const existingUser = await userRepository.findByCedulaOrEmail({ cedula });
    if (!existingUser) {
      await fs.remove(file.path).catch(() => { });
      return res.status(404).send({ message: "Usuario no encontrado" });
    }

    const relativePath = path.relative(process.cwd(), file.path).replace(/\\/g, "/");
    const normalizedPath = relativePath.startsWith("uploads/") ? relativePath : `uploads/${relativePath}`;

    const updatedUser = await userRepository.updatePhotoByCedula(cedula, normalizedPath);

    const previousPath = existingUser.photo_url;
    if (previousPath && !previousPath.startsWith("data:")) {
      const absolutePrev = path.resolve(process.cwd(), previousPath.replace(/^\/+/, ""));
      if (await fs.pathExists(absolutePrev)) {
        await fs.remove(absolutePrev).catch(() => { });
      }
    }

    res.json({ result: "ok", user: updatedUser });
  } catch (error) {
    await fs.remove(file.path).catch(() => { });
    console.error("Error actualizando foto de usuario", error);
    res.status(500).send({ message: "Error al actualizar la foto", error: error.message });
  }
};

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

    const [orgRelationRows] = await pool.query(
      "SELECT id FROM relation_unit_types WHERE code = 'org' LIMIT 1"
    );
    if (!orgRelationRows.length) {
      return res.status(500).json({
        message:
          "No existe relation_unit_types con code='org'. Debe implementarse para construir la jerarquia de unidades."
      });
    }

    const [positions] = await pool.query(
      `SELECT DISTINCT
         up.id AS position_id,
         up.position_type,
         u.id AS unit_id,
         u.name AS unit_name,
         u.label AS unit_label,
         u.unit_type_id,
         uol.group_unit_id AS group_unit_id,
         gu.name AS group_unit_name,
         gu.label AS group_unit_label,
         c.id AS cargo_id,
         c.name AS cargo_name
       FROM position_assignments pa
       INNER JOIN unit_positions up ON up.id = pa.position_id
       INNER JOIN units u ON u.id = up.unit_id
       INNER JOIN cargos c ON c.id = up.cargo_id
       LEFT JOIN unit_org_levels uol ON uol.unit_id = u.id
       LEFT JOIN units gu ON gu.id = uol.group_unit_id
       WHERE pa.person_id = ?
         AND pa.is_current = 1
         AND up.is_active = 1
         AND u.is_active = 1
         AND c.is_active = 1
       ORDER BY u.name, c.name`,
      [userId]
    );

    if (!positions.length) {
      return res.json({ user_id: userId, units: [], consolidated: [] });
    }

    const unitsMap = new Map();
    const cargoMapByUnit = new Map();
    const consolidatedMap = new Map();
    const groupMap = new Map();

    const ensureUnitCargoMap = (unitId) => {
      if (!cargoMapByUnit.has(unitId)) {
        cargoMapByUnit.set(unitId, new Map());
      }
      return cargoMapByUnit.get(unitId);
    };

    positions.forEach((row) => {
      const groupUnitId = row.group_unit_id ?? row.unit_id;
      const groupUnitName = row.group_unit_name ?? row.unit_name;
      const groupUnitLabel = row.group_unit_label ?? row.unit_label ?? row.unit_name;

      if (!groupMap.has(groupUnitId)) {
        groupMap.set(groupUnitId, {
          id: groupUnitId,
          name: groupUnitName,
          label: groupUnitLabel,
          units: []
        });
      }

      if (!unitsMap.has(row.unit_id)) {
        unitsMap.set(row.unit_id, {
          id: row.unit_id,
          name: row.unit_name,
          label: row.unit_label ?? row.unit_name,
          group_id: groupUnitId
        });
      }

      const unitCargoMap = ensureUnitCargoMap(row.unit_id);
      if (!unitCargoMap.has(row.cargo_id)) {
        unitCargoMap.set(row.cargo_id, {
          id: row.cargo_id,
          name: row.cargo_name,
          position_type: row.position_type ?? null,
          processes: []
        });
      }

      if (!consolidatedMap.has(row.cargo_id)) {
        consolidatedMap.set(row.cargo_id, {
          id: row.cargo_id,
          name: row.cargo_name,
          position_type: row.position_type ?? null,
          processes: []
        });
      }
    });

    const [orgTreeRows] = await pool.query(
      `SELECT ur.parent_unit_id, ur.child_unit_id
       FROM unit_relations ur
       INNER JOIN relation_unit_types rt
         ON rt.id = ur.relation_type_id
        AND rt.code = 'org'`
    );

    const [processRuleRows] = await pool.query(
      `SELECT DISTINCT
         p.id AS process_id,
         p.name AS process_name,
         p.slug AS process_slug,
         pdv.id AS process_definition_id,
         pdv.variation_key,
         pdv.definition_version,
         ptr.id AS rule_id,
         ptr.priority,
         ptr.unit_scope_type,
         ptr.unit_id,
         ptr.unit_type_id,
         ptr.cargo_id,
         ptr.position_id,
         ptr.recipient_policy,
         EXISTS(
           SELECT 1 FROM process_definition_templates pdt
           WHERE pdt.process_definition_id = pdv.id AND pdt.item_mode = 'routed'
         ) AS is_routed
       FROM processes p
       INNER JOIN process_definition_versions pdv
         ON pdv.process_id = p.id
        AND pdv.status = 'active'
        AND pdv.effective_from <= CURDATE()
        AND (pdv.effective_to IS NULL OR pdv.effective_to >= CURDATE())
       INNER JOIN process_target_rules ptr
         ON ptr.process_definition_id = pdv.id
        AND ptr.is_active = 1
        AND (ptr.effective_from IS NULL OR ptr.effective_from <= CURDATE())
        AND (ptr.effective_to IS NULL OR ptr.effective_to >= CURDATE())
       WHERE p.is_active = 1
       ORDER BY p.name, ptr.priority, ptr.id`
    );
    const operationalProcessRows = await getUserOperationalProcessRows(pool, userId);

    const childrenByUnit = new Map();
    orgTreeRows.forEach((row) => {
      if (!childrenByUnit.has(row.parent_unit_id)) {
        childrenByUnit.set(row.parent_unit_id, []);
      }
      childrenByUnit.get(row.parent_unit_id).push(row.child_unit_id);
    });

    const subtreeCache = new Map();
    const getUnitSubtree = (unitId) => {
      if (!unitId) {
        return new Set();
      }
      if (subtreeCache.has(unitId)) {
        return subtreeCache.get(unitId);
      }
      const visited = new Set([unitId]);
      const stack = [unitId];
      while (stack.length) {
        const current = stack.pop();
        const children = childrenByUnit.get(current) || [];
        children.forEach((childId) => {
          if (!visited.has(childId)) {
            visited.add(childId);
            stack.push(childId);
          }
        });
      }
      subtreeCache.set(unitId, visited);
      return visited;
    };

    const positionMatchesRule = (position, rule) => {
      if (rule.position_id) {
        return Number(position.position_id) === Number(rule.position_id);
      }
      if (rule.recipient_policy === "exact_position") {
        return false;
      }
      if (rule.cargo_id && Number(position.cargo_id) !== Number(rule.cargo_id)) {
        return false;
      }
      switch (rule.unit_scope_type) {
        case "all_units":
          return true;
        case "unit_type":
          return rule.unit_type_id && Number(position.unit_type_id) === Number(rule.unit_type_id);
        case "unit_subtree":
          return rule.unit_id && getUnitSubtree(Number(rule.unit_id)).has(Number(position.unit_id));
        case "unit_exact":
        default:
          if (!rule.unit_id) {
            return false;
          }
          return Number(position.unit_id) === Number(rule.unit_id);
      }
    };

    const operationalRowMatchesPosition = (position, row) => {
      const sourcePositionId = Number(row?.source_position_id || 0);
      const sourceCargoId = Number(row?.source_cargo_id || 0);
      const sourceUnitId = Number(row?.source_unit_id || 0);
      const sourceUnitTypeId = Number(row?.source_unit_type_id || 0);

      if (sourcePositionId) {
        return Number(position.position_id) === sourcePositionId;
      }

      if (sourceCargoId && Number(position.cargo_id) !== sourceCargoId) {
        return false;
      }

      if (sourceUnitId) {
        return Number(position.unit_id) === sourceUnitId;
      }

      if (sourceUnitTypeId) {
        return Number(position.unit_type_id) === sourceUnitTypeId;
      }

      return Boolean(sourceCargoId);
    };

    const seenByUnitCargo = new Map();
    const seenByCargo = new Map();

    const addProcess = (cargo, process, seenSet) => {
      const uniqueKey = Number(process.process_definition_id || process.id);
      const existingIndex = cargo.processes.findIndex(
        (item) => Number(item.process_definition_id || item.id) === uniqueKey
      );

      if (existingIndex >= 0) {
        const existing = cargo.processes[existingIndex];
        if (existing.access_source !== "process" && process.access_source === "process") {
          cargo.processes[existingIndex] = {
            ...existing,
            ...process,
          };
        }
        seenSet.add(uniqueKey);
        return;
      }

      cargo.processes.push(process);
      seenSet.add(uniqueKey);
    };

    positions.forEach((position) => {
      const matchingRules = processRuleRows.filter((rule) => positionMatchesRule(position, rule));
      matchingRules.forEach((row) => {
        const process = {
          id: row.process_id,
          name: row.process_name,
          slug: row.process_slug,
          unit_id: position.unit_id,
          process_definition_id: row.process_definition_id,
          variation_key: row.variation_key,
          definition_version: row.definition_version,
          is_routed: !!row.is_routed,
          access_source: "process"
        };

        const unitCargoMap = cargoMapByUnit.get(position.unit_id);
        if (unitCargoMap?.has(position.cargo_id)) {
          const cargo = unitCargoMap.get(position.cargo_id);
          const key = `${position.unit_id}:${position.cargo_id}`;
          if (!seenByUnitCargo.has(key)) {
            seenByUnitCargo.set(key, new Set());
          }
          addProcess(cargo, process, seenByUnitCargo.get(key));
        }

        if (consolidatedMap.has(position.cargo_id)) {
          if (!seenByCargo.has(position.cargo_id)) {
            seenByCargo.set(position.cargo_id, new Set());
          }
          addProcess(consolidatedMap.get(position.cargo_id), process, seenByCargo.get(position.cargo_id));
        }
      });
    });

    positions.forEach((position) => {
      operationalProcessRows.forEach((row) => {
        if (!operationalRowMatchesPosition(position, row)) {
          return;
        }

        const process = {
          id: row.process_id,
          name: row.process_name,
          slug: row.process_slug,
          unit_id: Number(row.source_unit_id || position.unit_id),
          process_definition_id: row.process_definition_id,
          variation_key: row.variation_key,
          definition_version: row.definition_version,
          access_source: "flow"
        };

        const unitCargoMap = cargoMapByUnit.get(position.unit_id);
        if (unitCargoMap?.has(position.cargo_id)) {
          const cargo = unitCargoMap.get(position.cargo_id);
          const key = `${position.unit_id}:${position.cargo_id}:operational`;
          if (!seenByUnitCargo.has(key)) {
            seenByUnitCargo.set(key, new Set());
          }
          addProcess(cargo, process, seenByUnitCargo.get(key));
        }

        if (consolidatedMap.has(position.cargo_id)) {
          const key = `${position.cargo_id}:operational`;
          if (!seenByCargo.has(key)) {
            seenByCargo.set(key, new Set());
          }
          addProcess(consolidatedMap.get(position.cargo_id), process, seenByCargo.get(key));
        }
      });
    });

    const sortCargos = (cargos) => {
      cargos.forEach((cargo) => {
        cargo.processes.sort((a, b) => a.name.localeCompare(b.name));
      });
      cargos.sort((a, b) => a.name.localeCompare(b.name));
      return cargos;
    };

    const units = Array.from(unitsMap.values())
      .map((unit) => {
        const cargoMap = cargoMapByUnit.get(unit.id);
        const cargos = cargoMap ? Array.from(cargoMap.values()) : [];
        return {
          ...unit,
          cargos: sortCargos(cargos)
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    units.forEach((unit) => {
      const group = groupMap.get(unit.group_id);
      if (group) {
        group.units.push(unit);
      }
    });

    const unitGroups = Array.from(groupMap.values())
      .map((group) => ({
        ...group,
        units: group.units.sort((a, b) => a.name.localeCompare(b.name))
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const consolidated = sortCargos(Array.from(consolidatedMap.values()));

    res.json({ user_id: userId, units, unit_groups: unitGroups, consolidated });
  } catch (error) {
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

  const mode = String(req.body?.mode || "free").trim().toLowerCase(); // 'free' | 'derived'
  const title = String(req.body?.title || "").trim();
  const description = String(req.body?.description || "").trim() || null;
  const customTerm = req.body?.custom_term ?? null;
  const sourceTaskId = req.body?.source_task_id
    ? Number(req.body.source_task_id)
    : (req.body?.parent_task_id ? Number(req.body.parent_task_id) : null);
  const sourceTaskItemId = req.body?.source_task_item_id ? Number(req.body.source_task_item_id) : null;
  const requestedUnitId = req.body?.unit_id ? Number(req.body.unit_id) : null;
  // Plantilla ligada a replicar/rutear (modo replicated/routed). Sin ella = alta genérica legacy.
  const processDefinitionTemplateId = req.body?.process_definition_template_id
    ? Number(req.body.process_definition_template_id)
    : null;
  // Destinatario (compat legacy: routed simple = 1 destinatario firmante).
  const recipientPersonId = req.body?.recipient_person_id ? Number(req.body.recipient_person_id) : null;
  // P1 routed: flujo definido al enviar { entrega:[{person_id}...], firma:[{person_id}...] }.
  // "me" en el frontend se resuelve al creador antes de enviar.
  const runtimeFlow = (req.body?.flow && typeof req.body.flow === "object") ? req.body.flow : null;

  if (!title) {
    return res.status(400).json({ message: "Debes indicar un título para la tarea." });
  }
  if (mode === "derived" && (!sourceTaskId || Number.isNaN(sourceTaskId))) {
    return res.status(400).json({ message: "Se requiere la tarea de origen para agregar el entregable." });
  }

  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const definitionId = await getActiveGeneralDefinition(connection);
    if (!definitionId) {
      throw new Error("El proceso General no está disponible. Ejecuta el seed correspondiente.");
    }

    if (mode === "derived") {
      const [sourceRows] = await connection.query(
        `SELECT
           t.id,
           t.process_definition_id,
           t.term_id,
           COALESCE(t.scope_unit_id, rp.unit_id) AS scope_unit_id,
           t.responsible_position_id,
           t.start_date,
           t.end_date
         FROM tasks t
         LEFT JOIN unit_positions rp ON rp.id = t.responsible_position_id
         WHERE t.id = ?
         LIMIT 1`,
        [sourceTaskId]
      );
      const sourceTask = sourceRows?.[0];
      if (!sourceTask) {
        throw new Error("La tarea de origen no existe.");
      }

      const sourceUnitId = sourceTask.scope_unit_id || requestedUnitId || null;
      const responsiblePositionId = await resolveUserPositionInUnit(connection, authenticatedUserId, sourceUnitId);
      if (!responsiblePositionId) {
        throw new Error("No tienes una posición vigente en la unidad de la tarea origen.");
      }

      // Resolver la plantilla a instanciar y su modo de emisión.
      let definitionTemplateId = null;
      let templateArtifactId = null;
      let itemMode = "replicated"; // legacy genérico = réplica auto-asignada

      if (processDefinitionTemplateId) {
        // Modo configurado: la réplica/instancia hereda la config de la plantilla ligada del proceso origen.
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
        itemMode = String(tpl.item_mode || "single");
        if (itemMode === "single") {
          throw new Error("Este entregable es de instancia única: no admite réplicas ni envíos.");
        }
        definitionTemplateId = Number(tpl.id);
        templateArtifactId = Number(tpl.template_artifact_id);
      } else {
        // Legacy: entregable genérico del proceso default, auto-asignado al creador.
        const [defaultTemplateRows] = await connection.query(
          `SELECT pdt.id, pdt.template_artifact_id
           FROM process_definition_templates pdt
           WHERE pdt.process_definition_id = ?
           ORDER BY pdt.sort_order ASC, pdt.id ASC
           LIMIT 1`,
          [definitionId]
        );
        templateArtifactId = defaultTemplateRows?.[0]?.template_artifact_id
          ? Number(defaultTemplateRows[0].template_artifact_id)
          : null;
        definitionTemplateId = defaultTemplateRows?.[0]?.id
          ? Number(defaultTemplateRows[0].id)
          : null;
        if (!templateArtifactId || !definitionTemplateId) {
          throw new Error("El proceso default no tiene una plantilla base para entregables agregados.");
        }
      }

      // Destinatario / dueño según modo:
      //  - replicated: auto-asignado al creador (target = creador → dueño = creador).
      //  - routed: el destinatario elegido es el dueño/firmante; el creador queda como autor (assignee).
      let targetPersonId = authenticatedUserId;
      let targetPositionId = responsiblePositionId;
      let targetUnitId = sourceUnitId;

      if (itemMode === "routed") {
        // Con flujo runtime el flujo define los actores → el destinatario es opcional (metadato
        // "Para:"). Sin flujo (compat legacy) sigue siendo obligatorio 1 destinatario firmante.
        if (!recipientPersonId && !runtimeFlow) {
          throw new Error("Debes elegir el destinatario del envío.");
        }
        if (recipientPersonId) {
          const [recipRows] = await connection.query(
            `SELECT id FROM persons WHERE id = ? AND is_active = 1 LIMIT 1`,
            [recipientPersonId]
          );
          if (!recipRows?.length) {
            throw new Error("El destinatario no es válido.");
          }
        }
        targetPersonId = recipientPersonId || null; // "Para:" (puede ser null si la firma es por cargo)
        targetPositionId = null; // se rutea por el flujo, no por puesto
        targetUnitId = null;
      }

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
           end_date,
           status
         ) VALUES (?, ?, ?, 'user_added', ?, 999, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')`,
        [
          sourceTaskId,
          definitionTemplateId,
          templateArtifactId,
          // Modos configurados: el título es la ETIQUETA limpia (se ve en la tarjeta).
          // Legacy genérico: conserva el "título + descripción" concatenado.
          processDefinitionTemplateId ? title : (description ? `${title}\n\n${description}` : title),
          authenticatedUserId,
          sourceTaskItemId || null,
          targetUnitId,
          targetPositionId,
          targetPersonId,
          responsiblePositionId,
          authenticatedUserId,
          sourceTask.start_date,
          sourceTask.end_date || null
        ]
      );

      const taskItemId = Number(itemResult.insertId);
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
      // routed: si el usuario definió el flujo al enviar, se materializa POR INSTANCIA (specific_person).
      if (itemMode === "routed" && runtimeFlow) {
        await materializeRuntimeFlowForTaskItem(connection, {
          taskItemId,
          processDefinitionTemplateId: definitionTemplateId,
          flow: runtimeFlow,
        });
      }
      await ensureDocumentForTaskItem(connection, taskItemRows[0]);
      await connection.commit();

      return res.json({
        result: "ok",
        mode,
        item_mode: itemMode,
        recipient_person_id: itemMode === "routed" ? targetPersonId : null,
        task_id: sourceTaskId,
        task_item_id: taskItemId,
        definition_id: sourceTask.process_definition_id,
        unit_id: sourceUnitId,
        responsible_position_id: responsiblePositionId,
      });
    }

    // Resolver unidad de contexto para tarea suelta.
    let unitId = requestedUnitId;

    // Posición del creador en la unidad (responsable de la nueva tarea).
    const responsiblePositionId = await resolveUserPositionInUnit(connection, authenticatedUserId, unitId);
    if (!responsiblePositionId) {
      throw new Error("No tienes una posición vigente en la unidad indicada para crear esta tarea.");
    }

    // Periodo: custom obligatorio para tareas libres/derivadas.
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
    const termId = Number(termResult.insertId);

    const [taskResult] = await connection.query(
      `INSERT INTO tasks (
         process_definition_id, term_id, scope_unit_id, created_by_user_id,
         responsible_position_id, description, start_date, end_date, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')`,
      [
        definitionId,
        termId,
        unitId,
        authenticatedUserId,
        responsiblePositionId,
        description ? `${title}\n\n${description}` : title,
        startDate,
        endDate,
      ]
    );
    const taskId = Number(taskResult.insertId);

    // Proceso por defecto = routed comodín: se crea UN entregable endosado a la persona
    // elegida (target_person_id = destinatario, que puede ser uno mismo). El dueño del
    // documento resuelve al destinatario, que es quien realiza/atiende la tarea (paso de
    // llenado `document_owner`); el creador queda como autor/delegador.
    const [freeTplRows] = await connection.query(
      `SELECT id, template_artifact_id
       FROM process_definition_templates
       WHERE process_definition_id = ?
       ORDER BY sort_order ASC, id ASC
       LIMIT 1`,
      [definitionId]
    );
    const freeTpl = freeTplRows?.[0];
    if (!freeTpl) {
      throw new Error("El proceso por defecto no tiene una plantilla base.");
    }
    let freeTargetPersonId = authenticatedUserId;
    if (recipientPersonId && recipientPersonId !== authenticatedUserId) {
      const [recipRows] = await connection.query(
        `SELECT id FROM persons WHERE id = ? AND is_active = 1 LIMIT 1`,
        [recipientPersonId]
      );
      if (!recipRows?.length) {
        throw new Error("El destinatario no es válido.");
      }
      freeTargetPersonId = recipientPersonId;
    }
    const [freeItemResult] = await connection.query(
      `INSERT INTO task_items (
         task_id, process_definition_template_id, template_artifact_id, origin_kind, title,
         sort_order, created_by_person_id, target_unit_id, target_position_id, target_person_id,
         responsible_position_id, assigned_person_id, start_date, end_date, status
       ) VALUES (?, ?, ?, 'user_added', ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')`,
      [
        taskId,
        freeTpl.id,
        freeTpl.template_artifact_id,
        description ? `${title}\n\n${description}` : title,
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
    const freeItemId = Number(freeItemResult.insertId);
    const [freeItemRows] = await connection.query(
      `SELECT id, task_id, template_artifact_id, assigned_person_id, target_unit_id,
              target_person_id, responsible_position_id
       FROM task_items WHERE id = ? LIMIT 1`,
      [freeItemId]
    );
    // Proceso por defecto (routed): flujo definido al enviar → materializado POR INSTANCIA.
    if (runtimeFlow) {
      await materializeRuntimeFlowForTaskItem(connection, {
        taskItemId: freeItemId,
        processDefinitionTemplateId: freeTpl.id,
        flow: runtimeFlow,
      });
    }
    await ensureDocumentForTaskItem(connection, freeItemRows[0]);

    await connection.commit();

    return res.json({
      result: "ok",
      mode,
      task_id: taskId,
      task_item_id: freeItemId,
      term_id: termId,
      definition_id: definitionId,
      unit_id: unitId,
      recipient_person_id: freeTargetPersonId,
      responsible_position_id: responsiblePositionId,
    });
  } catch (error) {
    await connection.rollback().catch(() => {});
    console.error("Error creando tarea general:", error);
    return res.status(400).json({ message: error.message || "No se pudo crear la tarea." });
  } finally {
    connection.release();
  }
};
