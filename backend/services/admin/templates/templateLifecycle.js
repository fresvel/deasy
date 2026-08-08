// TemplateLifecycleService — ciclo de vida de plantillas documentales y entregables. Extraido de
// SqlAdminService.js (God #1) por Extract Class, cut #8.
//
// QUE ES ESTE CLUSTER. Es el punto de INTEGRACION del dominio de plantillas: guardar un borrador
// (con sus ficheros en MinIO, su schema, su meta y sus flujos autorados), el update guiado
// (crear borradores de plantilla + configuracion, y publicarlos juntos), el fork de un entregable
// para otra configuracion, el sync de semillas y el diff de activacion.
//
// POR QUE TIENE TANTAS DEPENDENCIAS INYECTADAS (17). No es acoplamiento accidental: orquestar el
// ciclo de vida exige tocar versionado (cut #4), sincronizacion de flujos (cut #5), scope y cargos
// resolubles (cut #6) y el ciclo de vida del artifact (cut #3). La lista explicita es INFORMACION:
// si un refactor futuro reduce ese acoplamiento, la lista encoge y se ve.
//
// LO QUE ESTE CUT **NO** HACE. `saveTemplateArtifactDraft` sigue siendo un metodo de 542 lineas.
// Se ha movido LITERAL, no descompuesto: no tenia caracterizacion propia (su ruta es multipart con
// subida de ficheros) y partirlo a ciegas seria exactamente el error que el audit senala. Su
// descomposicion es un trabajo aparte, con su red antes.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  hasVisibleFiles,
  hashDirectory,
  buildProtectedManifest,
  listMinioObjects,
  getMinioObjectStream,
  streamToBuffer,
  copyMinioObjectToFile,
  downloadMinioPrefixToDirectory,
  copyMinioObjectBinary,
  removeMinioPrefix,
  uploadDirectoryToMinio,
} from "../kernel/storage.js";
import { sanitizeStorageSegment } from "../../../utils/templateArchive.js";
import { normalizeItemMode } from "../kernel/versioning.js";
import { slugify, humanizeSlug, normalizeNumericId } from "../kernel/primitives.js";
import {
  buildWorkflowsYaml,
  collectAuthoredWorkflowIssues,
  parseWorkflowPayload,
  workflowHasSteps
} from "./workflows.js";
import { parseAvailableFormats, findPreferredPdfObject } from "./artifacts.js";
import {
  MINIO_TEMPLATES_BUCKET,
  CONTRACT_FORMAT,
  EDITABLE_CONTENT_SUBPATH,
} from "../kernel/constants.js";

// Staging efimero de los borradores: se arma, se sube a MinIO y se borra dentro de la
// misma peticion. Va al temporal del sistema, como el resto de subidas (certificados,
// dossier, fotos), asi no deja estado en el contenedor ni ensucia el repo en dev.
const TEMPLATE_DRAFT_STAGING_ROOT = path.join(os.tmpdir(), "deasy", "template-drafts");
const MINIO_TEMPLATES_PREFIX = (process.env.MINIO_TEMPLATES_PREFIX || "System").replace(/^\/+|\/+$/g, "");
// Semilla por defecto ("general") cuando se crea una plantilla sin elegir seed. Coincide con la del bootstrap.
const DEFAULT_SEED_CODE = process.env.DEFAULT_TEMPLATE_SEED_CODE || "latex/informe-general";
// Formatos de documento de referencia (al menos uno es obligatorio al crear una plantilla).
const REFERENCE_DOC_FORMATS = ["pdf", "docx", "xlsx", "pptx"];

const MINIO_TEMPLATES_SEEDS_PREFIX = (process.env.MINIO_TEMPLATES_SEEDS_PREFIX || "Seeds").replace(/^\/+|\/+$/g, "");
const TEMPLATE_USERS_PREFIX = (
  process.env.MINIO_TEMPLATES_USERS_PREFIX
  || process.env.MINIO_TEMPLATES_DRAFT_PREFIX
  || "Users"
).replace(/^\/+|\/+$/g, "");
const ARTIFACT_WORKFLOW_CONTRACT = [
  "workflows:",
  "  fill:",
  "    required: true",
  "    source: \"artifact\"",
  "    sync_mode: \"artifact_to_db\"",
  "    steps: []",
  "  signatures:",
  "    required: false",
  "    source: \"artifact\"",
  "    sync_mode: \"artifact_to_db\"",
  "    steps: []",
  "dependencies:",
  "  templates: []",
  "  data: []"
].join("\n");

// Componentes UI permitidos para los campos del schema editados desde la web.
const SCHEMA_FIELD_COMPONENTS = new Set([
  "text", "richtext", "textarea", "number", "switch", "date", "date_expression", "select", "hidden"
]);

const slugifyFieldKey = (value, fallback = "campo") => {
  const base = String(value || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || fallback;
};

// Convierte la lista de campos definida en la web en un JSON Schema con extensiones x-deasy-*.
// Cada field: { key, title, type, component, group, required }
const buildSchemaJsonFromFields = (fields = []) => {
  const properties = {};
  const required = [];
  const seen = new Set();
  (Array.isArray(fields) ? fields : []).forEach((rawField, index) => {
    const dataKey = slugifyFieldKey(rawField?.key || rawField?.title, `campo_${index + 1}`);
    if (seen.has(dataKey)) return;
    seen.add(dataKey);
    const component = SCHEMA_FIELD_COMPONENTS.has(String(rawField?.component || "").trim())
      ? String(rawField.component).trim()
      : "text";
    const group = slugifyFieldKey(rawField?.group || "general", "general");
    const jsonType = component === "switch" ? "boolean"
      : component === "number" ? "number"
      : "string";
    const fieldCode = String(rawField?.field_code || `${group}.${dataKey}`).trim();
    properties[dataKey] = {
      type: jsonType,
      title: String(rawField?.title || dataKey).slice(0, 180),
      "x-deasy-field-code": fieldCode,
      "x-deasy-data-key": dataKey,
      "x-deasy-ui": { component, group },
    };
    if (rawField?.required) required.push(dataKey);
  });
  return {
    type: "object",
    properties,
    required,
    additionalProperties: true,
  };
};

// Layout aplanado por formato (sin eje "modes" ni "mode" ni "src"): template/<format>/...
const buildArtifactFormatDir = (baseDir, format) =>
  path.join(baseDir, "template", format);

const setAvailableFormatEntry = (availableFormats, format, baseObjectPrefix) => {
  availableFormats[format] = {
    entry_object_key: `${baseObjectPrefix}template/${format}/`
  };
};

const validatePackagedArtifactDraft = (draftDir, availableFormats) => {
  const schemaPath = path.join(draftDir, "schema.json");
  const metaPath = path.join(draftDir, "meta.yaml");
  const templateDir = path.join(draftDir, "template");
  if (!fs.existsSync(schemaPath) || !fs.existsSync(metaPath) || !fs.existsSync(templateDir)) {
    throw new Error("El artifact no cumple la estructura base requerida (meta.yaml, schema.json y template/).");
  }
  const metaContent = fs.readFileSync(metaPath, "utf8");
  const requiredMetaSections = [
    /^workflows:\s*$/m,
    /^\s{2}fill:\s*$/m,
    /^\s{2}signatures:\s*$/m,
    /^dependencies:\s*$/m
  ];
  if (requiredMetaSections.some((pattern) => !pattern.test(metaContent))) {
    throw new Error("El artifact no cumple el contrato minimo de meta.yaml para workflows y dependencies.");
  }
  for (const format of Object.keys(availableFormats || {})) {
    const dirPath = buildArtifactFormatDir(draftDir, format);
    if (!hasVisibleFiles(dirPath)) {
      throw new Error(`La salida ${format} no cumple la estructura esperada en template/${format}/.`);
    }
  }
};

export default class TemplateLifecycleService {
  constructor(pool, {
    getByKeys,
    cloneProcessDefinitionChildren,
    getNextProcessDefinitionVersion,
    retireActiveDefinitionsInSeries,
    createTemplateArtifactVersion,
    getNextStorageVersionForTemplateCode,
    loadTemplateArtifactMetaDocument,
    retirePriorPublishedSiblings,
    getCargoCodeMap,
    getProcessTargetScope,
    getResolvableCargoIdsByUnit,
    listResolvableCargos,
    getWorkflowReferenceIdSets,
    syncArtifactWorkflowsForTemplateArtifactId,
    ensureDefinitionHasActiveRulesForActivation,
    ensureDefinitionHasActivePeriodTypesForActivation,
    ensureDefinitionHasArtifactsForActivation
  } = {}) {
    this.pool = pool;
    this._getByKeys = getByKeys;
    this._cloneProcessDefinitionChildren = cloneProcessDefinitionChildren;
    this._getNextProcessDefinitionVersion = getNextProcessDefinitionVersion;
    this._retireActiveDefinitionsInSeries = retireActiveDefinitionsInSeries;
    this._createTemplateArtifactVersion = createTemplateArtifactVersion;
    this._getNextStorageVersionForTemplateCode = getNextStorageVersionForTemplateCode;
    this._loadTemplateArtifactMetaDocument = loadTemplateArtifactMetaDocument;
    this._retirePriorPublishedSiblings = retirePriorPublishedSiblings;
    this._getCargoCodeMap = getCargoCodeMap;
    this._getProcessTargetScope = getProcessTargetScope;
    this._getResolvableCargoIdsByUnit = getResolvableCargoIdsByUnit;
    this._listResolvableCargos = listResolvableCargos;
    this._getWorkflowReferenceIdSets = getWorkflowReferenceIdSets;
    this._syncArtifactWorkflowsForTemplateArtifactId = syncArtifactWorkflowsForTemplateArtifactId;
    this._ensureDefinitionHasActiveRulesForActivation = ensureDefinitionHasActiveRulesForActivation;
    this._ensureDefinitionHasActivePeriodTypesForActivation = ensureDefinitionHasActivePeriodTypesForActivation;
    this._ensureDefinitionHasArtifactsForActivation = ensureDefinitionHasArtifactsForActivation;
  }

  ensurePool() {
    if (!this.pool) {
      throw new Error("Conexion PostgreSQL no disponible");
    }
  }

  // Al activar una configuración, publica sus plantillas en BORRADOR (las creadas nacen draft y se publican de
  // forma controlada al activar la config: "activa la config + publica la plantilla"). Para cada borrador: exige
  // readiness (≥1 paso de entrega), retira la publicada previa del mismo template_code y la marca published.
  // No toca is_active (storage-ready): si la subida a MinIO no terminó, el chequeo de artefactos activos avisará.
  async publishDraftTemplatesForDefinition(definitionId, connection = this.pool) {
    const normalizedDefinitionId = Number(definitionId);
    if (!normalizedDefinitionId) return 0;
    const [rows] = await connection.query(
      `SELECT ta.*, pdt.item_mode AS item_mode, d.display_name AS deliverable_name
         FROM process_definition_templates pdt
         INNER JOIN template_artifacts ta ON ta.id = pdt.template_artifact_id
         LEFT JOIN deliverables d ON d.id = ta.deliverable_id
        WHERE pdt.process_definition_id = ? AND ta.lifecycle_state = 'draft'`,
      [normalizedDefinitionId]
    );
    let published = 0;
    for (const artifact of rows) {
      // routed NO autora flujo (se define al enviar): no se exige paso de entrega para publicarse.
      // single/replicated sí deben traer su flujo predefinido.
      if (String(artifact.item_mode) !== "routed") {
        let fillSteps = 0;
        try {
          const meta = await this._loadTemplateArtifactMetaDocument(artifact);
          fillSteps = (Array.isArray(meta?.workflows?.fill?.steps) ? meta.workflows.fill.steps : []).length;
        } catch {
          fillSteps = 0;
        }
        if (!fillSteps) {
          const templateName = artifact.deliverable_name || artifact.display_name || artifact.template_code || `#${artifact.id}`;
          throw new Error(
            `No se puede activar: la plantilla "${templateName}" debe definir al menos un paso de flujo de entrega antes de publicarse.`
          );
        }
      }
      await this._retirePriorPublishedSiblings(connection, artifact.id);
      await connection.query(
        "UPDATE template_artifacts SET lifecycle_state = 'published' WHERE id = ?",
        [artifact.id]
      );
      published += 1;
    }
    return published;
  }

  // Valida que la configuracion corra en el tipo de periodo del term indicado: debe existir un
  // vinculo activo en process_definition_period_types. Reemplaza la antigua validacion por
  // trigger_mode (automatic/manual_only/manual_custom_term, ya deprecada).

  // Borrador de TRABAJO de una configuración (modelo config-céntrico): una config tiene a lo más UN borrador en
  // curso por (proceso, variación). Si la config dada es borrador, ese es el de trabajo. Si es activa, reutiliza
  // un borrador existente de la serie o, si no hay, clona la activa a un nuevo borrador (bump minor) con sus
  // reglas/periodos/plantillas. Devuelve { id, definition_version, created }.
  async getOrCreateConfigWorkingDraft(definitionId, connection = this.pool) {
    const defId = Number(definitionId);
    const [defRows] = await connection.query(
      `SELECT id, process_id, series_id, variation_key, definition_version, name, description, status
         FROM process_definition_versions WHERE id = ? LIMIT 1`,
      [defId]
    );
    const definition = defRows?.[0];
    if (!definition) throw new Error("La configuración no existe.");
    if (String(definition.status) === "draft") {
      return { id: defId, definition_version: definition.definition_version, created: false };
    }
    if (String(definition.status) !== "active") {
      throw new Error("Solo se puede preparar un borrador desde una configuración activa o borrador.");
    }
    // ¿Existe ya un borrador de la misma serie (proceso, variación)?
    const [existingDraft] = await connection.query(
      `SELECT id, definition_version FROM process_definition_versions
        WHERE process_id = ? AND variation_key = ? AND status = 'draft'
        ORDER BY id DESC LIMIT 1`,
      [definition.process_id, definition.variation_key]
    );
    if (existingDraft?.[0]?.id) {
      return { id: Number(existingDraft[0].id), definition_version: existingDraft[0].definition_version, created: false };
    }
    // Clonar la activa → nuevo borrador (bump minor) con sus hijos.
    const nextVersion = await this._getNextProcessDefinitionVersion(
      definition.process_id, definition.variation_key, "minor", connection
    );
    const [insertResult] = await connection.query(
      `INSERT INTO process_definition_versions
         (process_id, series_id, variation_key, definition_version, name, description, status, effective_from)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', CURDATE())`,
      [definition.process_id, definition.series_id, definition.variation_key, nextVersion, definition.name, definition.description]
    );
    const newId = Number(insertResult.insertId);
    await this._cloneProcessDefinitionChildren({
      sourceDefinitionId: defId,
      targetDefinitionId: newId,
      targetProcessId: definition.process_id,
      connection
    });
    return { id: newId, definition_version: nextVersion, created: true };
  }

  // Re-apunta el enlace de una configuración (su plantilla de cierto template_code) a una versión concreta.
  // F3 — "la pared": un entregable solo puede vincularse a configs de SU MISMA línea (proceso, variación).
  // Si el entregable no tiene dueño (legacy/transición) NO se bloquea (se limpia en F4). El clon de config
  // (cloneProcessDefinitionChildren) NO valida: copia enlaces existentes tal cual hasta el fork de F4.

  // Re-apunta el enlace de una configuración (su plantilla de cierto template_code) a una versión concreta.
  // F3 — "la pared": un entregable solo puede vincularse a configs de SU MISMA línea (proceso, variación).
  // Si el entregable no tiene dueño (legacy/transición) NO se bloquea (se limpia en F4). El clon de config
  // (cloneProcessDefinitionChildren) NO valida: copia enlaces existentes tal cual hasta el fork de F4.
  async assertDeliverableBelongsToConfigLine(definitionId, templateArtifactId, connection = this.pool) {
    const [defRows] = await connection.query(
      "SELECT process_id, variation_key FROM process_definition_versions WHERE id = ? LIMIT 1",
      [Number(definitionId)]
    );
    const def = defRows?.[0];
    if (!def) throw new Error("La configuración no existe.");
    const [ownRows] = await connection.query(
      `SELECT d.owner_process_id, d.owner_variation_key, d.code
         FROM template_artifacts ta
         INNER JOIN deliverables d ON d.id = ta.deliverable_id
        WHERE ta.id = ? LIMIT 1`,
      [Number(templateArtifactId)]
    );
    const own = ownRows?.[0];
    if (!own || own.owner_process_id == null) return; // sin dueño todavía → no se bloquea (transición)
    if (Number(own.owner_process_id) !== Number(def.process_id)
      || String(own.owner_variation_key) !== String(def.variation_key)) {
      const e = new Error(
        `El entregable "${own.code}" pertenece a otra línea (proceso/variación) y no se puede vincular a esta configuración. Crea o usa un entregable propio de esta línea ("Crear a partir de este").`
      );
      e.statusCode = 422;
      throw e;
    }
  }

  async repointConfigTemplateLink(definitionId, templateCode, targetArtifactId, connection = this.pool) {
    await this.assertDeliverableBelongsToConfigLine(definitionId, targetArtifactId, connection);
    const [result] = await connection.query(
      `UPDATE process_definition_templates pdt
         INNER JOIN template_artifacts ta ON ta.id = pdt.template_artifact_id
         INNER JOIN deliverables d ON d.id = ta.deliverable_id
          SET pdt.template_artifact_id = ?
        WHERE pdt.process_definition_id = ? AND d.code = ?`,
      [Number(targetArtifactId), Number(definitionId), String(templateCode)]
    );
    if (result?.affectedRows) {
      try {
        await this._syncArtifactWorkflowsForTemplateArtifactId(Number(targetArtifactId), connection);
      } catch {
        // aviso no bloqueante
      }
    }
    return result?.affectedRows || 0;
  }

  // Acción config-céntrica: "usar esta versión del entregable en esta configuración".
  //  - Config BORRADOR: re-apunta su enlace directo a la versión elegida.
  //  - Config ACTIVA: prepara (o reutiliza) el borrador de trabajo y re-apunta ahí; se aplica al activar el borrador.

  // Acción config-céntrica: "usar esta versión del entregable en esta configuración".
  //  - Config BORRADOR: re-apunta su enlace directo a la versión elegida.
  //  - Config ACTIVA: prepara (o reutiliza) el borrador de trabajo y re-apunta ahí; se aplica al activar el borrador.
  async useTemplateVersionInConfig({ definitionId, templateArtifactId } = {}) {
    this.ensurePool();
    const defId = Number(definitionId);
    const targetId = Number(templateArtifactId);
    if (!defId || !targetId) {
      throw new Error("Faltan datos: configuración y versión de plantilla.");
    }
    const target = await this._getByKeys("template_artifacts", { id: targetId });
    if (!target) throw new Error("La versión de plantilla no existe.");

    const [defRows] = await this.pool.query(
      "SELECT id, status FROM process_definition_versions WHERE id = ? LIMIT 1",
      [defId]
    );
    const status = String(defRows?.[0]?.status || "");
    if (!status) throw new Error("La configuración no existe.");
    if (status === "retired") throw new Error("Una configuración retirada es de solo lectura.");

    if (status === "draft") {
      const changed = await this.repointConfigTemplateLink(defId, target.template_code, targetId);
      if (!changed) throw new Error("Esta configuración no tiene un entregable de ese código para re-apuntar.");
      return {
        mode: "draft",
        config_definition_id: defId,
        target_artifact_id: targetId,
        __notice: `La configuración (borrador) ahora usa la versión v${target.storage_version}.`
      };
    }

    // Activa: preparar/usar el borrador de trabajo.
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const draft = await this.getOrCreateConfigWorkingDraft(defId, connection);
      const changed = await this.repointConfigTemplateLink(draft.id, target.template_code, targetId, connection);
      if (!changed) {
        throw new Error("El borrador de la configuración no tiene un entregable de ese código para re-apuntar.");
      }
      await connection.commit();
      return {
        mode: "active",
        config_definition_id: draft.id,
        config_definition_version: draft.definition_version,
        draft_created: draft.created,
        target_artifact_id: targetId,
        __notice: `Se preparó en el borrador v${draft.definition_version} de la configuración: usará v${target.storage_version}. Actívalo para aplicarlo.`
      };
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  }

  // Diff de activación: compara una configuración (borrador) contra la ACTIVA de su misma serie (proceso,
  // variación). Devuelve qué entregables cambian de versión / se agregan / se quitan, y conteos de reglas y
  // periodos. Para mostrar y confirmar antes de activar.

  // Diff de activación: compara una configuración (borrador) contra la ACTIVA de su misma serie (proceso,
  // variación). Devuelve qué entregables cambian de versión / se agregan / se quitan, y conteos de reglas y
  // periodos. Para mostrar y confirmar antes de activar.
  async getConfigActivationDiff(definitionId) {
    this.ensurePool();
    const defId = Number(definitionId);
    const [defRows] = await this.pool.query(
      "SELECT id, process_id, variation_key, status, definition_version FROM process_definition_versions WHERE id = ? LIMIT 1",
      [defId]
    );
    const draft = defRows?.[0];
    if (!draft) throw new Error("La configuración no existe.");
    const [activeRows] = await this.pool.query(
      `SELECT id, definition_version FROM process_definition_versions
        WHERE process_id = ? AND variation_key = ? AND status = 'active' AND id <> ?
        ORDER BY id DESC LIMIT 1`,
      [draft.process_id, draft.variation_key, defId]
    );
    const active = activeRows?.[0] || null;

    const loadTemplates = async (id) => {
      const [rows] = await this.pool.query(
        `SELECT d.code AS template_code, d.display_name, ta.storage_version, ta.lifecycle_state
           FROM process_definition_templates pdt
           INNER JOIN template_artifacts ta ON ta.id = pdt.template_artifact_id
           INNER JOIN deliverables d ON d.id = ta.deliverable_id
          WHERE pdt.process_definition_id = ?`,
        [id]
      );
      const map = new Map();
      for (const r of rows) map.set(r.template_code, r);
      return map;
    };
    const newT = await loadTemplates(defId);
    const oldT = active ? await loadTemplates(active.id) : new Map();
    const codes = new Set([...newT.keys(), ...oldT.keys()]);
    const templates = [];
    for (const code of codes) {
      const n = newT.get(code);
      const o = oldT.get(code);
      if (n && o) {
        templates.push({
          template_code: code, display_name: n.display_name,
          from_version: o.storage_version, to_version: n.storage_version, to_state: n.lifecycle_state,
          change: o.storage_version === n.storage_version ? "unchanged" : "changed"
        });
      } else if (n) {
        templates.push({ template_code: code, display_name: n.display_name, from_version: null, to_version: n.storage_version, to_state: n.lifecycle_state, change: "added" });
      } else {
        templates.push({ template_code: code, display_name: o.display_name, from_version: o.storage_version, to_version: null, change: "removed" });
      }
    }
    templates.sort((a, b) => String(a.template_code).localeCompare(String(b.template_code)));

    const countRows = async (table, id) => {
      const [r] = await this.pool.query(`SELECT COUNT(*) AS n FROM ${table} WHERE process_definition_id = ?`, [id]);
      return Number(r?.[0]?.n || 0);
    };
    const rules = { from: active ? await countRows("process_target_rules", active.id) : 0, to: await countRows("process_target_rules", defId) };
    const periodTypes = { from: active ? await countRows("process_definition_period_types", active.id) : 0, to: await countRows("process_definition_period_types", defId) };

    return {
      has_active: Boolean(active),
      from_version: active?.definition_version || null,
      to_version: draft.definition_version,
      config_status: draft.status,
      templates,
      rules,
      period_types: periodTypes
    };
  }

  // FORK: copia el contenido de una versión a un ENTREGABLE NUEVO propio de la línea (proceso, variación) de la
  // config destino, lo publica (v1.0.0) y re-apunta el enlace de esa config. Resuelve el conflicto cross-línea
  // (un linaje deja de tomar prestado el entregable de otro). Reusable también por la UI ("Crear a partir de este"
  // / arreglo del hueco cuando la pared bloquea use-in-config).

  // FORK: copia el contenido de una versión a un ENTREGABLE NUEVO propio de la línea (proceso, variación) de la
  // config destino, lo publica (v1.0.0) y re-apunta el enlace de esa config. Resuelve el conflicto cross-línea
  // (un linaje deja de tomar prestado el entregable de otro). Reusable también por la UI ("Crear a partir de este"
  // / arreglo del hueco cuando la pared bloquea use-in-config).
  async forkDeliverableForConfig({ sourceArtifactId, definitionId, newCode = null } = {}) {
    this.ensurePool();
    const srcId = Number(sourceArtifactId);
    const defId = Number(definitionId);
    const [srcRows] = await this.pool.query(
      `SELECT ta.*, d.code AS template_code, d.display_name, d.description, d.template_scope,
              d.template_seed_id, d.owner_person_id
         FROM template_artifacts ta LEFT JOIN deliverables d ON d.id = ta.deliverable_id
        WHERE ta.id = ? LIMIT 1`,
      [srcId]
    );
    const src = srcRows?.[0];
    if (!src) throw new Error("La versión de origen no existe.");
    const [defRows] = await this.pool.query(
      "SELECT process_id, variation_key FROM process_definition_versions WHERE id = ? LIMIT 1",
      [defId]
    );
    const def = defRows?.[0];
    if (!def) throw new Error("La configuración destino no existe.");
    const [procRows] = await this.pool.query("SELECT slug FROM processes WHERE id = ? LIMIT 1", [def.process_id]);
    const procSlug = String(procRows?.[0]?.slug || `p${def.process_id}`);

    // Código nuevo único para el fork.
    let code = newCode || `${src.template_code}__${procSlug}`;
    for (let i = 1; ; i += 1) {
      const candidate = i === 1 ? code : `${code}-${i}`;
      const [exists] = await this.pool.query("SELECT id FROM deliverables WHERE code = ? LIMIT 1", [candidate]);
      if (!exists.length) { code = candidate; break; }
    }

    // Crear el deliverable propio de la línea destino.
    const [delivIns] = await this.pool.query(
      `INSERT INTO deliverables
         (code, display_name, description, owner_process_id, owner_variation_key, template_scope, template_seed_id, owner_person_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [code, src.display_name, src.description, def.process_id, def.variation_key, src.template_scope || "official", src.template_seed_id, src.owner_person_id]
    );
    const newDeliverableId = Number(delivIns.insertId);

    // Copiar contenido MinIO a un prefijo propio (System/<code>/1.0.0/).
    const bucket = MINIO_TEMPLATES_BUCKET;
    const oldPrefix = String(src.base_object_prefix || "").replace(/\/?$/, "/");
    const oldCode = String(src.template_code);
    const oldVersion = String(src.storage_version || "");
    const suffix = `${oldCode}/${oldVersion}/`;
    const root = oldPrefix.endsWith(suffix) ? oldPrefix.slice(0, oldPrefix.length - suffix.length) : oldPrefix.replace(/[^/]+\/[^/]+\/$/, "");
    const newPrefix = `${root}${code}/1.0.0/`;
    const objectNames = await listMinioObjects(bucket, oldPrefix, true);
    for (const objectName of objectNames) {
      if (!objectName.startsWith(oldPrefix)) continue;
      const relative = objectName.slice(oldPrefix.length);
      if (!relative) continue;
      await copyMinioObjectBinary(bucket, objectName, `${newPrefix}${relative}`);
    }
    const remappedFormats = parseAvailableFormats(src.available_formats);
    for (const entry of Object.values(remappedFormats || {})) {
      if (entry?.entry_object_key && String(entry.entry_object_key).startsWith(oldPrefix)) {
        entry.entry_object_key = `${newPrefix}${String(entry.entry_object_key).slice(oldPrefix.length)}`;
      }
    }

    // Insertar la versión publicada del fork. Identidad/scope/owner viven en el `deliverable` nuevo (newDeliverableId).
    const [taIns] = await this.pool.query(
      `INSERT INTO template_artifacts
         (storage_version, lifecycle_state, base_object_prefix, available_formats, schema_object_key,
          meta_object_key, content_hash, deliverable_id, is_active)
       VALUES ('1.0.0', 'published', ?, ?, ?, ?, ?, ?, 1)`,
      [
        newPrefix, JSON.stringify(remappedFormats || {}),
        `${newPrefix}schema.json`, `${newPrefix}meta.yaml`, src.content_hash, newDeliverableId
      ]
    );
    const newArtifactId = Number(taIns.insertId);

    // Re-apuntar el enlace de la config destino (del original al fork).
    await this.pool.query(
      "UPDATE process_definition_templates SET template_artifact_id = ? WHERE process_definition_id = ? AND template_artifact_id = ?",
      [newArtifactId, defId, srcId]
    );
    try { await this._syncArtifactWorkflowsForTemplateArtifactId(newArtifactId); } catch { /* aviso no bloqueante */ }

    return { deliverable_id: newDeliverableId, artifact_id: newArtifactId, code, base_object_prefix: newPrefix };
  }

  async getTemplateSeedPreview(seedId) {
    this.ensurePool();
    const [rows] = await this.pool.query(
      `SELECT id, display_name, preview_path, source_path
       FROM template_seeds
       WHERE id = ?
       LIMIT 1`,
      [Number(seedId)]
    );
    const row = rows?.[0];
    if (!row) {
      throw new Error("El seed seleccionado no existe.");
    }
    if (!row.preview_path) {
      const seedObjects = await listMinioObjects(MINIO_TEMPLATES_BUCKET, row.source_path, true);
      const fallbackPreviewPath = findPreferredPdfObject(seedObjects);
      if (!fallbackPreviewPath) {
        throw new Error("El seed seleccionado no tiene preview PDF publicado en MinIO.");
      }
      row.preview_path = fallbackPreviewPath;
      await this.pool.query(
        "UPDATE template_seeds SET preview_path = ? WHERE id = ?",
        [fallbackPreviewPath, row.id]
      );
    }
    let objectStream;
    try {
      objectStream = await getMinioObjectStream(MINIO_TEMPLATES_BUCKET, row.preview_path);
    } catch (error) {
      const message = String(error?.message || "");
      if (!/does not exist|NoSuchKey/i.test(message)) {
        throw error;
      }
      const seedObjects = await listMinioObjects(MINIO_TEMPLATES_BUCKET, row.source_path, true);
      const fallbackPreviewPath = findPreferredPdfObject(seedObjects);
      if (!fallbackPreviewPath) {
        throw new Error("El seed seleccionado no tiene preview PDF publicado en MinIO.");
      }
      row.preview_path = fallbackPreviewPath;
      await this.pool.query(
        "UPDATE template_seeds SET preview_path = ? WHERE id = ?",
        [fallbackPreviewPath, row.id]
      );
      objectStream = await getMinioObjectStream(MINIO_TEMPLATES_BUCKET, row.preview_path);
    }
    return {
      stream: objectStream,
      fileName: `${slugify(row.display_name || "seed") || "seed"}-preview.pdf`
    };
  }

  async syncTemplateSeedsFromSource() {
    this.ensurePool();
    const bucket = MINIO_TEMPLATES_BUCKET;
    const prefixRoot = `${MINIO_TEMPLATES_SEEDS_PREFIX}/`;
    const objectNames = await listMinioObjects(bucket, prefixRoot, true);
    if (!objectNames.length) {
      throw new Error(`No existen seeds publicados en MinIO bajo ${prefixRoot}`);
    }

    let discovered = 0;
    let inserted = 0;
    let updated = 0;

    const seedGroups = new Map();
    for (const objectName of objectNames) {
      if (!objectName.startsWith(prefixRoot)) {
        continue;
      }
      const relativePath = objectName.slice(prefixRoot.length);
      const parts = relativePath.split("/").filter(Boolean);
      if (parts.length < 2) {
        continue;
      }

      const seedType = parts[0];
      const seedName = parts[1];
      const seedCode = `${seedType}/${seedName}`;
      const objectSuffix = parts.slice(2).join("/");

      if (!seedGroups.has(seedCode)) {
        seedGroups.set(seedCode, {
          seedCode,
          displayName: humanizeSlug(seedName),
          seedType,
          sourcePath: `${prefixRoot}${seedType}/${seedName}/`,
          previewPath: null,
          readmeObjectKey: null,
          objectNames: []
        });
      }

      const group = seedGroups.get(seedCode);
      group.objectNames.push(objectName);
      if (!group.readmeObjectKey && objectSuffix === "README.md") {
        group.readmeObjectKey = objectName;
      }
    }

    for (const group of seedGroups.values()) {
      discovered += 1;
      group.previewPath = findPreferredPdfObject(group.objectNames);
      let description = `Seed ${group.displayName}`;
      if (group.readmeObjectKey) {
        try {
          const readmeStream = await getMinioObjectStream(bucket, group.readmeObjectKey);
          const readmeContent = (await streamToBuffer(readmeStream)).toString("utf8");
          const firstBodyLine = readmeContent
            .split(/\r?\n/)
            .map((line) => line.trim())
            .find((line) => line && !line.startsWith("#"));
          if (firstBodyLine) {
            description = firstBodyLine.slice(0, 255);
          }
        } catch {
          // Fallback to generated description.
        }
      }

      const [existingRows] = await this.pool.query(
        `SELECT id
         FROM template_seeds
         WHERE seed_code = ?
         LIMIT 1`,
        [group.seedCode]
      );

      if (existingRows?.length) {
        await this.pool.query(
          `UPDATE template_seeds
           SET display_name = ?,
               description = ?,
               seed_type = ?,
               source_path = ?,
               preview_path = ?,
               is_active = 1
           WHERE id = ?`,
          [group.displayName, description, group.seedType, group.sourcePath, group.previewPath, existingRows[0].id]
        );
        updated += 1;
      } else {
        await this.pool.query(
          `INSERT INTO template_seeds (
            seed_code,
            display_name,
            description,
            seed_type,
            source_path,
            preview_path,
            is_active
          ) VALUES (?, ?, ?, ?, ?, ?, 1)`,
          [group.seedCode, group.displayName, description, group.seedType, group.sourcePath, group.previewPath]
        );
        inserted += 1;
      }
    }

    return { discovered, inserted, updated, bucket, prefix: MINIO_TEMPLATES_SEEDS_PREFIX };
  }

  // === FASE 2: actualización guiada de la plantilla de una configuración ACTIVA ===
  // Paso 1 (start): clona la plantilla (bump → borrador) y clona la config activa → borrador re-apuntando el
  // enlace a la nueva versión de plantilla. Devuelve ambos borradores para editar y luego publicar+activar.

  // === FASE 2: actualización guiada de la plantilla de una configuración ACTIVA ===
  // Paso 1 (start): clona la plantilla (bump → borrador) y clona la config activa → borrador re-apuntando el
  // enlace a la nueva versión de plantilla. Devuelve ambos borradores para editar y luego publicar+activar.
  async startTemplateUpdateForActiveConfig({ definitionId, templateArtifactId, bumpLevel = "minor" } = {}) {
    this.ensurePool();
    const defId = Number(definitionId);
    const tplId = Number(templateArtifactId);
    if (!defId || !tplId) {
      throw new Error("Faltan datos: se requieren la configuración y la plantilla.");
    }

    const [defRows] = await this.pool.query(
      `SELECT id, process_id, series_id, variation_key, definition_version, name, description, status
         FROM process_definition_versions WHERE id = ? LIMIT 1`,
      [defId]
    );
    const definition = defRows?.[0];
    if (!definition) {
      throw new Error("La configuración no existe.");
    }
    if (String(definition.status) !== "active") {
      throw new Error("La actualización guiada aplica solo a configuraciones activas.");
    }

    const [linkRows] = await this.pool.query(
      "SELECT id FROM process_definition_templates WHERE process_definition_id = ? AND template_artifact_id = ? LIMIT 1",
      [defId, tplId]
    );
    if (!linkRows.length) {
      throw new Error("La plantilla seleccionada no pertenece a esta configuración.");
    }

    const template = await this._getByKeys("template_artifacts", { id: tplId });
    if (!template) {
      throw new Error("La plantilla no existe.");
    }
    if (String(template.lifecycle_state || "published") !== "published") {
      throw new Error("Solo se puede actualizar desde una versión publicada de la plantilla.");
    }

    // 1) Clonar la plantilla → nueva versión en borrador (MinIO + DB). Fuera de la transacción de la config
    //    porque copia objetos en MinIO (efecto colateral no transaccional).
    const tplVersion = await this._createTemplateArtifactVersion(tplId, bumpLevel);
    const newTemplateId = Number(tplVersion.id);

    // 2) Clonar la config activa → borrador, re-apuntando el enlace de plantilla a la nueva versión.
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const nextConfigVersion = await this._getNextProcessDefinitionVersion(
        definition.process_id,
        definition.variation_key,
        bumpLevel,
        connection
      );
      const [insertResult] = await connection.query(
        `INSERT INTO process_definition_versions
           (process_id, series_id, variation_key, definition_version, name, description, status, effective_from)
         VALUES (?, ?, ?, ?, ?, ?, 'draft', CURDATE())`,
        [
          definition.process_id,
          definition.series_id,
          definition.variation_key,
          nextConfigVersion,
          definition.name,
          definition.description
        ]
      );
      const newConfigId = Number(insertResult.insertId);
      await this._cloneProcessDefinitionChildren({
        sourceDefinitionId: defId,
        targetDefinitionId: newConfigId,
        targetProcessId: definition.process_id,
        templateRemap: { [tplId]: newTemplateId },
        connection
      });
      await connection.commit();
      return {
        template_draft_id: newTemplateId,
        template_storage_version: tplVersion.storage_version,
        config_draft_id: newConfigId,
        config_definition_version: nextConfigVersion,
        source_definition_id: defId,
        source_template_artifact_id: tplId,
        __notice: `Borradores creados: plantilla v${tplVersion.storage_version} y configuración v${nextConfigVersion}. Edita el contenido y publica para activar.`
      };
    } catch (error) {
      await connection.rollback().catch(() => {});
      // La plantilla borrador ya creada queda huérfana (inofensiva); se puede retirar/eliminar luego.
      throw error;
    } finally {
      connection.release();
    }
  }

  // Paso 2 (finish): publica la plantilla borrador y activa la config borrador, ATÓMICO. Retira la plantilla
  // publicada previa del mismo código y la config activa previa de la serie.

  // Paso 2 (finish): publica la plantilla borrador y activa la config borrador, ATÓMICO. Retira la plantilla
  // publicada previa del mismo código y la config activa previa de la serie.
  async finishTemplateUpdate({ templateArtifactId, configDefinitionId } = {}) {
    this.ensurePool();
    const tplId = Number(templateArtifactId);
    const cfgId = Number(configDefinitionId);
    if (!tplId || !cfgId) {
      throw new Error("Faltan datos: se requieren la plantilla y la configuración borrador.");
    }

    const template = await this._getByKeys("template_artifacts", { id: tplId });
    if (!template) {
      throw new Error("La plantilla borrador no existe.");
    }
    if (String(template.lifecycle_state || "") !== "draft") {
      throw new Error("La plantilla ya no está en borrador.");
    }

    const [defRows] = await this.pool.query(
      "SELECT id, process_id, variation_key, definition_version, status FROM process_definition_versions WHERE id = ? LIMIT 1",
      [cfgId]
    );
    const definition = defRows?.[0];
    if (!definition) {
      throw new Error("La configuración borrador no existe.");
    }
    if (String(definition.status) !== "draft") {
      throw new Error("La configuración ya no está en borrador.");
    }

    const [linkRows] = await this.pool.query(
      "SELECT id, item_mode FROM process_definition_templates WHERE process_definition_id = ? AND template_artifact_id = ? LIMIT 1",
      [cfgId, tplId]
    );
    if (!linkRows.length) {
      throw new Error("La configuración borrador no está vinculada a esta plantilla.");
    }

    // Readiness de publicación de la plantilla (≥1 paso de entrega) — lectura MinIO antes de la transacción.
    // routed NO autora flujo (se define al enviar): se omite el readiness de entrega.
    if (String(linkRows[0].item_mode) !== "routed") {
      let fillSteps = 0;
      try {
        const meta = await this._loadTemplateArtifactMetaDocument(template);
        fillSteps = (Array.isArray(meta?.workflows?.fill?.steps) ? meta.workflows.fill.steps : []).length;
      } catch {
        fillSteps = 0;
      }
      if (!fillSteps) {
        throw new Error("No se puede publicar: la plantilla debe definir al menos un paso de flujo de entrega.");
      }
    }

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      // Readiness de activación que NO depende del estado de la plantilla.
      await this._ensureDefinitionHasActiveRulesForActivation(cfgId, connection);
      await this._ensureDefinitionHasActivePeriodTypesForActivation(cfgId, connection);

      // Publicar plantilla PRIMERO (deja is_active=1) para que pase el check de artefactos activos.
      // Una sola publicada por ENTREGABLE: retira las demás publicadas del mismo deliverable.
      await this._retirePriorPublishedSiblings(connection, tplId);
      await connection.query(
        "UPDATE template_artifacts SET lifecycle_state = 'published', is_active = 1 WHERE id = ?",
        [tplId]
      );

      // Ahora sí, el check de artefactos activos de la config pasa (la nueva plantilla ya está activa).
      await this._ensureDefinitionHasArtifactsForActivation(cfgId, connection);

      // Activar config: retira la activa previa de la serie + activa esta.
      const retiredCount = await this._retireActiveDefinitionsInSeries({
        processId: definition.process_id,
        variationKey: definition.variation_key,
        excludeId: cfgId,
        connection
      });
      await connection.query(
        "UPDATE process_definition_versions SET status = 'active' WHERE id = ?",
        [cfgId]
      );
      await connection.commit();
      return {
        template_artifact_id: tplId,
        template_lifecycle_state: "published",
        config_definition_id: cfgId,
        config_status: "active",
        retired_previous_config: retiredCount,
        __notice: `Plantilla v${template.storage_version} publicada y configuración v${definition.definition_version} activada.`
      };
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  }

  // Borrador de TRABAJO de una configuración (modelo config-céntrico): una config tiene a lo más UN borrador en
  // curso por (proceso, variación). Si la config dada es borrador, ese es el de trabajo. Si es activa, reutiliza
  // un borrador existente de la serie o, si no hay, clona la activa a un nuevo borrador (bump minor) con sus
  // reglas/periodos/plantillas. Devuelve { id, definition_version, created }.

  async createTemplateArtifactDraft(data = {}, files = {}, actor = {}) {
    return this.saveTemplateArtifactDraft(null, data, files, actor);
  }

  async updateTemplateArtifactDraft(artifactId, data = {}, files = {}, actor = {}) {
    return this.saveTemplateArtifactDraft(artifactId, data, files, actor);
  }

  // Resuelve el propietario del borrador: su cedula (ownerRef) y su id de persona.
  //
  // La cedula ya NO se persiste como columna: se usa solo para construir la ruta MinIO ad_hoc al
  // crear (Users/<cedula>/...) y para resolver owner_person_id. En edicion se reutiliza el
  // base_object_prefix ya almacenado, asi que no hace falta.
  //
  // Precedencia: la persona pedida explicitamente gana; si no, la del artifact existente; y como
  // ultimo recurso se busca por cedula.
  async _resolveDraftOwner({ ownerCedula = "", requestedOwnerPersonId = null, existingArtifact = null } = {}) {
    let ownerRef = String(ownerCedula || "").slice(0, 180);
    let ownerPersonId = normalizeNumericId(existingArtifact?.owner_person_id);

    if (!ownerRef && ownerPersonId) {
      const ownerPersonRow = await this._getByKeys("persons", { id: ownerPersonId });
      ownerRef = String(ownerPersonRow?.cedula || "").slice(0, 180);
    }

    if (requestedOwnerPersonId) {
      const ownerPerson = await this._getByKeys("persons", { id: requestedOwnerPersonId });
      if (!ownerPerson) {
        throw new Error("La persona propietaria indicada no existe.");
      }
      return { ownerRef, ownerPersonId: requestedOwnerPersonId };
    }

    if (!ownerPersonId && ownerRef) {
      const [ownerRows] = await this.pool.query(
        `SELECT id
         FROM persons
         WHERE cedula = ?
         LIMIT 1`,
        [ownerRef]
      );
      if (ownerRows?.length) {
        ownerPersonId = ownerRows[0].id;
      }
    }

    return { ownerRef, ownerPersonId };
  }

  // Valida el contrato del flujo AUTORADO, antes de subir el meta.yaml, en vez de degradar en
  // silencio durante la normalizacion del sync. Devuelve los avisos NO bloqueantes (p. ej. un cargo
  // que hoy no tiene titular en la ubicacion); lanza 422 si hay errores de verdad.
  async _validateAuthoredWorkflows({
    fillWorkflow = null,
    signatureWorkflow = null,
    templateScope = "official",
    processDefinitionId = null,
    existingArtifactId = null
  } = {}) {
    // Proceso vinculado: en creación llega en el form; en edición se busca el vínculo existente.
    let linkedDefinitionId = normalizeNumericId(processDefinitionId);
    if (!linkedDefinitionId && existingArtifactId) {
      const [linkRows] = await this.pool.query(
        "SELECT process_definition_id FROM process_definition_templates WHERE template_artifact_id = ? LIMIT 1",
        [Number(existingArtifactId)]
      );
      linkedDefinitionId = normalizeNumericId(linkRows?.[0]?.process_definition_id);
    }
    const [cargoCodeMap, referenceIds, processScope] = await Promise.all([
      this._getCargoCodeMap(),
      this._getWorkflowReferenceIdSets(),
      this._getProcessTargetScope(linkedDefinitionId)
    ]);
    // Cargos resolubles por ubicación, para rechazar pasos por cargo que no tendrían titular: ctx (alcance,
    // para "misma unidad") + byUnit (cada unidad fija usada en pasos "unidad específica").
    const fillStepList = Array.isArray(fillWorkflow?.steps) ? fillWorkflow.steps : [];
    const unitExactUnitIds = [];
    let needsCtxCargos = false;
    // Considera tanto pasos de entrega (un resolutor) como firmantes de cada paso de firma (lista). Así los
    // avisos "cargo sin puesto" se evalúan con el set de cargos resolubles correcto y no salen falsos.
    const cargoScopeSources = [...fillStepList];
    for (const step of (Array.isArray(signatureWorkflow?.steps) ? signatureWorkflow.steps : [])) {
      const signers = Array.isArray(step?.signers) && step.signers.length ? step.signers : [step];
      cargoScopeSources.push(...signers);
    }
    for (const step of cargoScopeSources) {
      const resolverType = String(step?.resolver_type || step?.resolver?.resolver_type || "task_assignee");
      if (resolverType !== "cargo_in_scope") continue;
      const stepScope = String(step?.unit_scope_type || step?.resolver?.unit_scope_type || "context_exact");
      if (stepScope === "unit_exact") {
        const uid = normalizeNumericId(step?.unit_id ?? step?.resolver?.unit_id);
        if (uid) unitExactUnitIds.push(uid);
      } else if (stepScope === "context_exact") {
        needsCtxCargos = true;
      }
    }
    const [ctxCargos, resolvableByUnit] = await Promise.all([
      needsCtxCargos && linkedDefinitionId ? this._listResolvableCargos(linkedDefinitionId) : Promise.resolve(null),
      unitExactUnitIds.length ? this._getResolvableCargoIdsByUnit(this.pool, unitExactUnitIds) : Promise.resolve(new Map())
    ]);
    const resolvableCargoIds = {
      ctx: ctxCargos ? new Set(ctxCargos.map((c) => c.id)) : null,
      byUnit: resolvableByUnit
    };
    const { errors: workflowErrors, warnings: workflowWarnings } = collectAuthoredWorkflowIssues({
      fillWorkflow,
      signatureWorkflow,
      cargoCodeMap,
      referenceIds,
      processScope,
      resolvableCargoIds,
      templateScope
    });
    if (workflowErrors.length) {
      const error = new Error(`El flujo definido tiene errores:\n- ${workflowErrors.join("\n- ")}`);
      error.statusCode = 422;
      throw error;
    }
    return workflowWarnings;
  }

  // Deja en `draftDir` TODOS los formatos que va a tener el borrador y devuelve el mapa
  // `available_formats` que se persiste. Tres fuentes, en este orden:
  //
  //   1. la semilla elegida (contrato jinja2 + defaults.yaml + el render latex, si lo publica),
  //   2. los formatos que ya tenia el artifact, cuando NO se cambia de semilla,
  //   3. los ficheros que suba el usuario, que ganan sobre lo anterior.
  //
  // Devuelve tambien `seedRow` porque quien llama lo necesita para el `seed_code` del meta.yaml.
  async _materializeDraftFormats({
    draftDir,
    bucket,
    baseObjectPrefix,
    templateSeedId = null,
    uploadedFiles = {},
    existingAvailableFormats = {}
  } = {}) {
    const availableFormats = {};

    const preserveExistingFormat = async (format) => {
      const existingEntry = existingAvailableFormats?.[format];
      if (!existingEntry?.entry_object_key) {
        return false;
      }
      const targetDir = buildArtifactFormatDir(draftDir, format);
      const existingObjectKey = String(existingEntry.entry_object_key);
      if (/\.[a-z0-9]+$/i.test(existingObjectKey)) {
        const fileName = path.basename(existingObjectKey);
        await copyMinioObjectToFile(bucket, existingObjectKey, path.join(targetDir, fileName));
      } else {
        await downloadMinioPrefixToDirectory(bucket, existingObjectKey, targetDir);
      }
      setAvailableFormatEntry(availableFormats, format, baseObjectPrefix);
      return true;
    };

    let seedRow = null;
    if (templateSeedId) {
      seedRow = await this._getByKeys("template_seeds", { id: templateSeedId });
      if (!seedRow) {
        throw new Error("El seed seleccionado no existe.");
      }
      await downloadMinioPrefixToDirectory(
        MINIO_TEMPLATES_BUCKET,
        `${seedRow.source_path}src/`,
        buildArtifactFormatDir(draftDir, CONTRACT_FORMAT)
      );
      setAvailableFormatEntry(availableFormats, CONTRACT_FORMAT, baseObjectPrefix);
      const defaultsObjectKey = `${seedRow.source_path}defaults.yaml`;
      try {
        await copyMinioObjectToFile(
          MINIO_TEMPLATES_BUCKET,
          defaultsObjectKey,
          path.join(draftDir, "data.yaml")
        );
      } catch {
        // Optional for non-latex seeds.
      }
      // El render compilado (formato latex) es opcional/derivable: si el seed no lo publica (p.ej. el seed
      // base se empaqueta sin render/), se omite sin abortar. El contrato real es jinja2.
      if (String(seedRow.seed_type || "").toLowerCase() === "latex") {
        try {
          await downloadMinioPrefixToDirectory(
            MINIO_TEMPLATES_BUCKET,
            `${seedRow.source_path}render/`,
            buildArtifactFormatDir(draftDir, "latex")
          );
          setAvailableFormatEntry(availableFormats, "latex", baseObjectPrefix);
        } catch {
          // Sin render/ publicado: se omite el formato latex.
        }
      }
    }

    if (!seedRow) {
      await preserveExistingFormat(CONTRACT_FORMAT);
      await preserveExistingFormat("latex");
    }

    const fileFieldMap = {
      pdf: "pdf",
      docx: "docx",
      xlsx: "xlsx",
      pptx: "pptx"
    };

    for (const [format, file] of Object.entries(uploadedFiles)) {
      const targetDir = buildArtifactFormatDir(draftDir, fileFieldMap[format]);
      const existingEntry = existingAvailableFormats?.[fileFieldMap[format]];

      if (file) {
        const safeName = slugify(path.parse(file.originalname || format).name) || format;
        const extension = path.extname(file.originalname || "") || `.${format}`;
        const fallbackFileName = `${safeName}${extension.toLowerCase()}`;
        const fileName = existingEntry?.entry_object_key
          ? path.basename(existingEntry.entry_object_key)
          : fallbackFileName;
        fs.mkdirSync(targetDir, { recursive: true });
        fs.writeFileSync(path.join(targetDir, fileName), file.buffer);
        setAvailableFormatEntry(availableFormats, fileFieldMap[format], baseObjectPrefix);
        continue;
      }

      if (existingEntry?.entry_object_key) {
        const existingObjectKey = String(existingEntry.entry_object_key);
        if (/\.[a-z0-9]+$/i.test(existingObjectKey)) {
          const fileName = path.basename(existingObjectKey);
          await copyMinioObjectToFile(bucket, existingObjectKey, path.join(targetDir, fileName));
        } else {
          await downloadMinioPrefixToDirectory(bucket, existingObjectKey, targetDir);
        }
        setAvailableFormatEntry(availableFormats, fileFieldMap[format], baseObjectPrefix);
      }
    }

    return { availableFormats, seedRow };
  }

  async saveTemplateArtifactDraft(artifactId, data = {}, files = {}, actor = {}) {
    this.ensurePool();

    const displayName = String(data.display_name || "").trim();
    const description = String(data.description || "").trim() || null;
    const ownerCedula = String(data.owner_cedula || "").trim();
    const requestedOwnerPersonId = normalizeNumericId(data.owner_person_id);
    let templateSeedId = data.template_seed_id ? Number(data.template_seed_id) : null;
    const isEdit = artifactId !== null && artifactId !== undefined && artifactId !== "";

    if (!displayName) {
      throw new Error("Ingresa el nombre del artifact borrador.");
    }
    if (!ownerCedula && !isEdit) {
      throw new Error("No se pudo inferir la cedula del usuario actual para crear el borrador.");
    }

    const uploadedFiles = {
      pdf: files?.pdf_file?.[0] || null,
      docx: files?.docx_file?.[0] || null,
      xlsx: files?.xlsx_file?.[0] || null,
      pptx: files?.pptx_file?.[0] || null
    };

    let existingArtifact = null;
    if (isEdit) {
      existingArtifact = await this._getByKeys("template_artifacts", { id: Number(artifactId) });
      if (!existingArtifact) {
        throw new Error("El artifact seleccionado no existe.");
      }
      // Solo se edita el contenido mientras la versión está en BORRADOR (independiente del scope). Una versión
      // publicada es inmutable: para cambiarla, crea una nueva versión (que nace en borrador) y edítala.
      if (String(existingArtifact.lifecycle_state || "published") !== "draft") {
        throw new Error("Esta plantilla está publicada (inmutable). Crea una nueva versión para editarla.");
      }
    }

    // Fail-fast (antes de subir nada a MinIO): TODA plantilla debe pertenecer a un proceso. Aplica a todos
    // los roles (admin/gestor de procesos incluidos), no solo al ejecutor.
    if (!isEdit && !(data.process_definition_id ? Number(data.process_definition_id) : null)) {
      throw new Error("Debes seleccionar el proceso (o 'default') al que pertenece esta plantilla.");
    }

    // Modo de emisión del vínculo a proceso (single/replicated/routed). Se fija AL CREAR el link;
    // default 'single'. 'routed' no autora flujo predefinido: se define al enviar (runtime).
    const requestedItemMode = normalizeItemMode(data.item_mode);

    const existingAvailableFormats = parseAvailableFormats(existingArtifact?.available_formats);

    // Toda plantilla nace de una semilla: si al crear no se eligió ninguna, se usa la general (default).
    if (!isEdit && !templateSeedId) {
      const [defaultSeedRows] = await this.pool.query(
        "SELECT id FROM template_seeds WHERE seed_code = ? AND is_active = 1 LIMIT 1",
        [DEFAULT_SEED_CODE]
      );
      if (!defaultSeedRows?.[0]?.id) {
        throw new Error(`No existe la semilla por defecto "${DEFAULT_SEED_CODE}". Ejecuta el bootstrap del sistema.`);
      }
      templateSeedId = Number(defaultSeedRows[0].id);
    }

    // Al crear, siempre se exige al menos un documento de referencia (word/excel/pdf/pptx).
    if (!isEdit) {
      const hasReferenceDoc = REFERENCE_DOC_FORMATS.some((format) => uploadedFiles[format]);
      if (!hasReferenceDoc) {
        throw new Error("Debes adjuntar al menos un documento de referencia (PDF, Word, Excel o PowerPoint).");
      }
      // Toda plantilla single/replicated debe definir un flujo de entrega con al menos un paso
      // (fail-fast antes del upload). 'routed' NO autora flujo: se define al enviar (runtime).
      if (requestedItemMode !== "routed") {
        if (!workflowHasSteps(parseWorkflowPayload(data.fill_workflow))) {
          throw new Error("Debes definir al menos un paso en el flujo de entrega.");
        }
      }
    } else if (
      !templateSeedId
      && !Object.values(uploadedFiles).some(Boolean)
      && !Object.keys(existingAvailableFormats).length
    ) {
      throw new Error("Selecciona un seed o sube al menos un archivo para actualizar el borrador.");
    }

    const { ownerRef, ownerPersonId } = await this._resolveDraftOwner({
      ownerCedula,
      requestedOwnerPersonId,
      existingArtifact
    });
    const baseSlug = slugify(displayName) || "artifact";
    const templateCode = String(existingArtifact?.template_code || `draft_${baseSlug}`).slice(0, 180);
    const storageVersion = existingArtifact?.storage_version || await this._getNextStorageVersionForTemplateCode(templateCode);
    const bucket = MINIO_TEMPLATES_BUCKET;
    const requestedTemplateScope = String(data.template_scope || existingArtifact?.template_scope || "official").trim();
    const templateScope = requestedTemplateScope === "ad_hoc" ? "ad_hoc" : "official";
    const adHocToken = sanitizeStorageSegment(data.task_item_id || data.draft_token || randomUUID(), "draft");
    // 'official' (de proceso) vive en un repo distinto del de usuarios; 'ad_hoc' (de usuario) bajo Users/.
    const defaultBaseObjectPrefix = templateScope === "ad_hoc"
      ? `${TEMPLATE_USERS_PREFIX}/${ownerRef}/AdHoc/${adHocToken}/${templateCode}/${storageVersion}/`
      : `${MINIO_TEMPLATES_PREFIX}/${templateCode}/${storageVersion}/`;
    const baseObjectPrefix = String(existingArtifact?.base_object_prefix || defaultBaseObjectPrefix);
    const draftDir = path.join(
      TEMPLATE_DRAFT_STAGING_ROOT,
      ownerRef || templateScope,
      templateCode,
      storageVersion
    );

    fs.rmSync(draftDir, { recursive: true, force: true });
    fs.mkdirSync(draftDir, { recursive: true });
    fs.mkdirSync(path.join(draftDir, "template"), { recursive: true });
    const { availableFormats, seedRow } = await this._materializeDraftFormats({
      draftDir,
      bucket,
      baseObjectPrefix,
      templateSeedId,
      uploadedFiles,
      existingAvailableFormats
    });

    if (!Object.keys(availableFormats).length) {
      throw new Error("No se detectaron formatos disponibles para el borrador.");
    }

    const schemaObjectKey = `${baseObjectPrefix}schema.json`;
    const metaObjectKey = `${baseObjectPrefix}meta.yaml`;
    // Campos definidos desde la web (editor de schema). Si no llegan, se conserva {}.
    let schemaFields = data.schema_fields;
    if (typeof schemaFields === "string") {
      try { schemaFields = JSON.parse(schemaFields); } catch { schemaFields = null; }
    }
    const schemaJson = Array.isArray(schemaFields) && schemaFields.length
      ? buildSchemaJsonFromFields(schemaFields)
      : null;
    fs.writeFileSync(
      path.join(draftDir, "schema.json"),
      schemaJson ? `${JSON.stringify(schemaJson, null, 2)}\n` : "{}\n",
      "utf8"
    );
    const metaLines = [
      `name: "${displayName.replaceAll("\"", '\\"')}"`,
      `version: "${storageVersion.replaceAll("\"", '\\"')}"`,
      `template_code: "${templateCode.replaceAll("\"", '\\"')}"`,
      `template_scope: ${templateScope}`
    ];
    if (description) {
      metaLines.push(`description: "${description.replaceAll("\"", '\\"')}"`);
    }
    if (seedRow?.seed_code) {
      metaLines.push(`seed_code: "${String(seedRow.seed_code).replaceAll("\"", '\\"')}"`);
    }
    // Flujos definidos desde el editor web (fill/signatures). Si no llegan, se usa el contrato vacío.
    const fillWorkflow = parseWorkflowPayload(data.fill_workflow);
    const signatureWorkflow = parseWorkflowPayload(data.signature_workflow);
    const hasCustomWorkflows = workflowHasSteps(fillWorkflow) || workflowHasSteps(signatureWorkflow);
    // Avisos no bloqueantes de autoría (p. ej. cargo sin puesto hoy en la ubicación): se acumulan para
    // informarlos en la respuesta, sin abortar el guardado.
    let authoringWarnings = [];
    // Validación del contrato de flujo en autoría (no solo al vincular): falla rápido y claro antes de
    // subir el meta.yaml, en vez de degradar silenciosamente en la normalización del sync.
    if (hasCustomWorkflows) {
      authoringWarnings = await this._validateAuthoredWorkflows({
        fillWorkflow,
        signatureWorkflow,
        templateScope,
        processDefinitionId: data.process_definition_id,
        existingArtifactId: isEdit ? existingArtifact?.id : null
      });
    }
    const workflowsYaml = hasCustomWorkflows
      ? buildWorkflowsYaml({ fillWorkflow, signatureWorkflow })
      : ARTIFACT_WORKFLOW_CONTRACT;
    fs.writeFileSync(
      path.join(draftDir, "meta.yaml"),
      `${metaLines.join("\n")}\n${workflowsYaml}\n`,
      "utf8"
    );
    validatePackagedArtifactDraft(draftDir, availableFormats);

    const contentHash = hashDirectory(draftDir);
    // Manifiesto de integridad (después del content_hash para no alterarlo; antes del upload para que viaje).
    fs.writeFileSync(
      path.join(draftDir, "manifest.json"),
      `${JSON.stringify(buildProtectedManifest(draftDir, EDITABLE_CONTENT_SUBPATH), null, 2)}\n`,
      "utf8"
    );
    let createdId = isEdit ? Number(existingArtifact.id) : null;
    let uploadedToMinio = false;
    // Compensación manual (aquí NO hay transacción): se anota lo que ESTA llamada insertó para
    // poder deshacerlo en el `catch`. Se distingue insertar de REUSAR: un `deliverable` que ya
    // existía con el mismo `code` pertenece a versiones anteriores y no debe borrarse.
    let insertedDeliverableId = null;
    let insertedLinkId = null;

    try {
      await uploadDirectoryToMinio(bucket, baseObjectPrefix, draftDir);
      uploadedToMinio = true;

      if (isEdit) {
        // Storage en template_artifacts; identidad/scope/owner/seed/nombre en el `deliverable`.
        await this.pool.query(
          `UPDATE template_artifacts
           SET base_object_prefix = ?,
               available_formats = ?,
               schema_object_key = ?,
               meta_object_key = ?,
               content_hash = ?,
               is_active = 1
           WHERE id = ?`,
          [
            baseObjectPrefix,
            JSON.stringify(availableFormats),
            schemaObjectKey,
            metaObjectKey,
            contentHash,
            createdId
          ]
        );
        if (existingArtifact?.deliverable_id) {
          await this.pool.query(
            `UPDATE deliverables
             SET display_name = ?, description = ?, template_scope = ?, template_seed_id = ?, owner_person_id = ?
             WHERE id = ?`,
            [displayName, description, templateScope, templateSeedId, ownerPersonId, existingArtifact.deliverable_id]
          );
        }
      } else {
        // Modelo entregable/ediciones: crear (o reusar) el `deliverable` PRIMERO (dueño = (proceso, variación) de
        // la configuración destino) y luego insertar la versión con su deliverable_id.
        let ownerProcessId = null;
        let ownerVariationKey = null;
        const destDefId = data.process_definition_id ? Number(data.process_definition_id) : null;
        if (destDefId) {
          const [dRows] = await this.pool.query(
            "SELECT process_id, variation_key FROM process_definition_versions WHERE id = ? LIMIT 1",
            [destDefId]
          );
          ownerProcessId = dRows?.[0]?.process_id ?? null;
          ownerVariationKey = dRows?.[0]?.variation_key ?? null;
        }
        const [delivExisting] = await this.pool.query("SELECT id FROM deliverables WHERE code = ? LIMIT 1", [templateCode]);
        let newDeliverableId = delivExisting?.[0]?.id;
        if (!newDeliverableId) {
          const [delivIns] = await this.pool.query(
            `INSERT INTO deliverables
               (code, display_name, description, owner_process_id, owner_variation_key, template_scope, template_seed_id, owner_person_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [templateCode, displayName, description, ownerProcessId, ownerVariationKey, templateScope, templateSeedId, ownerPersonId]
          );
          newDeliverableId = delivIns.insertId;
          insertedDeliverableId = newDeliverableId;
        }
        const [result] = await this.pool.query(
          `INSERT INTO template_artifacts (
            storage_version,
            lifecycle_state,
            base_object_prefix,
            available_formats,
            schema_object_key,
            meta_object_key,
            content_hash,
            deliverable_id,
            is_active
          ) VALUES (?, 'draft', ?, ?, ?, ?, ?, ?, 1)`,
          [
            storageVersion,
            baseObjectPrefix,
            JSON.stringify(availableFormats),
            schemaObjectKey,
            metaObjectKey,
            contentHash,
            newDeliverableId
          ]
        );
        createdId = result.insertId;
      }

      // Vínculo a proceso destino. Obligatorio para ejecutores (GestorEjecucionProcesos):
      // su plantilla debe colgar de un proceso ya definido o de 'default'. Opcional para diseñadores.
      // El requisito de vínculo obligatorio para ejecutores al crear ya se validó arriba (fail-fast);
      // en edición el vínculo previo se conserva. Aquí solo se materializa el vínculo si llega un destino.
      const requestedProcessDefinitionId = data.process_definition_id ? Number(data.process_definition_id) : null;
      if (requestedProcessDefinitionId && createdId) {
        const def = await this._getByKeys("process_definition_versions", { id: requestedProcessDefinitionId });
        if (!def) {
          throw new Error("El proceso destino seleccionado no existe.");
        }
        const [existingLink] = await this.pool.query(
          `SELECT id FROM process_definition_templates
           WHERE process_definition_id = ? AND template_artifact_id = ? LIMIT 1`,
          [requestedProcessDefinitionId, createdId]
        );
        if (!existingLink?.length) {
          const [linkInsert] = await this.pool.query(
            `INSERT INTO process_definition_templates
              (process_definition_id, template_artifact_id, sort_order, item_mode)
             VALUES (?, ?, 1, ?)`,
            [requestedProcessDefinitionId, createdId, requestedItemMode]
          );
          insertedLinkId = linkInsert?.insertId ?? null;
        } else if (requestedItemMode !== "single") {
          // El link ya existía (p. ej. reintento): respeta el modo solicitado si no es el default.
          await this.pool.query(
            `UPDATE process_definition_templates SET item_mode = ?
             WHERE process_definition_id = ? AND template_artifact_id = ?`,
            [requestedItemMode, requestedProcessDefinitionId, createdId]
          );
        }
      }

      // Si se definieron flujos y el artifact ya está vinculado a configuraciones de proceso,
      // sincroniza inmediatamente fill/signature flow templates desde el meta.yaml recién subido.
      let workflowNotice = "";
      let workflowSyncFailed = false;
      if (hasCustomWorkflows && createdId) {
        try {
          const summary = await this._syncArtifactWorkflowsForTemplateArtifactId(createdId);
          const fillTpls = summary?.fill?.syncedTemplates || 0;
          const sigTpls = summary?.signatures?.syncedTemplates || 0;
          if (fillTpls || sigTpls) {
            workflowNotice = ` Flujos sincronizados (entrega: ${fillTpls}, firmas: ${sigTpls}).`;
          }
        } catch (syncError) {
          console.warn("No se pudieron sincronizar los flujos del artifact:", syncError?.message);
          workflowSyncFailed = true;
          workflowNotice = " Los flujos se guardaron en el meta.yaml pero NO se pudieron sincronizar a la base de datos; vuelve a guardar o re-sincroniza.";
        }
      }

      // Avisos no bloqueantes (sync fallido + autoría: cargos sin puesto hoy) se combinan en __warning.
      const combinedWarning = [
        workflowSyncFailed ? workflowNotice.trim() : "",
        ...authoringWarnings
      ].filter(Boolean).join(" ");

      return {
        id: createdId,
        template_seed_id: templateSeedId,
        owner_person_id: ownerPersonId,
        template_code: templateCode,
        display_name: displayName,
        description,
        storage_version: storageVersion,
        template_scope: templateScope,
        base_object_prefix: baseObjectPrefix,
        available_formats: availableFormats,
        schema_object_key: schemaObjectKey,
        meta_object_key: metaObjectKey,
        content_hash: contentHash,
        is_active: 1,
        workflow_sync_failed: workflowSyncFailed,
        __warning: combinedWarning || undefined,
        __notice: (isEdit
          ? "La plantilla de documento fue actualizada y cargada correctamente en MinIO."
          : "La plantilla de documento fue cargada correctamente en MinIO y registrada en el sistema.") + workflowNotice
      };
    } catch (error) {
      // Rollback en creación: deshace las filas que insertó ESTA llamada y limpia los objetos
      // huérfanos subidos a MinIO. En edición no se limpia MinIO (los objetos pertenecen a un
      // artifact existente que se conserva).
      //
      // El orden es el INVERSO al de creación porque ninguna FK cascadea (todas NO ACTION):
      // vínculo → artifact → deliverable. Antes sólo se borraba el artifact, así que un fallo
      // posterior al INSERT en `deliverables` (p. ej. "El proceso destino seleccionado no
      // existe.") dejaba la fila huérfana; y como el alta busca por `code`, el siguiente intento
      // con el mismo nombre la REUSABA y se quedaba con `owner_process_id` NULL para siempre.
      //
      // Sigue siendo best-effort (cada DELETE traga su error): si el fallo ocurriera después de
      // sincronizar los flujos, las plantillas de flujo colgadas del vínculo lo bloquearían. No
      // hay hoy ningún camino que lance ahí — el sync atrapa sus propios errores.
      if (!isEdit) {
        if (insertedLinkId) {
          await this.pool.query("DELETE FROM process_definition_templates WHERE id = ?", [insertedLinkId]).catch(() => {});
        }
        if (createdId) {
          await this.pool.query("DELETE FROM template_artifacts WHERE id = ?", [createdId]).catch(() => {});
        }
        if (insertedDeliverableId) {
          await this.pool.query("DELETE FROM deliverables WHERE id = ?", [insertedDeliverableId]).catch(() => {});
        }
        if (uploadedToMinio) {
          await removeMinioPrefix(bucket, baseObjectPrefix).catch(() => {});
        }
      }
      throw error;
    } finally {
      fs.rmSync(draftDir, { recursive: true, force: true });
    }
  }
}
