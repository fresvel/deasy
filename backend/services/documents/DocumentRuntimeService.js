import fs from "fs";
import path from "path";
import yaml from "js-yaml";

import { getMariaDBPool } from "../../config/mariadb.js";
import { getMinioObjectStream, listMinioObjects } from "../storage/minio_service.js";

const SERVICE_DIR = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(SERVICE_DIR, "..", "..", "..");
const PATTERNS_DIR = path.join(REPO_ROOT, "tools", "templates", "patterns");

const streamToBuffer = (stream) => new Promise((resolve, reject) => {
  const chunks = [];
  stream.on("data", (chunk) => chunks.push(chunk));
  stream.on("error", reject);
  stream.on("end", () => resolve(Buffer.concat(chunks)));
});

const readMinioObjectAsText = async (bucket, objectName) => {
  const stream = await getMinioObjectStream(bucket, objectName);
  const buffer = await streamToBuffer(stream);
  return buffer.toString("utf8");
};

const parseStructuredText = (content, objectName = "object") => {
  const suffix = path.extname(objectName).toLowerCase();
  try {
    if (suffix === ".json") {
      return JSON.parse(content);
    }
    return yaml.load(content) || {};
  } catch (error) {
    throw new Error(`No se pudo interpretar ${objectName}: ${error.message}`);
  }
};

const loadObjectIfExists = async (bucket, objectName) => {
  try {
    const content = await readMinioObjectAsText(bucket, objectName);
    return {
      content,
      parsed: parseStructuredText(content, objectName),
      objectName,
    };
  } catch (error) {
    if (error?.code === "NoSuchKey" || /Not Found/i.test(error?.message || "")) {
      return null;
    }
    throw error;
  }
};

const normalizeObjectName = (value) => String(value || "").replace(/^\/+/, "");
const normalizeObjectPrefix = (value) => `${normalizeObjectName(value).replace(/\/?$/, "/")}`;
const normalizeArtifactRelativePath = (value) =>
  String(value || "").trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");

const resolveBaseDataObjectNames = (artifact) => {
  const prefix = normalizeObjectPrefix(artifact.base_object_prefix || "");
  return [
    `${prefix}data.json`,
    `${prefix}data.yaml`,
    `${prefix}data.yml`,
  ];
};

const resolveRenderSourceConfig = ({ artifactContext, meta }) => {
  const renderEngine = String(artifactContext?.render_engine || "").trim() || "jinja2";
  const systemMode = (((meta || {}).modes || {}).system || {})[renderEngine];
  const relativePath = normalizeArtifactRelativePath(systemMode?.path);

  if (!relativePath) {
    throw new Error(
      `El artifact no declara una fuente tecnica utilizable para el render_engine ${renderEngine}.`
    );
  }

  const objectPrefix = `${normalizeObjectPrefix(artifactContext?.base_object_prefix || "")}${relativePath}/`;
  return {
    renderEngine,
    relativePath,
    objectPrefix,
  };
};

const resolvePatternPath = (patternRef) => {
  const normalized = String(patternRef || "").trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!normalized) {
    return "";
  }
  const candidates = normalized.endsWith(".yaml")
    ? [normalized]
    : [`${normalized}.yaml`, path.posix.join(normalized, "pattern.yaml")];
  for (const candidate of candidates) {
    const absolutePath = path.join(PATTERNS_DIR, candidate);
    if (fs.existsSync(absolutePath)) {
      return absolutePath;
    }
  }
  return "";
};

const collectSchemaFieldMap = (node, fieldMap = new Map()) => {
  if (!node || typeof node !== "object") {
    return fieldMap;
  }

  if (typeof node["x-deasy-field-code"] === "string" && node["x-deasy-field-code"].trim()) {
    fieldMap.set(node["x-deasy-field-code"].trim(), {
      dataKey: typeof node["x-deasy-data-key"] === "string" ? node["x-deasy-data-key"].trim() : "",
      schema: node,
    });
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectSchemaFieldMap(item, fieldMap);
    }
    return fieldMap;
  }

  for (const value of Object.values(node)) {
    collectSchemaFieldMap(value, fieldMap);
  }
  return fieldMap;
};

const setNestedValue = (target, dottedPath, value) => {
  const parts = String(dottedPath || "").split(".").filter(Boolean);
  if (!parts.length) {
    return;
  }
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    if (!cursor[part] || typeof cursor[part] !== "object" || Array.isArray(cursor[part])) {
      cursor[part] = {};
    }
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
};

const buildVisibleName = (row) => `${row.first_name || ""} ${row.last_name || ""}`.trim() || null;

const coerceRuntimeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
};

const mergeRuntimePayload = ({ basePayload, schema, pattern, runtimePayload }) => {
  const merged = {
    ...(basePayload && typeof basePayload === "object" ? basePayload : {}),
  };
  const fieldMap = collectSchemaFieldMap(schema || {});
  const runtimeFields = (((pattern || {}).pattern || {}).compiler_contract || {}).runtime_fields || [];

  for (const runtimeField of runtimeFields) {
    const slot = runtimeField.slot;
    const slotValues = (((runtimePayload || {}).signatures || {})[slot]) || null;
    if (!slot || !slotValues || typeof slotValues !== "object") {
      continue;
    }

    for (const [valueKey, fieldRefKey] of [
      ["token", "token_field_ref"],
      ["nombre", "name_field_ref"],
      ["cargo", "role_field_ref"],
      ["fecha", "date_field_ref"],
    ]) {
      const fieldRef = runtimeField[fieldRefKey];
      const value = slotValues[valueKey];
      if (!fieldRef || value === undefined) {
        continue;
      }
      const fieldInfo = fieldMap.get(fieldRef);
      if (fieldInfo?.dataKey) {
        merged[fieldInfo.dataKey] = value;
      }
      setNestedValue(merged, fieldRef, value);
    }
  }

  return merged;
};

const getDocumentVersionArtifactContext = async (connection, documentVersionId) => {
  const [rows] = await connection.query(
    `SELECT
       dv.id,
       dv.document_id,
       dv.version,
       dv.template_artifact_id,
       dv.payload_object_path,
       dv.working_file_path,
       dv.final_file_path,
       dv.format,
       dv.render_engine,
       dv.status,
       d.owner_person_id,
       d.task_item_id,
       ta.template_code,
       ta.display_name,
       ta.bucket,
       ta.base_object_prefix,
       ta.available_formats,
       ta.schema_object_key,
       ta.meta_object_key,
       ta.artifact_origin
     FROM document_versions dv
     INNER JOIN documents d ON d.id = dv.document_id
     LEFT JOIN template_artifacts ta ON ta.id = dv.template_artifact_id
     WHERE dv.id = ?
     LIMIT 1`,
    [documentVersionId]
  );
  return rows?.[0] || null;
};

const getSignatureRuntimeRows = async (connection, documentVersionId) => {
  const [rows] = await connection.query(
    `SELECT
       sr.id,
       sr.assigned_person_id,
       sr.is_manual,
       sr.created_at,
       sfs.step_order,
       p.first_name,
       p.last_name,
       p.token,
       c.name AS step_cargo_name
     FROM signature_requests sr
     INNER JOIN signature_flow_instances sfi ON sfi.id = sr.instance_id
     INNER JOIN signature_flow_steps sfs ON sfs.id = sr.step_id
     LEFT JOIN persons p ON p.id = sr.assigned_person_id
     LEFT JOIN cargos c ON c.id = sfs.required_cargo_id
     WHERE sfi.document_version_id = ?
     ORDER BY sfs.step_order ASC, sr.id ASC`,
    [documentVersionId]
  );
  return rows || [];
};

const buildSignatureRuntimePayload = ({ meta, pattern, signatureRows }) => {
  const payload = { signatures: {} };
  const runtimeFields = (((pattern || {}).pattern || {}).compiler_contract || {}).runtime_fields || [];
  const metaAnchors = (((meta || {}).workflows || {}).signatures || {}).anchors || [];
  const metaSteps = (((meta || {}).workflows || {}).signatures || {}).steps || [];
  const rowsByStepOrder = new Map();

  for (const row of signatureRows || []) {
    const order = Number(row.step_order);
    if (!rowsByStepOrder.has(order)) {
      rowsByStepOrder.set(order, []);
    }
    rowsByStepOrder.get(order).push(row);
  }

  for (const runtimeField of runtimeFields) {
    const slot = runtimeField.slot;
    const tokenFieldRef = runtimeField.token_field_ref;
    if (!slot || !tokenFieldRef) {
      continue;
    }

    const anchorCodes = metaAnchors
      .filter((anchor) => anchor?.placement?.token_field_ref === tokenFieldRef)
      .map((anchor) => anchor.code)
      .filter(Boolean);

    const step = metaSteps.find((candidate) => {
      const refs = Array.isArray(candidate?.anchor_refs) ? candidate.anchor_refs : [];
      return refs.some((anchorRef) => anchorCodes.includes(anchorRef));
    });

    if (!step?.order) {
      continue;
    }

    const candidateRows = rowsByStepOrder.get(Number(step.order)) || [];
    const row = candidateRows.find((item) => item.assigned_person_id && item.token) || candidateRows[0];
    if (!row) {
      continue;
    }

    payload.signatures[slot] = {
      token: row.token ? `!-${row.token}-!` : null,
      nombre: buildVisibleName(row),
      cargo: row.step_cargo_name || null,
      fecha: coerceRuntimeDate(row.created_at),
      assigned_person_id: row.assigned_person_id ? Number(row.assigned_person_id) : null,
      step_order: Number(step.order),
      is_manual: Boolean(row.is_manual),
    };
  }

  return payload;
};

const loadPatternForMeta = (meta) => {
  const patternRef = (((meta || {}).workflows || {}).signatures || {}).pattern_ref;
  if (!patternRef) {
    return null;
  }
  const patternPath = resolvePatternPath(patternRef);
  if (!patternPath) {
    throw new Error(`No se encontró el pattern_ref declarado por el artifact: ${patternRef}`);
  }
  return {
    path: patternPath,
    document: yaml.load(fs.readFileSync(patternPath, "utf8")) || {},
    ref: patternRef,
  };
};

export class DocumentRuntimeService {
  constructor({ pool = getMariaDBPool() } = {}) {
    this.pool = pool;
  }

  async loadArtifactSourceDocuments(artifactContext) {
    if (!artifactContext?.bucket || !artifactContext?.meta_object_key || !artifactContext?.schema_object_key) {
      throw new Error("La document_version no tiene un artifact técnico completo asociado.");
    }

    const bucket = artifactContext.bucket;
    const metaObject = await loadObjectIfExists(bucket, normalizeObjectName(artifactContext.meta_object_key));
    const schemaObject = await loadObjectIfExists(bucket, normalizeObjectName(artifactContext.schema_object_key));

    if (!metaObject?.parsed || !schemaObject?.parsed) {
      throw new Error("No se pudo cargar meta.yaml o schema.json del artifact.");
    }

    let dataObject = null;
    for (const objectName of resolveBaseDataObjectNames(artifactContext)) {
      dataObject = await loadObjectIfExists(bucket, normalizeObjectName(objectName));
      if (dataObject?.parsed) {
        break;
      }
    }

    return {
      meta: metaObject.parsed,
      schema: schemaObject.parsed,
      baseData: dataObject?.parsed || {},
      metaObjectKey: metaObject.objectName,
      schemaObjectKey: schemaObject.objectName,
      dataObjectKey: dataObject?.objectName || null,
    };
  }

  async loadArtifactRenderSource(artifactContext, meta) {
    if (!artifactContext?.bucket || !artifactContext?.base_object_prefix) {
      throw new Error("La document_version no tiene un prefijo base de artifact resoluble.");
    }

    const renderSource = resolveRenderSourceConfig({ artifactContext, meta });
    const objectNames = await listMinioObjects(artifactContext.bucket, renderSource.objectPrefix, true);
    const sourceFiles = objectNames
      .filter((objectName) => objectName.startsWith(renderSource.objectPrefix))
      .map((objectName) => ({
        objectName,
        relativePath: objectName.slice(renderSource.objectPrefix.length),
      }))
      .filter((item) => item.relativePath);

    if (!sourceFiles.length) {
      throw new Error(
        `No se encontraron archivos del artifact bajo ${renderSource.objectPrefix}.`
      );
    }

    const preferredEntryCandidates = [
      "main.tex.j2",
      "main.j2",
      "index.tex.j2",
      "index.j2",
    ];

    const entryFile = preferredEntryCandidates
      .map((candidate) => sourceFiles.find((item) => item.relativePath === candidate))
      .find(Boolean) || sourceFiles[0];

    return {
      bucket: artifactContext.bucket,
      renderEngine: renderSource.renderEngine,
      relativePath: renderSource.relativePath,
      objectPrefix: renderSource.objectPrefix,
      entryObjectKey: entryFile?.objectName || null,
      fileCount: sourceFiles.length,
      files: sourceFiles,
    };
  }

  async buildDocumentCompilationInput(documentVersionId, externalConnection = null) {
    const connection = externalConnection || await this.pool.getConnection();
    const shouldRelease = !externalConnection;

    try {
      const artifactContext = await getDocumentVersionArtifactContext(connection, documentVersionId);
      if (!artifactContext) {
        throw new Error(`No existe la document_version ${documentVersionId}.`);
      }

      const artifactDocuments = await this.loadArtifactSourceDocuments(artifactContext);
      const artifactRenderSource = await this.loadArtifactRenderSource(
        artifactContext,
        artifactDocuments.meta
      );
      const pattern = loadPatternForMeta(artifactDocuments.meta);
      const signatureRows = await getSignatureRuntimeRows(connection, documentVersionId);
      const runtimePayload = pattern
        ? buildSignatureRuntimePayload({
            meta: artifactDocuments.meta,
            pattern: pattern.document,
            signatureRows,
          })
        : {};

      const mergedPayload = pattern
        ? mergeRuntimePayload({
            basePayload: artifactDocuments.baseData,
            schema: artifactDocuments.schema,
            pattern: pattern.document,
            runtimePayload,
          })
        : {
            ...(artifactDocuments.baseData && typeof artifactDocuments.baseData === "object"
              ? artifactDocuments.baseData
              : {}),
          };

      return {
        documentVersionId: Number(documentVersionId),
        artifact: {
          id: artifactContext.template_artifact_id ? Number(artifactContext.template_artifact_id) : null,
          templateCode: artifactContext.template_code || null,
          displayName: artifactContext.display_name || null,
          bucket: artifactContext.bucket || null,
          baseObjectPrefix: artifactContext.base_object_prefix || null,
          format: artifactContext.format || null,
          renderEngine: artifactContext.render_engine || null,
          artifactOrigin: artifactContext.artifact_origin || null,
        },
        sources: {
          metaObjectKey: artifactDocuments.metaObjectKey,
          schemaObjectKey: artifactDocuments.schemaObjectKey,
          dataObjectKey: artifactDocuments.dataObjectKey,
          patternRef: pattern?.ref || null,
          patternPath: pattern?.path || null,
          renderSourcePrefix: artifactRenderSource.objectPrefix,
          renderSourceEntryObjectKey: artifactRenderSource.entryObjectKey,
        },
        renderSource: artifactRenderSource,
        schema: artifactDocuments.schema,
        meta: artifactDocuments.meta,
        baseData: artifactDocuments.baseData,
        runtimePayload,
        mergedPayload,
      };
    } finally {
      if (shouldRelease) {
        connection.release();
      }
    }
  }
}

export const documentRuntimeService = new DocumentRuntimeService();
