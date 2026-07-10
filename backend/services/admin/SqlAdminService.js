import { getPostgresPool } from "../../config/postgres.js";
import {
  hydrateTaskFromDefinition,
  ensureProcessRun,
  ensureDocumentsForTask,
  ensureDocumentForTaskItem,
  ensureFillFlowForDocumentVersion,
  ensureSignatureFlowForDocumentVersion
} from "./TaskGenerationService.js";
import { SQL_TABLE_MAP } from "../../config/sqlTables.js";
import bcrypt from "bcrypt";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import * as Minio from "minio";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import yaml from "js-yaml";
import { sanitizeStorageSegment } from "../../utils/templateArchive.js";
import {
  syncDocumentProgressFromDocumentSignature,
  syncDocumentProgressFromFillRequest,
  syncDocumentProgressFromSignatureRequest,
} from "../documents/DocumentProgressService.js";
import {
  buildProcessDefinitionVersionName,
  resolveProcessDefinitionSeriesIdentity
} from "./processDefinitionSeries.js";
import {
  ITEM_EMISSION_MODES,
  bumpSemanticVersion,
  normalizeItemMode,
} from "./SqlAdminService.versioning.js";
import {
  parseJsonObject,
  ensureDateOrder,
  validateTableRules,
} from "./SqlAdminService.validation.js";
import {
  slugify,
  humanizeSlug,
  normalizeNumericId,
  normalizeBooleanFlag,
} from "./SqlAdminService.primitives.js";
import {
  buildWorkflowsYaml,
  normalizeFillSteps,
  normalizeSignatureSteps,
  collectSignatureWorkflowNormalizationIssues,
  collectAuthoredWorkflowIssues,
} from "./SqlAdminService.workflows.js";

const DEFAULT_LIMIT = 50;
const BCRYPT_HASH_REGEX = /^\$2[abxy]\$\d{2}\$/;
const PERSON_TOKEN_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const SERVICE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SERVICE_DIR, "..", "..", "..");
const BACKEND_STORAGE_ROOT = path.join(REPO_ROOT, "backend", "storage");
const MINIO_TEMPLATES_BUCKET = process.env.MINIO_TEMPLATES_BUCKET || "deasy-templates";
const MINIO_TEMPLATES_PREFIX = (process.env.MINIO_TEMPLATES_PREFIX || "System").replace(/^\/+|\/+$/g, "");
// Semilla por defecto ("general") cuando se crea una plantilla sin elegir seed. Coincide con la del bootstrap.
const DEFAULT_SEED_CODE = process.env.DEFAULT_TEMPLATE_SEED_CODE || "latex/informe-general";
// Formatos de documento de referencia (al menos uno es obligatorio al crear una plantilla).
const REFERENCE_DOC_FORMATS = ["pdf", "docx", "xlsx", "pptx"];
// Rol derivado del formato (sustituye al eje "mode" que ya no se almacena): jinja2 = contrato ejecutable,
// latex = render derivable, el resto = documento de referencia. Es 1:1 con el formato, por eso es derivable.
const FORMAT_ROLE = { jinja2: "contract", latex: "render" };
const formatRole = (format) => FORMAT_ROLE[String(format || "").toLowerCase()] || "reference";
// Formato del contrato ejecutable (único editable por el admin).
const CONTRACT_FORMAT = "jinja2";
// Único subárbol editable por el admin (contenido LaTeX). Todo lo demás del contrato es protegido (hash).
const EDITABLE_CONTENT_SUBPATH = `template/${CONTRACT_FORMAT}/Contenido/`;
const MINIO_TEMPLATES_SEEDS_PREFIX = (process.env.MINIO_TEMPLATES_SEEDS_PREFIX || "Seeds").replace(/^\/+|\/+$/g, "");
const TEMPLATE_USERS_PREFIX = (
  process.env.MINIO_TEMPLATES_USERS_PREFIX
  || process.env.MINIO_TEMPLATES_DRAFT_PREFIX
  || "Users"
).replace(/^\/+|\/+$/g, "");
const ARTIFACT_SYNC_FILL_DESCRIPTION_PREFIX = "artifact_sync_fill:";
const ARTIFACT_SYNC_SIGNATURE_DESCRIPTION_PREFIX = "artifact_sync_signature:";
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

// Opciones de autoría de pasos de llenado SEGÚN el tipo de plantilla (template_scope):
// - 'official' (de proceso): responsable | cargo en {misma unidad, unidad específica, TIPO de unidad}.
//   El tipo de unidad permite disparar la revisión a un cargo en muchas unidades (p. ej. todas las carreras).
//   SIN persona concreta (frágil ante rotación en algo durable que corre en muchas unidades).
// - 'ad_hoc' (de usuario, extensión puntual): responsable | cargo en {misma unidad, unidad específica} |
//   persona concreta. SIN tipo de unidad (no hay distribución masiva en una extensión puntual).
// Autoría web de ENTREGA: 'manual' no está implementado en el resolvedor de llenado (se comporta como 'todas')
// → se excluye para no engañar. El enum/runtime mantiene 'manual' por compatibilidad de seeds.
const minioUrl = new URL(process.env.MINIO_ENDPOINT || "http://localhost:9000");
const minioUseSSL = String(process.env.MINIO_USE_SSL || "").trim() === "1" || minioUrl.protocol === "https:";
let minioClientInstance = null;

const walkFiles = (dirPath, collected = []) => {
  if (!fs.existsSync(dirPath)) {
    return collected;
  }
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, collected);
      continue;
    }
    collected.push(fullPath);
  }
  return collected;
};

const getYamlScalar = (content, key) => {
  const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  if (!match) {
    return "";
  }
  let value = match[1].trim();
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value;
};

const parseYamlDocument = (content, { filePath = "meta.yaml" } = {}) => {
  try {
    const parsed = yaml.load(content);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    throw new Error(`No se pudo interpretar ${filePath}: ${error.message}`);
  }
};

const hasVisibleFiles = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    return false;
  }
  return walkFiles(dirPath).some((filePath) => path.basename(filePath) && !path.basename(filePath).startsWith("."));
};

const hashDirectory = (dirPath) => {
  const hash = crypto.createHash("sha256");
  const files = walkFiles(dirPath)
    .filter((filePath) => !path.basename(filePath).startsWith("."))
    .sort((left, right) => left.localeCompare(right));
  for (const filePath of files) {
    const relative = path.relative(dirPath, filePath).replace(/\\/g, "/");
    hash.update(relative);
    hash.update(fs.readFileSync(filePath));
  }
  return files.length ? hash.digest("hex") : null;
};

// Manifiesto de integridad del contrato: hash sha256 de cada archivo PROTEGIDO (todo menos el subárbol
// editable de contenido). Se publica como manifest.json en la raíz del artifact (fuera de los prefijos de
// available_formats, por lo que NO entra en la descarga de formatos) y es la fuente de verdad para verificar
// la re-subida del admin en la Fase 3.
const buildProtectedManifest = (dirPath) => {
  const relFiles = walkFiles(dirPath)
    .map((filePath) => path.relative(dirPath, filePath).replace(/\\/g, "/"))
    .filter((rel) => !path.basename(rel).startsWith(".") && rel !== "manifest.json")
    .sort((a, b) => a.localeCompare(b));
  const protectedHashes = {};
  for (const rel of relFiles) {
    if (rel.startsWith(EDITABLE_CONTENT_SUBPATH)) {
      continue; // contenido editable: no se fija hash
    }
    protectedHashes[rel] = crypto.createHash("sha256").update(fs.readFileSync(path.join(dirPath, rel))).digest("hex");
  }
  return {
    manifest_version: 1,
    generated_at: new Date().toISOString(),
    editable_prefixes: [EDITABLE_CONTENT_SUBPATH],
    protected: protectedHashes
  };
};

// Descomprime un ZIP a un directorio destino (usa el binario unzip).
const unzipToDirectory = (zipPath, destDir) => new Promise((resolve, reject) => {
  const proc = spawn("unzip", ["-o", "-qq", zipPath, "-d", destDir], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = "";
  proc.stderr.on("data", (chunk) => { stderr += String(chunk || ""); });
  proc.on("error", reject);
  proc.on("close", (code) => (code === 0 ? resolve(true) : reject(new Error(stderr.trim() || "No se pudo descomprimir el ZIP."))));
});

// Saneo anti-inyección del contenido LaTeX editable. Devuelve la lista de violaciones (vacía = OK).
const sanitizeLatexSource = (relpath, text) => {
  const violations = [];
  const forbidden = [
    [/\\write18/, "shell-escape (\\write18)"],
    [/\\(directlua|latelua)\b/, "ejecución Lua (\\directlua/\\latelua)"],
    [/\\openout\b/, "\\openout (escritura de archivos)"],
    [/\\openin\b/, "\\openin (lectura de archivos)"],
    [/\\special\s*\{\s*(?:dvips:\s*)?[!`|]/, "\\special con comando"],
    [/\\ShellEscape\b/, "\\ShellEscape"],
  ];
  for (const [re, label] of forbidden) {
    if (re.test(text)) violations.push(`${relpath}: ${label}`);
  }
  // \input/\include/\includegraphics/... con pipe, ruta absoluta o que escape del árbol (..)
  const pathCmd = /\\(input|include|includegraphics|InputIfFileExists|import|subimport|usepackage)\b\s*(?:\[[^\]]*\])?\s*\{([^}]*)\}/g;
  let match;
  while ((match = pathCmd.exec(text)) !== null) {
    const target = String(match[2] || "").trim();
    if (/^[|`!]/.test(target) || target.startsWith("/") || target.includes("..") || /^[a-zA-Z]:[\\/]/.test(target)) {
      violations.push(`${relpath}: ruta no permitida en \\${match[1]}{${target}}`);
    }
  }
  return violations;
};

const getMinioClient = () => {
  if (!minioClientInstance) {
    minioClientInstance = new Minio.Client({
      endPoint: minioUrl.hostname,
      port: Number(minioUrl.port || (minioUseSSL ? 443 : 80)),
      useSSL: minioUseSSL,
      accessKey: process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || "",
      secretKey: process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || ""
    });
  }
  return minioClientInstance;
};

const listMinioObjects = (bucket, prefix, recursive = true) => new Promise((resolve, reject) => {
  const objects = [];
  const stream = getMinioClient().listObjectsV2(bucket, prefix, recursive);
  stream.on("data", (item) => {
    if (item?.name) {
      objects.push(item.name);
    }
  });
  stream.on("error", reject);
  stream.on("end", () => resolve(objects));
});

const getMinioObjectStream = (bucket, objectName) => new Promise((resolve, reject) => {
  getMinioClient().getObject(bucket, objectName, (error, dataStream) => {
    if (error) {
      reject(error);
      return;
    }
    resolve(dataStream);
  });
});

const streamToBuffer = (stream) => new Promise((resolve, reject) => {
  const chunks = [];
  stream.on("data", (chunk) => chunks.push(chunk));
  stream.on("error", reject);
  stream.on("end", () => resolve(Buffer.concat(chunks)));
});

const readMinioObjectAsText = async (bucket, objectName) => {
  const dataStream = await getMinioObjectStream(bucket, objectName);
  const buffer = await streamToBuffer(dataStream);
  return buffer.toString("utf8");
};

const copyMinioObjectToFile = async (bucket, objectName, targetFile) => {
  const dataStream = await getMinioObjectStream(bucket, objectName);
  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
  await new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(targetFile);
    dataStream.on("error", reject);
    writeStream.on("error", reject);
    writeStream.on("finish", resolve);
    dataStream.pipe(writeStream);
  });
};

const downloadMinioPrefixToDirectory = async (bucket, objectPrefix, targetDir) => {
  const normalizedPrefix = String(objectPrefix || "").replace(/^\/+/, "").replace(/\/?$/, "/");
  const objectNames = await listMinioObjects(bucket, normalizedPrefix, true);
  if (!objectNames.length) {
    throw new Error(`No se encontraron objetos en MinIO bajo ${normalizedPrefix}`);
  }
  for (const objectName of objectNames) {
    if (!objectName.startsWith(normalizedPrefix)) {
      continue;
    }
    const relativePath = objectName.slice(normalizedPrefix.length);
    if (!relativePath) {
      continue;
    }
    await copyMinioObjectToFile(bucket, objectName, path.join(targetDir, relativePath));
  }
};

const fPutObject = (bucket, objectName, filePath) => new Promise((resolve, reject) => {
  getMinioClient().fPutObject(bucket, objectName, filePath, {}, (error, etag) => {
    if (error) {
      reject(error);
      return;
    }
    resolve(etag);
  });
});

const putMinioObjectFromText = (bucket, objectName, text, contentType = "text/plain") => new Promise((resolve, reject) => {
  const buffer = Buffer.from(String(text ?? ""), "utf8");
  getMinioClient().putObject(bucket, objectName, buffer, buffer.length, { "Content-Type": contentType }, (error, etag) => {
    if (error) {
      reject(error);
      return;
    }
    resolve(etag);
  });
});

const statMinioObject = (bucket, objectName) => new Promise((resolve, reject) => {
  getMinioClient().statObject(bucket, objectName, (error, stat) => (error ? reject(error) : resolve(stat)));
});

// Copia byte-a-byte preservando el content-type. Imprescindible para clonar versiones con binarios
// (PNG/PDF/DOCX/XLSX/PPTX): una copia vía texto UTF-8 corrompe esos archivos.
const copyMinioObjectBinary = async (bucket, sourceObject, targetObject) => {
  let contentType;
  try {
    const stat = await statMinioObject(bucket, sourceObject);
    contentType = stat?.metaData?.["content-type"] || stat?.metaData?.["Content-Type"];
  } catch {
    // El content-type es opcional; si no se puede leer, se sube sin él.
  }
  const buffer = await streamToBuffer(await getMinioObjectStream(bucket, sourceObject));
  return new Promise((resolve, reject) => {
    const meta = contentType ? { "Content-Type": contentType } : {};
    getMinioClient().putObject(bucket, targetObject, buffer, buffer.length, meta, (error, etag) => (error ? reject(error) : resolve(etag)));
  });
};

// Elimina todos los objetos bajo un prefijo (limpieza de huérfanos en MinIO, best-effort).
const removeMinioPrefix = async (bucket, objectPrefix) => {
  const objectNames = await listMinioObjects(bucket, objectPrefix, true);
  for (const objectName of objectNames) {
    await new Promise((resolve) => {
      getMinioClient().removeObject(bucket, objectName, (error) => {
        if (error) {
          console.warn(`No se pudo eliminar objeto huérfano ${objectName}:`, error.message);
        }
        resolve();
      });
    });
  }
};

const ensureMinioBucket = (bucket) => new Promise((resolve, reject) => {
  getMinioClient().bucketExists(bucket, (checkError, exists) => {
    if (checkError) {
      reject(checkError);
      return;
    }
    if (exists) {
      resolve(true);
      return;
    }
    getMinioClient().makeBucket(bucket, "", (makeError) => {
      if (makeError) {
        reject(makeError);
        return;
      }
      resolve(true);
    });
  });
});

const normalizeObjectName = (prefix, relativePath) => {
  const cleanPrefix = String(prefix || "").replace(/^\/+|\/+$/g, "");
  const cleanRelative = String(relativePath || "").replace(/^\/+|\/+$/g, "");
  if (!cleanPrefix) {
    return cleanRelative;
  }
  if (!cleanRelative) {
    return cleanPrefix;
  }
  return `${cleanPrefix}/${cleanRelative}`;
};

const uploadDirectoryToMinio = async (bucket, objectPrefix, sourceDir) => {
  await ensureMinioBucket(bucket);
  const files = walkFiles(sourceDir).filter((filePath) => !path.basename(filePath).startsWith("."));
  for (const filePath of files) {
    const relativePath = path.relative(sourceDir, filePath).replace(/\\/g, "/");
    const objectName = normalizeObjectName(objectPrefix, relativePath);
    await fPutObject(bucket, objectName, filePath);
  }
  return files.length;
};

const parseAvailableFormats = (value) => {
  if (!value) {
    return {};
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return {};
  }
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
};

const buildArtifactSyncedFillDescription = ({ artifactId, templateCode, storageVersion }) =>
  `${ARTIFACT_SYNC_FILL_DESCRIPTION_PREFIX}${artifactId}:${templateCode}:${storageVersion}`;

const buildArtifactSyncedSignatureDescription = ({ artifactId, templateCode, storageVersion }) =>
  `${ARTIFACT_SYNC_SIGNATURE_DESCRIPTION_PREFIX}${artifactId}:${templateCode}:${storageVersion}`;

// Lee la marca de procedencia "<prefix><artifactId>:<templateCode>:<storageVersion>" para detectar drift:
// si el storageVersion materializado en BD difiere del actual del artifact, la proyección está desfasada.
// templateCode puede contener ':' improbable, pero artifactId (primer token) y storageVersion (último)
// son inequívocos.
const parseArtifactSyncMarker = (description, prefix) => {
  const raw = String(description || "");
  if (!raw.startsWith(prefix)) {
    return null;
  }
  const body = raw.slice(prefix.length);
  const firstColon = body.indexOf(":");
  const lastColon = body.lastIndexOf(":");
  if (firstColon < 0 || lastColon <= firstColon) {
    return null;
  }
  return {
    artifactId: Number(body.slice(0, firstColon)) || null,
    templateCode: body.slice(firstColon + 1, lastColon),
    storageVersion: body.slice(lastColon + 1)
  };
};

const isArtifactFillWorkflowSyncEnabled = (workflow = {}) =>
  String(workflow?.sync_mode || "").trim() === "artifact_to_db"
  && normalizeBooleanFlag(workflow?.required, false)
  && Array.isArray(workflow?.steps)
  && workflow.steps.length > 0;

const isArtifactSignatureWorkflowSyncEnabled = (workflow = {}) =>
  String(workflow?.sync_mode || "").trim() === "artifact_to_db"
  && normalizeBooleanFlag(workflow?.required, false)
  && Array.isArray(workflow?.steps)
  && workflow.steps.length > 0;

const findPreferredPdfObject = (objectNames = []) => {
  const pdfCandidates = (objectNames || []).filter((name) => /\.pdf$/i.test(String(name || "")));
  if (!pdfCandidates.length) {
    return null;
  }
  const preferredMatchers = [
    /\/render\/output\/pdf\/.+\.pdf$/i,
    /\/render\/.+\.pdf$/i,
    /\/preview\/.+\.pdf$/i,
    /\.pdf$/i
  ];
  for (const matcher of preferredMatchers) {
    const match = pdfCandidates.find((name) => matcher.test(name));
    if (match) {
      return match;
    }
  }
  return pdfCandidates[0];
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

const normalizeValue = (field, value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (field?.type === "boolean") {
    return value ? 1 : 0;
  }

  // Columnas JSON: vacío → null; string → validar JSON; objeto → serializar.
  if (field?.json) {
    if (value === "") {
      return null;
    }
    if (typeof value === "string") {
      try {
        JSON.parse(value);
      } catch {
        throw new Error(`El campo ${field.label || field.name} debe ser un JSON válido.`);
      }
      return value;
    }
    return JSON.stringify(value);
  }

  return value;
};

const getConfig = (tableName) => {
  const config = SQL_TABLE_MAP[tableName];
  if (!config) {
    throw new Error(`Tabla no soportada: ${tableName}`);
  }
  return config;
};

const pickPayload = (fields, data, { includeReadOnly = false } = {}) => {
  const payload = {};
  for (const field of fields) {
    if (field.virtual) {
      continue;
    }
    if (!includeReadOnly && field.readOnly) {
      continue;
    }
    if (Object.hasOwn(data, field.name)) {
      payload[field.name] = normalizeValue(field, data[field.name]);
    }
  }
  return payload;
};

const buildWhere = (keys, values) => {
  const clauses = [];
  const params = [];
  for (const key of keys) {
    if (!Object.hasOwn(values, key)) {
      throw new Error(`Falta la llave primaria: ${key}`);
    }
    clauses.push(`${key} = ?`);
    params.push(values[key]);
  }
  return { where: clauses.join(" AND "), params };
};

const isValidDate = (value) => {
  if (!value) {
    return false;
  }
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

const validateFieldTypes = (config, payload) => {
  for (const field of config.fields) {
    if (!Object.hasOwn(payload, field.name)) {
      continue;
    }
    const value = payload[field.name];
    if (value === null || value === undefined || value === "") {
      continue;
    }
    if (field.type === "number" && Number.isNaN(Number(value))) {
      throw new Error(`El campo ${field.label || field.name} debe ser numerico.`);
    }
    if (field.type === "boolean" && ![0, 1, "0", "1", true, false].includes(value)) {
      throw new Error(`El campo ${field.label || field.name} debe ser booleano.`);
    }
    if ((field.type === "date" || field.type === "datetime") && !isValidDate(value)) {
      throw new Error(`El campo ${field.label || field.name} debe tener una fecha valida.`);
    }
    if (field.type === "select" && field.options?.length) {
      if (!field.options.includes(value)) {
        throw new Error(`El campo ${field.label || field.name} no acepta el valor recibido.`);
      }
    }
  }
};

const isBcryptHash = (value) => typeof value === "string" && BCRYPT_HASH_REGEX.test(value);

const validatePasswordPolicy = (password) => {
  const validations = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password)
  };

  const passedCriteria = Object.values(validations).filter(Boolean).length;
  if (passedCriteria < 3) {
    throw new Error(
      "La contraseña debe cumplir al menos 3 criterios: 8+ caracteres, mayúscula, minúscula, número."
    );
  }
};

const hashPassword = async (password) => {
  validatePasswordPolicy(password);
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

const generatePersonToken = () => {
  const bytes = crypto.randomBytes(10);
  return Array.from(bytes, (byte) => PERSON_TOKEN_CHARS[byte % PERSON_TOKEN_CHARS.length]).join("");
};

const resolveUniquePersonToken = async (pool) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const token = generatePersonToken();
    const [rows] = await pool.query("SELECT id FROM persons WHERE token = ? LIMIT 1", [token]);
    if (!rows?.length) return token;
  }
  throw new Error("No se pudo generar un token unico para el usuario.");
};

const sanitizePersonRow = (tableName, row) => {
  if (tableName !== "persons" || !row || typeof row !== "object") {
    return row;
  }
  const safeRow = { ...row };
  delete safeRow.password_hash;
  return safeRow;
};

export default class SqlAdminService {
  constructor(pool = getPostgresPool()) {
    this.pool = pool;
  }

  ensurePool() {
    if (!this.pool) {
      throw new Error("La conexion con PostgreSQL no esta disponible.");
    }
  }

  async resolveProcessDefinitionSeriesIdentity(candidate) {
    return resolveProcessDefinitionSeriesIdentity(candidate, {
      findUnitType: (id) => this.getByKeys("unit_types", { id }),
      findCargo: (id) => this.getByKeys("cargos", { id })
    });
  }

  // Conteos agregados (solo lectura) para los resúmenes de Operación. Cada dominio se calcula de forma
  // independiente; si una consulta falla devuelve null y el frontend omite esa tarjeta.
  async getOperationStats() {
    this.ensurePool();
    const groupByStatus = async (sql) => {
      try {
        const [rows] = await this.pool.query(sql);
        return Object.fromEntries(rows.map((row) => [String(row.status), Number(row.c) || 0]));
      } catch {
        return null;
      }
    };
    const scalar = async (sql) => {
      try {
        const [[row]] = await this.pool.query(sql);
        return Number(row?.c) || 0;
      } catch {
        return null;
      }
    };
    const [tasks, overdue, documents, deliveries, signatures] = await Promise.all([
      groupByStatus("SELECT status, COUNT(*) AS c FROM tasks GROUP BY status"),
      scalar("SELECT COUNT(*) AS c FROM tasks WHERE status NOT IN ('completada','cancelada') AND end_date IS NOT NULL AND end_date < CURDATE()"),
      groupByStatus("SELECT status, COUNT(*) AS c FROM documents GROUP BY status"),
      groupByStatus("SELECT status, COUNT(*) AS c FROM fill_requests GROUP BY status"),
      groupByStatus(
        "SELECT srs.code AS status, COUNT(*) AS c FROM signature_flow_instances sfi "
        + "JOIN signature_request_statuses srs ON srs.id = sfi.status_id GROUP BY srs.code"
      )
    ]);
    return {
      tasks: tasks === null ? null : { byStatus: tasks, overdue: overdue ?? 0 },
      documents: documents === null ? null : { byStatus: documents },
      deliveries: deliveries === null ? null : { byStatus: deliveries },
      signatures: signatures === null ? null : { byStatus: signatures }
    };
  }

  async ensureProcessDefinitionVersionAvailable(candidate, { excludeId = null } = {}) {
    this.ensurePool();
    const processId = Number(candidate?.process_id);
    const variationKey = String(candidate?.variation_key || "").trim();
    const definitionVersion = String(candidate?.definition_version || "").trim();

    if (!processId || !variationKey || !definitionVersion) {
      return;
    }

    const params = [processId, variationKey, definitionVersion];
    let query = `
      SELECT id
      FROM process_definition_versions
      WHERE process_id = ?
        AND variation_key = ?
        AND definition_version = ?`;

    if (excludeId !== null && excludeId !== undefined && excludeId !== "") {
      query += "\n        AND id <> ?";
      params.push(Number(excludeId));
    }

    query += "\n      LIMIT 1";

    const [rows] = await this.pool.query(query, params);
    if (rows?.length) {
      throw new Error("Ya existe una configuracion con esa serie y version para el proceso seleccionado.");
    }
  }

  async resolveProcessDefinitionSeries(candidate, { connection = this.pool } = {}) {
    this.ensurePool();
    const seriesId = Number(candidate?.series_id);
    if (!seriesId) {
      throw new Error("Selecciona una serie valida para la configuracion.");
    }
    const [rows] = await connection.query(
      `SELECT
         pds.id,
         pds.source_type,
         pds.unit_type_id,
         pds.cargo_id,
         pds.code,
         pds.is_active,
         ut.name AS unit_type_name,
         c.name AS cargo_name
       FROM process_definition_series pds
       LEFT JOIN unit_types ut ON ut.id = pds.unit_type_id
       LEFT JOIN cargos c ON c.id = pds.cargo_id
       WHERE pds.id = ?
       LIMIT 1`,
      [seriesId]
    );
    const series = rows?.[0] || null;
    if (!series) {
      throw new Error("La serie seleccionada no existe.");
    }
    if (!Number(series.is_active)) {
      throw new Error("La serie seleccionada esta inactiva.");
    }
    // La serie `default` = "sin variación" (nombre directo) es una opción válida para procesos
    // sin eje de variación (memos/oficios routed); ya no se bloquea para configuraciones nuevas.
    return series;
  }

  // El proceso por defecto (slug 'default') es un routed comodín especial: solo puede tener UNA
  // variación — la "sin variación" (source_type='default'). Se permite versionarla (N versiones),
  // pero no crear otra variación por cargo o tipo de unidad.
  async ensureDefaultProcessSingleVariation(processId, series, { connection = this.pool } = {}) {
    this.ensurePool();
    if (!processId) {
      return;
    }
    const [rows] = await connection.query(
      "SELECT slug FROM processes WHERE id = ? LIMIT 1",
      [Number(processId)]
    );
    if (String(rows?.[0]?.slug || "") !== "default") {
      return;
    }
    if (String(series?.source_type || "") !== "default") {
      throw new Error("El proceso por defecto solo admite la configuración \"sin variación\". Puedes crear nuevas versiones de ella, pero no otra variación por cargo o tipo de unidad.");
    }
  }

  async resolveProcessDefinitionVersionName(processId, seriesId, { connection = this.pool } = {}) {
    this.ensurePool();
    const normalizedProcessId = Number(processId);
    const normalizedSeriesId = Number(seriesId);
    if (!normalizedProcessId || !normalizedSeriesId) {
      throw new Error("Selecciona proceso y serie para calcular el nombre de la configuracion.");
    }
    const [rows] = await connection.query(
      `SELECT
         p.name AS process_name,
         pds.source_type,
         pds.code,
         ut.name AS unit_type_name,
         c.name AS cargo_name
       FROM processes p
       INNER JOIN process_definition_series pds ON pds.id = ?
       LEFT JOIN unit_types ut ON ut.id = pds.unit_type_id
       LEFT JOIN cargos c ON c.id = pds.cargo_id
       WHERE p.id = ?
       LIMIT 1`,
      [normalizedSeriesId, normalizedProcessId]
    );
    const row = rows?.[0] || null;
    if (!row) {
      throw new Error("No se pudo calcular el nombre de la configuracion.");
    }
    const generatedName = buildProcessDefinitionVersionName({
      processName: row.process_name,
      series: row
    });
    if (!generatedName) {
      throw new Error("No se pudo calcular el nombre de la configuracion.");
    }
    return generatedName;
  }

  async refreshProcessDefinitionVersionNames({ processId = null, seriesId = null, connection = this.pool } = {}) {
    this.ensurePool();
    const filters = [];
    const params = [];
    if (processId !== null && processId !== undefined && processId !== "") {
      filters.push("pdv.process_id = ?");
      params.push(Number(processId));
    }
    if (seriesId !== null && seriesId !== undefined && seriesId !== "") {
      filters.push("pdv.series_id = ?");
      params.push(Number(seriesId));
    }
    if (!filters.length) {
      return 0;
    }
    const [rows] = await connection.query(
      `SELECT
         pdv.id,
         pdv.name,
         p.name AS process_name,
         pds.source_type,
         pds.code,
         ut.name AS unit_type_name,
         c.name AS cargo_name
       FROM process_definition_versions pdv
       INNER JOIN processes p ON p.id = pdv.process_id
       INNER JOIN process_definition_series pds ON pds.id = pdv.series_id
       LEFT JOIN unit_types ut ON ut.id = pds.unit_type_id
       LEFT JOIN cargos c ON c.id = pds.cargo_id
       WHERE ${filters.join(" AND ")}`,
      params
    );
    let updated = 0;
    for (const row of rows || []) {
      const generatedName = buildProcessDefinitionVersionName({
        processName: row.process_name,
        series: row
      });
      if (!generatedName || String(row.name || "") === generatedName) {
        continue;
      }
      await connection.query(
        "UPDATE process_definition_versions SET name = ? WHERE id = ?",
        [generatedName, Number(row.id)]
      );
      updated += 1;
    }
    return updated;
  }

  async retireActiveDefinitionsInSeries({ processId, variationKey, excludeId = null, connection = this.pool }) {
    this.ensurePool();
    const normalizedProcessId = Number(processId);
    const normalizedVariationKey = String(variationKey || "").trim();
    if (!normalizedProcessId || !normalizedVariationKey) {
      return 0;
    }

    const params = [normalizedProcessId, normalizedVariationKey];
    let excludeSql = "";
    if (excludeId !== null && excludeId !== undefined && excludeId !== "") {
      excludeSql = " AND id <> ?";
      params.push(Number(excludeId));
    }

    const [activeRows] = await connection.query(
      `SELECT id
       FROM process_definition_versions
       WHERE process_id = ?
         AND variation_key = ?
         AND status = 'active'${excludeSql}`,
      params
    );

    if (!activeRows?.length) {
      return 0;
    }

    await connection.query(
      `UPDATE process_definition_versions
       SET status = 'retired',
           effective_to = COALESCE(effective_to, CURDATE())
       WHERE process_id = ?
         AND variation_key = ?
         AND status = 'active'${excludeSql}`,
      params
    );

    return activeRows.length;
  }

  getMeta() {
    return Object.values(SQL_TABLE_MAP);
  }

  async ensureContractablePosition(positionId) {
    this.ensurePool();
    const [rows] = await this.pool.query(
      "SELECT position_type FROM unit_positions WHERE id = ? LIMIT 1",
      [positionId]
    );
    if (!rows?.length) {
      throw new Error("El puesto seleccionado no existe.");
    }
    if (!["real", "promocion"].includes(rows[0].position_type)) {
      throw new Error("Solo se permiten vacantes para ocupaciones reales o de promocion.");
    }
  }

  async list(tableName, { q, limit, offset, orderBy, order, filters = {} } = {}) {
    this.ensurePool();
    const config = getConfig(tableName);
    const physicalFields = config.fields.filter((field) => !field.virtual).map((field) => field.name);
    const availableFields = config.fields.map((field) => field.name);
    const orderableFields = [...physicalFields];

    const params = [];
    const conditions = [];
    let joinClause = "";
    let selectClause = `SELECT ${physicalFields.join(", ")}`;
    let groupByClause = "";
    let columnPrefix = "";
    const normalizedFilters = { ...filters };
    // template_artifacts: estos campos viven en `deliverables` (alias d). Se rutean ahí en select/búsqueda/filtro/orden.
    const TA_DELIV_COLS = {
      template_code: "d.code",
      display_name: "d.display_name",
      description: "d.description",
      template_scope: "d.template_scope",
      template_seed_id: "d.template_seed_id",
      owner_person_id: "d.owner_person_id"
    };
    const qualifyField = (field) => {
      if (tableName === "template_artifacts" && TA_DELIV_COLS[field]) return TA_DELIV_COLS[field];
      return columnPrefix ? `${columnPrefix}${field}` : field;
    };

    if (tableName === "processes") {
      joinClause = `LEFT JOIN (
        SELECT process_id, definition_version, status
        FROM (
          SELECT
            process_id,
            definition_version,
            status,
            ROW_NUMBER() OVER (
              PARTITION BY process_id
              ORDER BY effective_from DESC, id DESC
            ) AS rn
          FROM process_definition_versions
          WHERE status IN ('draft', 'active')
        ) ranked_pd
        WHERE rn = 1
      ) pd_main ON pd_main.process_id = processes.id`;
      columnPrefix = "processes.";
      const selectFields = physicalFields.map((field) => `${columnPrefix}${field}`);
      if (availableFields.includes("active_definition_version")) {
        selectFields.push("pd_main.definition_version AS active_definition_version");
        orderableFields.push("active_definition_version");
      }
      if (availableFields.includes("active_definition_status")) {
        selectFields.push("pd_main.status AS active_definition_status");
      }
      selectClause = `SELECT ${selectFields.join(", ")}`;
    }

    if (tableName === "process_target_rules") {
      joinClause = "LEFT JOIN process_definition_versions pd_rule ON pd_rule.id = process_target_rules.process_definition_id";
      columnPrefix = "process_target_rules.";
      const selectFields = physicalFields.map((field) => `${columnPrefix}${field}`);
      selectClause = `SELECT ${selectFields.join(", ")}`;

      const definitionStatus = normalizedFilters.definition_status;
      delete normalizedFilters.definition_status;

      if (definitionStatus !== undefined && definitionStatus !== null && definitionStatus !== "") {
        conditions.push("pd_rule.status = ?");
        params.push(definitionStatus);
      }

    }

    if (tableName === "template_artifacts") {
      columnPrefix = "template_artifacts.";
      joinClause = "LEFT JOIN deliverables d ON d.id = template_artifacts.deliverable_id";
      const selectFields = physicalFields.map((field) =>
        TA_DELIV_COLS[field] ? `${TA_DELIV_COLS[field]} AS ${field}` : `template_artifacts.${field}`
      );
      selectClause = `SELECT ${selectFields.join(", ")}`;
      // Filtro "por proceso al que pertenece": plantillas vinculadas a ese proceso vía process_definition_templates.
      const processFilter = normalizedFilters.process_id;
      delete normalizedFilters.process_id;
      if (processFilter !== undefined && processFilter !== null && processFilter !== "") {
        conditions.push(`EXISTS (
          SELECT 1 FROM process_definition_templates pdt
            INNER JOIN process_definition_versions pdv ON pdv.id = pdt.process_definition_id
           WHERE pdt.template_artifact_id = template_artifacts.id AND pdv.process_id = ?
        )`);
        params.push(processFilter);
      }
    }

    if (q && config.searchFields?.length) {
      const like = `%${q}%`;
      const searchClauses = config.searchFields.map((field) => `${qualifyField(field)} LIKE ?`);
      conditions.push(`(${searchClauses.join(" OR ")})`);
      params.push(...config.searchFields.map(() => like));
    }

    for (const [field, value] of Object.entries(normalizedFilters)) {
      if (!physicalFields.includes(field)) {
        continue;
      }
      if (value === undefined || value === null || value === "") {
        continue;
      }
      const fieldMeta = config.fields.find((meta) => meta.name === field);
      const columnName = qualifyField(field);
      if (["text", "email", "textarea"].includes(fieldMeta?.type)) {
        conditions.push(`${columnName} LIKE ?`);
        params.push(`%${value}%`);
      } else {
        conditions.push(`${columnName} = ?`);
        params.push(value);
      }
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const safeOrderBy = orderableFields.includes(orderBy) ? orderBy : config.primaryKeys[0];
    const orderColumn =
      (tableName === "processes" && safeOrderBy === "active_definition_version")
        ? safeOrderBy
        : tableName === "template_artifacts"
          ? qualifyField(safeOrderBy)
          : joinClause
            ? `${tableName}.${safeOrderBy}`
            : safeOrderBy;
    const safeOrder = order?.toLowerCase() === "asc" ? "ASC" : "DESC";
    const safeLimit = Number.isFinite(Number(limit)) ? Math.max(1, Number(limit)) : DEFAULT_LIMIT;
    const safeOffset = Number.isFinite(Number(offset)) ? Math.max(0, Number(offset)) : 0;

    const [rows] = await this.pool.query(
      `${selectClause} FROM ${tableName} ${joinClause} ${whereClause} ${groupByClause}
       ORDER BY ${orderColumn} ${safeOrder} LIMIT ? OFFSET ?`,
      [...params, safeLimit, safeOffset]
    );

    return tableName === "persons" ? rows.map((row) => sanitizePersonRow(tableName, row)) : rows;
  }

  async getByKeys(tableName, keys) {
    this.ensurePool();
    // template_artifacts: la identidad/atributos del entregable viven en `deliverables` (modelo "libro/ediciones").
    // Se resuelven vía JOIN y se exponen con los MISMOS nombres (template_code/display_name/scope/seed/owner_person)
    // para no romper a los ~muchos llamadores. Funciona antes y después del drop de columnas (lee de `d`).
    if (tableName === "template_artifacts" && keys?.id !== undefined) {
      const [rows] = await this.pool.query(
        `SELECT ta.id, ta.storage_version, ta.lifecycle_state, ta.is_active, ta.base_object_prefix,
                ta.available_formats, ta.schema_object_key, ta.meta_object_key, ta.content_hash,
                ta.parent_version_id, ta.deliverable_id, ta.created_at,
                d.code AS template_code, d.display_name, d.description, d.template_scope,
                d.template_seed_id, d.owner_person_id
           FROM template_artifacts ta
           LEFT JOIN deliverables d ON d.id = ta.deliverable_id
          WHERE ta.id = ? LIMIT 1`,
        [Number(keys.id)]
      );
      return rows?.[0] ?? null;
    }
    const config = getConfig(tableName);
    const { where, params } = buildWhere(config.primaryKeys, keys);
    const fields = config.fields.filter((field) => !field.virtual).map((field) => field.name);
    const [rows] = await this.pool.query(
      `SELECT ${fields.join(", ")} FROM ${tableName} WHERE ${where} LIMIT 1`,
      params
    );
    return rows?.[0] ?? null;
  }

  async getTaskTemplate(templateId) {
    this.ensurePool();
    const [rows] = await this.pool.query(
      `SELECT id, process_definition_id, template_artifact_id, sort_order
       FROM process_definition_templates
       WHERE id = ?
       LIMIT 1`,
      [templateId]
    );
    return rows?.[0] ?? null;
  }

  async getTemplateArtifact(artifactId, connection = this.pool) {
    this.ensurePool();
    const [rows] = await connection.query(
      `SELECT
         ta.id,
         d.code AS template_code,
         d.display_name,
         ta.storage_version,
         d.template_scope,
         ta.meta_object_key
       FROM template_artifacts ta
       LEFT JOIN deliverables d ON d.id = ta.deliverable_id
       WHERE ta.id = ?
       LIMIT 1`,
      [artifactId]
    );
    return rows?.[0] ?? null;
  }

  async loadTemplateArtifactMetaDocument(artifact, connection = this.pool) {
    if (!artifact?.meta_object_key) {
      return null;
    }
    const content = await readMinioObjectAsText(
      MINIO_TEMPLATES_BUCKET,
      String(artifact.meta_object_key || "").trim()
    );
    return parseYamlDocument(content, {
      filePath: `${MINIO_TEMPLATES_BUCKET}/${artifact.meta_object_key}`
    });
  }

  async syncArtifactWorkflowsForTemplateArtifactId(artifactId, connection = this.pool) {
    const artifact = await this.getTemplateArtifact(artifactId, connection);
    if (!artifact?.id) {
      return null;
    }

    const metaDocument = await this.loadTemplateArtifactMetaDocument(artifact, connection);
    const fillSyncSummary = await this.syncArtifactFillWorkflowForArtifact({
      connection,
      artifactId: Number(artifact.id),
      templateCode: artifact.template_code,
      storageVersion: artifact.storage_version,
      displayName: artifact.display_name,
      metaDocument
    });

    const signatureSyncSummary = await this.syncArtifactSignatureWorkflowForArtifact({
      connection,
      artifactId: Number(artifact.id),
      templateCode: artifact.template_code,
      storageVersion: artifact.storage_version,
      displayName: artifact.display_name,
      metaDocument
    });

    return {
      fill: fillSyncSummary,
      signatures: signatureSyncSummary
    };
  }

  async getTaskItem(taskItemId, connection = this.pool) {
    this.ensurePool();
    const [rows] = await connection.query(
      `SELECT id, task_id, process_definition_template_id, template_artifact_id, start_date, end_date, user_started_at
       FROM task_items
       WHERE id = ?
       LIMIT 1`,
      [taskItemId]
    );
    return rows?.[0] ?? null;
  }

  async getProcessRun(processRunId, connection = this.pool) {
    this.ensurePool();
    const [rows] = await connection.query(
      `SELECT id, process_definition_id, term_id, run_mode, created_by_user_id
       FROM process_runs
       WHERE id = ?
       LIMIT 1`,
      [processRunId]
    );
    return rows?.[0] ?? null;
  }

  async getFillFlowTemplate(fillFlowTemplateId, connection = this.pool) {
    this.ensurePool();
    const [rows] = await connection.query(
      `SELECT id, process_definition_template_id
       FROM fill_flow_templates
       WHERE id = ?
       LIMIT 1`,
      [fillFlowTemplateId]
    );
    return rows?.[0] ?? null;
  }

  async getProcessDefinitionVersion(definitionId, connection = this.pool) {
    this.ensurePool();
    const [rows] = await connection.query(
      `SELECT id, process_id, variation_key, status
       FROM process_definition_versions
       WHERE id = ?
       LIMIT 1`,
      [definitionId]
    );
    return rows?.[0] ?? null;
  }

  async getTermWithType(termId, connection = this.pool) {
    this.ensurePool();
    const [rows] = await connection.query(
      `SELECT
         t.id,
         t.term_type_id,
         tt.code AS term_type_code
       FROM terms t
       INNER JOIN term_types tt
         ON tt.id = t.term_type_id
       WHERE t.id = ?
       LIMIT 1`,
      [termId]
    );
    return rows?.[0] ?? null;
  }

  async ensureDraftDefinitionContext(definitionId, { connection = this.pool, entityLabel = "registros asociados" } = {}) {
    const definition = await this.getProcessDefinitionVersion(definitionId, connection);
    if (!definition) {
      throw new Error("La configuracion de proceso seleccionada no existe.");
    }
    if (String(definition.status || "") !== "draft") {
      throw new Error(`Solo se pueden modificar ${entityLabel} cuando la configuracion esta en draft.`);
    }
    return definition;
  }

  async cloneProcessDefinitionChildren({
    sourceDefinitionId,
    targetDefinitionId,
    targetProcessId,
    templateRemap = null,
    connection = this.pool
  }) {
    const normalizedSourceId = Number(sourceDefinitionId);
    const normalizedTargetId = Number(targetDefinitionId);
    const normalizedTargetProcessId = Number(targetProcessId);

    if (!normalizedSourceId || !normalizedTargetId) {
      return { clonedTemplates: 0, clonedRules: 0, clonedPeriodTypes: 0 };
    }

    const sourceDefinition = await this.getProcessDefinitionVersion(normalizedSourceId, connection);
    if (!sourceDefinition) {
      throw new Error("La configuracion origen para clonar no existe.");
    }
    if (normalizedTargetProcessId && Number(sourceDefinition.process_id) !== normalizedTargetProcessId) {
      throw new Error("Solo se puede clonar desde una configuracion del mismo proceso.");
    }

    const [templateRows] = await connection.query(
      `SELECT template_artifact_id, sort_order
       FROM process_definition_templates
       WHERE process_definition_id = ?
       ORDER BY sort_order ASC, id ASC`,
      [normalizedSourceId]
    );

    // Avisos no bloqueantes de sincronización de flujos: clonar la configuración NO debe fallar porque una
    // plantilla vinculada tenga un flujo incompleto (p. ej. pasos de firma con cargo sin resolver). El vínculo
    // se conserva y el flujo se re-sincroniza cuando la plantilla quede consistente (resync/reconcile).
    // Remap opcional de plantilla: re-apunta enlaces de una versión a otra (acción guiada de "actualizar
    // plantilla de config activa": la nueva config debe pinear la NUEVA versión de plantilla).
    const remap = templateRemap && typeof templateRemap === "object" ? templateRemap : null;
    const remapArtifactId = (artifactId) => {
      if (!remap || artifactId == null) return artifactId;
      const mapped = remap[String(artifactId)] ?? remap[Number(artifactId)];
      return mapped != null ? Number(mapped) : artifactId;
    };

    const templateWorkflowWarnings = [];
    for (const row of templateRows) {
      const targetArtifactId = remapArtifactId(row.template_artifact_id);
      await connection.query(
        `INSERT INTO process_definition_templates (
          process_definition_id,
          template_artifact_id,
          sort_order
        ) VALUES (?, ?, ?)`,
        [
          normalizedTargetId,
          targetArtifactId,
          row.sort_order
        ]
      );

      if (targetArtifactId) {
        try {
          await this.syncArtifactWorkflowsForTemplateArtifactId(Number(targetArtifactId), connection);
        } catch (syncError) {
          console.warn(
            `No se pudo sincronizar el flujo de la plantilla ${targetArtifactId} al versionar:`,
            syncError?.message
          );
          templateWorkflowWarnings.push(syncError?.message || String(syncError));
        }
      }
    }

    const [ruleRows] = await connection.query(
      `SELECT unit_scope_type,
              unit_id,
              unit_type_id,
              cargo_id,
              position_id,
              recipient_policy,
              priority,
              is_active,
              effective_from,
              effective_to
       FROM process_target_rules
       WHERE process_definition_id = ?
       ORDER BY priority ASC, id ASC`,
      [normalizedSourceId]
    );

    for (const row of ruleRows) {
      await connection.query(
        `INSERT INTO process_target_rules (
          process_definition_id,
          unit_scope_type,
          unit_id,
          unit_type_id,
          cargo_id,
          position_id,
          recipient_policy,
          priority,
          is_active,
          effective_from,
          effective_to
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          normalizedTargetId,
          row.unit_scope_type,
          row.unit_id,
          row.unit_type_id,
          row.cargo_id,
          row.position_id,
          row.recipient_policy,
          row.priority,
          row.is_active,
          row.effective_from,
          row.effective_to
        ]
      );
    }

    const [periodTypeRows] = await connection.query(
      `SELECT term_type_id,
              is_active
       FROM process_definition_period_types
       WHERE process_definition_id = ?
       ORDER BY id ASC`,
      [normalizedSourceId]
    );

    for (const row of periodTypeRows) {
      await connection.query(
        `INSERT INTO process_definition_period_types (
          process_definition_id,
          term_type_id,
          is_active
        ) VALUES (?, ?, ?)`,
        [
          normalizedTargetId,
          row.term_type_id,
          row.is_active
        ]
      );
    }

    return {
      clonedTemplates: templateRows.length,
      clonedRules: ruleRows.length,
      clonedPeriodTypes: periodTypeRows.length,
      templateWorkflowWarnings
    };
  }

  async ensureDefinitionHasActiveRulesForActivation(definitionId, connection = this.pool) {
    const normalizedDefinitionId = Number(definitionId);
    if (!normalizedDefinitionId) {
      return;
    }

    const [rows] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM process_target_rules
       WHERE process_definition_id = ?
         AND is_active = 1`,
      [normalizedDefinitionId]
    );

    const total = Number(rows?.[0]?.total || 0);
    if (total < 1) {
      throw new Error(
        "No se puede activar una configuracion si no tiene al menos una regla activa en Reglas de alcance."
      );
    }
  }

  async ensureDefinitionHasActivePeriodTypesForActivation(definitionId, connection = this.pool) {
    const normalizedDefinitionId = Number(definitionId);
    if (!normalizedDefinitionId) {
      return;
    }

    const [rows] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM process_definition_period_types
       WHERE process_definition_id = ?
         AND is_active = 1`,
      [normalizedDefinitionId]
    );

    const total = Number(rows?.[0]?.total || 0);
    if (total < 1) {
      throw new Error(
        "No se puede activar una configuracion si no tiene al menos un tipo de periodo activo en Periodos del proceso."
      );
    }
  }

  async ensureDefinitionHasArtifactsForActivation(definitionId, connection = this.pool) {
    const normalizedDefinitionId = Number(definitionId);
    if (!normalizedDefinitionId) {
      return;
    }

    const [rows] = await connection.query(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN ta.is_active = 1 THEN 1 ELSE 0 END) AS active_total
       FROM process_definition_templates pdt
       INNER JOIN template_artifacts ta ON ta.id = pdt.template_artifact_id
       WHERE pdt.process_definition_id = ?`,
      [normalizedDefinitionId]
    );

    const total = Number(rows?.[0]?.total || 0);
    const activeTotal = Number(rows?.[0]?.active_total || 0);
    if (total < 1) {
      throw new Error(
        "No se puede activar una configuracion si no tiene al menos un paquete (plantilla) vinculado."
      );
    }
    if (activeTotal < 1) {
      throw new Error(
        "No se puede activar: la configuracion debe tener al menos una plantilla vinculada y activa."
      );
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
          const meta = await this.loadTemplateArtifactMetaDocument(artifact);
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
      await this.retirePriorPublishedSiblings(connection, artifact.id);
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
  async ensureDefinitionRunsInTermPeriodType(definitionId, termId, connection = this.pool) {
    const normalizedDefinitionId = Number(definitionId);
    const normalizedTermId = Number(termId);

    if (!normalizedDefinitionId || !normalizedTermId) {
      throw new Error("La tarea requiere una configuracion y un periodo validos.");
    }

    const term = await this.getTermWithType(normalizedTermId, connection);
    if (!term) {
      throw new Error("El periodo seleccionado no existe.");
    }

    const [rows] = await connection.query(
      `SELECT id
       FROM process_definition_period_types
       WHERE process_definition_id = ?
         AND term_type_id = ?
         AND is_active = 1
       LIMIT 1`,
      [normalizedDefinitionId, Number(term.term_type_id)]
    );
    if (!rows?.length) {
      throw new Error("La configuracion no corre en el tipo de periodo seleccionado (revisa Periodos del proceso).");
    }
  }

  // F-C: la cabeza de unidad debe ser un puesto OCUPABLE (real/promoción); un simbólico no resolvería a una
  // persona. Se valida en la capa de app (no en trigger, para no acoplar el schema a una columna nueva).
  assertUnitHeadAllowed(isHead, positionType) {
    if (Number(isHead) === 1 && !["real", "promocion"].includes(String(positionType))) {
      throw new Error("La cabeza de la unidad debe ser un puesto real o de promoción.");
    }
  }

  // Devuelve el grafo de unidades (nodos + aristas + catálogo de tipos) para la vista de organigrama.
  // relationTypeCode filtra las aristas por tipo (p. ej. 'org'); 'all' devuelve todas.
  async getUnitGraph(relationTypeCode = "org") {
    this.ensurePool();
    const [nodes] = await this.pool.query(
      `SELECT u.id, u.name, u.label, u.slug, u.unit_type_id, ut.name AS unit_type_name, u.is_active,
              (SELECT COUNT(*) FROM unit_positions p WHERE p.unit_id = u.id AND p.is_active = 1) AS positions_count,
              (SELECT COUNT(*) FROM unit_positions p
                 INNER JOIN position_assignments pa ON pa.position_id = p.id AND pa.is_current = 1
                WHERE p.unit_id = u.id AND p.is_active = 1) AS occupied_count,
              (SELECT COUNT(*) FROM unit_positions p WHERE p.unit_id = u.id AND p.is_unit_head = 1 AND p.is_active = 1) AS head_count
       FROM units u
       LEFT JOIN unit_types ut ON ut.id = u.unit_type_id
       ORDER BY u.id ASC`
    );
    const [relationTypes] = await this.pool.query(
      "SELECT id, code, name FROM relation_unit_types ORDER BY id ASC"
    );
    let edgeSql =
      `SELECT ur.id, ur.parent_unit_id, ur.child_unit_id, ur.relation_type_id, rt.code AS relation_type_code
       FROM unit_relations ur
       INNER JOIN relation_unit_types rt ON rt.id = ur.relation_type_id`;
    const params = [];
    const code = String(relationTypeCode || "").trim();
    if (code && code !== "all") {
      edgeSql += " WHERE rt.code = ?";
      params.push(code);
    }
    edgeSql += " ORDER BY ur.id ASC";
    const [edges] = await this.pool.query(edgeSql, params);
    return { nodes, edges, relationTypes };
  }

  // --- Jerarquía de procesos (padre→hijo vía processes.parent_id), análoga al organigrama de unidades ---
  async getProcessGraph() {
    this.ensurePool();
    const [nodes] = await this.pool.query(
      `SELECT p.id, p.name, p.slug, p.is_active, p.parent_id,
              (SELECT COUNT(*) FROM process_definition_versions pdv WHERE pdv.process_id = p.id) AS definitions_count,
              (SELECT COUNT(*) FROM process_definition_versions pdv WHERE pdv.process_id = p.id AND pdv.status = 'active') AS active_count
         FROM processes p
        ORDER BY p.name ASC`
    );
    const edges = nodes
      .filter((node) => node.parent_id)
      .map((node) => ({
        id: `pe-${node.parent_id}-${node.id}`,
        parent_process_id: node.parent_id,
        child_process_id: node.id
      }));
    // Configuraciones (process_definition_versions) por proceso, para el grafo multinivel expandible.
    const [configs] = await this.pool.query(
      `SELECT pdv.id AS definition_id, pdv.process_id, pdv.name AS definition_name,
              pdv.variation_key, pdv.definition_version, pdv.status,
              pds.source_type AS series_source_type, pds.code AS series_code,
              sc.name AS series_cargo_name, sut.name AS series_unit_type_name
         FROM process_definition_versions pdv
         INNER JOIN process_definition_series pds ON pds.id = pdv.series_id
         LEFT JOIN cargos sc ON sc.id = pds.cargo_id
         LEFT JOIN unit_types sut ON sut.id = pds.unit_type_id
        ORDER BY pdv.process_id, FIELD(pdv.status, 'active', 'draft', 'retired'), pdv.variation_key ASC`
    );
    // Entregables (plantillas vinculadas) por configuración, para el 3er nivel del grafo. Una misma plantilla
    // puede estar en varias configuraciones: cada fila pdt es un nodo (duplicado por config) y el template_code
    // es el distintivo que identifica que es el mismo entregable.
    const [templates] = await this.pool.query(
      `SELECT pdt.id, pdt.process_definition_id AS definition_id, pdv.process_id,
              pdt.template_artifact_id, d.code AS template_code, d.display_name, d.template_scope,
              ta.storage_version, ta.lifecycle_state,
              (SELECT COUNT(*) FROM template_artifacts tav WHERE tav.deliverable_id = ta.deliverable_id) AS version_count
         FROM process_definition_templates pdt
         INNER JOIN process_definition_versions pdv ON pdv.id = pdt.process_definition_id
         INNER JOIN template_artifacts ta ON ta.id = pdt.template_artifact_id
         INNER JOIN deliverables d ON d.id = ta.deliverable_id
        ORDER BY pdt.process_definition_id, pdt.sort_order ASC`
    );
    return { nodes, edges, configs, templates };
  }

  // Todas las versiones de un template_code (para el drawer de versiones del grafo): linaje completo con su
  // estado, ordenadas de la más nueva a la más antigua.
  async getTemplateVersions(templateCode) {
    this.ensurePool();
    const code = String(templateCode || "").trim();
    if (!code) return [];
    const [rows] = await this.pool.query(
      `SELECT ta.id, d.code AS template_code, d.display_name, ta.storage_version, ta.lifecycle_state, ta.is_active,
              ta.parent_version_id, d.template_scope, ta.created_at
         FROM template_artifacts ta
         INNER JOIN deliverables d ON d.id = ta.deliverable_id
        WHERE d.code = ?
        ORDER BY ta.created_at DESC, ta.id DESC`,
      [code]
    );
    return rows;
  }

  // Ciclo: poner parentId como padre de childId lo cerraría si parentId ya es descendiente de childId
  // (o son el mismo). CTE recursiva sobre processes.parent_id.
  async wouldCreateProcessCycle(parentId, childId, connection = this.pool) {
    if (Number(parentId) === Number(childId)) {
      return true;
    }
    const [rows] = await connection.query(
      `WITH RECURSIVE descendants AS (
         SELECT id FROM processes WHERE parent_id = ?
         UNION ALL
         SELECT p.id FROM processes p INNER JOIN descendants d ON p.parent_id = d.id
       )
       SELECT 1 FROM descendants WHERE id = ? LIMIT 1`,
      [childId, parentId]
    );
    return rows.length > 0;
  }

  async createProcessWithParent({ name, slug, parent_id = null } = {}) {
    this.ensurePool();
    const cleanName = String(name || "").trim();
    if (!cleanName) {
      throw new Error("El nombre del proceso es obligatorio.");
    }
    const cleanSlug = slugify(slug || cleanName);
    if (!cleanSlug) {
      throw new Error("No se pudo derivar el slug del proceso.");
    }
    const parentId = parent_id ? Number(parent_id) : null;
    if (parentId) {
      const parent = await this.getByKeys("processes", { id: parentId });
      if (!parent) {
        throw new Error("El proceso padre no existe.");
      }
    }
    try {
      const [r] = await this.pool.query(
        "INSERT INTO processes (name, slug, parent_id, is_active) VALUES (?, ?, ?, 1)",
        [cleanName, cleanSlug, parentId]
      );
      return { id: Number(r.insertId) };
    } catch (error) {
      if (error?.code === "ER_DUP_ENTRY") {
        throw new Error("Ya existe un proceso con ese identificador (slug).");
      }
      throw error;
    }
  }

  // Reparenta (o desvincula con parentId null) un proceso, con guardia de ciclo.
  async setProcessParent(processId, parentId) {
    this.ensurePool();
    const id = Number(processId);
    const newParent = parentId ? Number(parentId) : null;
    const proc = await this.getByKeys("processes", { id });
    if (!proc) {
      throw new Error("El proceso no existe.");
    }
    if (newParent) {
      if (newParent === id) {
        throw new Error("Un proceso no puede ser su propio padre.");
      }
      const parent = await this.getByKeys("processes", { id: newParent });
      if (!parent) {
        throw new Error("El proceso padre no existe.");
      }
      if (await this.wouldCreateProcessCycle(newParent, id)) {
        throw new Error("La relación crearía un ciclo en la jerarquía de procesos.");
      }
    }
    await this.pool.query("UPDATE processes SET parent_id = ? WHERE id = ?", [newParent, id]);
    return { id, parent_id: newParent };
  }

  // Detalle de un proceso para el cockpit del grafo de procesos: el registro en sí (+ nombre del padre),
  // sus configuraciones (process_definition_versions agrupadas por serie/variación, con estado y conteos de
  // reglas/plantillas/corridas), sus sub-procesos (hijos en el árbol parent_id) y sus corridas (process_runs).
  async getProcessDetail(processId) {
    this.ensurePool();
    const id = Number(processId);
    if (!id) {
      throw new Error("Proceso inválido.");
    }
    const [processRows] = await this.pool.query(
      `SELECT p.id, p.name, p.slug, p.parent_id, p.is_active, par.name AS parent_name
         FROM processes p
         LEFT JOIN processes par ON par.id = p.parent_id
        WHERE p.id = ?
        LIMIT 1`,
      [id]
    );
    const process = processRows?.[0];
    if (!process) {
      throw new Error("El proceso no existe.");
    }

    const [configurations] = await this.pool.query(
      `SELECT pdv.id AS definition_id,
              pdv.name AS definition_name,
              pdv.variation_key,
              pdv.definition_version,
              pdv.status,
              pdv.effective_from,
              pdv.effective_to,
              pds.id AS series_id,
              pds.source_type AS series_source_type,
              pds.code AS series_code,
              sc.name AS series_cargo_name,
              sut.name AS series_unit_type_name,
              (SELECT COUNT(*) FROM process_target_rules ptr WHERE ptr.process_definition_id = pdv.id) AS rules_count,
              (SELECT COUNT(*) FROM process_definition_templates pdt WHERE pdt.process_definition_id = pdv.id) AS templates_count,
              (SELECT COUNT(*) FROM process_runs pr WHERE pr.process_definition_id = pdv.id) AS runs_count
         FROM process_definition_versions pdv
         INNER JOIN process_definition_series pds ON pds.id = pdv.series_id
         LEFT JOIN cargos sc ON sc.id = pds.cargo_id
         LEFT JOIN unit_types sut ON sut.id = pds.unit_type_id
        WHERE pdv.process_id = ?
        ORDER BY FIELD(pdv.status, 'active', 'draft', 'retired'),
                 pdv.variation_key ASC, pdv.definition_version DESC`,
      [id]
    );

    const [children] = await this.pool.query(
      `SELECT c.id, c.name, c.slug, c.is_active,
              (SELECT COUNT(*) FROM process_definition_versions pdv WHERE pdv.process_id = c.id) AS definitions_count,
              (SELECT COUNT(*) FROM process_definition_versions pdv WHERE pdv.process_id = c.id AND pdv.status = 'active') AS active_count
         FROM processes c
        WHERE c.parent_id = ?
        ORDER BY c.name ASC`,
      [id]
    );

    const [runs] = await this.pool.query(
      `SELECT pr.id, pr.process_definition_id, pr.run_mode, pr.status, pr.reason, pr.source_run_id, pr.created_at,
              pdv.name AS definition_name, pdv.variation_key, pdv.definition_version,
              t.id AS term_id, t.name AS term_name,
              tt.code AS term_type_code, tt.name AS term_type_name
         FROM process_runs pr
         INNER JOIN process_definition_versions pdv ON pdv.id = pr.process_definition_id
         LEFT JOIN terms t ON t.id = pr.term_id
         LEFT JOIN term_types tt ON tt.id = t.term_type_id
        WHERE pdv.process_id = ?
        ORDER BY pr.created_at DESC`,
      [id]
    );

    return {
      process: {
        id: process.id,
        name: process.name,
        slug: process.slug,
        parent_id: process.parent_id,
        parent_name: process.parent_name,
        is_active: process.is_active
      },
      configurations,
      children,
      runs
    };
  }

  // Detecta si crear la arista parent->child (en un tipo de relación) cerraría un ciclo: ocurre si el padre
  // ya es descendiente del hijo dentro de ese mismo tipo. CTE recursiva acotada al relation_type.
  async wouldCreateUnitCycle(parentUnitId, childUnitId, relationTypeId, connection = this.pool) {
    if (Number(parentUnitId) === Number(childUnitId)) {
      return true;
    }
    const [rows] = await connection.query(
      `WITH RECURSIVE descendants AS (
         SELECT child_unit_id FROM unit_relations
          WHERE parent_unit_id = ? AND relation_type_id = ?
         UNION ALL
         SELECT ur.child_unit_id FROM unit_relations ur
         INNER JOIN descendants d ON ur.parent_unit_id = d.child_unit_id
          WHERE ur.relation_type_id = ?
       )
       SELECT 1 FROM descendants WHERE child_unit_id = ? LIMIT 1`,
      [childUnitId, relationTypeId, relationTypeId, parentUnitId]
    );
    return rows.length > 0;
  }

  // Detalle de una unidad para el panel del organigrama: sus puestos (cargo, slot, jefatura, activo) y el
  // ocupante actual de cada uno (position_assignments → persons).
  async getUnitDetail(unitId) {
    this.ensurePool();
    const id = Number(unitId);
    if (!id) {
      throw new Error("Unidad inválida.");
    }
    const unit = await this.getByKeys("units", { id });
    if (!unit) {
      throw new Error("La unidad no existe.");
    }
    const [positions] = await this.pool.query(
      `SELECT p.id, p.slot_no, p.title, p.is_unit_head, p.is_active, p.position_type, p.cargo_id, p.profile,
              c.name AS cargo_name, c.code AS cargo_code,
              pa.id AS assignment_id, pa.start_date,
              pers.id AS person_id, pers.cedula,
              CONCAT(COALESCE(pers.first_name, ''), ' ', COALESCE(pers.last_name, '')) AS person_name
       FROM unit_positions p
       LEFT JOIN cargos c ON c.id = p.cargo_id
       LEFT JOIN position_assignments pa ON pa.position_id = p.id AND pa.is_current = 1
       LEFT JOIN persons pers ON pers.id = pa.person_id
       WHERE p.unit_id = ?
       ORDER BY p.is_unit_head DESC, c.name ASC, p.slot_no ASC`,
      [id]
    );
    return {
      unit: { id: unit.id, name: unit.name, label: unit.label },
      positions
    };
  }

  // Procesos que aplican a una unidad: reglas de alcance (process_target_rules) que la referencian
  // directamente (unit_exact/unit_subtree por unit_id), por su tipo de unidad, o de alcance global (all_units).
  async getUnitProcesses(unitId) {
    this.ensurePool();
    const id = Number(unitId);
    if (!id) {
      throw new Error("Unidad inválida.");
    }
    const unit = await this.getByKeys("units", { id });
    if (!unit) {
      throw new Error("La unidad no existe.");
    }
    const [rows] = await this.pool.query(
      `SELECT
              ptr.id AS rule_id,
              pdv.id AS definition_id,
              p.name AS process_name,
              pdv.name AS definition_name,
              pdv.definition_version,
              pdv.variation_key,
              pdv.status,
              ptr.unit_scope_type,
              ptr.recipient_policy,
              ptr.priority,
              ptr.is_active AS rule_active,
              ptr.unit_id,
              ptr.unit_type_id,
              ptr.cargo_id,
              ptr.position_id,
              c.name AS cargo_name,
              up.title AS position_title,
              upc.name AS position_cargo_name,
              CASE
                WHEN ptr.unit_id = ? THEN 'direct'
                WHEN ptr.unit_type_id IS NOT NULL AND ptr.unit_type_id = ? THEN 'type'
                WHEN ptr.unit_scope_type = 'all_units' THEN 'global'
                ELSE 'other'
              END AS origin
       FROM process_target_rules ptr
       INNER JOIN process_definition_versions pdv ON pdv.id = ptr.process_definition_id
       INNER JOIN processes p ON p.id = pdv.process_id
       LEFT JOIN cargos c ON c.id = ptr.cargo_id
       LEFT JOIN unit_positions up ON up.id = ptr.position_id
       LEFT JOIN cargos upc ON upc.id = up.cargo_id
       WHERE ptr.unit_id = ?
          OR (ptr.unit_type_id IS NOT NULL AND ptr.unit_type_id = ?)
          OR ptr.unit_scope_type = 'all_units'
       ORDER BY (ptr.unit_id = ?) DESC,
                FIELD(pdv.status, 'active', 'draft', 'retired'),
                p.name ASC, pdv.definition_version DESC`,
      [id, unit.unit_type_id, id, unit.unit_type_id, id]
    );
    return {
      unit: { id: unit.id, name: unit.name },
      processes: rows
    };
  }

  // Configuraciones de proceso a las que se puede vincular esta unidad vía regla de alcance.
  // Dos restricciones del modelo:
  // 1) Las reglas de alcance solo se editan mientras la configuración está en 'draft' (activar congela el
  //    diseño; cambiar alcance ⇒ nueva versión). Por eso solo se ofrecen configuraciones en draft.
  // 2) Solo variaciones por cargo o default: las variaciones por tipo de unidad fijan el alcance a 'unit_type'
  //    (unit_id NULL) y aplican a todas las unidades del tipo, así que no se acotan por unidad.
  async getUnitAttachableProcesses(unitId) {
    this.ensurePool();
    const id = Number(unitId);
    if (!id) {
      throw new Error("Unidad inválida.");
    }
    const [rows] = await this.pool.query(
      `SELECT pdv.id AS definition_id,
              p.name AS process_name,
              pdv.name AS definition_name,
              pdv.definition_version,
              pdv.variation_key,
              pds.source_type AS series_source_type,
              pds.cargo_id AS series_cargo_id,
              c.name AS series_cargo_name
         FROM process_definition_versions pdv
         INNER JOIN processes p ON p.id = pdv.process_id
         INNER JOIN process_definition_series pds ON pds.id = pdv.series_id
         LEFT JOIN cargos c ON c.id = pds.cargo_id
        WHERE pdv.status = 'draft'
          AND pds.source_type <> 'unit_type'
        ORDER BY p.name ASC, pdv.definition_version DESC`
    );
    return { definitions: rows };
  }

  // --- Gestión de puestos y ocupaciones desde el organigrama ---
  // Crea un puesto (unit_position) en una unidad. slot_no se autoincrementa por (unidad, cargo).
  // Normaliza el perfil del puesto a un JSON con las keys soportadas (formacion/experiencia/capacitacion/
  // investigacion). Acepta objeto o string JSON; devuelve un string JSON o null si queda vacío.
  normalizePositionProfile(profile) {
    if (profile === undefined || profile === null || profile === "") return null;
    let obj = profile;
    if (typeof profile === "string") {
      try {
        obj = JSON.parse(profile);
      } catch {
        throw new Error("El perfil debe ser un JSON válido.");
      }
    }
    if (typeof obj !== "object" || Array.isArray(obj)) {
      throw new Error("El perfil debe ser un objeto con secciones (formación, experiencia, etc.).");
    }
    const KEYS = ["formacion", "experiencia", "capacitacion", "investigacion"];
    const out = {};
    for (const key of KEYS) {
      const value = obj[key];
      if (value === undefined || value === null) continue;
      const text = String(value).trim();
      if (text) out[key] = text;
    }
    return Object.keys(out).length ? JSON.stringify(out) : null;
  }

  async addUnitPosition(unitId, data = {}) {
    this.ensurePool();
    const uId = Number(unitId);
    const cargoId = Number(data.cargo_id);
    if (!uId || !cargoId) {
      throw new Error("La unidad y el cargo son obligatorios.");
    }
    const positionType = ["real", "promocion", "simbolico"].includes(data.position_type) ? data.position_type : "real";
    const isHead = data.is_unit_head ? 1 : 0;
    this.assertUnitHeadAllowed(isHead, positionType);
    const profileJson = this.normalizePositionProfile(data.profile);
    const [slotRows] = await this.pool.query(
      "SELECT COALESCE(MAX(slot_no), 0) + 1 AS next_slot FROM unit_positions WHERE unit_id = ? AND cargo_id = ?",
      [uId, cargoId]
    );
    const nextSlot = Number(slotRows?.[0]?.next_slot || 1);
    try {
      const [r] = await this.pool.query(
        `INSERT INTO unit_positions (unit_id, cargo_id, slot_no, title, profile, position_type, is_unit_head, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [uId, cargoId, nextSlot, String(data.title || "").trim() || null, profileJson, positionType, isHead]
      );
      return { id: Number(r.insertId) };
    } catch (error) {
      if (error?.code === "ER_DUP_ENTRY") {
        throw new Error("La unidad ya tiene una jefatura asignada (solo se permite una).");
      }
      throw error;
    }
  }

  async updateUnitPosition(positionId, data = {}) {
    this.ensurePool();
    const pid = Number(positionId);
    const existing = await this.getByKeys("unit_positions", { id: pid });
    if (!existing) {
      throw new Error("El puesto no existe.");
    }
    const effType = data.position_type !== undefined ? data.position_type : existing.position_type;
    const effHead = data.is_unit_head !== undefined ? (data.is_unit_head ? 1 : 0) : existing.is_unit_head;
    this.assertUnitHeadAllowed(effHead, effType);
    const fields = [];
    const params = [];
    if (data.title !== undefined) { fields.push("title = ?"); params.push(String(data.title || "").trim() || null); }
    if (data.cargo_id !== undefined) { fields.push("cargo_id = ?"); params.push(Number(data.cargo_id)); }
    if (data.position_type !== undefined) { fields.push("position_type = ?"); params.push(effType); }
    if (data.is_unit_head !== undefined) { fields.push("is_unit_head = ?"); params.push(effHead); }
    if (data.is_active !== undefined) { fields.push("is_active = ?"); params.push(data.is_active ? 1 : 0); }
    if (data.profile !== undefined) { fields.push("profile = ?"); params.push(this.normalizePositionProfile(data.profile)); }
    if (!fields.length) {
      return { id: pid };
    }
    params.push(pid);
    try {
      await this.pool.query(`UPDATE unit_positions SET ${fields.join(", ")} WHERE id = ?`, params);
    } catch (error) {
      if (error?.code === "ER_DUP_ENTRY") {
        throw new Error("La unidad ya tiene una jefatura asignada (solo se permite una).");
      }
      throw error;
    }
    return { id: pid };
  }

  // Elimina un puesto y sus ocupaciones (transacción). Antes limpia los role_assignments derivados de esas
  // ocupaciones (FK derived_from_assignment_id) y sus relation_types. Si el puesto está referenciado por
  // vacantes/contratos/reglas, se rechaza con mensaje claro (mejor desactivarlo).
  async removeUnitPosition(positionId) {
    this.ensurePool();
    const pid = Number(positionId);
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        `DELETE rart FROM role_assignment_relation_types rart
           INNER JOIN role_assignments ra ON ra.id = rart.role_assignment_id
          WHERE ra.derived_from_assignment_id IN (SELECT id FROM position_assignments WHERE position_id = ?)`,
        [pid]
      );
      await connection.query(
        `DELETE FROM role_assignments
          WHERE derived_from_assignment_id IN (SELECT id FROM position_assignments WHERE position_id = ?)`,
        [pid]
      );
      await connection.query("DELETE FROM position_assignments WHERE position_id = ?", [pid]);
      await connection.query("DELETE FROM unit_positions WHERE id = ?", [pid]);
      await connection.commit();
      return { id: pid };
    } catch (error) {
      await connection.rollback();
      if (error?.code === "ER_ROW_IS_REFERENCED_2" || error?.code === "ER_ROW_IS_REFERENCED") {
        throw new Error("No se puede eliminar: el puesto está referenciado (vacantes, contratos o reglas). Desactívalo en su lugar.");
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  // Asigna (o cambia) el ocupante de un puesto: cierra la ocupación vigente y crea la nueva (atómico).
  async assignUnitPosition(positionId, personId) {
    this.ensurePool();
    const pid = Number(positionId);
    const perId = Number(personId);
    if (!pid || !perId) {
      throw new Error("El puesto y la persona son obligatorios.");
    }
    const position = await this.getByKeys("unit_positions", { id: pid });
    if (!position) {
      throw new Error("El puesto no existe.");
    }
    const person = await this.getByKeys("persons", { id: perId });
    if (!person) {
      throw new Error("La persona no existe.");
    }
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        "UPDATE position_assignments SET is_current = 0, end_date = CURDATE() WHERE position_id = ? AND is_current = 1",
        [pid]
      );
      await connection.query(
        "INSERT INTO position_assignments (position_id, person_id, start_date, is_current) VALUES (?, ?, CURDATE(), 1)",
        [pid, perId]
      );
      await connection.commit();
      return { ok: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Quita el ocupante vigente de un puesto (cierra la ocupación).
  async unassignUnitPosition(positionId) {
    this.ensurePool();
    const pid = Number(positionId);
    await this.pool.query(
      "UPDATE position_assignments SET is_current = 0, end_date = CURDATE() WHERE position_id = ? AND is_current = 1",
      [pid]
    );
    return { ok: true };
  }

  // Crea una unidad y, opcionalmente, su relación con un padre en un solo paso atómico (para "+ Hijo/Hermano"
  // desde el organigrama). La nueva unidad es una hoja nueva: no puede formar ciclo ni duplicar padre.
  async createUnitWithParent({ name, label, slug, unit_type_id, parent_unit_id, relation_type_id } = {}) {
    this.ensurePool();
    const nm = String(name || "").trim();
    if (!nm) {
      throw new Error("Ingresa el nombre de la unidad.");
    }
    const unitTypeId = Number(unit_type_id);
    if (!unitTypeId) {
      throw new Error("Selecciona el tipo de unidad.");
    }
    const finalSlug = (String(slug || "").trim() || slugify(nm)).slice(0, 180);
    if (!finalSlug) {
      throw new Error("No se pudo derivar un slug para la unidad.");
    }
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [unitResult] = await connection.query(
        "INSERT INTO units (name, label, slug, unit_type_id, is_active) VALUES (?, ?, ?, ?, 1)",
        [nm.slice(0, 180), (String(label || "").trim() || nm).slice(0, 180), finalSlug, unitTypeId]
      );
      const newUnitId = Number(unitResult.insertId);
      let relationId = null;
      const parentId = Number(parent_unit_id);
      const relTypeId = Number(relation_type_id);
      if (parentId && relTypeId) {
        const [relResult] = await connection.query(
          "INSERT INTO unit_relations (relation_type_id, parent_unit_id, child_unit_id) VALUES (?, ?, ?)",
          [relTypeId, parentId, newUnitId]
        );
        relationId = Number(relResult.insertId);
      }
      await connection.commit();
      return { unit_id: newUnitId, relation_id: relationId };
    } catch (error) {
      await connection.rollback();
      if (error?.code === "ER_DUP_ENTRY") {
        throw new Error("Ya existe una unidad con ese slug. Cambia el nombre o el slug.");
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  async create(tableName, data) {
    this.ensurePool();
    const config = getConfig(tableName);
    const payload = pickPayload(config.fields, data);
    if (tableName === "unit_positions") {
      this.assertUnitHeadAllowed(payload.is_unit_head, payload.position_type || "real");
    }
    if (tableName === "unit_relations") {
      const parentId = Number(payload.parent_unit_id);
      const childId = Number(payload.child_unit_id);
      const relTypeId = Number(payload.relation_type_id);
      if (!parentId || !childId || !relTypeId) {
        throw new Error("La relación requiere unidad padre, unidad hija y tipo de relación.");
      }
      if (parentId === childId) {
        throw new Error("Una unidad no puede relacionarse consigo misma.");
      }
      const [existingParent] = await this.pool.query(
        "SELECT parent_unit_id FROM unit_relations WHERE child_unit_id = ? AND relation_type_id = ? LIMIT 1",
        [childId, relTypeId]
      );
      if (existingParent.length) {
        throw new Error("Esa unidad ya tiene un padre en este tipo de relación. Quita la relación actual antes de crear otra.");
      }
      if (await this.wouldCreateUnitCycle(parentId, childId, relTypeId)) {
        throw new Error("La relación crearía un ciclo en la jerarquía (la unidad padre ya depende de la hija).");
      }
    }
    const cloneSourceDefinitionId = (
      tableName === "process_definition_versions"
      && data?.source_process_definition_id !== undefined
      && data?.source_process_definition_id !== null
      && data?.source_process_definition_id !== ""
    )
      ? Number(data.source_process_definition_id)
      : null;

    if (tableName === "process_definition_versions") {
      if (typeof payload.definition_version === "string") {
        payload.definition_version = payload.definition_version.trim();
      }
    }

    if (tableName === "process_definition_series") {
      const identity = await this.resolveProcessDefinitionSeriesIdentity(payload);
      Object.assign(payload, identity);
      const [dupRows] = await this.pool.query(
        `SELECT id
         FROM process_definition_series
         WHERE code = ?
         LIMIT 1`,
        [identity.code]
      );
      if (dupRows?.length) {
        throw new Error("Ya existe una serie con ese origen.");
      }
    }

    if (tableName === "persons") {
      const rawPassword = typeof data?.password === "string" ? data.password : "";
      const rawToken = typeof data?.token === "string" ? data.token.trim() : "";
      payload.token = rawToken || await resolveUniquePersonToken(this.pool);
      if (rawPassword) {
        payload.password_hash = await hashPassword(rawPassword);
      } else if (typeof payload.password_hash === "string" && payload.password_hash) {
        if (!isBcryptHash(payload.password_hash)) {
          payload.password_hash = await hashPassword(payload.password_hash);
        }
      } else {
        throw new Error("Ingresa el password del usuario.");
      }
    }

    if (
      tableName === "process_definition_templates"
      || tableName === "process_target_rules"
      || tableName === "process_definition_period_types"
    ) {
      await this.ensureDraftDefinitionContext(
        payload.process_definition_id,
        {
          entityLabel:
            tableName === "process_definition_templates"
              ? "las plantillas de configuracion"
              : tableName === "process_target_rules"
                ? "las reglas de alcance"
                : "los periodos del proceso"
        }
      );
    }

    if (tableName === "process_definition_templates") {
      // F3 — "la pared": solo se enlaza un entregable cuyo dueño = (proceso, variación) de la config.
      await this.assertDeliverableBelongsToConfigLine(payload.process_definition_id, payload.template_artifact_id);
      // Vínculo idempotente: si la plantilla ya está en esta configuración (p. ej. porque al crearla desde el
      // wizard ya se enlazó), no se duplica el registro (evita el ER_DUP_ENTRY de uq_process_definition_templates);
      // se devuelve el vínculo existente.
      const [existingLinkRows] = await this.pool.query(
        `SELECT id, sort_order FROM process_definition_templates
         WHERE process_definition_id = ? AND template_artifact_id = ? LIMIT 1`,
        [payload.process_definition_id, payload.template_artifact_id]
      );
      if (existingLinkRows?.length) {
        return sanitizePersonRow(tableName, {
          id: existingLinkRows[0].id,
          process_definition_id: Number(payload.process_definition_id),
          template_artifact_id: Number(payload.template_artifact_id),
          sort_order: existingLinkRows[0].sort_order,
          __notice: "La plantilla ya estaba vinculada a esta configuración."
        });
      }
      // El orden es interno (secuencia de la plantilla dentro de la configuración) y se asigna solo:
      // el usuario no debe elegirlo.
      if (payload.sort_order === undefined || payload.sort_order === null || payload.sort_order === "") {
        const [countRows] = await this.pool.query(
          "SELECT COUNT(*) AS c FROM process_definition_templates WHERE process_definition_id = ?",
          [payload.process_definition_id]
        );
        payload.sort_order = Number(countRows?.[0]?.c || 0) + 1;
      }
    }

    if (tableName === "process_target_rules") {
      await this.applyTargetRuleSeriesConstraints(payload.process_definition_id, payload);
    }

    if (tableName === "process_definition_period_types") {
      const definition = await this.getProcessDefinitionVersion(payload.process_definition_id);
      if (!definition) {
        throw new Error("La configuracion de proceso seleccionada no existe.");
      }
    }

    if (tableName === "tasks") {
      const definition = await this.getProcessDefinitionVersion(payload.process_definition_id);
      if (!definition) {
        throw new Error("La configuracion de proceso seleccionada no existe.");
      }
      if (String(definition.status || "") !== "active") {
        throw new Error("Solo se pueden instanciar tareas desde configuraciones activas.");
      }
      await this.ensureDefinitionRunsInTermPeriodType(
        payload.process_definition_id,
        payload.term_id
      );

      if (payload.process_run_id) {
        const processRun = await this.getProcessRun(payload.process_run_id);
        if (!processRun) {
          throw new Error("La corrida de proceso seleccionada no existe.");
        }
        if (Number(processRun.process_definition_id) !== Number(payload.process_definition_id)) {
          throw new Error("La corrida de proceso no pertenece a la configuracion seleccionada.");
        }
        if (Number(processRun.term_id || 0) !== Number(payload.term_id || 0)) {
          throw new Error("La corrida de proceso no pertenece al periodo seleccionado.");
        }
      }
    }

    if (tableName === "task_items" && payload.process_definition_template_id) {
      const template = await this.getTaskTemplate(payload.process_definition_template_id);
      if (!template) {
        throw new Error("La plantilla de proceso configurado seleccionada no existe.");
      }
      const task = await this.getByKeys("tasks", { id: payload.task_id });
      if (!task) {
        throw new Error("La tarea seleccionada no existe.");
      }
      if (Number(task.process_definition_id) !== Number(template.process_definition_id)) {
        throw new Error("La plantilla seleccionada no pertenece a la configuracion de proceso de la tarea.");
      }
      payload.template_artifact_id = template.template_artifact_id;
      if (!payload.start_date) {
        payload.start_date = task.start_date;
      }
      if (payload.end_date === undefined || payload.end_date === "") {
        payload.end_date = task.end_date ?? null;
      }
      if (payload.sort_order === undefined || payload.sort_order === null || payload.sort_order === "") {
        payload.sort_order = template.sort_order;
      }
    }

    if (tableName === "documents" && payload.task_item_id) {
      const taskItem = await this.getTaskItem(payload.task_item_id);
      if (!taskItem) {
        throw new Error("El item de tarea seleccionado no existe.");
      }
      payload.origin_type = payload.origin_type || "task_item";
    }

    if (tableName === "documents" && !payload.task_item_id) {
      if (!payload.owner_person_id) {
        throw new Error("Los documentos standalone requieren un propietario.");
      }
      payload.origin_type = payload.origin_type || "standalone";
    }

    if (tableName === "fill_flow_templates" && payload.process_definition_template_id) {
      const template = await this.getTaskTemplate(payload.process_definition_template_id);
      if (!template) {
        throw new Error("La plantilla de proceso configurado seleccionada no existe.");
      }
      payload.process_definition_id = template.process_definition_id;
      await this.ensureDraftDefinitionContext(
        template.process_definition_id,
        { entityLabel: "los flujos de entrega" }
      );
      delete payload.process_definition_id;
    }

    if (tableName === "fill_flow_steps" && payload.fill_flow_template_id) {
      const fillFlowTemplate = await this.getFillFlowTemplate(payload.fill_flow_template_id);
      if (!fillFlowTemplate) {
        throw new Error("La plantilla de entrega seleccionada no existe.");
      }
      const template = await this.getTaskTemplate(fillFlowTemplate.process_definition_template_id);
      if (!template) {
        throw new Error("La plantilla de proceso definida asociada no existe.");
      }
      await this.ensureDraftDefinitionContext(
        template.process_definition_id,
        { entityLabel: "los pasos de entrega" }
      );
    }

    if (tableName === "document_versions" && payload.document_id) {
      const document = await this.getByKeys("documents", { id: payload.document_id });
      if (!document) {
        throw new Error("El documento seleccionado no existe.");
      }
      if (!payload.template_artifact_id && document.task_item_id) {
        const taskItem = await this.getTaskItem(document.task_item_id);
        if (taskItem?.template_artifact_id) {
          payload.template_artifact_id = taskItem.template_artifact_id;
        }
      }
    }

    if (tableName === "signature_flow_templates" && payload.process_definition_template_id) {
      const template = await this.getTaskTemplate(payload.process_definition_template_id);
      if (!template) {
        throw new Error("La plantilla de proceso configurado seleccionada no existe.");
      }
      await this.ensureDraftDefinitionContext(
        template.process_definition_id,
        { entityLabel: "los flujos de firma" }
      );
    }

    if (tableName === "template_artifacts") {
      throw new Error("Los artifacts se registran por sincronizacion desde MinIO o mediante el flujo de plantilla de documento.");
    }

    if (tableName === "process_definition_versions") {
      const requestedStatus = String(payload.status || "draft");
      if (requestedStatus !== "draft") {
        throw new Error("Las nuevas configuraciones solo pueden crearse en estado draft.");
      }
      const series = await this.resolveProcessDefinitionSeries(payload);
      payload.variation_key = String(series.code || "").trim();
      // El proceso por defecto es especial: SOLO admite la configuración "sin variación"
      // (source_type='default'). Puede versionarse (N versiones), pero no tener otra
      // variación por cargo/tipo de unidad.
      await this.ensureDefaultProcessSingleVariation(payload.process_id, series);
      payload.name = await this.resolveProcessDefinitionVersionName(payload.process_id, payload.series_id);
      payload.status = "draft";
      await this.ensureProcessDefinitionVersionAvailable(payload);
    }

    const required = config.fields.filter((field) => field.required && !field.readOnly && !field.virtual);
    const missing = required.filter((field) => payload[field.name] === undefined || payload[field.name] === "");

    if (missing.length) {
      throw new Error(`Datos incompletos: ${missing.map((field) => field.label || field.name).join(", ")}`);
    }

    validateFieldTypes(config, payload);
    validateTableRules(tableName, payload);

    if (tableName === "vacancies") {
      await this.ensureContractablePosition(payload.position_id ?? data?.position_id);
    }

    const columns = Object.keys(payload);
    if (!columns.length) {
      throw new Error("No hay datos para insertar.");
    }

    const values = columns.map((key) => payload[key]);
    const placeholders = columns.map(() => "?").join(", ");
    let result;
    let createNotice = "";
    try {
      if (tableName === "process_definition_versions") {
        const connection = await this.pool.getConnection();
        try {
          await connection.beginTransaction();
          const [insertResult] = await connection.query(
            `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`,
            values
          );
          result = insertResult;

          if (cloneSourceDefinitionId) {
            const cloneSummary = await this.cloneProcessDefinitionChildren({
              sourceDefinitionId: cloneSourceDefinitionId,
              targetDefinitionId: insertResult.insertId,
              targetProcessId: payload.process_id,
              connection
            });
            if (cloneSummary.clonedTemplates || cloneSummary.clonedRules || cloneSummary.clonedPeriodTypes) {
              createNotice =
                `Se clonaron ${cloneSummary.clonedTemplates} plantillas, ${cloneSummary.clonedRules} reglas`
                + ` y ${cloneSummary.clonedPeriodTypes} periodos del proceso desde la configuracion origen.`;
            }
            if (cloneSummary.templateWorkflowWarnings?.length) {
              createNotice = `${createNotice || ""} Atención: ${cloneSummary.templateWorkflowWarnings.length} plantilla(s) con flujo incompleto no se sincronizaron (revisa sus pasos de firma y vuelve a sincronizarlas).`.trim();
            }
          }

          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } else if (tableName === "tasks") {
        const connection = await this.pool.getConnection();
        try {
          await connection.beginTransaction();
          if (!payload.process_run_id) {
            payload.process_run_id = await ensureProcessRun({
              connection,
              processDefinitionId: Number(payload.process_definition_id),
              termId: Number(payload.term_id),
              runMode: "manual",
              createdByUserId: payload.created_by_user_id || null,
              status: "active"
            });
          }
          const taskColumns = Object.keys(payload);
          const taskPlaceholders = taskColumns.map(() => "?").join(", ");
          const taskValues = taskColumns.map((key) => payload[key]);
          const [insertResult] = await connection.query(
            `INSERT INTO ${tableName} (${taskColumns.join(", ")}) VALUES (${taskPlaceholders})`,
            taskValues
          );
          result = insertResult;
          await hydrateTaskFromDefinition({
            connection,
            taskId: insertResult.insertId,
            processDefinitionId: Number(payload.process_definition_id),
            termId: Number(payload.term_id)
          });
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } else if (tableName === "task_items") {
        const connection = await this.pool.getConnection();
        try {
          await connection.beginTransaction();
          const [insertResult] = await connection.query(
            `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`,
            values
          );
          result = insertResult;
          const taskItem = await this.getTaskItem(insertResult.insertId, connection);
          if (taskItem) {
            await ensureDocumentForTaskItem(connection, taskItem);
          } else {
            await ensureDocumentsForTask(connection, Number(payload.task_id));
          }
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } else if (tableName === "process_definition_templates") {
        const connection = await this.pool.getConnection();
        try {
          await connection.beginTransaction();
          const [insertResult] = await connection.query(
            `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`,
            values
          );
          result = insertResult;
          if (payload.template_artifact_id) {
            await this.syncArtifactWorkflowsForTemplateArtifactId(Number(payload.template_artifact_id), connection);
          }
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } else if (tableName === "document_versions") {
        const connection = await this.pool.getConnection();
        try {
          await connection.beginTransaction();
          const [insertResult] = await connection.query(
            `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`,
            values
          );
          result = insertResult;
          await ensureFillFlowForDocumentVersion(connection, Number(insertResult.insertId));
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } else if (tableName === "fill_requests") {
        const connection = await this.pool.getConnection();
        try {
          await connection.beginTransaction();
          const [insertResult] = await connection.query(
            `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`,
            values
          );
          result = insertResult;
          await syncDocumentProgressFromFillRequest(connection, Number(insertResult.insertId));
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } else if (tableName === "signature_requests") {
        const connection = await this.pool.getConnection();
        try {
          await connection.beginTransaction();
          const [insertResult] = await connection.query(
            `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`,
            values
          );
          result = insertResult;
          await syncDocumentProgressFromSignatureRequest(connection, Number(insertResult.insertId));
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } else if (tableName === "document_signatures") {
        const connection = await this.pool.getConnection();
        try {
          await connection.beginTransaction();
          const [insertResult] = await connection.query(
            `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`,
            values
          );
          result = insertResult;
          await syncDocumentProgressFromDocumentSignature(connection, Number(insertResult.insertId));
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } else {
        const [insertResult] = await this.pool.query(
          `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`,
          values
        );
        result = insertResult;
      }
    } catch (error) {
      if (
        tableName === "process_definition_versions"
        && error?.code === "ER_DUP_ENTRY"
        && String(error?.message || "").includes("uq_process_definition_one_active_series")
      ) {
        throw new Error("Solo puede existir una configuracion activa por serie dentro del mismo proceso.");
      }
      if (
        tableName === "tasks"
        && error?.code === "ER_DUP_ENTRY"
      ) {
        throw new Error("Ya existe una instancia de tarea con esa configuracion, periodo y criterio de lanzamiento.");
      }
      throw error;
    }
    const created = { id: result.insertId, ...payload };
    if (createNotice) {
      return {
        ...sanitizePersonRow(tableName, created),
        __notice: createNotice
      };
    }
    return sanitizePersonRow(tableName, created);
  }

  async update(tableName, keys, data) {
    this.ensurePool();
    const config = getConfig(tableName);

    const keyPayload = pickPayload(config.fields, keys, { includeReadOnly: true });
    const { where, params } = buildWhere(config.primaryKeys, keyPayload);
    const updates = pickPayload(config.fields, data);
    const existing = await this.getByKeys(tableName, keyPayload);
    if (!existing) {
      throw new Error("Registro no encontrado.");
    }

    if (tableName === "unit_positions") {
      const effHead = updates.is_unit_head !== undefined ? updates.is_unit_head : existing.is_unit_head;
      const effType = updates.position_type !== undefined ? updates.position_type : existing.position_type;
      this.assertUnitHeadAllowed(effHead, effType);
    }

    if (tableName === "unit_relations") {
      const parentId = Number(updates.parent_unit_id ?? existing.parent_unit_id);
      const childId = Number(updates.child_unit_id ?? existing.child_unit_id);
      const relTypeId = Number(updates.relation_type_id ?? existing.relation_type_id);
      if (parentId === childId) {
        throw new Error("Una unidad no puede relacionarse consigo misma.");
      }
      const [dupRel] = await this.pool.query(
        "SELECT id FROM unit_relations WHERE child_unit_id = ? AND relation_type_id = ? AND id <> ? LIMIT 1",
        [childId, relTypeId, Number(existing.id)]
      );
      if (dupRel.length) {
        throw new Error("Esa unidad ya tiene un padre en este tipo de relación. Quita la relación actual antes de reasignar.");
      }
      if (await this.wouldCreateUnitCycle(parentId, childId, relTypeId)) {
        throw new Error("La relación crearía un ciclo en la jerarquía (la unidad padre ya depende de la hija).");
      }
    }

    if (tableName === "persons" && Object.hasOwn(data, "password")) {
      const rawPassword = typeof data.password === "string" ? data.password : "";
      if (rawPassword) {
        updates.password_hash = await hashPassword(rawPassword);
      }
    }
    if (tableName === "persons" && typeof updates.password_hash === "string" && updates.password_hash) {
      if (!isBcryptHash(updates.password_hash)) {
        updates.password_hash = await hashPassword(updates.password_hash);
      }
    }
    if (tableName === "tasks") {
      if (
        Object.hasOwn(updates, "process_definition_id")
      ) {
        if (Number(updates.process_definition_id) !== Number(existing.process_definition_id)) {
          throw new Error("No se puede cambiar la configuracion de una tarea ya instanciada.");
        }
        delete updates.process_definition_id;
      }
      if (Object.hasOwn(updates, "term_id")) {
        if (Number(updates.term_id) !== Number(existing.term_id)) {
          throw new Error("No se puede cambiar el periodo de una tarea ya instanciada.");
        }
        delete updates.term_id;
      }
      if (Object.hasOwn(updates, "launch_mode")) {
        delete updates.launch_mode;
      }
      if (Object.hasOwn(updates, "created_by_user_id")) {
        if (Number(updates.created_by_user_id || 0) !== Number(existing.created_by_user_id || 0)) {
          throw new Error("No se puede cambiar el usuario creador de una tarea existente.");
        }
        delete updates.created_by_user_id;
      }
      if (Object.hasOwn(updates, "process_run_id")) {
        if (Number(updates.process_run_id || 0) !== Number(existing.process_run_id || 0)) {
          throw new Error("No se puede cambiar la corrida de proceso de una tarea existente.");
        }
        delete updates.process_run_id;
      }
    }
    if (tableName === "task_items") {
      if (Object.hasOwn(updates, "task_id")) {
        if (Number(updates.task_id) !== Number(existing.task_id)) {
          throw new Error("No se puede cambiar la tarea asociada de un item.");
        }
        delete updates.task_id;
      }
      if (Object.hasOwn(updates, "process_definition_template_id")) {
        if (Number(updates.process_definition_template_id) !== Number(existing.process_definition_template_id)) {
          throw new Error("No se puede cambiar la plantilla asociada de un item.");
        }
        delete updates.process_definition_template_id;
      }
      if (Object.hasOwn(updates, "template_artifact_id")) {
        if (Number(updates.template_artifact_id) !== Number(existing.template_artifact_id)) {
          throw new Error("No se puede cambiar el paquete asociado de un item.");
        }
        delete updates.template_artifact_id;
      }
    }
    if (tableName === "documents") {
      if (Object.hasOwn(updates, "task_item_id")) {
        if (Number(updates.task_item_id) !== Number(existing.task_item_id)) {
          throw new Error("No se puede cambiar el item de tarea asociado de un documento.");
        }
        delete updates.task_item_id;
      }
    }
    if (tableName === "signature_flow_templates") {
      if (Object.hasOwn(updates, "process_definition_template_id")) {
        if (Number(updates.process_definition_template_id) !== Number(existing.process_definition_template_id)) {
          throw new Error("No se puede cambiar la plantilla asociada de un flujo de firma.");
        }
        delete updates.process_definition_template_id;
      }
      const template = await this.getTaskTemplate(existing.process_definition_template_id);
      if (!template) {
        throw new Error("La plantilla de proceso configurado asociada al flujo ya no existe.");
      }
      await this.ensureDraftDefinitionContext(
        template.process_definition_id,
        { entityLabel: "los flujos de firma" }
      );
    }
    if (tableName === "fill_flow_templates") {
      if (Object.hasOwn(updates, "process_definition_template_id")) {
        if (Number(updates.process_definition_template_id) !== Number(existing.process_definition_template_id)) {
          throw new Error("No se puede cambiar la plantilla asociada de un flujo de entrega.");
        }
        delete updates.process_definition_template_id;
      }
      const template = await this.getTaskTemplate(existing.process_definition_template_id);
      if (template) {
        await this.ensureDraftDefinitionContext(
          template.process_definition_id,
          { entityLabel: "los flujos de entrega" }
        );
      }
    }
    if (tableName === "fill_flow_steps") {
      if (Object.hasOwn(updates, "fill_flow_template_id")) {
        if (Number(updates.fill_flow_template_id) !== Number(existing.fill_flow_template_id)) {
          throw new Error("No se puede cambiar la plantilla asociada de un paso de entrega.");
        }
        delete updates.fill_flow_template_id;
      }
      const fillFlowTemplate = await this.getFillFlowTemplate(existing.fill_flow_template_id);
      if (fillFlowTemplate) {
        const template = await this.getTaskTemplate(fillFlowTemplate.process_definition_template_id);
        if (template) {
          await this.ensureDraftDefinitionContext(
            template.process_definition_id,
            { entityLabel: "los pasos de entrega" }
          );
        }
      }
    }
    if (
      tableName === "process_definition_templates"
      || tableName === "process_target_rules"
      || tableName === "process_definition_period_types"
    ) {
      if (Object.hasOwn(updates, "process_definition_id")) {
        if (Number(updates.process_definition_id) !== Number(existing.process_definition_id)) {
          throw new Error("No se puede cambiar la configuracion asociada de este registro.");
        }
        delete updates.process_definition_id;
      }
      await this.ensureDraftDefinitionContext(
        existing.process_definition_id,
        {
          entityLabel:
            tableName === "process_definition_templates"
              ? "las plantillas de configuracion"
              : tableName === "process_target_rules"
                ? "las reglas de alcance"
                : "los periodos del proceso"
        }
      );
    }
    if (tableName === "process_target_rules") {
      const mergedRule = { ...existing, ...updates };
      await this.applyTargetRuleSeriesConstraints(existing.process_definition_id, mergedRule);
      for (const key of ["cargo_id", "unit_type_id"]) {
        if (mergedRule[key] != null && Number(mergedRule[key]) !== Number(existing[key])) {
          updates[key] = mergedRule[key];
        }
      }
    }
    if (tableName === "process_definition_series") {
      const candidateSeries = { ...existing, ...updates };
      const sourceType = String(candidateSeries.source_type || existing.source_type || "").trim();
      if (sourceType === "default") {
        throw new Error("La serie por defecto del sistema no se edita manualmente.");
      }
      const identity = await this.resolveProcessDefinitionSeriesIdentity(candidateSeries);
      Object.assign(updates, identity);
      const [dupRows] = await this.pool.query(
        `SELECT id
         FROM process_definition_series
         WHERE code = ?
           AND id <> ?
         LIMIT 1`,
        [identity.code, Number(existing.id)]
      );
      if (dupRows?.length) {
        throw new Error("Ya existe otra serie con ese origen.");
      }
    }
    if (tableName === "template_artifacts") {
      // Una versión publicada es inmutable; solo se edita en borrador. Para cambiar una publicada, versiónala.
      if (String(existing.lifecycle_state || "published") !== "draft") {
        throw new Error("Esta plantilla está publicada (inmutable). Crea una nueva versión para editarla.");
      }
    }
    let activateDraftVersion = false;
    let processDefinitionActivationNotice = "";
    let processDefinitionSeriesContext = null;

    if (tableName === "process_definition_versions") {
      if (typeof updates.definition_version === "string") {
        updates.definition_version = updates.definition_version.trim();
      }

      const normalizeComparableValue = (fieldName, value) => {
        if (value === null || value === undefined || value === "") {
          return null;
        }
        const fieldMeta = config.fields.find((field) => field.name === fieldName);
        if (value instanceof Date) {
          if (fieldMeta?.type === "date") {
            return value.toISOString().slice(0, 10);
          }
          if (fieldMeta?.type === "datetime") {
            return value.toISOString().slice(0, 19).replace("T", " ");
          }
          return value.toISOString();
        }
        if (fieldMeta?.type === "number" || fieldMeta?.type === "boolean") {
          const numeric = Number(value);
          return Number.isNaN(numeric) ? String(value) : String(numeric);
        }
        return String(value);
      };

      const isSameValue = (fieldName, left, right) => {
        const normalizedLeft = normalizeComparableValue(fieldName, left);
        const normalizedRight = normalizeComparableValue(fieldName, right);
        return normalizedLeft === normalizedRight;
      };

      if (Object.hasOwn(updates, "definition_version")) {
        if (!isSameValue("definition_version", updates.definition_version, existing.definition_version)) {
          throw new Error("No se puede modificar el numero de version de una configuracion.");
        }
        delete updates.definition_version;
      }
      if (Object.hasOwn(updates, "process_id")) {
        if (!isSameValue("process_id", updates.process_id, existing.process_id)) {
          throw new Error("No se puede cambiar el proceso de una configuracion.");
        }
        delete updates.process_id;
      }
      if (Object.hasOwn(updates, "series_id")) {
        if (!isSameValue("series_id", updates.series_id, existing.series_id)) {
          throw new Error("No se puede cambiar la serie de una configuracion.");
        }
        delete updates.series_id;
      }
      if (Object.hasOwn(updates, "variation_key")) {
        if (!isSameValue("variation_key", updates.variation_key, existing.variation_key)) {
          throw new Error("No se puede cambiar la serie de una configuracion.");
        }
        delete updates.variation_key;
      }
      if (Object.hasOwn(updates, "name")) {
        delete updates.name;
      }

      Object.keys(updates).forEach((key) => {
        if (isSameValue(key, updates[key], existing[key])) {
          delete updates[key];
        }
      });

      const currentStatus = String(existing.status || "draft");
      const nextStatus = Object.hasOwn(updates, "status")
        ? String(updates.status || "")
        : currentStatus;

      const allowedTransitions = {
        draft: new Set(["draft", "active", "retired"]),
        active: new Set(["active", "retired"]),
        retired: new Set(["retired"])
      };
      const currentAllowedTransitions = allowedTransitions[currentStatus] || new Set([currentStatus]);
      if (!currentAllowedTransitions.has(nextStatus)) {
        throw new Error(`No se permite cambiar una configuracion ${currentStatus} a ${nextStatus}.`);
      }

      let allowed;
      let errorMessage;
      if (currentStatus === "draft") {
        const generatedName = await this.resolveProcessDefinitionVersionName(existing.process_id, existing.series_id);
        if (generatedName && !isSameValue("name", generatedName, existing.name)) {
          updates.name = generatedName;
        }
        allowed = new Set([
          "name",
          "description",
          "status",
          "effective_from",
          "effective_to"
        ]);
        errorMessage = "Una configuracion en borrador solo permite cambios funcionales y de estado.";
      } else if (currentStatus === "active") {
        allowed = new Set(["status", "effective_to"]);
        errorMessage = "Una configuracion activa solo permite cambiar estado o vigencia final.";
      } else {
        allowed = new Set();
        errorMessage = "Una configuracion retirada es de solo lectura.";
      }

      const disallowed = Object.keys(updates).filter((key) => !allowed.has(key));
      if (disallowed.length) {
        throw new Error(errorMessage);
      }

      if (currentStatus === "draft" && nextStatus === "active") {
        activateDraftVersion = true;
        processDefinitionSeriesContext = {
          processId: existing.process_id,
          variationKey: existing.variation_key,
          excludeId: existing.id ?? keyPayload.id
        };
      }
    }

    const allowPrimaryKeyUpdate = config.allowPrimaryKeyUpdate === true;
    const columns = Object.keys(updates).filter((column) =>
      allowPrimaryKeyUpdate ? true : !config.primaryKeys.includes(column)
    );
    if (!columns.length) {
      throw new Error("No hay cambios para actualizar.");
    }

    const setClause = columns.map((column) => `${column} = ?`).join(", ");
    const values = columns.map((column) => updates[column]);

    const candidate = { ...existing, ...updates };
    validateFieldTypes(config, candidate);
    validateTableRules(tableName, candidate);

    try {
      if (tableName === "process_definition_versions" && activateDraftVersion) {
        const connection = await this.pool.getConnection();
        try {
          await connection.beginTransaction();
          await this.ensureDefinitionHasActiveRulesForActivation(existing.id ?? keyPayload.id, connection);
          await this.ensureDefinitionHasActivePeriodTypesForActivation(existing.id ?? keyPayload.id, connection);
          // Publica las plantillas borrador de la config (activa config + publica plantilla, juntas) antes de
          // validar que haya artefactos activos.
          await this.publishDraftTemplatesForDefinition(existing.id ?? keyPayload.id, connection);
          await this.ensureDefinitionHasArtifactsForActivation(existing.id ?? keyPayload.id, connection);
          const retiredCount = await this.retireActiveDefinitionsInSeries({
            ...processDefinitionSeriesContext,
            connection
          });
          await connection.query(
            `UPDATE ${tableName} SET ${setClause} WHERE ${where}`,
            [...values, ...params]
          );
          await connection.commit();
          if (retiredCount > 0) {
            processDefinitionActivationNotice = "La configuracion activa anterior de la misma serie fue retirada automaticamente.";
          }
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } else if (tableName === "document_versions") {
        const connection = await this.pool.getConnection();
        try {
          await connection.beginTransaction();
          await connection.query(
            `UPDATE ${tableName} SET ${setClause} WHERE ${where}`,
            [...values, ...params]
          );
          if (Object.hasOwn(updates, "status")) {
            const nextStatus = String(updates.status || "").trim().toLowerCase();
            if (nextStatus === "listo para firma") {
              const documentVersionId = Number(existing.id ?? keyPayload.id);
              const signatureFlowResult = await ensureSignatureFlowForDocumentVersion(connection, documentVersionId);
              if (signatureFlowResult && !signatureFlowResult.ok) {
                console.warn(
                  `[SqlAdminService] DocumentVersion ${documentVersionId} cannot enter signature: ${signatureFlowResult.reason}`
                );
              }
            }
          }
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } else if (tableName === "fill_requests") {
        const connection = await this.pool.getConnection();
        try {
          await connection.beginTransaction();
          await connection.query(
            `UPDATE ${tableName} SET ${setClause} WHERE ${where}`,
            [...values, ...params]
          );
          await syncDocumentProgressFromFillRequest(connection, Number(existing.id ?? keyPayload.id));
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } else if (tableName === "signature_requests") {
        const connection = await this.pool.getConnection();
        try {
          await connection.beginTransaction();
          await connection.query(
            `UPDATE ${tableName} SET ${setClause} WHERE ${where}`,
            [...values, ...params]
          );
          await syncDocumentProgressFromSignatureRequest(connection, Number(existing.id ?? keyPayload.id));
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } else if (tableName === "document_signatures") {
        const connection = await this.pool.getConnection();
        try {
          await connection.beginTransaction();
          await connection.query(
            `UPDATE ${tableName} SET ${setClause} WHERE ${where}`,
            [...values, ...params]
          );
          await syncDocumentProgressFromDocumentSignature(connection, Number(existing.id ?? keyPayload.id));
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } else if (tableName === "process_definition_templates") {
        const connection = await this.pool.getConnection();
        try {
          await connection.beginTransaction();
          await connection.query(
            `UPDATE ${tableName} SET ${setClause} WHERE ${where}`,
            [...values, ...params]
          );
          const rawArtifactId =
            updates.template_artifact_id
            ?? existing.template_artifact_id
            ?? keyPayload.template_artifact_id
            ?? 0;
          const artifactId = Number(rawArtifactId);
          if (artifactId) {
            await this.syncArtifactWorkflowsForTemplateArtifactId(artifactId, connection);
          }
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      } else {
        await this.pool.query(
          `UPDATE ${tableName} SET ${setClause} WHERE ${where}`,
          [...values, ...params]
        );
        if (tableName === "process_definition_series" && Object.hasOwn(updates, "code")) {
          await this.pool.query(
            `UPDATE process_definition_versions
             SET variation_key = ?
             WHERE series_id = ?`,
            [updates.code, Number(existing.id)]
          );
          await this.refreshProcessDefinitionVersionNames({ seriesId: Number(existing.id) });
        }
        if (tableName === "processes" && Object.hasOwn(updates, "name")) {
          await this.refreshProcessDefinitionVersionNames({ processId: Number(existing.id ?? keyPayload.id) });
        }
        if (
          (tableName === "unit_types" || tableName === "cargos")
          && Object.hasOwn(updates, "name")
        ) {
          const foreignKey = tableName === "unit_types" ? "unit_type_id" : "cargo_id";
          const [seriesRows] = await this.pool.query(
            `SELECT id FROM process_definition_series WHERE ${foreignKey} = ?`,
            [Number(existing.id ?? keyPayload.id)]
          );
          for (const seriesRow of seriesRows || []) {
            await this.refreshProcessDefinitionVersionNames({ seriesId: Number(seriesRow.id) });
          }
        }
      }
    } catch (error) {
      if (
        tableName === "process_definition_versions"
        && error?.code === "ER_DUP_ENTRY"
        && String(error?.message || "").includes("uq_process_definition_one_active_series")
      ) {
        throw new Error("Solo puede existir una configuracion activa por serie dentro del mismo proceso.");
      }
      throw error;
    }
    const updatedRow = sanitizePersonRow(tableName, { ...keyPayload, ...updates });
    if (processDefinitionActivationNotice) {
      return {
        ...updatedRow,
        __notice: processDefinitionActivationNotice
      };
    }
    return updatedRow;
  }

  async getProcessDefinitionTemplatesByArtifact(artifactId, connection = this.pool) {
    const [rows] = await connection.query(
      `SELECT
         pdt.id,
         pdt.process_definition_id,
         pdt.template_artifact_id,
         pdv.name AS process_definition_name
       FROM process_definition_templates pdt
       INNER JOIN process_definition_versions pdv ON pdv.id = pdt.process_definition_id
       WHERE pdt.template_artifact_id = ?
       ORDER BY pdt.id ASC`,
      [artifactId]
    );
    return rows;
  }

  async getSyncedFillFlowTemplate(processDefinitionTemplateId, connection = this.pool) {
    const [rows] = await connection.query(
      `SELECT id, description, is_active
       FROM fill_flow_templates
       WHERE process_definition_template_id = ?
         AND description LIKE ?
       ORDER BY id DESC
       LIMIT 1`,
      [processDefinitionTemplateId, `${ARTIFACT_SYNC_FILL_DESCRIPTION_PREFIX}%`]
    );
    return rows?.[0] || null;
  }

  async getSyncedSignatureFlowTemplate(processDefinitionTemplateId, connection = this.pool) {
    const [rows] = await connection.query(
      `SELECT id, description, is_active
       FROM signature_flow_templates
       WHERE process_definition_template_id = ?
         AND description LIKE ?
       ORDER BY id DESC
       LIMIT 1`,
      [processDefinitionTemplateId, `${ARTIFACT_SYNC_SIGNATURE_DESCRIPTION_PREFIX}%`]
    );
    return rows?.[0] || null;
  }

  // Estado de sincronización del flujo de un artifact: compara el storage_version materializado en BD
  // (marca de procedencia) contra el actual del artifact, por cada vínculo a configuración. Devuelve
  // 'no_link' | 'synced' | 'stale' a nivel global y el detalle por vínculo.
  async getArtifactWorkflowSyncStatus(artifactId, connection = this.pool) {
    this.ensurePool();
    const artifact = await this.getTemplateArtifact(artifactId, connection);
    if (!artifact?.id) {
      return { artifact_id: Number(artifactId) || null, exists: false, status: "unknown", links: [] };
    }
    const currentVersion = String(artifact.storage_version || "");
    let metaDocument = null;
    try {
      metaDocument = await this.loadTemplateArtifactMetaDocument(artifact, connection);
    } catch {
      metaDocument = null;
    }
    const fillEnabled = isArtifactFillWorkflowSyncEnabled(metaDocument?.workflows?.fill || {});
    const signatureEnabled = isArtifactSignatureWorkflowSyncEnabled(metaDocument?.workflows?.signatures || {});
    const links = await this.getProcessDefinitionTemplatesByArtifact(artifactId, connection);

    // Estado por lado (fill/firmas): 'ok' | 'stale' | 'missing'.
    const sideStatus = (synced, enabled, prefix) => {
      if (!enabled) {
        // No debe materializarse; si quedó activo, está desfasado (pendiente de desactivar).
        return synced?.id && Number(synced.is_active) === 1 ? "stale" : "ok";
      }
      if (!synced?.id || Number(synced.is_active) !== 1) {
        return "missing";
      }
      const marker = parseArtifactSyncMarker(synced.description, prefix);
      return marker && String(marker.storageVersion) === currentVersion ? "ok" : "stale";
    };

    const severity = { missing: 3, stale: 2, ok: 1 };
    const links_status = [];
    for (const link of links) {
      const fill = await this.getSyncedFillFlowTemplate(link.id, connection);
      const signature = await this.getSyncedSignatureFlowTemplate(link.id, connection);
      const fillState = sideStatus(fill, fillEnabled, ARTIFACT_SYNC_FILL_DESCRIPTION_PREFIX);
      const signatureState = sideStatus(signature, signatureEnabled, ARTIFACT_SYNC_SIGNATURE_DESCRIPTION_PREFIX);
      const worst = [fillState, signatureState].sort((a, b) => severity[b] - severity[a])[0];
      links_status.push({
        process_definition_template_id: link.id,
        process_definition_id: link.process_definition_id,
        process_definition_name: link.process_definition_name,
        fill: fillState,
        signatures: signatureState,
        status: worst === "ok" ? "synced" : worst
      });
    }

    const anyStale = links_status.some((entry) => entry.status !== "synced");
    return {
      artifact_id: Number(artifact.id),
      exists: true,
      storage_version: currentVersion,
      has_workflow: fillEnabled || signatureEnabled,
      fill_enabled: fillEnabled,
      signature_enabled: signatureEnabled,
      status: !links.length ? "no_link" : (anyStale ? "stale" : "synced"),
      links: links_status
    };
  }

  // Job de reconciliación: re-sincroniza los artifacts vinculados cuya proyección en BD está desfasada
  // (o todos si onlyStale=false). Best-effort por artifact: un fallo no aborta el resto. Sirve como
  // auto-reparación al arranque y como acción admin a demanda (cierra la ventana de escritura dual).
  async reconcileArtifactWorkflows({ onlyStale = true } = {}) {
    this.ensurePool();
    const [rows] = await this.pool.query(
      `SELECT DISTINCT template_artifact_id AS id
       FROM process_definition_templates
       WHERE template_artifact_id IS NOT NULL`
    );
    const summary = { scanned: 0, stale: 0, resynced: 0, failed: 0, details: [] };
    for (const row of rows || []) {
      const artifactId = Number(row.id);
      if (!artifactId) {
        continue;
      }
      summary.scanned += 1;
      try {
        const before = await this.getArtifactWorkflowSyncStatus(artifactId);
        if (onlyStale && before.status !== "stale") {
          continue;
        }
        if (before.status === "stale") {
          summary.stale += 1;
        }
        await this.syncArtifactWorkflowsForTemplateArtifactId(artifactId);
        const after = await this.getArtifactWorkflowSyncStatus(artifactId);
        summary.resynced += 1;
        summary.details.push({ artifact_id: artifactId, before: before.status, after: after.status });
      } catch (error) {
        summary.failed += 1;
        summary.details.push({ artifact_id: artifactId, error: error?.message || "error" });
      }
    }
    return summary;
  }

  async getCargoCodeMap(connection = this.pool) {
    const [rows] = await connection.query(
      `SELECT id, code, name
       FROM cargos
       WHERE is_active = 1
       ORDER BY id ASC`
    );
    const map = new Map();
    for (const row of rows) {
      const normalizedCode = slugify(row.code || "");
      const normalizedName = slugify(row.name || "");
      if (normalizedCode && !map.has(normalizedCode)) {
        map.set(normalizedCode, Number(row.id));
      }
      if (normalizedName && !map.has(normalizedName)) {
        map.set(normalizedName, Number(row.id));
      }
    }
    return map;
  }

  async getUnitTypeNameMap(connection = this.pool) {
    const [rows] = await connection.query(
      `SELECT id, name
       FROM unit_types
       WHERE is_active = 1
       ORDER BY id ASC`
    );
    const map = new Map();
    for (const row of rows) {
      const normalizedName = String(row.name || "").trim().toLowerCase();
      if (normalizedName && !map.has(normalizedName)) {
        map.set(normalizedName, Number(row.id));
      }
    }
    return map;
  }

  // Sets de ids válidos (activos) para validar EN AUTORÍA que las referencias del flujo existen en la DB,
  // antes de escribir el meta.yaml en MinIO (no solo confiar en el select del front ni en las FKs al
  // materializar). Espejo de getCargoCodeMap para persona/posición/unidad/tipo de unidad.
  async getWorkflowReferenceIdSets(connection = this.pool) {
    const [persons, positions, units, unitTypes] = await Promise.all([
      connection.query("SELECT id FROM persons WHERE is_active = 1"),
      connection.query("SELECT id FROM unit_positions WHERE is_active = 1"),
      connection.query("SELECT id FROM units WHERE is_active = 1"),
      connection.query("SELECT id FROM unit_types WHERE is_active = 1")
    ]);
    const toSet = (result) => new Set((result?.[0] || []).map((row) => Number(row.id)));
    return {
      personIds: toSet(persons),
      positionIds: toSet(positions),
      unitIds: toSet(units),
      unitTypeIds: toSet(unitTypes)
    };
  }

  // Ámbito resoluble de un proceso a partir de sus reglas objetivo activas: la unión de unidades que
  // las reglas pueden alcanzar (lo que en runtime fija la posición responsable → scope_unit_id). Se usa
  // para (a) habilitar/validar los ámbitos de contexto del flujo y (b) acotar el select de unidades a
  // las unidades realmente cubiertas. Sin reglas, los ámbitos de contexto resolverían null.
  async getProcessTargetScope(processDefinitionId, connection = this.pool) {
    const defId = normalizeNumericId(processDefinitionId);
    if (!defId) {
      return { has_rules: false, supports_context: false, all_units: false, unit_ids: [], cargo_ids: [] };
    }
    const [rules] = await connection.query(
      `SELECT unit_scope_type, unit_id, unit_type_id, cargo_id, position_id
         FROM process_target_rules
        WHERE process_definition_id = ? AND is_active = 1`,
      [defId]
    );
    if (!rules.length) {
      return { has_rules: false, supports_context: false, all_units: false, unit_ids: [], cargo_ids: [] };
    }
    const unitIds = new Set();
    const cargoIds = new Set();
    let allUnits = false;
    for (const rule of rules) {
      if (rule.cargo_id) {
        cargoIds.add(Number(rule.cargo_id));
      }
      const scope = String(rule.unit_scope_type || "unit_exact");
      const useSubtree = scope === "unit_subtree";
      if (scope === "all_units") {
        allUnits = true;
        continue;
      }
      if (useSubtree && rule.unit_id) {
        const [rows] = await connection.query(
          `WITH RECURSIVE scoped_units AS (
             SELECT id FROM units WHERE id = ?
             UNION ALL
             SELECT ur.child_unit_id
               FROM unit_relations ur
               INNER JOIN relation_unit_types rt ON rt.id = ur.relation_type_id AND rt.code = 'org'
               INNER JOIN scoped_units su ON su.id = ur.parent_unit_id
           )
           SELECT id FROM units WHERE id IN (SELECT id FROM scoped_units) AND is_active = 1`,
          [rule.unit_id]
        );
        rows.forEach((row) => unitIds.add(Number(row.id)));
      } else if (scope === "unit_exact" && rule.unit_id) {
        unitIds.add(Number(rule.unit_id));
      } else if (scope === "unit_type" && rule.unit_type_id) {
        const [rows] = await connection.query(
          "SELECT id FROM units WHERE unit_type_id = ? AND is_active = 1",
          [rule.unit_type_id]
        );
        rows.forEach((row) => unitIds.add(Number(row.id)));
      }
    }
    return {
      has_rules: true,
      supports_context: true,
      all_units: allUnits,
      unit_ids: Array.from(unitIds),
      cargo_ids: Array.from(cargoIds)
    };
  }

  // Cargos AUTORIZABLES en una ubicación: los que tienen un PUESTO activo (`unit_positions`) ahí. NO se exige
  // ocupante vigente — el modelo es late-binding: se autoriza contra el puesto y la persona se enlaza después
  // (al ocuparse el puesto, un trigger reconcilia los task_items abiertos). Con `unitId` = esa unidad;
  // `unitTypeId` = cualquier unidad de ese tipo; sin ambos = las unidades del alcance del proceso.
  async listResolvableCargos(processDefinitionId, { unitId = null, unitTypeId = null } = {}, connection = this.pool) {
    const directUnitId = normalizeNumericId(unitId);
    const directUnitTypeId = normalizeNumericId(unitTypeId);
    let unitIdList = null; // null = sin restricción de unidad (alcance "todas las unidades")
    if (!directUnitTypeId) {
      if (directUnitId) {
        unitIdList = [directUnitId];
      } else {
        const scope = await this.getProcessTargetScope(processDefinitionId, connection);
        if (!scope.has_rules) {
          return [];
        }
        if (!scope.all_units) {
          unitIdList = Array.isArray(scope.unit_ids) ? scope.unit_ids : [];
          if (!unitIdList.length) {
            return [];
          }
        }
      }
    }
    const params = [];
    let unitFilter = "";
    if (directUnitTypeId) {
      // Cargos resolubles en CUALQUIER unidad de ese tipo (para revisores "por tipo de unidad" en proceso).
      unitFilter = "AND u.unit_type_id = ?";
      params.push(directUnitTypeId);
    } else if (Array.isArray(unitIdList)) {
      unitFilter = "AND up.unit_id IN (?)";
      params.push(unitIdList);
    }
    const [rows] = await connection.query(
      `SELECT DISTINCT c.id, c.name, c.code
         FROM unit_positions up
         INNER JOIN units u ON u.id = up.unit_id
         INNER JOIN cargos c ON c.id = up.cargo_id
        WHERE up.is_active = 1 AND c.is_active = 1 ${unitFilter}
        ORDER BY c.name ASC`,
      params
    );
    return rows.map((row) => ({ id: Number(row.id), name: row.name, code: row.code || "" }));
  }

  // Mapa unidad → conjunto de cargo_ids con PUESTO en ella (mismo criterio que listResolvableCargos, sin exigir
  // ocupante). Lo usa la validación de autoría para rechazar un cargo que no tiene puesto en la unidad elegida.
  async getResolvableCargoIdsByUnit(connection, unitIds = []) {
    const list = [...new Set((unitIds || []).map((id) => normalizeNumericId(id)).filter(Boolean))];
    const map = new Map();
    if (!list.length) {
      return map;
    }
    const [rows] = await connection.query(
      `SELECT DISTINCT up.unit_id, up.cargo_id
         FROM unit_positions up
         INNER JOIN cargos c ON c.id = up.cargo_id
        WHERE up.is_active = 1 AND c.is_active = 1 AND up.unit_id IN (?)`,
      [list]
    );
    for (const row of rows) {
      const unit = Number(row.unit_id);
      if (!map.has(unit)) {
        map.set(unit, new Set());
      }
      map.get(unit).add(Number(row.cargo_id));
    }
    return map;
  }

  // F-B (backfill idempotente): reconcilia los task_items ABIERTOS y NO INICIADOS (sin documento) al ocupante
  // vigente de su puesto. El trigger de `position_assignments` reconcilia hacia adelante; esto arregla huérfanos
  // creados con el puesto vacante. No toca cerradas ni YA INICIADAS (no romper la cadena). `positionId` acota.
  async reconcileOpenTaskItemAssignments({ positionId = null } = {}, connection = this.pool) {
    const pid = normalizeNumericId(positionId);
    const params = [];
    let posFilter = "";
    if (pid) {
      posFilter = "AND ti.responsible_position_id = ?";
      params.push(pid);
    }
    const [result] = await connection.query(
      `UPDATE task_items ti
         INNER JOIN position_assignments pa
            ON pa.position_id = ti.responsible_position_id
           AND pa.is_current = 1
           AND pa.person_id IS NOT NULL
          SET ti.assigned_person_id = pa.person_id
        WHERE ti.responsible_position_id IS NOT NULL
          AND ti.status NOT IN ('completed','completado','cancelled','cancelado','finalizado','entregado','rechazado')
          AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.task_item_id = ti.id)
          AND (ti.assigned_person_id IS NULL OR ti.assigned_person_id <> pa.person_id)
          ${posFilter}`,
      params
    );
    return { reconciled: result?.affectedRows ?? 0 };
  }

  // F-C (handover): traspasa el MISMO entregable a otra persona (NO duplica). Mueve el responsable del task_item
  // y, si ya está iniciado, el dueño del documento; deja asiento de auditoría. Conserva versiones/firmas/historial.
  // No traspasa entregables cerrados (trazabilidad intacta).
  async handoverTaskItem(taskItemId, { toPersonId, reason = null, triggerKind = "manual", performedByUserId = null } = {}, connection = this.pool) {
    const tiId = normalizeNumericId(taskItemId);
    const toId = normalizeNumericId(toPersonId);
    if (!tiId) throw new Error("Entregable (task_item) inválido.");
    if (!toId) throw new Error("Debes indicar la persona destino del traspaso.");
    const [rows] = await connection.query(
      "SELECT id, assigned_person_id, status FROM task_items WHERE id = ? LIMIT 1",
      [tiId]
    );
    if (!rows.length) throw new Error("El entregable no existe.");
    const TERMINAL = ["completed", "completado", "cancelled", "cancelado", "finalizado", "entregado", "rechazado"];
    if (TERMINAL.includes(String(rows[0].status))) {
      throw new Error("El entregable ya está cerrado; no se puede traspasar.");
    }
    const fromId = rows[0].assigned_person_id ? Number(rows[0].assigned_person_id) : null;
    if (fromId === toId) {
      return { task_item_id: tiId, from_person_id: fromId, to_person_id: toId, unchanged: true };
    }
    const [personRows] = await connection.query("SELECT id FROM persons WHERE id = ? LIMIT 1", [toId]);
    if (!personRows.length) throw new Error("La persona destino no existe.");
    await connection.query("UPDATE task_items SET assigned_person_id = ? WHERE id = ?", [toId, tiId]);
    // Si ya está iniciado (tiene documento), su dueño también se mueve al nuevo responsable.
    await connection.query("UPDATE documents SET owner_person_id = ? WHERE task_item_id = ?", [toId, tiId]);
    const kind = ["occupancy_end", "position_deactivated", "manual"].includes(triggerKind) ? triggerKind : "manual";
    await connection.query(
      `INSERT INTO task_item_handovers (task_item_id, from_person_id, to_person_id, reason, trigger_kind, performed_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tiId, fromId, toId, reason || null, kind, normalizeNumericId(performedByUserId) || null]
    );
    return { task_item_id: tiId, from_person_id: fromId, to_person_id: toId };
  }

  // F-C (lista de atascados): task_items ABIERTOS que requieren atención — por persona (los que tiene asignados),
  // por puesto, por unidad, o (sin filtros) los huérfanos (sin persona). Marca `started` (tiene documento).
  async listStuckTaskItems({ personId = null, positionId = null, unitId = null } = {}, connection = this.pool) {
    const filters = ["ti.status NOT IN ('completed','completado','cancelled','cancelado','finalizado','entregado','rechazado')"];
    const params = [];
    const pid = normalizeNumericId(personId);
    const posId = normalizeNumericId(positionId);
    const uId = normalizeNumericId(unitId);
    if (pid) { filters.push("ti.assigned_person_id = ?"); params.push(pid); }
    if (posId) { filters.push("ti.responsible_position_id = ?"); params.push(posId); }
    if (uId) { filters.push("up.unit_id = ?"); params.push(uId); }
    if (!pid && !posId && !uId) { filters.push("ti.assigned_person_id IS NULL AND ti.responsible_position_id IS NOT NULL"); }
    const [rows] = await connection.query(
      `SELECT ti.id, ti.task_id, ti.assigned_person_id, ti.responsible_position_id, ti.status,
              up.unit_id, c.name AS cargo_name, u.name AS unit_name,
              EXISTS (SELECT 1 FROM documents d WHERE d.task_item_id = ti.id) AS started
         FROM task_items ti
         LEFT JOIN unit_positions up ON up.id = ti.responsible_position_id
         LEFT JOIN units u ON u.id = up.unit_id
         LEFT JOIN cargos c ON c.id = up.cargo_id
        WHERE ${filters.join(" AND ")}
        ORDER BY ti.id ASC
        LIMIT 500`,
      params
    );
    return rows.map((r) => ({
      id: Number(r.id),
      task_id: Number(r.task_id),
      assigned_person_id: r.assigned_person_id ? Number(r.assigned_person_id) : null,
      responsible_position_id: r.responsible_position_id ? Number(r.responsible_position_id) : null,
      status: r.status,
      unit_id: r.unit_id ? Number(r.unit_id) : null,
      unit_name: r.unit_name || null,
      cargo_name: r.cargo_name || null,
      started: Number(r.started) > 0
    }));
  }

  // F-C (jefe inmediato): sube por la jerarquía de unidades (relación, org por defecto) y devuelve el ocupante
  // vigente del PUESTO CABEZA más cercano que no sea la propia persona. Sirve para SUGERIR destino del traspaso.
  async resolveImmediateBoss({ positionId = null, unitId = null, relationCode = "org" } = {}, connection = this.pool) {
    let startUnit = normalizeNumericId(unitId);
    let selfPersonId = null;
    const posId = normalizeNumericId(positionId);
    if (posId && !startUnit) {
      const [pr] = await connection.query(
        `SELECT up.unit_id, pa.person_id
           FROM unit_positions up
           LEFT JOIN position_assignments pa ON pa.position_id = up.id AND pa.is_current = 1
          WHERE up.id = ? LIMIT 1`,
        [posId]
      );
      startUnit = pr?.[0]?.unit_id ? Number(pr[0].unit_id) : null;
      selfPersonId = pr?.[0]?.person_id ? Number(pr[0].person_id) : null;
    }
    if (!startUnit) return { boss_person_id: null };
    const [rel] = await connection.query("SELECT id FROM relation_unit_types WHERE code = ? LIMIT 1", [relationCode || "org"]);
    const relId = rel?.[0]?.id ? Number(rel[0].id) : null;
    if (!relId) return { boss_person_id: null };
    const [rows] = await connection.query(
      `WITH RECURSIVE chain AS (
         SELECT ? AS unit_id, 0 AS depth
         UNION ALL
         SELECT ur.parent_unit_id, c.depth + 1
           FROM unit_relations ur INNER JOIN chain c ON c.unit_id = ur.child_unit_id
          WHERE ur.relation_type_id = ?
       )
       SELECT pa.person_id, head.unit_id, c.depth
         FROM chain c
         INNER JOIN unit_positions head ON head.unit_id = c.unit_id AND head.is_unit_head = 1 AND head.is_active = 1
         INNER JOIN position_assignments pa ON pa.position_id = head.id AND pa.is_current = 1 AND pa.person_id IS NOT NULL
        WHERE (? IS NULL OR pa.person_id <> ?)
        ORDER BY c.depth ASC
        LIMIT 1`,
      [startUnit, relId, selfPersonId, selfPersonId]
    );
    const r = rows?.[0];
    return r
      ? { boss_person_id: Number(r.person_id), unit_id: Number(r.unit_id), depth: Number(r.depth) }
      : { boss_person_id: null };
  }

  // F-C (scope por jefe): para el usuario/persona dado, resuelve las unidades que ENCABEZA (is_unit_head con
  // ocupación vigente) + sus descendientes orgánicos, y devuelve los task_items ABIERTOS ATASCADOS ahí: sin
  // persona (huérfanos) o cuyo asignado ya NO ocupa el puesto responsable (titular que se fue). `is_supervisor`
  // indica si encabeza alguna unidad (para mostrar/ocultar el panel aunque no haya atascados).
  async listSupervisorStuckTaskItems(personId, connection = this.pool) {
    const pid = normalizeNumericId(personId);
    if (!pid) return { is_supervisor: false, items: [] };
    const [headRows] = await connection.query(
      `SELECT COUNT(*) AS n
         FROM unit_positions up
         INNER JOIN position_assignments pa ON pa.position_id = up.id AND pa.is_current = 1 AND pa.person_id = ?
        WHERE up.is_unit_head = 1 AND up.is_active = 1`,
      [pid]
    );
    if (Number(headRows?.[0]?.n || 0) === 0) {
      return { is_supervisor: false, items: [] };
    }
    const [rows] = await connection.query(
      `WITH RECURSIVE headed AS (
         SELECT up.unit_id AS unit_id
           FROM unit_positions up
           INNER JOIN position_assignments pa ON pa.position_id = up.id AND pa.is_current = 1 AND pa.person_id = ?
          WHERE up.is_unit_head = 1 AND up.is_active = 1
       ),
       scope AS (
         SELECT unit_id FROM headed
         UNION
         SELECT ur.child_unit_id
           FROM unit_relations ur
           INNER JOIN relation_unit_types rt ON rt.id = ur.relation_type_id AND rt.code = 'org'
           INNER JOIN scope s ON s.unit_id = ur.parent_unit_id
       )
       SELECT ti.id, ti.task_id, ti.assigned_person_id, ti.responsible_position_id, ti.status,
              up.unit_id, u.name AS unit_name, c.name AS cargo_name,
              EXISTS (SELECT 1 FROM documents d WHERE d.task_item_id = ti.id) AS started
         FROM task_items ti
         INNER JOIN unit_positions up ON up.id = ti.responsible_position_id
         INNER JOIN units u ON u.id = up.unit_id
         LEFT JOIN cargos c ON c.id = up.cargo_id
        WHERE up.unit_id IN (SELECT unit_id FROM scope)
          AND ti.status NOT IN ('completed','completado','cancelled','cancelado','finalizado','entregado','rechazado')
          AND (
            ti.assigned_person_id IS NULL
            OR NOT EXISTS (
              SELECT 1 FROM position_assignments pa2
               WHERE pa2.position_id = ti.responsible_position_id
                 AND pa2.is_current = 1
                 AND pa2.person_id = ti.assigned_person_id
            )
          )
        ORDER BY up.unit_id ASC, ti.id ASC
        LIMIT 500`,
      [pid]
    );
    return {
      is_supervisor: true,
      items: rows.map((r) => ({
        id: Number(r.id),
        task_id: Number(r.task_id),
        assigned_person_id: r.assigned_person_id ? Number(r.assigned_person_id) : null,
        responsible_position_id: r.responsible_position_id ? Number(r.responsible_position_id) : null,
        status: r.status,
        unit_id: r.unit_id ? Number(r.unit_id) : null,
        unit_name: r.unit_name || null,
        cargo_name: r.cargo_name || null,
        started: Number(r.started) > 0,
        reason: r.assigned_person_id ? "titular_se_fue" : "sin_responsable"
      }))
    };
  }

  // La serie de un proceso ("por Docente", "por Carrera"...) ya fija el cargo y/o el tipo de unidad
  // objetivo. La regla NO debe volver a decidirlos: se siembran desde la serie y se blindan para que no
  // puedan contradecirla. Así el cargo se decide una sola vez (en la serie) y la regla solo añade el
  // alcance (unidad) y la entrega (recipient_policy).
  async getProcessDefinitionSeriesScope(processDefinitionId, connection = this.pool) {
    const defId = normalizeNumericId(processDefinitionId);
    if (!defId) {
      return null;
    }
    const [rows] = await connection.query(
      `SELECT pds.source_type, pds.cargo_id, pds.unit_type_id,
              c.name AS cargo_name, ut.name AS unit_type_name
         FROM process_definition_versions pdv
         INNER JOIN process_definition_series pds ON pds.id = pdv.series_id
         LEFT JOIN cargos c ON c.id = pds.cargo_id
         LEFT JOIN unit_types ut ON ut.id = pds.unit_type_id
        WHERE pdv.id = ?
        LIMIT 1`,
      [defId]
    );
    return rows?.[0] || null;
  }

  async applyTargetRuleSeriesConstraints(processDefinitionId, candidate, connection = this.pool) {
    const series = await this.getProcessDefinitionSeriesScope(processDefinitionId, connection);
    if (!series) {
      return;
    }
    const seriesCargoId = normalizeNumericId(series.cargo_id);
    const seriesUnitTypeId = normalizeNumericId(series.unit_type_id);
    const policy = String(candidate.recipient_policy || "all_matches");

    // Puesto exacto: el puesto define por sí mismo unidad y cargo, así que no se siembra ningún eje;
    // solo validamos que el puesto pertenezca al eje (cargo o tipo de unidad) que fija la serie.
    if (policy === "exact_position") {
      const positionId = normalizeNumericId(candidate.position_id);
      if (positionId && (seriesCargoId || seriesUnitTypeId)) {
        const [posRows] = await connection.query(
          `SELECT up.cargo_id, u.unit_type_id
             FROM unit_positions up
             INNER JOIN units u ON u.id = up.unit_id
            WHERE up.id = ? LIMIT 1`,
          [positionId]
        );
        const positionCargoId = normalizeNumericId(posRows?.[0]?.cargo_id);
        const positionUnitTypeId = normalizeNumericId(posRows?.[0]?.unit_type_id);
        if (seriesCargoId && positionCargoId && positionCargoId !== seriesCargoId) {
          throw new Error("El puesto exacto no corresponde al cargo de la serie del proceso.");
        }
        if (seriesUnitTypeId && positionUnitTypeId && positionUnitTypeId !== seriesUnitTypeId) {
          throw new Error("El puesto exacto no pertenece al tipo de unidad de la serie del proceso.");
        }
      }
      return;
    }

    // Cargo: lo fija la serie; se siembra si la regla no lo trae, o se blinda si difiere.
    if (seriesCargoId) {
      const candidateCargoId = normalizeNumericId(candidate.cargo_id);
      if (!candidateCargoId) {
        candidate.cargo_id = seriesCargoId;
      } else if (candidateCargoId !== seriesCargoId) {
        throw new Error("El cargo de la regla debe coincidir con el cargo de la serie del proceso.");
      }
    }

    // Tipo de unidad: la variación por tipo fija el alcance de la regla a ese tipo; la regla solo añade
    // el cargo y la entrega. El despliegue por tipo ya cubre todas las unidades de ese tipo.
    if (seriesUnitTypeId) {
      const requestedScope = candidate.unit_scope_type ? String(candidate.unit_scope_type) : "";
      if (requestedScope && requestedScope !== "unit_type") {
        throw new Error("El alcance de la regla lo fija la serie por tipo de unidad; no puede cambiarse.");
      }
      const candidateUnitTypeId = normalizeNumericId(candidate.unit_type_id);
      if (candidateUnitTypeId && candidateUnitTypeId !== seriesUnitTypeId) {
        throw new Error("El tipo de unidad de la regla debe coincidir con el tipo de unidad de la serie del proceso.");
      }
      candidate.unit_scope_type = "unit_type";
      candidate.unit_type_id = seriesUnitTypeId;
      candidate.unit_id = null;
    }
  }

  async replaceSyncedFillFlowSteps(fillFlowTemplateId, steps, connection = this.pool) {
    await connection.query(
      "DELETE FROM fill_flow_steps WHERE fill_flow_template_id = ?",
      [fillFlowTemplateId]
    );

    for (const step of steps) {
      await connection.query(
        `INSERT INTO fill_flow_steps (
           fill_flow_template_id,
           step_order,
           resolver_type,
           assigned_person_id,
           unit_scope_type,
           unit_id,
           unit_type_id,
           relation_type_id,
           cargo_id,
           position_id,
           selection_mode,
           is_required,
           can_reject
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fillFlowTemplateId,
          step.stepOrder,
          step.resolverType,
          step.assignedPersonId,
          step.unitScopeType,
          step.unitId,
          step.unitTypeId,
          step.relationTypeId ?? null,
          step.cargoId,
          step.positionId,
          step.selectionMode,
          step.isRequired,
          step.canReject
        ]
      );
    }
  }

  async hasFillFlowTemplateRuntimeUsage(fillFlowTemplateId, connection = this.pool) {
    const [rows] = await connection.query(
      `SELECT EXISTS(
         SELECT 1
         FROM document_fill_flows dff
         LEFT JOIN fill_requests fr ON fr.document_fill_flow_id = dff.id
         WHERE dff.fill_flow_template_id = ?
         LIMIT 1
       ) AS has_usage`,
      [fillFlowTemplateId]
    );
    return Boolean(Number(rows?.[0]?.has_usage || 0));
  }

  async replaceSyncedSignatureFlowSteps(signatureFlowTemplateId, steps, connection = this.pool) {
    await connection.query(
      "DELETE FROM signature_flow_steps WHERE template_id = ?",
      [signatureFlowTemplateId]
    );

    for (const step of steps) {
      await connection.query(
        `INSERT INTO signature_flow_steps (
           template_id,
           step_order,
           code,
           name,
           slot,
           resolver_type,
           assigned_person_id,
           unit_scope_type,
           unit_id,
           unit_type_id,
           position_id,
           required_cargo_id,
           selection_mode,
           approval_mode,
         required_signers_min,
         required_signers_max,
         is_required,
         anchor_refs,
         signers
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          signatureFlowTemplateId,
          step.stepOrder,
          step.code,
          step.name,
          step.slot,
          step.resolverType,
          step.assignedPersonId,
          step.unitScopeType,
          step.unitId,
          step.unitTypeId,
          step.positionId,
          step.requiredCargoId,
          step.selectionMode,
          step.approvalMode,
          step.requiredSignersMin,
          step.requiredSignersMax,
          step.isRequired,
          JSON.stringify(Array.isArray(step.anchorRefs) ? step.anchorRefs : []),
          JSON.stringify(Array.isArray(step.signers) ? step.signers : [])
        ]
      );
    }
  }

  async hasSignatureFlowTemplateRuntimeUsage(signatureFlowTemplateId, connection = this.pool) {
    const [rows] = await connection.query(
      `SELECT EXISTS(
         SELECT 1
         FROM signature_flow_instances sfi
         LEFT JOIN signature_requests sr ON sr.instance_id = sfi.id
         LEFT JOIN document_signatures ds ON ds.signature_request_id = sr.id
         WHERE sfi.template_id = ?
         LIMIT 1
       ) AS has_usage`,
      [signatureFlowTemplateId]
    );
    return Boolean(Number(rows?.[0]?.has_usage || 0));
  }

  async syncArtifactFillWorkflowForArtifact({
    connection,
    artifactId,
    templateCode,
    storageVersion,
    displayName,
    metaDocument
  }) {
    const workflow = metaDocument?.workflows?.fill || {};
    const processTemplates = await this.getProcessDefinitionTemplatesByArtifact(artifactId, connection);

    if (!processTemplates.length) {
      return {
        linkedTemplates: 0,
        syncedTemplates: 0,
        syncedSteps: 0,
        deactivatedTemplates: 0
      };
    }

    const syncEnabled = isArtifactFillWorkflowSyncEnabled(workflow);
    const cargoCodeMap = syncEnabled ? await this.getCargoCodeMap(connection) : new Map();
    const normalizedSteps = syncEnabled
      ? normalizeFillSteps(workflow, { cargoCodeMap })
      : [];
    const templateName = String(workflow?.name || "").trim() || `Flujo de entrega - ${displayName}`;
    const templateDescription = buildArtifactSyncedFillDescription({
      artifactId,
      templateCode,
      storageVersion
    });

    let syncedTemplates = 0;
    let syncedSteps = 0;
    let deactivatedTemplates = 0;

    for (const processTemplate of processTemplates) {
      const existingTemplate = await this.getSyncedFillFlowTemplate(processTemplate.id, connection);

      if (!syncEnabled || !normalizedSteps.length) {
        if (existingTemplate?.id) {
          await connection.query(
            `UPDATE fill_flow_templates
             SET is_active = 0,
                 name = ?,
                 description = ?
             WHERE id = ?`,
            [templateName, templateDescription, existingTemplate.id]
          );
          deactivatedTemplates += 1;
        }
        continue;
      }

      let fillFlowTemplateId = existingTemplate?.id ? Number(existingTemplate.id) : null;
      const templateHasRuntimeUsage = fillFlowTemplateId
        ? await this.hasFillFlowTemplateRuntimeUsage(fillFlowTemplateId, connection)
        : false;

      if (!fillFlowTemplateId || templateHasRuntimeUsage) {
        const [insertResult] = await connection.query(
          `INSERT INTO fill_flow_templates (
             process_definition_template_id,
             name,
             description,
             is_active
           ) VALUES (?, ?, ?, 1)`,
          [processTemplate.id, templateName, templateDescription]
        );
        fillFlowTemplateId = Number(insertResult.insertId);
      } else {
        await connection.query(
          `UPDATE fill_flow_templates
           SET name = ?,
               description = ?,
               is_active = 1
           WHERE id = ?`,
          [templateName, templateDescription, fillFlowTemplateId]
        );
      }

      await connection.query(
        `UPDATE fill_flow_templates
         SET is_active = 0
         WHERE process_definition_template_id = ?
           AND description LIKE ?
           AND id <> ?`,
        [processTemplate.id, `${ARTIFACT_SYNC_FILL_DESCRIPTION_PREFIX}%`, fillFlowTemplateId]
      );

      await this.replaceSyncedFillFlowSteps(fillFlowTemplateId, normalizedSteps, connection);
      syncedTemplates += 1;
      syncedSteps += normalizedSteps.length;
    }

    return {
      linkedTemplates: processTemplates.length,
      syncedTemplates,
      syncedSteps,
      deactivatedTemplates
    };
  }

  async syncArtifactSignatureWorkflowForArtifact({
    connection,
    artifactId,
    templateCode,
    storageVersion,
    displayName,
    metaDocument
  }) {
    const workflow = metaDocument?.workflows?.signatures || {};
    const processTemplates = await this.getProcessDefinitionTemplatesByArtifact(artifactId, connection);

    if (!processTemplates.length) {
      return {
        linkedTemplates: 0,
        syncedTemplates: 0,
        syncedSteps: 0,
        deactivatedTemplates: 0
      };
    }

    const syncEnabled = isArtifactSignatureWorkflowSyncEnabled(workflow);
    const templateName = String(workflow?.name || "").trim() || `Flujo de firma - ${displayName}`;
    const templateDescription = buildArtifactSyncedSignatureDescription({
      artifactId,
      templateCode,
      storageVersion
    });

    const cargoCodeMap = await this.getCargoCodeMap(connection);
    const unitTypeNameMap = await this.getUnitTypeNameMap(connection);
    const normalizationIssues = syncEnabled
      ? collectSignatureWorkflowNormalizationIssues(workflow, { cargoCodeMap, unitTypeNameMap })
      : [];
    if (normalizationIssues.length) {
      throw new Error(
        `No se pudo sincronizar el flujo de firmas de ${templateCode}: ${normalizationIssues.join(" ")}`
      );
    }
    const normalizedSteps = syncEnabled
      ? normalizeSignatureSteps(workflow, { cargoCodeMap, unitTypeNameMap })
      : [];

    let syncedTemplates = 0;
    let syncedSteps = 0;
    let deactivatedTemplates = 0;

    for (const processTemplate of processTemplates) {
      const existingTemplate = await this.getSyncedSignatureFlowTemplate(processTemplate.id, connection);

      if (!syncEnabled || !normalizedSteps.length) {
        if (existingTemplate?.id) {
          await connection.query(
            `UPDATE signature_flow_templates
             SET is_active = 0,
                 name = ?,
                 description = ?
             WHERE id = ?`,
            [templateName, templateDescription, existingTemplate.id]
          );
          deactivatedTemplates += 1;
        }
        continue;
      }

      let signatureFlowTemplateId = existingTemplate?.id ? Number(existingTemplate.id) : null;
      const templateHasRuntimeUsage = signatureFlowTemplateId
        ? await this.hasSignatureFlowTemplateRuntimeUsage(signatureFlowTemplateId, connection)
        : false;

      if (!signatureFlowTemplateId || templateHasRuntimeUsage) {
        const [insertResult] = await connection.query(
          `INSERT INTO signature_flow_templates (
             process_definition_template_id,
             name,
             description,
             is_active
           ) VALUES (?, ?, ?, 1)`,
          [processTemplate.id, templateName, templateDescription]
        );
        signatureFlowTemplateId = Number(insertResult.insertId);
      } else {
        await connection.query(
          `UPDATE signature_flow_templates
           SET name = ?,
               description = ?,
               is_active = 1
           WHERE id = ?`,
          [templateName, templateDescription, signatureFlowTemplateId]
        );
      }

      await connection.query(
        `UPDATE signature_flow_templates
         SET is_active = 0
         WHERE process_definition_template_id = ?
           AND description LIKE ?
           AND id <> ?`,
        [processTemplate.id, `${ARTIFACT_SYNC_SIGNATURE_DESCRIPTION_PREFIX}%`, signatureFlowTemplateId]
      );

      await this.replaceSyncedSignatureFlowSteps(signatureFlowTemplateId, normalizedSteps, connection);
      syncedTemplates += 1;
      syncedSteps += normalizedSteps.length;
    }

    return {
      linkedTemplates: processTemplates.length,
      syncedTemplates,
      syncedSteps,
      deactivatedTemplates
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

  // Lee el schema.json de un artifact desde MinIO y lo devuelve como lista de campos
  // editables en la web (formato inverso de buildSchemaJsonFromFields).
  async getTemplateArtifactSchema(artifactId) {
    this.ensurePool();
    const artifact = await this.getByKeys("template_artifacts", { id: Number(artifactId) });
    if (!artifact) {
      throw new Error("El artifact seleccionado no existe.");
    }
    const bucket = MINIO_TEMPLATES_BUCKET;
    let schema = {};
    try {
      const text = await readMinioObjectAsText(bucket, artifact.schema_object_key);
      schema = JSON.parse(text || "{}");
    } catch {
      schema = {};
    }
    const properties = schema?.properties || {};
    const requiredSet = new Set(Array.isArray(schema?.required) ? schema.required : []);
    const fields = Object.entries(properties).map(([key, def]) => ({
      key: def?.["x-deasy-data-key"] || key,
      title: def?.title || key,
      field_code: def?.["x-deasy-field-code"] || "",
      component: def?.["x-deasy-ui"]?.component || "text",
      group: def?.["x-deasy-ui"]?.group || "general",
      required: requiredSet.has(def?.["x-deasy-data-key"] || key),
    }));

    // Lee los workflows (fill/signatures) del meta.yaml en formato editable por la web.
    let fillWorkflow = { required: true, steps: [] };
    let signatureWorkflow = { required: false, steps: [] };
    try {
      const meta = await this.loadTemplateArtifactMetaDocument(artifact);
      const fill = meta?.workflows?.fill || {};
      fillWorkflow = {
        required: fill?.required !== false,
        steps: (Array.isArray(fill?.steps) ? fill.steps : []).map((s, i) => ({
          order: Number(s?.order) || i + 1,
          code: s?.code || "",
          name: s?.name || "",
          resolver_type: s?.resolver?.type || "task_assignee",
          selection_mode: s?.resolver?.selection_mode || "auto_one",
          cargo_id: s?.resolver?.cargo_id || null,
          cargo_code: s?.resolver?.cargo_code || "",
          unit_scope_type: s?.resolver?.unit_scope_type || "context_exact",
          unit_id: s?.resolver?.unit_id || null,
          unit_type_id: s?.resolver?.unit_type_id || null,
          person_id: s?.resolver?.person_id || null,
          position_id: s?.resolver?.position_id || null,
          field_refs: Array.isArray(s?.field_refs) ? s.field_refs : [],
          required: s?.required !== false,
        })),
      };
      const sig = meta?.workflows?.signatures || {};
      // Aplana un resolutor del meta a los campos que usa el formulario web de firmante.
      const flattenSigner = (resolver = {}) => ({
        resolver_type: resolver?.type || "cargo_in_scope",
        selection_mode: resolver?.selection_mode || "auto_all",
        cargo_id: resolver?.cargo_id || null,
        cargo_code: resolver?.cargo_code || "",
        unit_scope_type: resolver?.unit_scope_type || "context_exact",
        unit_id: resolver?.unit_id || null,
        unit_type_id: resolver?.unit_type_id || null,
        person_id: resolver?.person_id || null,
        position_id: resolver?.position_id || null,
      });
      signatureWorkflow = {
        required: sig?.required === true,
        steps: (Array.isArray(sig?.steps) ? sig.steps : []).map((s, i) => {
          // Multi-firmante: `signers: [...]`. Back-compat: meta antigua con un único `resolver`.
          const rawSigners = Array.isArray(s?.signers) && s.signers.length
            ? s.signers
            : (s?.resolver ? [s.resolver] : []);
          return {
            order: Number(s?.order) || i + 1,
            code: s?.code || "",
            name: s?.name || "",
            approval_mode: s?.approval_mode || "and",
            required_signers_min: s?.required_signers_min || 1,
            required: s?.required !== false,
            signers: rawSigners.map(flattenSigner),
          };
        }),
      };
    } catch {
      // sin meta legible → flujos vacíos por defecto
    }

    return {
      artifact_id: Number(artifactId),
      template_code: artifact.template_code,
      display_name: artifact.display_name,
      fields,
      fill_workflow: fillWorkflow,
      signature_workflow: signatureWorkflow,
    };
  }

  // True si la plantilla está vinculada a algún proceso y TODOS sus vínculos son 'routed' (que NO autoran
  // flujo: se define al enviar). Se usa para relajar el readiness "≥1 paso de entrega" en publish/activate
  // por id (sin contexto de link). Si tiene algún vínculo no-routed, o ninguno, se mantiene el readiness.
  async isArtifactRoutedOnly(artifactId, connection = this.pool) {
    const [rows] = await connection.query(
      "SELECT item_mode FROM process_definition_templates WHERE template_artifact_id = ?",
      [Number(artifactId)]
    );
    if (!rows.length) return false;
    return rows.every((row) => String(row.item_mode) === "routed");
  }

  // Activa/desactiva una plantilla. is_active es el único estado del ciclo de vida (Activo/Inactivo).
  // Al activar se exige que la plantilla tenga al menos un paso de flujo de entrega definido en su meta.yaml
  // (regla: una plantilla de proceso no se usa sin flujo de entrega). La firma puede ser ad-hoc.
  async setTemplateArtifactActive(artifactId, active) {
    this.ensurePool();
    const nextActive = active ? 1 : 0;
    const artifact = await this.getByKeys("template_artifacts", { id: Number(artifactId) });
    if (!artifact) {
      throw new Error("El artifact seleccionado no existe.");
    }
    const current = Number(artifact.is_active) === 1 ? 1 : 0;
    if (current === nextActive) {
      return { artifact_id: Number(artifactId), is_active: nextActive, changed: false };
    }
    if (nextActive === 1 && !(await this.isArtifactRoutedOnly(Number(artifactId)))) {
      let fillSteps = 0;
      try {
        const meta = await this.loadTemplateArtifactMetaDocument(artifact);
        fillSteps = (Array.isArray(meta?.workflows?.fill?.steps) ? meta.workflows.fill.steps : []).length;
      } catch {
        fillSteps = 0;
      }
      if (!fillSteps) {
        throw new Error("No se puede activar: la plantilla debe definir al menos un paso de flujo de entrega.");
      }
    }

    await this.pool.query(
      "UPDATE template_artifacts SET is_active = ? WHERE id = ?",
      [nextActive, Number(artifactId)]
    );

    return { artifact_id: Number(artifactId), is_active: nextActive, previous_is_active: current, changed: true };
  }

  // F5 — "una sola publicada por ENTREGABLE": retira las demás versiones publicadas del mismo deliverable_id
  // (== mismo deliverable_id) que la versión dada. NO publica la versión dada (eso lo hace quien llama).
  async retirePriorPublishedSiblings(connection, artifactId) {
    const [rows] = await connection.query(
      "SELECT deliverable_id FROM template_artifacts WHERE id = ? LIMIT 1",
      [Number(artifactId)]
    );
    const delivId = rows?.[0]?.deliverable_id || null;
    if (delivId) {
      await connection.query(
        `UPDATE template_artifacts SET lifecycle_state = 'retired', is_active = 0
          WHERE deliverable_id = ? AND id <> ? AND lifecycle_state = 'published'`,
        [delivId, Number(artifactId)]
      );
    }
  }

  // Máquina de estados de la VERSIÓN de plantilla (Fase 0). publicar: draft|retired → published, exige al menos
  // un paso de flujo de entrega (readiness) y retira la versión publicada previa del MISMO ENTREGABLE
  // (una sola publicada por entregable). La nueva queda usable (is_active=1). Atómico.
  async publishTemplateArtifact(artifactId) {
    this.ensurePool();
    const id = Number(artifactId);
    const artifact = await this.getByKeys("template_artifacts", { id });
    if (!artifact) {
      throw new Error("El artifact seleccionado no existe.");
    }
    if (String(artifact.lifecycle_state || "") === "published") {
      return { artifact_id: id, lifecycle_state: "published", changed: false };
    }
    // routed NO autora flujo (se define al enviar): se omite el readiness si la plantilla es routed-only.
    if (!(await this.isArtifactRoutedOnly(id))) {
      let fillSteps = 0;
      try {
        const meta = await this.loadTemplateArtifactMetaDocument(artifact);
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
      // Una sola publicada por ENTREGABLE: retira las otras publicadas del mismo deliverable.
      await this.retirePriorPublishedSiblings(connection, id);
      await connection.query(
        "UPDATE template_artifacts SET lifecycle_state = 'published', is_active = 1 WHERE id = ?",
        [id]
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
    return {
      artifact_id: id,
      lifecycle_state: "published",
      is_active: 1,
      changed: true,
      __notice: `Plantilla ${artifact.template_code} v${artifact.storage_version} publicada.`,
    };
  }

  // Retira una versión: no enlazable a configs nuevas, pero se conserva para auditoría (los documentos ya
  // emitidos siguen pineados a ella). No la borra.
  async retireTemplateArtifact(artifactId) {
    this.ensurePool();
    const id = Number(artifactId);
    const artifact = await this.getByKeys("template_artifacts", { id });
    if (!artifact) {
      throw new Error("El artifact seleccionado no existe.");
    }
    if (String(artifact.lifecycle_state || "") === "retired") {
      return { artifact_id: id, lifecycle_state: "retired", changed: false };
    }
    await this.pool.query(
      "UPDATE template_artifacts SET lifecycle_state = 'retired', is_active = 0 WHERE id = ?",
      [id]
    );
    return { artifact_id: id, lifecycle_state: "retired", changed: true };
  }

  // Próxima versión semver de una configuración dentro de su (proceso, variación).
  async getNextProcessDefinitionVersion(processId, variationKey, level = "minor", connection = this.pool) {
    const [rows] = await connection.query(
      `SELECT definition_version FROM process_definition_versions
        WHERE process_id = ? AND variation_key = ?`,
      [Number(processId), String(variationKey || "")]
    );
    let maxKey = -1;
    let maxVersion = "";
    for (const row of rows || []) {
      const m = String(row.definition_version || "").trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
      if (!m) continue;
      const key = Number(m[1]) * 1e6 + Number(m[2]) * 1e3 + Number(m[3]);
      if (key > maxKey) {
        maxKey = key;
        maxVersion = `${m[1]}.${m[2]}.${m[3]}`;
      }
    }
    if (!maxVersion) return "1.0.0";
    return bumpSemanticVersion(maxVersion, level);
  }

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

    const template = await this.getByKeys("template_artifacts", { id: tplId });
    if (!template) {
      throw new Error("La plantilla no existe.");
    }
    if (String(template.lifecycle_state || "published") !== "published") {
      throw new Error("Solo se puede actualizar desde una versión publicada de la plantilla.");
    }

    // 1) Clonar la plantilla → nueva versión en borrador (MinIO + DB). Fuera de la transacción de la config
    //    porque copia objetos en MinIO (efecto colateral no transaccional).
    const tplVersion = await this.createTemplateArtifactVersion(tplId, bumpLevel);
    const newTemplateId = Number(tplVersion.id);

    // 2) Clonar la config activa → borrador, re-apuntando el enlace de plantilla a la nueva versión.
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const nextConfigVersion = await this.getNextProcessDefinitionVersion(
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
      await this.cloneProcessDefinitionChildren({
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
  async finishTemplateUpdate({ templateArtifactId, configDefinitionId } = {}) {
    this.ensurePool();
    const tplId = Number(templateArtifactId);
    const cfgId = Number(configDefinitionId);
    if (!tplId || !cfgId) {
      throw new Error("Faltan datos: se requieren la plantilla y la configuración borrador.");
    }

    const template = await this.getByKeys("template_artifacts", { id: tplId });
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
        const meta = await this.loadTemplateArtifactMetaDocument(template);
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
      await this.ensureDefinitionHasActiveRulesForActivation(cfgId, connection);
      await this.ensureDefinitionHasActivePeriodTypesForActivation(cfgId, connection);

      // Publicar plantilla PRIMERO (deja is_active=1) para que pase el check de artefactos activos.
      // Una sola publicada por ENTREGABLE: retira las demás publicadas del mismo deliverable.
      await this.retirePriorPublishedSiblings(connection, tplId);
      await connection.query(
        "UPDATE template_artifacts SET lifecycle_state = 'published', is_active = 1 WHERE id = ?",
        [tplId]
      );

      // Ahora sí, el check de artefactos activos de la config pasa (la nueva plantilla ya está activa).
      await this.ensureDefinitionHasArtifactsForActivation(cfgId, connection);

      // Activar config: retira la activa previa de la serie + activa esta.
      const retiredCount = await this.retireActiveDefinitionsInSeries({
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
    const nextVersion = await this.getNextProcessDefinitionVersion(
      definition.process_id, definition.variation_key, "minor", connection
    );
    const [insertResult] = await connection.query(
      `INSERT INTO process_definition_versions
         (process_id, series_id, variation_key, definition_version, name, description, status, effective_from)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', CURDATE())`,
      [definition.process_id, definition.series_id, definition.variation_key, nextVersion, definition.name, definition.description]
    );
    const newId = Number(insertResult.insertId);
    await this.cloneProcessDefinitionChildren({
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
        await this.syncArtifactWorkflowsForTemplateArtifactId(Number(targetArtifactId), connection);
      } catch {
        // aviso no bloqueante
      }
    }
    return result?.affectedRows || 0;
  }

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
    const target = await this.getByKeys("template_artifacts", { id: targetId });
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

  // Crea una nueva versión (storage_version semver) clonando un artifact existente. Nace inactiva
  // (is_active=0): el gestor la activa cuando esté lista. El nivel de cambio (patch/minor/major) lo elige
  // quien crea la versión.
  async createTemplateArtifactVersion(artifactId, bumpLevel = "minor") {
    this.ensurePool();
    const artifact = await this.getByKeys("template_artifacts", { id: Number(artifactId) });
    if (!artifact) {
      throw new Error("El artifact seleccionado no existe.");
    }
    const bucket = MINIO_TEMPLATES_BUCKET;
    const templateCode = String(artifact.template_code);
    const nextStorageVersion = await this.getNextStorageVersionForTemplateCode(templateCode, bumpLevel);
    // El entregable se identifica por código (siempre existe tras backfill/creación). Robusto aunque getByKeys
    // no traiga deliverable_id (la columna no está en la config de sqlTables).
    const [delivRows] = await this.pool.query("SELECT id FROM deliverables WHERE code = ? LIMIT 1", [templateCode]);
    const deliverableId = delivRows?.[0]?.id || null;
    const oldVersion = String(artifact.storage_version || "");
    const oldPrefix = String(artifact.base_object_prefix || "").replace(/\/?$/, "/");
    const versionSuffixRe = new RegExp(`${oldVersion.replace(/[.\\]/g, "\\$&")}/?$`);
    const newPrefix = oldVersion ? oldPrefix.replace(versionSuffixRe, `${nextStorageVersion}/`) : oldPrefix;
    if (newPrefix === oldPrefix) {
      throw new Error("No se pudo derivar la ruta de la nueva versión.");
    }

    // Copia los objetos de la versión actual a la nueva ruta en MinIO.
    const objectNames = await listMinioObjects(bucket, oldPrefix, true);
    if (!objectNames.length) {
      throw new Error("La versión actual no tiene objetos en MinIO para clonar.");
    }
    for (const objectName of objectNames) {
      if (!objectName.startsWith(oldPrefix)) continue;
      const relative = objectName.slice(oldPrefix.length);
      if (!relative) continue;
      // Copia binaria (preserva bytes y content-type); NO leer/escribir como texto (corrompe binarios).
      await copyMinioObjectBinary(bucket, objectName, `${newPrefix}${relative}`);
    }

    const newSchemaKey = `${newPrefix}schema.json`;
    const newMetaKey = `${newPrefix}meta.yaml`;
    // Re-mapea los entry_object_key de available_formats del prefijo viejo al nuevo (antes quedaban
    // apuntando a la versión anterior).
    const remappedFormats = parseAvailableFormats(artifact.available_formats);
    for (const entry of Object.values(remappedFormats || {})) {
      if (entry?.entry_object_key && String(entry.entry_object_key).startsWith(oldPrefix)) {
        entry.entry_object_key = `${newPrefix}${String(entry.entry_object_key).slice(oldPrefix.length)}`;
      }
    }
    // Identidad/scope/owner viven en `deliverables`; la versión solo hereda deliverable_id (mismo entregable).
    const [result] = await this.pool.query(
      `INSERT INTO template_artifacts (
        storage_version, lifecycle_state, base_object_prefix,
        available_formats, schema_object_key, meta_object_key, content_hash, parent_version_id, deliverable_id, is_active
      ) VALUES (?, 'draft', ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        nextStorageVersion,
        newPrefix,
        JSON.stringify(remappedFormats || {}),
        newSchemaKey,
        newMetaKey,
        artifact.content_hash,
        Number(artifactId),
        deliverableId,
      ]
    );

    return {
      id: Number(result.insertId),
      template_code: templateCode,
      storage_version: nextStorageVersion,
      base_object_prefix: newPrefix,
      template_scope: artifact.template_scope || "official",
      lifecycle_state: "draft",
      parent_version_id: Number(artifactId),
      is_active: 0,
      __notice: `Nueva versión ${nextStorageVersion} creada (en borrador). Publícala cuando esté lista.`,
    };
  }

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
    try { await this.syncArtifactWorkflowsForTemplateArtifactId(newArtifactId); } catch { /* aviso no bloqueante */ }

    return { deliverable_id: newDeliverableId, artifact_id: newArtifactId, code, base_object_prefix: newPrefix };
  }

  // Aplica una re-subida de código (ZIP del subárbol process/jinja2/src) editado por el admin:
  // verifica que los archivos protegidos no cambiaron (hash vs manifest), que solo se tocó Contenido/,
  // sanea contra inyecciones LaTeX y, si todo es válido, crea una NUEVA versión con el contenido editado.
  // Solo AdminSistema (gate también en la ruta).
  async applyTemplateArtifactSource(artifactId, zipFilePath, actor = {}) {
    this.ensurePool();
    if (!Array.isArray(actor?.roleNames) || !actor.roleNames.includes("AdminSistema")) {
      const error = new Error("Solo AdminSistema puede editar el código de la plantilla.");
      error.statusCode = 403;
      throw error;
    }
    const artifact = await this.getByKeys("template_artifacts", { id: Number(artifactId) });
    if (!artifact) {
      throw new Error("El artifact seleccionado no existe.");
    }
    const bucket = MINIO_TEMPLATES_BUCKET;
    const basePrefix = String(artifact.base_object_prefix || "").replace(/\/?$/, "/");
    const formats = parseAvailableFormats(artifact.available_formats);
    const jinjaEntry = formats?.[CONTRACT_FORMAT]?.entry_object_key;
    if (!jinjaEntry) {
      throw new Error("La plantilla no tiene un contrato jinja2 editable.");
    }
    const srcRelPrefix = String(jinjaEntry).startsWith(basePrefix)
      ? String(jinjaEntry).slice(basePrefix.length)
      : EDITABLE_CONTENT_SUBPATH.replace(/Contenido\/$/, "");
    const editablePrefix = EDITABLE_CONTENT_SUBPATH.startsWith(srcRelPrefix)
      ? EDITABLE_CONTENT_SUBPATH.slice(srcRelPrefix.length)
      : "Contenido/";

    let manifest;
    try {
      manifest = JSON.parse(await readMinioObjectAsText(bucket, `${basePrefix}manifest.json`));
    } catch {
      throw new Error("La plantilla no tiene manifest.json de integridad. Vuelve a generarla con el flujo actual.");
    }
    const protectedMap = manifest?.protected || {};

    const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "tpl-source-"));
    try {
      await unzipToDirectory(zipFilePath, workDir);
      const uploaded = walkFiles(workDir)
        .map((abs) => ({ abs, rel: path.relative(workDir, abs).replace(/\\/g, "/") }))
        .filter((entry) => !path.basename(entry.rel).startsWith("."));
      if (!uploaded.length) {
        throw new Error("El ZIP no contiene archivos.");
      }

      const violations = [];
      const editedContent = [];
      const seenProtected = new Set();
      for (const entry of uploaded) {
        if (entry.rel.includes("..") || entry.rel.startsWith("/")) {
          violations.push(`Ruta no permitida: ${entry.rel}`);
          continue;
        }
        const fullRel = `${srcRelPrefix}${entry.rel}`;
        if (Object.hasOwn(protectedMap, fullRel)) {
          const hash = crypto.createHash("sha256").update(fs.readFileSync(entry.abs)).digest("hex");
          if (hash !== protectedMap[fullRel]) {
            violations.push(`Archivo protegido modificado: ${entry.rel}`);
          }
          seenProtected.add(fullRel);
        } else if (entry.rel.startsWith(editablePrefix)) {
          violations.push(...sanitizeLatexSource(entry.rel, fs.readFileSync(entry.abs, "utf8")));
          editedContent.push(entry);
        } else {
          violations.push(`Archivo no permitido (solo se edita ${editablePrefix} y no se añaden archivos al contrato): ${entry.rel}`);
        }
      }
      // No se permite borrar archivos protegidos del contrato (los que viven bajo el src).
      for (const key of Object.keys(protectedMap)) {
        if (key.startsWith(srcRelPrefix) && !seenProtected.has(key)) {
          violations.push(`Falta un archivo protegido del contrato: ${key.slice(srcRelPrefix.length)}`);
        }
      }
      if (violations.length) {
        const error = new Error(`La re-subida no cumple el contrato:\n- ${violations.slice(0, 25).join("\n- ")}`);
        error.statusCode = 422;
        throw error;
      }
      if (!editedContent.length) {
        throw new Error("No se detectaron cambios en el contenido editable (Contenido/).");
      }

      const version = await this.createTemplateArtifactVersion(artifactId, "patch");
      for (const entry of editedContent) {
        await putMinioObjectFromText(
          bucket,
          `${version.base_object_prefix}${srcRelPrefix}${entry.rel}`,
          fs.readFileSync(entry.abs, "utf8"),
          "text/plain"
        );
      }
      return {
        id: version.id,
        storage_version: version.storage_version,
        base_object_prefix: version.base_object_prefix,
        edited_files: editedContent.length,
        __notice: `Código verificado y actualizado en nueva versión ${version.storage_version} (inactiva). Archivos de contenido actualizados: ${editedContent.length}.`
      };
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
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

  // Devuelve la siguiente storage_version semver para un código. La primera versión es 1.0.0; si ya existe
  // alguna, sube desde la mayor por el nivel elegido (patch/minor/major). Garantiza unicidad y monotonía.
  async getNextStorageVersionForTemplateCode(templateCode, level = "minor", connection = this.pool) {
    const [rows] = await connection.query(
      `SELECT ta.storage_version
       FROM template_artifacts ta
       INNER JOIN deliverables d ON d.id = ta.deliverable_id
       WHERE d.code = ?`,
      [templateCode]
    );
    let maxKey = -1;
    let maxVersion = "";
    for (const row of rows || []) {
      const match = String(row.storage_version || "").trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
      if (!match) {
        continue;
      }
      const key = Number(match[1]) * 1e6 + Number(match[2]) * 1e3 + Number(match[3]);
      if (key > maxKey) {
        maxKey = key;
        maxVersion = `${match[1]}.${match[2]}.${match[3]}`;
      }
    }
    if (!maxVersion) {
      return "1.0.0";
    }
    return bumpSemanticVersion(maxVersion, level);
  }

  async createTemplateArtifactDraft(data = {}, files = {}, actor = {}) {
    return this.saveTemplateArtifactDraft(null, data, files, actor);
  }

  async updateTemplateArtifactDraft(artifactId, data = {}, files = {}, actor = {}) {
    return this.saveTemplateArtifactDraft(artifactId, data, files, actor);
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
      existingArtifact = await this.getByKeys("template_artifacts", { id: Number(artifactId) });
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
        let fillWorkflowCheck = data.fill_workflow;
        if (typeof fillWorkflowCheck === "string") {
          try { fillWorkflowCheck = JSON.parse(fillWorkflowCheck); } catch { fillWorkflowCheck = null; }
        }
        if (!fillWorkflowCheck || !Array.isArray(fillWorkflowCheck.steps) || !fillWorkflowCheck.steps.length) {
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

    // La cédula del propietario (ownerRef) ya no se persiste como columna: se usa solo para construir la ruta
    // MinIO ad_hoc al crear (Users/<cédula>/...) y para resolver owner_person_id. En edición se reutiliza el
    // base_object_prefix ya almacenado, así que no es necesaria.
    let ownerRef = ownerCedula.slice(0, 180);
    let ownerPersonId = normalizeNumericId(existingArtifact?.owner_person_id);
    if (!ownerRef && ownerPersonId) {
      const ownerPersonRow = await this.getByKeys("persons", { id: ownerPersonId });
      ownerRef = String(ownerPersonRow?.cedula || "").slice(0, 180);
    }
    if (requestedOwnerPersonId) {
      const ownerPerson = await this.getByKeys("persons", { id: requestedOwnerPersonId });
      if (!ownerPerson) {
        throw new Error("La persona propietaria indicada no existe.");
      }
      ownerPersonId = requestedOwnerPersonId;
    } else if (!ownerPersonId && ownerRef) {
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
    const baseSlug = slugify(displayName) || "artifact";
    const templateCode = String(existingArtifact?.template_code || `draft_${baseSlug}`).slice(0, 180);
    const storageVersion = existingArtifact?.storage_version || await this.getNextStorageVersionForTemplateCode(templateCode);
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
      BACKEND_STORAGE_ROOT,
      "minio-jobs",
      "templates-drafts",
      ownerRef || templateScope,
      templateCode,
      storageVersion
    );

    fs.rmSync(draftDir, { recursive: true, force: true });
    fs.mkdirSync(draftDir, { recursive: true });
    fs.mkdirSync(path.join(draftDir, "template"), { recursive: true });
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
      seedRow = await this.getByKeys("template_seeds", { id: templateSeedId });
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
      `name: "${displayName.replace(/"/g, '\\"')}"`,
      `version: "${storageVersion.replace(/"/g, '\\"')}"`,
      `template_code: "${templateCode.replace(/"/g, '\\"')}"`,
      `template_scope: ${templateScope}`
    ];
    if (description) {
      metaLines.push(`description: "${description.replace(/"/g, '\\"')}"`);
    }
    if (seedRow?.seed_code) {
      metaLines.push(`seed_code: "${String(seedRow.seed_code).replace(/"/g, '\\"')}"`);
    }
    // Flujos definidos desde el editor web (fill/signatures). Si no llegan, se usa el contrato vacío.
    let fillWorkflow = data.fill_workflow;
    let signatureWorkflow = data.signature_workflow;
    if (typeof fillWorkflow === "string") {
      try { fillWorkflow = JSON.parse(fillWorkflow); } catch { fillWorkflow = null; }
    }
    if (typeof signatureWorkflow === "string") {
      try { signatureWorkflow = JSON.parse(signatureWorkflow); } catch { signatureWorkflow = null; }
    }
    const hasCustomWorkflows =
      (fillWorkflow && Array.isArray(fillWorkflow.steps) && fillWorkflow.steps.length)
      || (signatureWorkflow && Array.isArray(signatureWorkflow.steps) && signatureWorkflow.steps.length);
    // Avisos no bloqueantes de autoría (p. ej. cargo sin puesto hoy en la ubicación): se acumulan para
    // informarlos en la respuesta, sin abortar el guardado.
    let authoringWarnings = [];
    // Validación del contrato de flujo en autoría (no solo al vincular): falla rápido y claro antes de
    // subir el meta.yaml, en vez de degradar silenciosamente en la normalización del sync.
    if (hasCustomWorkflows) {
      // Proceso vinculado: en creación llega en el form; en edición se busca el vínculo existente.
      let linkedDefinitionId = normalizeNumericId(data.process_definition_id);
      if (!linkedDefinitionId && isEdit && existingArtifact?.id) {
        const [linkRows] = await this.pool.query(
          "SELECT process_definition_id FROM process_definition_templates WHERE template_artifact_id = ? LIMIT 1",
          [Number(existingArtifact.id)]
        );
        linkedDefinitionId = normalizeNumericId(linkRows?.[0]?.process_definition_id);
      }
      const [cargoCodeMap, referenceIds, processScope] = await Promise.all([
        this.getCargoCodeMap(),
        this.getWorkflowReferenceIdSets(),
        this.getProcessTargetScope(linkedDefinitionId)
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
        needsCtxCargos && linkedDefinitionId ? this.listResolvableCargos(linkedDefinitionId) : Promise.resolve(null),
        unitExactUnitIds.length ? this.getResolvableCargoIdsByUnit(this.pool, unitExactUnitIds) : Promise.resolve(new Map())
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
      authoringWarnings = workflowWarnings;
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
      `${JSON.stringify(buildProtectedManifest(draftDir), null, 2)}\n`,
      "utf8"
    );
    let createdId = isEdit ? Number(existingArtifact.id) : null;
    let uploadedToMinio = false;

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
        const def = await this.getByKeys("process_definition_versions", { id: requestedProcessDefinitionId });
        if (!def) {
          throw new Error("El proceso destino seleccionado no existe.");
        }
        const [existingLink] = await this.pool.query(
          `SELECT id FROM process_definition_templates
           WHERE process_definition_id = ? AND template_artifact_id = ? LIMIT 1`,
          [requestedProcessDefinitionId, createdId]
        );
        if (!existingLink?.length) {
          await this.pool.query(
            `INSERT INTO process_definition_templates
              (process_definition_id, template_artifact_id, sort_order, item_mode)
             VALUES (?, ?, 1, ?)`,
            [requestedProcessDefinitionId, createdId, requestedItemMode]
          );
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
          const summary = await this.syncArtifactWorkflowsForTemplateArtifactId(createdId);
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
      // Rollback en creación: borra la fila SQL y limpia los objetos huérfanos subidos a MinIO.
      // En edición no se limpia MinIO (los objetos pertenecen a un artifact existente que se conserva).
      if (!isEdit) {
        if (createdId) {
          await this.pool.query("DELETE FROM template_artifacts WHERE id = ?", [createdId]).catch(() => {});
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

  async remove(tableName, keys) {
    this.ensurePool();
    const config = getConfig(tableName);
    const keyPayload = pickPayload(config.fields, keys, { includeReadOnly: true });
    const { where, params } = buildWhere(config.primaryKeys, keyPayload);

    if (
      tableName === "process_definition_templates"
      || tableName === "process_target_rules"
      || tableName === "process_definition_period_types"
    ) {
      const existing = await this.getByKeys(tableName, keyPayload);
      if (!existing) {
        throw new Error("Registro no encontrado.");
      }
      await this.ensureDraftDefinitionContext(
        existing.process_definition_id,
        {
          entityLabel:
            tableName === "process_definition_templates"
              ? "las plantillas de configuracion"
              : tableName === "process_target_rules"
                ? "las reglas de alcance"
                : "los periodos del proceso"
        }
      );
    }

    if (tableName === "signature_flow_templates") {
      const existing = await this.getByKeys(tableName, keyPayload);
      if (!existing) {
        throw new Error("Registro no encontrado.");
      }
      const template = await this.getTaskTemplate(existing.process_definition_template_id);
      if (!template) {
        throw new Error("La plantilla de proceso configurado asociada al flujo ya no existe.");
      }
      await this.ensureDraftDefinitionContext(
        template.process_definition_id,
        { entityLabel: "los flujos de firma" }
      );
    }

    // Quitar una plantilla de la configuración: sus flujos derivados (entrega/firma) cuelgan del vínculo y sus
    // FKs NO son ON DELETE CASCADE, así que hay que borrarlos primero. Solo aplica en draft (validado arriba);
    // en draft no existen instancias de runtime (requests/firmas), por eso basta con templates + pasos.
    if (tableName === "process_definition_templates") {
      const templateId = Number(keyPayload.id);
      const connection = await this.pool.getConnection();
      try {
        await connection.beginTransaction();
        // Flujos de ENTREGA del vínculo: pasos → template.
        const [fillTpls] = await connection.query(
          "SELECT id FROM fill_flow_templates WHERE process_definition_template_id = ?",
          [templateId]
        );
        for (const tpl of fillTpls) {
          await connection.query("DELETE FROM fill_flow_steps WHERE fill_flow_template_id = ?", [tpl.id]);
        }
        await connection.query("DELETE FROM fill_flow_templates WHERE process_definition_template_id = ?", [templateId]);
        // Flujos de FIRMA del vínculo: pasos → template.
        const [sigTpls] = await connection.query(
          "SELECT id FROM signature_flow_templates WHERE process_definition_template_id = ?",
          [templateId]
        );
        for (const tpl of sigTpls) {
          await connection.query("DELETE FROM signature_flow_steps WHERE template_id = ?", [tpl.id]);
        }
        await connection.query("DELETE FROM signature_flow_templates WHERE process_definition_template_id = ?", [templateId]);
        // Finalmente el vínculo.
        await connection.query(`DELETE FROM ${tableName} WHERE ${where}`, params);
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      return keyPayload;
    }

    await this.pool.query(`DELETE FROM ${tableName} WHERE ${where}`, params);
    return keyPayload;
  }
}
