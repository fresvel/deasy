import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import SqlAdminService from "../../services/admin/SqlAdminService.js";
import { getPostgresPool } from "../../config/postgres.js";
import {
  TEMPLATES_BUCKET,
  collectFormatResources,
  collectPrefixResources,
  sendResourcesAsZip
} from "../../utils/templateArchive.js";

const service = new SqlAdminService();

const parseAvailableFormats = (value) => {
  if (!value) {
    return {};
  }
  if (typeof value === "object") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

export const getSqlMeta = (req, res) => {
  try {
    const tables = service.getMeta();
    res.json({ tables });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getOperationStats = async (_req, res) => {
  try {
    const stats = await service.getOperationStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const syncTemplateSeeds = async (_req, res) => {
  try {
    const result = await service.syncTemplateSeedsFromSource();
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getTemplateSeedPreview = async (req, res) => {
  try {
    const result = await service.getTemplateSeedPreview(req.params.id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=\"${result.fileName}\"`);
    result.stream.on("error", (error) => {
      if (!res.headersSent) {
        res.status(404).json({ message: error.message });
        return;
      }
      res.end();
    });
    result.stream.pipe(res);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

const buildArtifactDraftActor = (req) => {
  const roleNames = req.access?.roleNames || [];
  const isDesigner = roleNames.includes("AdminSistema") || roleNames.includes("GestorProcesos");
  return {
    personId: Number(req.user?.uid || req.auth?.userId || 0) || null,
    roleNames,
    // Diseñador (admin/gestor de procesos): puede crear plantillas sin vincular.
    // Ejecutor (gestor de ejecución): debe vincular a un proceso existente o 'default'.
    requireProcessLink: !isDesigner,
  };
};

// Descarga un ZIP con todos los archivos de los formatos de un paquete de plantilla (incluye latex/jinja2:
// el admin gestiona el contrato, a diferencia del flujo de entregables que los excluye).
export const downloadTemplateArtifactArchive = async (req, res) => {
  const id = Number(req.params?.id);
  if (!id || Number.isNaN(id)) {
    return res.status(400).json({ message: "Identificador de plantilla invalido." });
  }
  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }
  try {
    const [rows] = await pool.query(
      `SELECT ta.id, d.code AS template_code, d.display_name, ta.available_formats
         FROM template_artifacts ta LEFT JOIN deliverables d ON d.id = ta.deliverable_id
        WHERE ta.id = ? LIMIT 1`,
      [id]
    );
    const artifact = rows?.[0];
    if (!artifact) {
      return res.status(404).json({ message: "No se encontro el paquete de plantilla." });
    }
    const availableFormats = parseAvailableFormats(artifact.available_formats);
    const resources = await collectFormatResources(availableFormats, { bucket: TEMPLATES_BUCKET });
    if (!resources.length) {
      return res.status(404).json({ message: "El paquete no tiene archivos publicados en MinIO para descargar." });
    }
    return await sendResourcesAsZip(res, {
      bucket: TEMPLATES_BUCKET,
      resources,
      fileBaseName: artifact.template_code || artifact.display_name || `plantilla-${id}`
    });
  } catch (error) {
    console.error("Error al descargar el ZIP del paquete de plantilla:", error);
    if (!res.headersSent) {
      return res.status(500).json({ message: error.message || "No se pudo generar el ZIP del paquete." });
    }
    return res.end();
  }
};

// Descarga un ZIP con todos los archivos de un seed (bajo su source_path en MinIO).
export const downloadTemplateSeedArchive = async (req, res) => {
  const id = Number(req.params?.id);
  if (!id || Number.isNaN(id)) {
    return res.status(400).json({ message: "Identificador de seed invalido." });
  }
  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }
  try {
    const [rows] = await pool.query(
      "SELECT id, seed_code, display_name, source_path FROM template_seeds WHERE id = ? LIMIT 1",
      [id]
    );
    const seed = rows?.[0];
    if (!seed) {
      return res.status(404).json({ message: "No se encontro el seed." });
    }
    if (!seed.source_path) {
      return res.status(404).json({ message: "El seed no tiene ruta fuente registrada." });
    }
    const resources = await collectPrefixResources(seed.source_path, { bucket: TEMPLATES_BUCKET });
    if (!resources.length) {
      return res.status(404).json({ message: "El seed no tiene archivos publicados en MinIO para descargar." });
    }
    return await sendResourcesAsZip(res, {
      bucket: TEMPLATES_BUCKET,
      resources,
      fileBaseName: (seed.seed_code || seed.display_name || `seed-${id}`).replace(/\//g, "-")
    });
  } catch (error) {
    console.error("Error al descargar el ZIP del seed:", error);
    if (!res.headersSent) {
      return res.status(500).json({ message: error.message || "No se pudo generar el ZIP del seed." });
    }
    return res.end();
  }
};

// Descarga el ZIP del código fuente editable (subárbol process/jinja2/src) de una plantilla. Solo admin.
export const downloadTemplateArtifactSource = async (req, res) => {
  const id = Number(req.params?.id);
  if (!id || Number.isNaN(id)) {
    return res.status(400).json({ message: "Identificador de plantilla invalido." });
  }
  const pool = getPostgresPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion PostgreSQL no disponible" });
  }
  try {
    const [rows] = await pool.query(
      `SELECT ta.id, d.code AS template_code, ta.available_formats
         FROM template_artifacts ta LEFT JOIN deliverables d ON d.id = ta.deliverable_id
        WHERE ta.id = ? LIMIT 1`,
      [id]
    );
    const artifact = rows?.[0];
    if (!artifact) {
      return res.status(404).json({ message: "No se encontro el paquete de plantilla." });
    }
    const formats = parseAvailableFormats(artifact.available_formats);
    const jinjaEntry = formats?.jinja2?.entry_object_key;
    if (!jinjaEntry) {
      return res.status(404).json({ message: "La plantilla no tiene un contrato jinja2 editable." });
    }
    const resources = await collectPrefixResources(jinjaEntry, { bucket: TEMPLATES_BUCKET });
    if (!resources.length) {
      return res.status(404).json({ message: "El contrato no tiene archivos publicados en MinIO." });
    }
    return await sendResourcesAsZip(res, {
      bucket: TEMPLATES_BUCKET,
      resources,
      fileBaseName: `${artifact.template_code || `plantilla-${id}`}-source`
    });
  } catch (error) {
    console.error("Error al descargar el source de la plantilla:", error);
    if (!res.headersSent) {
      return res.status(500).json({ message: error.message || "No se pudo generar el ZIP del source." });
    }
    return res.end();
  }
};

// Re-sube el código editado (ZIP) y, si cumple el contrato (hash de protegidos + saneo), crea nueva versión.
export const applyTemplateArtifactSource = async (req, res) => {
  const id = Number(req.params?.id);
  if (!id || Number.isNaN(id)) {
    return res.status(400).json({ message: "Identificador de plantilla invalido." });
  }
  const file = req.files?.source?.[0] || req.file || null;
  if (!file?.buffer) {
    return res.status(400).json({ message: "Debes adjuntar el ZIP del código editado (campo 'source')." });
  }
  const tmpPath = path.join(os.tmpdir(), `tpl-source-${randomUUID()}.zip`);
  try {
    fs.writeFileSync(tmpPath, file.buffer);
    const result = await service.applyTemplateArtifactSource(id, tmpPath, buildArtifactDraftActor(req));
    return res.json(result);
  } catch (error) {
    console.error("Error al aplicar el source de la plantilla:", error);
    return res.status(error.statusCode || 400).json({ message: error.message });
  } finally {
    fs.rmSync(tmpPath, { force: true });
  }
};

export const createTemplateArtifactDraft = async (req, res) => {
  try {
    const created = await service.createTemplateArtifactDraft(req.body ?? {}, req.files ?? {}, buildArtifactDraftActor(req));
    res.json(created);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateTemplateArtifactDraft = async (req, res) => {
  try {
    const updated = await service.updateTemplateArtifactDraft(req.params.id, req.body ?? {}, req.files ?? {}, buildArtifactDraftActor(req));
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getTemplateArtifactSchema = async (req, res) => {
  try {
    const result = await service.getTemplateArtifactSchema(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const setTemplateArtifactActive = async (req, res) => {
  try {
    const result = await service.setTemplateArtifactActive(req.params.id, req.body?.is_active);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const createTemplateArtifactVersion = async (req, res) => {
  try {
    const result = await service.createTemplateArtifactVersion(req.params.id, req.body?.bump_level);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const publishTemplateArtifact = async (req, res) => {
  try {
    const result = await service.publishTemplateArtifact(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 400).json({ message: error.message });
  }
};

export const retireTemplateArtifact = async (req, res) => {
  try {
    const result = await service.retireTemplateArtifact(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 400).json({ message: error.message });
  }
};

export const getTemplateVersions = async (req, res) => {
  try {
    const result = await service.getTemplateVersions(req.query?.code);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 400).json({ message: error.message });
  }
};

export const getConfigActivationDiff = async (req, res) => {
  try {
    const result = await service.getConfigActivationDiff(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 400).json({ message: error.message });
  }
};

export const useTemplateVersionInConfig = async (req, res) => {
  try {
    const result = await service.useTemplateVersionInConfig({
      definitionId: req.body?.definition_id,
      templateArtifactId: req.body?.template_artifact_id
    });
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 400).json({ message: error.message });
  }
};

export const startGuidedTemplateUpdate = async (req, res) => {
  try {
    const result = await service.startTemplateUpdateForActiveConfig({
      definitionId: req.body?.definition_id,
      templateArtifactId: req.body?.template_artifact_id,
      bumpLevel: req.body?.bump_level
    });
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 400).json({ message: error.message });
  }
};

export const finishGuidedTemplateUpdate = async (req, res) => {
  try {
    const result = await service.finishTemplateUpdate({
      templateArtifactId: req.body?.template_artifact_id,
      configDefinitionId: req.body?.config_definition_id
    });
    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 400).json({ message: error.message });
  }
};

// Estado de sincronización del flujo de un artifact (synced/stale/no_link) por vínculo a configuración.
export const getTemplateArtifactSyncStatus = async (req, res) => {
  try {
    const result = await service.getArtifactWorkflowSyncStatus(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Re-sincroniza (materializa) los flujos del artifact desde su meta.yaml a las tablas operativas.
export const resyncTemplateArtifactWorkflows = async (req, res) => {
  try {
    const summary = await service.syncArtifactWorkflowsForTemplateArtifactId(Number(req.params.id));
    const status = await service.getArtifactWorkflowSyncStatus(req.params.id);
    res.json({ ok: true, summary, ...status });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Reconcilia todos los artifacts vinculados cuya proyección de flujo está desfasada. ?all=1 fuerza todos.
export const reconcileTemplateArtifactWorkflows = async (req, res) => {
  try {
    const onlyStale = String(req.query?.all || "") !== "1";
    const summary = await service.reconcileArtifactWorkflows({ onlyStale });
    res.json({ ok: true, ...summary });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Ámbito resoluble (unidades cubiertas por las reglas objetivo) de una definición de proceso.
// Lo consume el editor de plantillas para habilitar/acotar los ámbitos del flujo de entrega.
export const getProcessTargetScope = async (req, res) => {
  try {
    const result = await service.getProcessTargetScope(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Cargos resolubles (con titular vigente) para una ubicación: en la unidad indicada (`unit_id`) o, sin ella,
// en el alcance del proceso. Lo consume el editor de plantillas para poblar el select de cargo de cada paso.
export const listResolvableCargos = async (req, res) => {
  try {
    const result = await service.listResolvableCargos(req.params.id, {
      unitId: req.query.unit_id || null,
      unitTypeId: req.query.unit_type_id || null
    });
    res.json({ cargos: result });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// F-B backfill: reconcilia los task_items abiertos al ocupante vigente de su puesto (huérfanos creados con el
// puesto vacante). Idempotente; opcional `position_id` para acotar. Solo AdminSistema.
export const reconcileTaskItemAssignments = async (req, res) => {
  try {
    const result = await service.reconcileOpenTaskItemAssignments({
      positionId: req.body?.position_id || req.query?.position_id || null
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// F-C handover: traspasa el MISMO entregable a otra persona (no duplica) + asiento de auditoría.
export const handoverTaskItem = async (req, res) => {
  try {
    const result = await service.handoverTaskItem(req.params.id, {
      toPersonId: req.body?.to_person_id ?? null,
      reason: req.body?.reason ?? null,
      triggerKind: req.body?.trigger_kind ?? "manual",
      performedByUserId: req.user?.uid ?? null
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// F-C lista de atascados: task_items abiertos por persona/puesto/unidad, o huérfanos (sin persona).
export const listStuckTaskItems = async (req, res) => {
  try {
    const result = await service.listStuckTaskItems({
      personId: req.query.person_id || null,
      positionId: req.query.position_id || null,
      unitId: req.query.unit_id || null
    });
    res.json({ items: result });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// F-C jefe inmediato: ocupante del puesto cabeza más cercano subiendo por la jerarquía de unidades. Sugiere destino.
export const getImmediateBoss = async (req, res) => {
  try {
    const result = await service.resolveImmediateBoss({
      positionId: req.params.id,
      relationCode: req.query.relation_code || "org"
    });
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Cargo/tipo de unidad que la serie del proceso fija. Lo consume el panel de reglas para precargar y
// bloquear el cargo (la serie ya decide el cargo; la regla solo añade alcance y entrega).
export const getProcessDefinitionSeriesScope = async (req, res) => {
  try {
    const result = await service.getProcessDefinitionSeriesScope(req.params.id);
    res.json(result || {});
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getUnitGraph = async (req, res) => {
  try {
    const result = await service.getUnitGraph(req.query?.relation_type || "org");
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const createUnitWithParent = async (req, res) => {
  try {
    const result = await service.createUnitWithParent(req.body || {});
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getUnitDetail = async (req, res) => {
  try {
    const result = await service.getUnitDetail(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getProcessGraph = async (req, res) => {
  try {
    const result = await service.getProcessGraph();
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getProcessDetail = async (req, res) => {
  try {
    const result = await service.getProcessDetail(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const createProcessWithParent = async (req, res) => {
  try {
    const result = await service.createProcessWithParent(req.body || {});
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const setProcessParent = async (req, res) => {
  try {
    const result = await service.setProcessParent(req.params.id, req.body?.parent_id ?? null);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getUnitProcesses = async (req, res) => {
  try {
    const result = await service.getUnitProcesses(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getUnitAttachableProcesses = async (req, res) => {
  try {
    const result = await service.getUnitAttachableProcesses(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const addUnitPosition = async (req, res) => {
  try {
    const result = await service.addUnitPosition(req.params.id, req.body || {});
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateUnitPosition = async (req, res) => {
  try {
    const result = await service.updateUnitPosition(req.params.positionId, req.body || {});
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const removeUnitPosition = async (req, res) => {
  try {
    const result = await service.removeUnitPosition(req.params.positionId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const assignUnitPosition = async (req, res) => {
  try {
    const result = await service.assignUnitPosition(req.params.positionId, req.body?.person_id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const unassignUnitPosition = async (req, res) => {
  try {
    const result = await service.unassignUnitPosition(req.params.positionId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const listSqlRows = async (req, res) => {
  try {
    const { table } = req.params;
    const filters = Object.fromEntries(
      Object.entries(req.query)
        .filter(([key, value]) => key.startsWith("filter_") && value !== undefined && value !== "")
        .map(([key, value]) => [key.replace("filter_", ""), value])
    );
    const rows = await service.list(table, {
      q: req.query.q,
      limit: req.query.limit,
      offset: req.query.offset,
      orderBy: req.query.orderBy,
      order: req.query.order,
      filters
    });
    res.json(rows);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const createSqlRow = async (req, res) => {
  try {
    const { table } = req.params;
    const created = await service.create(table, req.body ?? {});
    res.json(created);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateSqlRow = async (req, res) => {
  try {
    const { table } = req.params;
    const keys = req.body?.keys ?? req.body ?? {};
    const data = req.body?.data ?? req.body ?? {};
    const updated = await service.update(table, keys, data);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteSqlRow = async (req, res) => {
  try {
    const { table } = req.params;
    const keys = req.body?.keys ?? req.body ?? {};
    const deleted = await service.remove(table, keys);
    res.json({ deleted });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
