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
// ESTADO DE `saveTemplateArtifactDraft` (actualizado 2026-08-09, fase C CERRADA). El cut #8 la movio
// LITERAL y quedo en 542 lineas con complejidad 164. Hoy es ~150 lineas: validacion, preparacion del
// paquete y una secuencia de pasos que persisten. La logica esta en _resolveDraftOwner,
// _validateAuthoredWorkflows, _materializeDraftFormats, _linkDraftToProcessDefinition,
// _persistDraftEdit y _persistDraftCreation.
//
// COMO SE RESOLVIO LA COMPENSACION. Historia en tres actos, porque explica por que hoy es tan corta.
// Al principio habia cuatro variables (createdId, uploadedToMinio, insertedDeliverableId,
// insertedLinkId) compartidas entre el `try` y el `catch`, y el `catch` tenia que acordarse de
// mirarlas en el orden correcto. Despues cada paso registraba su propio deshacer en una pila y el
// `catch` solo desapilaba. Y desde el sub-paso 3 del §0.8 hay UNA TRANSACCION de verdad alrededor de
// todo lo que toca la base —artifact/deliverable, vinculo y flujo autorado—, asi que el `ROLLBACK`
// sustituye a los tres deshacer de base y **solo queda uno**: el prefijo de MinIO, que se sube ANTES
// y que ninguna transaccion de PostgreSQL puede deshacer.
//
// Efecto lateral bueno de la transaccion, y no era el objetivo: la pila NO apilaba en EDICION, asi
// que una edicion que fallaba al vincular dejaba aplicado el `UPDATE` de `template_artifacts`. Ahora
// tambien se deshace. Ver docs/planes/referencia/patrones-diseno.md §3.1.

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
  authoredWorkflowHasSteps,
  buildWorkflowsDocument,
  collectAuthoredWorkflowIssues,
  normalizeFillSteps,
  normalizeSignatureSteps,
  parseWorkflowPayload,
  workflowHasSteps
} from "./workflows.js";
import { replaceAuthoredFlowForArtifact, copyAuthoredFlowToArtifact, hasFillStepsForArtifact } from "./flowRows.js";
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

// EL PAQUETE YA NO LLEVA `meta.yaml` (sub-paso 8 del §0.8). Aqui se exigia su presencia y ademas
// cuatro regex sobre su contenido (`workflows:`, `fill:`, `signatures:`, `dependencies:`). Retirado
// el fichero entero, lo que queda es la ESTRUCTURA del paquete —schema.json, template/ y una salida
// por formato declarado—, que es lo que el ZIP y el manifiesto necesitan de verdad.
const validatePackagedArtifactDraft = (draftDir, availableFormats) => {
  const schemaPath = path.join(draftDir, "schema.json");
  const templateDir = path.join(draftDir, "template");
  if (!fs.existsSync(schemaPath) || !fs.existsSync(templateDir)) {
    throw new Error("El artifact no cumple la estructura base requerida (schema.json y template/).");
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
    retirePriorPublishedSiblings,
    getCargoCodeMap,
    getUnitTypeNameMap,
    getProcessTargetScope,
    getResolvableCargoIdsByUnit,
    listResolvableCargos,
    getWorkflowReferenceIdSets,
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
    this._retirePriorPublishedSiblings = retirePriorPublishedSiblings;
    this._getCargoCodeMap = getCargoCodeMap;
    this._getUnitTypeNameMap = getUnitTypeNameMap;
    this._getProcessTargetScope = getProcessTargetScope;
    this._getResolvableCargoIdsByUnit = getResolvableCargoIdsByUnit;
    this._listResolvableCargos = listResolvableCargos;
    this._getWorkflowReferenceIdSets = getWorkflowReferenceIdSets;
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
        if (!(await hasFillStepsForArtifact(connection, artifact.id))) {
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
      // `UPDATE ... SET ... FROM`: la forma `UPDATE ... INNER JOIN ... SET` es de MySQL y
      // PostgreSQL la rechaza al ejecutarla. La tabla que se actualiza NO se repite en el FROM;
      // su condicion de union pasa al WHERE. Se evalua contra los valores VIEJOS, asi que buscar
      // por `ta.id = pdt.template_artifact_id` y reasignar esa misma columna es correcto.
      `UPDATE process_definition_templates pdt
          SET template_artifact_id = ?
         FROM template_artifacts ta
         JOIN deliverables d ON d.id = ta.deliverable_id
        WHERE ta.id = pdt.template_artifact_id
          AND pdt.process_definition_id = ?
          AND d.code = ?`,
      [Number(targetArtifactId), Number(definitionId), String(templateCode)]
    );
    // Aquí se re-sincronizaba el flujo del artifact al re-apuntar el vínculo. Retirado con el
    // sub-paso 8 del §0.8: el flujo cuelga del ENTREGABLE, así que re-apuntar el vínculo a otra
    // versión ya trae el flujo de esa versión sin proyectar nada.
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

    // Insertar la versión publicada del fork Y COPIAR SU FLUJO, en una transacción (sub-paso 6 del
    // §0.8). El fork copia MinIO en binario igual que el versionado, y le pasaba lo mismo: el flujo
    // ya no viaja dentro del paquete, así que el entregable bifurcado nacía sin ninguna fila y —al
    // nacer ya `published`— con el gate de publicación esquivado por la puerta de atrás.
    //
    // El orden —copiar ANTES de re-apuntar el vínculo— importaba mientras `copyAuthoredFlowToArtifact`
    // podía leer el flujo del VÍNCULO del origen: el `UPDATE` de abajo mueve justo ese vínculo, así
    // que al revés la búsqueda no habría encontrado nada. Desde el sub-paso 8 el flujo solo cuelga
    // del artifact y el orden ya no decide el resultado; se conserva porque copiar antes de mover
    // sigue siendo lo que se lee mejor.
    const connection = await this.pool.getConnection();
    let newArtifactId;
    try {
      await connection.beginTransaction();
      const [taIns] = await connection.query(
        `INSERT INTO template_artifacts
           (storage_version, lifecycle_state, base_object_prefix, available_formats, schema_object_key,
            content_hash, deliverable_id, is_active)
         VALUES ('1.0.0', 'published', ?, ?, ?, ?, ?, 1)`,
        [
          newPrefix, JSON.stringify(remappedFormats || {}),
          `${newPrefix}schema.json`, src.content_hash, newDeliverableId
        ]
      );
      newArtifactId = Number(taIns.insertId);
      await copyAuthoredFlowToArtifact(connection, {
        sourceArtifactId: srcId,
        targetArtifactId: newArtifactId,
        displayName: src.display_name,
      });
      await connection.commit();
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }

    // Re-apuntar el enlace de la config destino (del original al fork).
    await this.pool.query(
      "UPDATE process_definition_templates SET template_artifact_id = ? WHERE process_definition_id = ? AND template_artifact_id = ?",
      [newArtifactId, defId, srcId]
    );

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

    // Readiness de publicación de la plantilla (≥1 paso de entrega) — se cuenta sobre la BASE, y antes de
    // abrir la transacción, igual que cuando la cuenta venía de MinIO (sub-paso 4 del §0.8).
    // routed NO autora flujo (se define al enviar): se omite el readiness de entrega.
    if (String(linkRows[0].item_mode) !== "routed") {
      if (!(await hasFillStepsForArtifact(this.pool, tplId))) {
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

      // 1.12 — y AHORA el resto de borradores de la config, igual que hace el camino del CRUD
      // (`tableHooks.js:605`). Activar una configuración PUBLICA sus plantillas en borrador: esa es la
      // semántica del modelo ("activa la config + publica la plantilla"), no un detalle del CRUD. Sin
      // esto, un entregable añadido al borrador de configuración durante la actualización guiada se
      // colaba dentro de una config ACTIVA todavía en `draft`.
      //
      // Va DESPUÉS del UPDATE de arriba y no lo pisa: la consulta filtra por `lifecycle_state = 'draft'`
      // y `tplId` ya está publicada, así que la dependencia del comentario anterior (publicar la suya
      // primero para que pase el check de artefactos ACTIVOS) queda intacta —
      // `publishDraftTemplatesForDefinition` no toca `is_active`.
      //
      // Lee MinIO dentro de la transacción abierta (readiness del meta.yaml). Es lo mismo que ya hace
      // el camino del CRUD desde `beforeUpdateTx`, y es el precio de que publicar y activar sean
      // atómicos: si un borrador no está listo, esto lanza y NO queda nada a medias.
      await this.publishDraftTemplatesForDefinition(cfgId, connection);

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
      // `defaults.yaml` NO ES UN FÓSIL, y por eso se conserva tal cual (§0.6, cierre del censo).
      // El censo lo listaba como «vivo pero fuera del CRUD», y las dos mitades siguen siendo ciertas:
      // se copia entero a `data.yaml` del paquete y es el payload de datos con el que se renderiza
      // (`brand_rgb`, `palette`, `layout*`, `bibliography_*`, los tokens de firma), pero el usuario no
      // puede tocar ninguna de esas claves desde la aplicación.
      // La decisión es NO cablearlo aquí: sus claves son campos de formulario, y modelar los campos
      // del formulario es justo lo que el §0.8 dejó fuera de alcance a propósito (decisión 3 — no
      // tienen tabla, viven en el `schema.json` de MinIO). Cablear estas y no las demás sería inventar
      // un segundo sitio donde vive un campo. Su dueño natural es el generador del §0.4.
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

    return { availableFormats };
  }

  // Materializa el vinculo de la plantilla con su configuracion de proceso destino.
  //
  // Devuelve el id del vinculo SOLO si lo inserto esta llamada, y null si no habia destino o si el
  // vinculo ya existia. Eso era, hasta el sub-paso 3 del §0.8, lo que permitia compensarlo a mano
  // sin borrar un vinculo ajeno; ahora corre dentro de la transaccion de `saveTemplateArtifactDraft`
  // y lo deshace el `ROLLBACK`. Se sigue devolviendo porque distingue "creado" de "reusado", que es
  // informacion de la operacion, no andamiaje.
  //
  // El requisito de vinculo obligatorio al crear ya se valido en el fail-fast de mas arriba; en
  // edicion el vinculo previo se conserva. Aqui solo se materializa si llega un destino.
  async _linkDraftToProcessDefinition({
    connection = this.pool,
    processDefinitionId = null,
    templateArtifactId = null,
    itemMode = "single"
  } = {}) {
    const definitionId = processDefinitionId ? Number(processDefinitionId) : null;
    if (!definitionId || !templateArtifactId) {
      return null;
    }

    const def = await this._getByKeys("process_definition_versions", { id: definitionId });
    if (!def) {
      throw new Error("El proceso destino seleccionado no existe.");
    }

    const [existingLink] = await connection.query(
      `SELECT id FROM process_definition_templates
       WHERE process_definition_id = ? AND template_artifact_id = ? LIMIT 1`,
      [definitionId, templateArtifactId]
    );

    if (!existingLink?.length) {
      const [linkInsert] = await connection.query(
        `INSERT INTO process_definition_templates
          (process_definition_id, template_artifact_id, sort_order, item_mode)
         VALUES (?, ?, 1, ?)`,
        [definitionId, templateArtifactId, itemMode]
      );
      return linkInsert?.insertId ?? null;
    }

    if (itemMode !== "single") {
      // El link ya existía (p. ej. reintento): respeta el modo solicitado si no es el default.
      await connection.query(
        `UPDATE process_definition_templates SET item_mode = ?
         WHERE process_definition_id = ? AND template_artifact_id = ?`,
        [itemMode, definitionId, templateArtifactId]
      );
    }
    return null;
  }

  // Persistencia de una EDICIÓN. Los objetos de MinIO ya existían antes de esta llamada y se
  // conservan pase lo que pase; los dos UPDATE los deshace el `ROLLBACK` de la transacción que abre
  // `saveTemplateArtifactDraft`. Devuelve el id, que no cambia.
  async _persistDraftEdit({ connection = this.pool, existingArtifact, almacenamiento, identidad }) {
    const artifactId = Number(existingArtifact.id);

    await connection.query(
      `UPDATE template_artifacts
       SET base_object_prefix = ?,
           available_formats = ?,
           schema_object_key = ?,
           content_hash = ?,
           is_active = 1
       WHERE id = ?`,
      [
        almacenamiento.baseObjectPrefix,
        JSON.stringify(almacenamiento.availableFormats),
        almacenamiento.schemaObjectKey,
        almacenamiento.contentHash,
        artifactId
      ]
    );

    if (existingArtifact?.deliverable_id) {
      await connection.query(
        `UPDATE deliverables
         SET display_name = ?, description = ?, template_scope = ?, template_seed_id = ?, owner_person_id = ?
         WHERE id = ?`,
        [
          identidad.displayName,
          identidad.description,
          identidad.templateScope,
          identidad.templateSeedId,
          identidad.ownerPersonId,
          existingArtifact.deliverable_id
        ]
      );
    }

    return artifactId;
  }

  // Persistencia de una CREACIÓN. Modelo entregable/ediciones: el `deliverable` se crea (o se REUSA)
  // PRIMERO —su dueño es la pareja (proceso, variación) de la configuración destino— y luego se
  // inserta la edición con su `deliverable_id`. Devuelve el id del `template_artifact` nuevo.
  //
  // No compensa nada: corre dentro de la transacción de `saveTemplateArtifactDraft`, así que un
  // fallo posterior lo deshace el `ROLLBACK`. Y el `deliverable` REUSADO (ya existía con el mismo
  // `code`, de una edición anterior) no se toca, porque tampoco se inserta.
  async _persistDraftCreation({ connection = this.pool, processDefinitionId, almacenamiento, identidad }) {
    let ownerProcessId = null;
    let ownerVariationKey = null;
    const destDefId = processDefinitionId ? Number(processDefinitionId) : null;
    if (destDefId) {
      const [dRows] = await connection.query(
        "SELECT process_id, variation_key FROM process_definition_versions WHERE id = ? LIMIT 1",
        [destDefId]
      );
      ownerProcessId = dRows?.[0]?.process_id ?? null;
      ownerVariationKey = dRows?.[0]?.variation_key ?? null;
    }

    const [delivExisting] = await connection.query(
      "SELECT id FROM deliverables WHERE code = ? LIMIT 1",
      [identidad.templateCode]
    );
    let deliverableId = delivExisting?.[0]?.id;
    if (!deliverableId) {
      const [delivIns] = await connection.query(
        `INSERT INTO deliverables
           (code, display_name, description, owner_process_id, owner_variation_key, template_scope, template_seed_id, owner_person_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          identidad.templateCode,
          identidad.displayName,
          identidad.description,
          ownerProcessId,
          ownerVariationKey,
          identidad.templateScope,
          identidad.templateSeedId,
          identidad.ownerPersonId
        ]
      );
      deliverableId = delivIns.insertId;
    }

    const [result] = await connection.query(
      `INSERT INTO template_artifacts (
        storage_version,
        lifecycle_state,
        base_object_prefix,
        available_formats,
        schema_object_key,
        content_hash,
        deliverable_id,
        is_active
      ) VALUES (?, 'draft', ?, ?, ?, ?, ?, 1)`,
      [
        almacenamiento.storageVersion,
        almacenamiento.baseObjectPrefix,
        JSON.stringify(almacenamiento.availableFormats),
        almacenamiento.schemaObjectKey,
        almacenamiento.contentHash,
        deliverableId
      ]
    );
    return result.insertId;
  }

  // TODO lo que un borrador escribe en la base, en UNA transacción: la edición (`template_artifacts`
  // + `deliverables`), el vínculo a la configuración destino y el flujo autorado.
  //
  // La abre el sub-paso 3 del §0.8 y no es un adorno. Antes había compensación manual con pila de
  // deshacer, y el flujo nuevo NO se podía escribir así: cuelga del artifact por FK, así que un
  // fallo posterior dejaba o un artifact sin su flujo o un flujo apuntando a un artifact que la
  // compensación acababa de borrar. Con `ROLLBACK` los tres efectos son uno solo.
  //
  // Efecto lateral bueno, y no era el objetivo: la pila de deshacer NO apilaba en EDICIÓN, así que
  // una edición que fallaba al vincular dejaba aplicado el `UPDATE` de `template_artifacts`. Ahora
  // también se deshace.
  //
  // Lo que queda FUERA a propósito: la subida a MinIO (ocurre antes y ninguna transacción de
  // PostgreSQL la revierte; la compensa quien llama) y el sync de flujos (necesita ver el vínculo ya
  // COMMITEADO, porque va por el pool y atrapa sus propios errores).
  async _persistDraftToDatabase({
    isEdit,
    existingArtifact,
    almacenamiento,
    identidad,
    processDefinitionId,
    itemMode,
    workflowsDocument
  }) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();

      const artifactId = isEdit
        ? await this._persistDraftEdit({ connection, existingArtifact, almacenamiento, identidad })
        : await this._persistDraftCreation({ connection, processDefinitionId, almacenamiento, identidad });

      // Vínculo a proceso destino. Obligatorio para ejecutores (GestorEjecucionProcesos): su
      // plantilla debe colgar de un proceso ya definido o de 'default'. Opcional para diseñadores.
      // El requisito al crear ya se validó en el fail-fast; en edición el vínculo previo se conserva.
      await this._linkDraftToProcessDefinition({
        connection,
        processDefinitionId,
        templateArtifactId: artifactId,
        itemMode
      });

      // ESCRITURA DOBLE: la otra copia del flujo, la que vive EN LA BASE. Sale del mismo
      // `workflowsDocument` que ya se serializó al `meta.yaml`.
      if (workflowsDocument && artifactId) {
        await this._persistAuthoredFlow({
          connection,
          artifactId,
          displayName: identidad.displayName,
          workflowsDocument
        });
      }

      await connection.commit();
      return artifactId;
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  }

  // LA ÚNICA COPIA DEL FLUJO AUTORADO (sub-paso 8 del §0.8): las filas colgadas de
  // `template_artifact_id`. Ya no hay `meta.yaml` con el que divergir ni sync que las duplique en
  // cada vínculo.
  //
  // Las DOS decisiones de "¿hay flujo que escribir?" las toma `authoredWorkflowHasSteps`, que es
  // literalmente el predicado del sync menos su término `sync_mode` —la clave del `meta.yaml` que
  // autorizaba la proyección y que ya no existe—. Ver su comentario en `workflows.js`: cambiarlo por
  // una condición escrita a mano aquí es justo lo que dejaría de escribir el flujo sin decir nada.
  async _persistAuthoredFlow({ connection, artifactId, displayName, workflowsDocument }) {
    const fill = workflowsDocument?.workflows?.fill || {};
    const signatures = workflowsDocument?.workflows?.signatures || {};
    const [cargoCodeMap, unitTypeNameMap] = await Promise.all([
      this._getCargoCodeMap(connection),
      this._getUnitTypeNameMap(connection)
    ]);
    return replaceAuthoredFlowForArtifact(connection, {
      artifactId,
      displayName,
      fillSteps: authoredWorkflowHasSteps(fill)
        ? normalizeFillSteps(fill, { cargoCodeMap })
        : [],
      // `normalizeSignatureSteps` DESCARTA en silencio los firmantes `cargo_in_scope` sin cargo
      // resoluble y los pasos que se quedan sin ninguno (`workflows.js:9-11`). Se conserva tal cual:
      // convertirlo en error de autoría sería mejor, pero es otro cambio y §0.8 «Riesgos» le reserva
      // commit y golden propios. Al escribir con el mismo normalizador que el sync, las dos copias
      // descartan exactamente lo mismo.
      signatureSteps: authoredWorkflowHasSteps(signatures)
        ? normalizeSignatureSteps(signatures, { cargoCodeMap, unitTypeNameMap })
        : []
    });
  }

  // Normaliza la entrada y aplica TODAS las guardas de admision, en bloque y antes de tocar disco o
  // MinIO. Es fail-fast a proposito: cuando esto devuelve, el borrador es admisible y el resto de
  // `saveTemplateArtifactDraft` ya no vuelve a validar entrada.
  //
  // EL ORDEN DE LAS GUARDAS ES CONTRATO, no estilo: esta caracterizado en zzz_artifact_draft y hay
  // mensajes que el frontend distingue. No lo reordenes.
  async _resolveDraftRequest(artifactId, data, files) {
    const isEdit = artifactId !== null && artifactId !== undefined && artifactId !== "";
    const displayName = String(data.display_name || "").trim();
    const ownerCedula = String(data.owner_cedula || "").trim();

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
    let templateSeedId = data.template_seed_id ? Number(data.template_seed_id) : null;

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

    if (!isEdit) {
      // Al crear, siempre se exige al menos un documento de referencia (word/excel/pdf/pptx).
      if (!REFERENCE_DOC_FORMATS.some((format) => uploadedFiles[format])) {
        throw new Error("Debes adjuntar al menos un documento de referencia (PDF, Word, Excel o PowerPoint).");
      }
      // Toda plantilla single/replicated debe definir un flujo de entrega con al menos un paso
      // (fail-fast antes del upload). 'routed' NO autora flujo: se define al enviar (runtime).
      if (requestedItemMode !== "routed" && !workflowHasSteps(parseWorkflowPayload(data.fill_workflow))) {
        throw new Error("Debes definir al menos un paso en el flujo de entrega.");
      }
    } else if (
      !templateSeedId
      && !Object.values(uploadedFiles).some(Boolean)
      && !Object.keys(existingAvailableFormats).length
    ) {
      throw new Error("Selecciona un seed o sube al menos un archivo para actualizar el borrador.");
    }

    return {
      isEdit,
      existingArtifact,
      displayName,
      description: String(data.description || "").trim() || null,
      ownerCedula,
      requestedOwnerPersonId: normalizeNumericId(data.owner_person_id),
      templateSeedId,
      uploadedFiles,
      requestedItemMode,
      existingAvailableFormats
    };
  }

  // Escribe en `draftDir` los DOS ficheros que acompanan al contenido —schema.json y manifest.json—,
  // valida el paquete y calcula su hash. Todo en disco: NO toca base de datos ni MinIO, asi que si
  // lanza no hay nada que compensar. (Eran tres hasta el sub-paso 8 del §0.8: el `meta.yaml` ya no
  // se emite.)
  //
  // EL ORDEN IMPORTA y es la razon de que esto sea un solo metodo: el manifiesto se escribe DESPUES
  // del content_hash (para no alterarlo) pero ANTES del upload (para que viaje con el paquete).
  async _writeDraftPackage({ draftDir, data, availableFormats, identidad, existingArtifactId }) {
    const { templateScope } = identidad;

    // Campos definidos desde la web (editor de schema). Si no llegan o vienen rotos, se conserva {}.
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

    // Flujos definidos desde el editor web (fill/signatures). Si no llegan, se usa el contrato vacío.
    const fillWorkflow = parseWorkflowPayload(data.fill_workflow);
    const signatureWorkflow = parseWorkflowPayload(data.signature_workflow);
    const hasCustomWorkflows = workflowHasSteps(fillWorkflow) || workflowHasSteps(signatureWorkflow);
    // Avisos no bloqueantes de autoría (p. ej. cargo sin puesto hoy en la ubicación): se acumulan para
    // informarlos en la respuesta, sin abortar el guardado. La validación del contrato de flujo se hace
    // AQUÍ, en autoría, y no solo al vincular: falla rápido y claro antes de escribir nada, en vez de
    // degradar silenciosamente en la normalización.
    const authoringWarnings = hasCustomWorkflows
      ? await this._validateAuthoredWorkflows({
          fillWorkflow,
          signatureWorkflow,
          templateScope,
          processDefinitionId: data.process_definition_id,
          existingArtifactId
        })
      : [];

    // EL `meta.yaml` YA NO SE ESCRIBE (sub-paso 8 del §0.8, decisión 2 del plan). El documento del
    // flujo se sigue construyendo —es lo que el escritor directo normaliza e inserta, ya dentro de la
    // transacción— pero no se serializa a ningún sitio.
    //
    // El commit anterior le quitó la sección `workflows:`, que era la única que no era copia literal
    // de una columna de `template_artifacts` / `deliverables`. Lo que quedaba —nombre, versión,
    // código, scope, descripción y seed_code— es exactamente eso: seis copias. Conservarlo generado
    // obligaría además a rechazarlo explícitamente al re-subir un ZIP, o la grieta vuelve.
    const workflowsDocument = hasCustomWorkflows
      ? buildWorkflowsDocument({ fillWorkflow, signatureWorkflow })
      : null;

    validatePackagedArtifactDraft(draftDir, availableFormats);

    const contentHash = hashDirectory(draftDir);
    fs.writeFileSync(
      path.join(draftDir, "manifest.json"),
      `${JSON.stringify(buildProtectedManifest(draftDir, EDITABLE_CONTENT_SUBPATH), null, 2)}\n`,
      "utf8"
    );

    return { contentHash, hasCustomWorkflows, authoringWarnings, workflowsDocument };
  }

  async saveTemplateArtifactDraft(artifactId, data = {}, files = {}, actor = {}) {
    this.ensurePool();

    const {
      isEdit,
      existingArtifact,
      displayName,
      description,
      ownerCedula,
      requestedOwnerPersonId,
      templateSeedId,
      uploadedFiles,
      requestedItemMode,
      existingAvailableFormats
    } = await this._resolveDraftRequest(artifactId, data, files);

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
    const { availableFormats } = await this._materializeDraftFormats({
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
    const { contentHash, hasCustomWorkflows, authoringWarnings, workflowsDocument } = await this._writeDraftPackage({
      draftDir,
      data,
      availableFormats,
      identidad: { templateScope },
      existingArtifactId: isEdit ? existingArtifact?.id : null
    });

    let createdId = isEdit ? Number(existingArtifact.id) : null;

    // La ÚNICA compensación que queda. Todo lo que toca la base va en una transacción (más abajo) y
    // lo deshace el `ROLLBACK`; la subida a MinIO ocurre ANTES y ninguna transacción de PostgreSQL
    // puede revertirla, así que se deshace a mano. Solo en CREACIÓN: en edición los objetos
    // pertenecen a un artifact que se conserva y borrar su prefijo sería destruir la versión previa.
    let prefijoSubidoAMinio = null;

    try {
      await uploadDirectoryToMinio(bucket, baseObjectPrefix, draftDir);
      if (!isEdit) prefijoSubidoAMinio = baseObjectPrefix;

      // El corte en dos objetos NO es cosmético: es el modelo. El ALMACENAMIENTO vive en
      // `template_artifacts` (una fila por edición) y la IDENTIDAD en `deliverables` (una por
      // entregable, compartida por sus ediciones). Cada método toca la tabla que le toca.
      const almacenamiento = {
        storageVersion, baseObjectPrefix, availableFormats, schemaObjectKey, contentHash
      };
      const identidad = {
        templateCode, displayName, description, templateScope, templateSeedId, ownerPersonId
      };

      // Todo lo que va a la base, en UNA transacción (ver `_persistDraftToDatabase`).
      createdId = await this._persistDraftToDatabase({
        isEdit,
        existingArtifact,
        almacenamiento,
        identidad,
        processDefinitionId: data.process_definition_id,
        itemMode: requestedItemMode,
        workflowsDocument
      });

      // Aquí se proyectaba el flujo del `meta.yaml` a cada vínculo, con su aviso y su bandera
      // `workflow_sync_failed`. Retirado con el sub-paso 8 del §0.8: el flujo se escribe ahora en la
      // MISMA transacción que la edición y el vínculo (`_persistDraftToDatabase`), así que «se
      // guardó pero no se pudo sincronizar» dejó de ser un estado posible — o se guarda todo o no se
      // guarda nada, y el error sube en vez de convertirse en un aviso.

      // Avisos no bloqueantes de autoría (cargos sin puesto hoy en la ubicación).
      const combinedWarning = authoringWarnings.filter(Boolean).join(" ");

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
        content_hash: contentHash,
        is_active: 1,
        __warning: combinedWarning || undefined,
        __notice: isEdit
          ? "La plantilla de documento fue actualizada y cargada correctamente en MinIO."
          : "La plantilla de documento fue cargada correctamente en MinIO y registrada en el sistema."
      };
    } catch (error) {
      // Lo de la base ya lo deshizo el `ROLLBACK`. Aquí solo queda el prefijo de MinIO, que se subió
      // antes de abrir la transacción. Best-effort a propósito: si borrarlo falla, el error que se
      // relanza tiene que seguir siendo el ORIGINAL, no el de la limpieza.
      if (prefijoSubidoAMinio) {
        try {
          await removeMinioPrefix(bucket, prefijoSubidoAMinio);
        } catch {
          // Deliberado: se pierde el fallo al compensar, no el original.
        }
      }
      throw error;
    } finally {
      fs.rmSync(draftDir, { recursive: true, force: true });
    }
  }
}
