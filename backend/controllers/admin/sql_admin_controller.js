import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import SqlAdminService from "../../services/admin/SqlAdminService.js";
import { getMariaDBPool } from "../../config/mariadb.js";
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
  const pool = getMariaDBPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion MariaDB no disponible" });
  }
  try {
    const [rows] = await pool.query(
      "SELECT id, template_code, display_name, available_formats FROM template_artifacts WHERE id = ? LIMIT 1",
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
  const pool = getMariaDBPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion MariaDB no disponible" });
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
  const pool = getMariaDBPool();
  if (!pool) {
    return res.status(500).json({ message: "Conexion MariaDB no disponible" });
  }
  try {
    const [rows] = await pool.query(
      "SELECT id, template_code, available_formats FROM template_artifacts WHERE id = ? LIMIT 1",
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

export const updateTemplateArtifactStage = async (req, res) => {
  try {
    const result = await service.updateTemplateArtifactStage(req.params.id, req.body?.stage);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const createTemplateArtifactVersion = async (req, res) => {
  try {
    const result = await service.createTemplateArtifactVersion(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
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
