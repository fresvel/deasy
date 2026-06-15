import { getMariaDBPool } from "../../config/mariadb.js";
import {
  hydrateTaskFromDefinition,
  ensureProcessRun,
  ensureDocumentsForTask,
  ensureDocumentForTaskItem,
  ensureFillFlowForDocumentVersion,
  ensureSignatureFlowForDocumentVersion,
  updateParentTaskStatusForTask
} from "./TaskGenerationService.js";
import { SQL_TABLE_MAP } from "../../config/sqlTables.js";
import bcrypt from "bcrypt";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import * as Minio from "minio";
import { fileURLToPath } from "url";
import yaml from "js-yaml";
import {
  assertDocumentStatusValue,
  assertDocumentVersionStatusValue,
} from "../documents/DocumentStateService.js";
import {
  syncDocumentProgressFromDocumentSignature,
  syncDocumentProgressFromFillRequest,
  syncDocumentProgressFromSignatureRequest,
} from "../documents/DocumentProgressService.js";
import {
  PROCESS_SERIES_SOURCE_TYPES,
  buildProcessDefinitionVersionName,
  resolveProcessDefinitionSeriesIdentity
} from "./processDefinitionSeries.js";

const DEFAULT_LIMIT = 50;
const BCRYPT_HASH_REGEX = /^\$2[abxy]\$\d{2}\$/;
const PERSON_TOKEN_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const SEMANTIC_VERSION_REGEX = /^\d+\.\d+\.\d+$/;
const ARTIFACT_STAGE_VALUES = new Set(["draft", "review", "approved", "published", "archived"]);
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

// Genera el bloque `workflows:` (fill + signatures) + `dependencies:` a partir de los flujos definidos en
// el editor web. Construye un objeto y lo serializa con yaml.dump (maneja saltos de línea/comillas/caracteres
// especiales de forma segura). Produce la misma estructura que consumen normalizeFillSteps/normalizeSignatureSteps.
const buildWorkflowsYaml = ({ fillWorkflow, signatureWorkflow } = {}) => {
  // ── Fill ──
  const fillSteps = Array.isArray(fillWorkflow?.steps) ? fillWorkflow.steps : [];
  const fill = {
    required: fillWorkflow?.required !== false,
    source: "artifact",
    sync_mode: "artifact_to_db",
    steps: fillSteps.map((step, index) => {
      const order = Number(step?.order) || index + 1;
      const resolver = {
        type: step?.resolver_type || "task_assignee",
        selection_mode: step?.selection_mode || "auto_one",
      };
      if (step?.resolver_type === "cargo_in_scope") {
        // El cargo se referencia por id (controlado contra la DB); se conserva cargo_code legible si viene.
        if (step?.cargo_id) resolver.cargo_id = Number(step.cargo_id);
        if (step?.cargo_code) resolver.cargo_code = step.cargo_code;
        const scopeType = step?.unit_scope_type || "context_exact";
        resolver.unit_scope_type = scopeType;
        // Ámbitos estáticos requieren fijar la unidad/tipo; los context_* la derivan del proceso en runtime.
        if ((scopeType === "unit_exact" || scopeType === "unit_subtree") && step?.unit_id) {
          resolver.unit_id = Number(step.unit_id);
        }
        if (scopeType === "unit_type" && step?.unit_type_id) {
          resolver.unit_type_id = Number(step.unit_type_id);
        }
      }
      if (step?.resolver_type === "specific_person" && step?.person_id) {
        resolver.person_id = Number(step.person_id);
      }
      if (step?.resolver_type === "position" && step?.position_id) {
        resolver.position_id = Number(step.position_id);
      }
      const out = { order };
      if (step?.code) out.code = step.code;
      out.name = step?.name || `Paso ${order}`;
      out.resolver = resolver;
      const fieldRefs = Array.isArray(step?.field_refs) ? step.field_refs.filter(Boolean) : [];
      if (fieldRefs.length) out.field_refs = fieldRefs;
      out.required = step?.required !== false;
      // La capacidad de devolver se deriva del orden: solo a partir del 2º paso hay un paso previo
      // al que regresar. El 1º (entrega del dueño) nunca puede devolver.
      out.can_reject = order > 1;
      return out;
    }),
  };

  // ── Signatures ──
  const sigSteps = Array.isArray(signatureWorkflow?.steps) ? signatureWorkflow.steps : [];
  const anchors = (Array.isArray(signatureWorkflow?.anchors) ? signatureWorkflow.anchors : [])
    .filter((anchor) => anchor?.code && anchor?.token_field_ref)
    .map((anchor) => ({
      code: anchor.code,
      placement: { strategy: "token", token_field_ref: anchor.token_field_ref },
      size: { width: Number(anchor.width) || 124, height: Number(anchor.height) || 48 },
    }));
  const signatures = {
    required: signatureWorkflow?.required === true && sigSteps.length > 0,
    source: "artifact",
    sync_mode: "artifact_to_db",
  };
  if (anchors.length) signatures.anchors = anchors;
  signatures.steps = sigSteps.map((step, index) => {
    const order = Number(step?.order) || index + 1;
    const out = { order };
    if (step?.code) out.code = step.code;
    out.name = step?.name || `Firma ${order}`;
    out.step_type_code = step?.step_type_code || "electronic";
    if (step?.required_cargo_code) out.required_cargo_code = step.required_cargo_code;
    out.selection_mode = step?.selection_mode || "auto_all";
    out.required_signers_min = Number(step?.required_signers_min) || 1;
    out.required_signers_max = Number(step?.required_signers_max) || 1;
    out.required = step?.required !== false;
    const anchorRefs = Array.isArray(step?.anchor_refs) ? step.anchor_refs.filter(Boolean) : [];
    if (anchorRefs.length) out.anchor_refs = anchorRefs;
    return out;
  });

  const doc = {
    workflows: { fill, signatures },
    dependencies: { templates: [], data: [] },
  };
  return yaml.dump(doc, { lineWidth: -1, noRefs: true });
};

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

const FILL_RESOLVER_TYPES = new Set([
  "task_assignee",
  "document_owner",
  "specific_person",
  "position",
  "cargo_in_scope",
  "manual_pick"
]);
const FILL_UNIT_SCOPE_TYPES = new Set([
  "unit_exact",
  "unit_subtree",
  "unit_type",
  "all_units",
  // Ámbitos relativos al contexto del proceso (la unidad se resuelve en runtime, sin fijarla en autoría).
  "context_exact",
  "context_subtree"
]);
const FILL_SELECTION_MODES = new Set(["auto_one", "auto_all", "manual"]);
const SIGNATURE_SELECTION_MODES = new Set(["auto_one", "auto_all", "manual"]);
const SIGNATURE_RESOLVER_TYPES = new Set([
  "task_assignee",
  "document_owner",
  "specific_person",
  "position",
  "cargo_in_scope",
  "manual_pick"
]);
const SIGNATURE_UNIT_SCOPE_TYPES = new Set([
  "unit_exact",
  "unit_subtree",
  "unit_type",
  "all_units",
  "context_exact",
  "context_subtree",
  "context_ancestor_type"
]);
const SIGNATURE_APPROVAL_MODES = new Set(["and", "or", "at_least"]);
const SIGNATURE_TYPE_CODE_ALIASES = new Map([
  ["electronic", "electronic"],
  ["firma_electronica", "electronic"],
  ["electronic_signature", "electronic"]
]);
const CARGO_CODE_ALIASES = new Map([
  ["coordinador_carrera", "coordinador"],
  ["director_escuela", "director"],
  ["director_docencia", "director"],
  ["responsable_aseguramiento_calidad", "responsable"],
  ["responsable_financiero", "responsable"],
  ["jefe_talento_humano", "jefe"]
]);
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

const slugify = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .replace(/-{2,}/g, "-");

const humanizeSlug = (value) => String(value || "")
  .split(/[-_/]+/)
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(" ");

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

// Transiciones de stage permitidas (lineal + reversas razonables + archivar desde cualquiera).
const ARTIFACT_STAGE_TRANSITIONS = {
  draft: ["review", "archived"],
  review: ["approved", "draft", "archived"],
  approved: ["published", "review", "archived"],
  published: ["archived", "approved"],
  archived: ["draft"],
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

const normalizeNumericId = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
};

const normalizeBooleanFlag = (value, defaultValue = false) => {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "si", "sí"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no"].includes(normalized)) {
    return false;
  }
  return defaultValue;
};

const normalizeSignatureStepAnchorRefs = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
};

const normalizeFillSteps = (workflow = {}, { cargoCodeMap = new Map() } = {}) => {
  const rawSteps = Array.isArray(workflow?.steps) ? workflow.steps : [];
  return rawSteps
    .filter((step) => step && typeof step === "object")
    .map((step, index) => {
      const resolverType = String(step?.resolver?.type || "task_assignee");
      const unitScopeType = String(step?.resolver?.unit_scope_type || "unit_exact");
      const selectionMode = String(step?.resolver?.selection_mode || "auto_one");
      const rawCargoCode = String(step?.resolver?.cargo_code || "").trim().toLowerCase();
      const normalizedCargoCode = slugify(CARGO_CODE_ALIASES.get(rawCargoCode) || rawCargoCode);
      const stepOrder = Number(step.order) || index + 1;
      return {
        stepOrder,
        resolverType: FILL_RESOLVER_TYPES.has(resolverType) ? resolverType : "manual_pick",
        assignedPersonId: normalizeNumericId(step?.resolver?.person_id),
        unitScopeType: FILL_UNIT_SCOPE_TYPES.has(unitScopeType) ? unitScopeType : "unit_exact",
        unitId: normalizeNumericId(step?.resolver?.unit_id),
        unitTypeId: normalizeNumericId(step?.resolver?.unit_type_id),
        cargoId: normalizeNumericId(step?.resolver?.cargo_id) || cargoCodeMap.get(normalizedCargoCode) || null,
        positionId: normalizeNumericId(step?.resolver?.position_id),
        selectionMode: FILL_SELECTION_MODES.has(selectionMode) ? selectionMode : "manual",
        isRequired: normalizeBooleanFlag(step?.required, true) ? 1 : 0,
        // Capacidad de devolver derivada del orden (solo desde el 2º paso); no se lee del input.
        canReject: stepOrder > 1 ? 1 : 0
      };
    })
    .sort((left, right) => left.stepOrder - right.stepOrder);
};

const normalizeSignatureSteps = (
  workflow = {},
  { cargoCodeMap = new Map(), signatureTypeCodeMap = new Map(), unitTypeNameMap = new Map() } = {}
) => {
  const rawSteps = Array.isArray(workflow?.steps) ? workflow.steps : [];
  return rawSteps
    .filter((step) => step && typeof step === "object")
    .map((step, index) => {
      const rawTypeCode = String(step.step_type_code || "electronic").trim().toLowerCase();
      const normalizedTypeCode = slugify(SIGNATURE_TYPE_CODE_ALIASES.get(rawTypeCode) || rawTypeCode);
      const rawCargoCode = String(
        step?.resolver?.cargo_code
        || step.required_cargo_code
        || ""
      ).trim().toLowerCase();
      const normalizedCargoCode = slugify(CARGO_CODE_ALIASES.get(rawCargoCode) || rawCargoCode);
      const normalizedSlot = String(step.slot || "").trim() || null;
      const stepCode = String(step.code || "").trim() || null;
      const stepName = String(step.name || "").trim() || null;
      const anchorRefs = normalizeSignatureStepAnchorRefs(step.anchor_refs);
      const resolverType = String(step?.resolver?.type || "cargo_in_scope").trim();
      const unitScopeType = String(step?.resolver?.unit_scope_type || "context_exact").trim();
      const selectionMode = String(step?.resolver?.selection_mode || step.selection_mode || "auto_all").trim();
      const approvalMode = String(step.approval_mode || "and").trim().toLowerCase();
      const rawUnitTypeName = String(step?.resolver?.unit_type_name || "").trim().toLowerCase();
      return {
        stepOrder: Number(step.order) || index + 1,
        code: stepCode,
        name: stepName,
        slot: normalizedSlot,
        stepTypeId: signatureTypeCodeMap.get(normalizedTypeCode) || null,
        resolverType: SIGNATURE_RESOLVER_TYPES.has(resolverType) ? resolverType : "cargo_in_scope",
        assignedPersonId: normalizeNumericId(step?.resolver?.person_id),
        unitScopeType: SIGNATURE_UNIT_SCOPE_TYPES.has(unitScopeType) ? unitScopeType : "context_exact",
        unitId: normalizeNumericId(step?.resolver?.unit_id),
        unitTypeId:
          normalizeNumericId(step?.resolver?.unit_type_id)
          || unitTypeNameMap.get(rawUnitTypeName)
          || null,
        positionId: normalizeNumericId(step?.resolver?.position_id),
        requiredCargoId:
          normalizeNumericId(step?.resolver?.cargo_id)
          || cargoCodeMap.get(normalizedCargoCode)
          || null,
        selectionMode: SIGNATURE_SELECTION_MODES.has(selectionMode) ? selectionMode : "auto_all",
        approvalMode: SIGNATURE_APPROVAL_MODES.has(approvalMode) ? approvalMode : "and",
        requiredSignersMin: normalizeNumericId(step.required_signers_min),
        requiredSignersMax: normalizeNumericId(step.required_signers_max),
        isRequired: normalizeBooleanFlag(step.required, true) ? 1 : 0,
        anchorRefs
      };
    })
    .filter((step) => step.stepTypeId)
    .filter((step) => step.resolverType !== "cargo_in_scope" || step.requiredCargoId)
    .sort((left, right) => left.stepOrder - right.stepOrder);
};

const collectSignatureWorkflowNormalizationIssues = (
  workflow = {},
  { cargoCodeMap = new Map(), signatureTypeCodeMap = new Map() } = {}
) => {
  const rawSteps = Array.isArray(workflow?.steps) ? workflow.steps : [];
  const issues = [];
  for (const [index, step] of rawSteps.entries()) {
    if (!step || typeof step !== "object") {
      continue;
    }

    const stepOrder = Number(step.order) || index + 1;
    const stepCode = String(step.code || "").trim() || `step_${stepOrder}`;
    const rawTypeCode = String(step.step_type_code || "electronic").trim().toLowerCase();
    const normalizedTypeCode = slugify(SIGNATURE_TYPE_CODE_ALIASES.get(rawTypeCode) || rawTypeCode);
    if (!signatureTypeCodeMap.get(normalizedTypeCode)) {
      issues.push(`Paso ${stepOrder} (${stepCode}): tipo de firma no resuelto (${rawTypeCode || "vacío"}).`);
    }

    const resolverType = String(step?.resolver?.type || "cargo_in_scope").trim();
    if (resolverType === "cargo_in_scope") {
      const rawCargoCode = String(
        step?.resolver?.cargo_code
        || step.required_cargo_code
        || ""
      ).trim().toLowerCase();
      const normalizedCargoCode = slugify(CARGO_CODE_ALIASES.get(rawCargoCode) || rawCargoCode);
      if (!cargoCodeMap.get(normalizedCargoCode)) {
        issues.push(`Paso ${stepOrder} (${stepCode}): cargo no resuelto (${rawCargoCode || "vacío"}).`);
      }
    }
  }
  return issues;
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

// Resuelve un cargo del paso (por id o por código/alias) contra el catálogo, para validar referencias.
const resolveStepCargoId = (resolver = {}, fallbackCode = "", cargoCodeMap = new Map()) => {
  const direct = normalizeNumericId(resolver?.cargo_id);
  if (direct) {
    return direct;
  }
  const rawCode = String(resolver?.cargo_code || fallbackCode || "").trim().toLowerCase();
  if (!rawCode) {
    return null;
  }
  const normalized = slugify(CARGO_CODE_ALIASES.get(rawCode) || rawCode);
  return cargoCodeMap.get(normalized) || null;
};

// Validación de contrato de flujo EN AUTORÍA (al guardar la plantilla), no solo al vincular: detecta
// errores que de otro modo se "tragarían" silenciosamente en la normalización del sync (orden inválido/
// duplicado, responsable/firmante desconocido, referencias faltantes). Devuelve lista de problemas.
const collectAuthoredWorkflowIssues = ({
  fillWorkflow,
  signatureWorkflow,
  cargoCodeMap = new Map(),
  signatureTypeCodeMap = new Map(),
  referenceIds = {},
  processScope = null
} = {}) => {
  const personIds = referenceIds?.personIds instanceof Set ? referenceIds.personIds : new Set();
  const positionIds = referenceIds?.positionIds instanceof Set ? referenceIds.positionIds : new Set();
  const unitIds = referenceIds?.unitIds instanceof Set ? referenceIds.unitIds : new Set();
  const unitTypeIds = referenceIds?.unitTypeIds instanceof Set ? referenceIds.unitTypeIds : new Set();
  // Ámbito resoluble del proceso vinculado (reglas objetivo). Si no se pasó, no se aplican estas reglas.
  const hasProcessScope = processScope && typeof processScope === "object";
  const scopeHasRules = hasProcessScope ? Boolean(processScope.has_rules) : null;
  const scopeAllUnits = hasProcessScope ? Boolean(processScope.all_units) : false;
  const scopeUnitIds = hasProcessScope && Array.isArray(processScope.unit_ids)
    ? new Set(processScope.unit_ids.map((id) => Number(id)))
    : new Set();
  const issues = [];
  const checkOrders = (steps, label) => {
    const seen = new Set();
    steps.forEach((step, index) => {
      const order = Number(step?.order);
      if (!Number.isInteger(order) || order < 1) {
        issues.push(`${label} ${index + 1}: el orden debe ser un entero ≥ 1.`);
      } else if (seen.has(order)) {
        issues.push(`${label}: orden duplicado (${order}).`);
      } else {
        seen.add(order);
      }
    });
  };
  // El formulario web envía los campos del responsable de forma PLANA (step.resolver_type, step.person_id…),
  // igual que los lee buildWorkflowsYaml; se admite también la forma anidada (step.resolver.*) por robustez.
  const getStepResolver = (step) => {
    const nested = (step && typeof step.resolver === "object" && step.resolver) ? step.resolver : {};
    return {
      type: step?.resolver_type || nested.type,
      person_id: step?.person_id ?? nested.person_id,
      position_id: step?.position_id ?? nested.position_id,
      cargo_id: step?.cargo_id ?? nested.cargo_id,
      cargo_code: step?.cargo_code ?? nested.cargo_code,
      unit_scope_type: step?.unit_scope_type ?? nested.unit_scope_type,
      unit_id: step?.unit_id ?? nested.unit_id,
      unit_type_id: step?.unit_type_id ?? nested.unit_type_id,
      selection_mode: step?.selection_mode ?? nested.selection_mode
    };
  };
  // Valida existencia contra la DB solo si el set correspondiente está poblado (si no se pudo cargar,
  // no se inventan falsos negativos; las FKs siguen siendo el último backstop al materializar).
  const checkResolverRefs = (resolver, type, label, fallbackCargoCode = "") => {
    if (type === "specific_person") {
      const personId = normalizeNumericId(resolver?.person_id);
      if (!personId) {
        issues.push(`${label}: "Persona específica" requiere seleccionar una persona.`);
      } else if (personIds.size && !personIds.has(personId)) {
        issues.push(`${label}: la persona seleccionada (${personId}) no existe o está inactiva.`);
      }
    }
    if (type === "position") {
      const positionId = normalizeNumericId(resolver?.position_id);
      if (!positionId) {
        issues.push(`${label}: "Posición" requiere seleccionar una posición.`);
      } else if (positionIds.size && !positionIds.has(positionId)) {
        issues.push(`${label}: la posición seleccionada (${positionId}) no existe o está inactiva.`);
      }
    }
    if (type === "cargo_in_scope") {
      if (!resolveStepCargoId(resolver, fallbackCargoCode, cargoCodeMap)) {
        issues.push(`${label}: "Cargo en ámbito" requiere seleccionar un cargo válido.`);
      }
      const scope = String(resolver?.unit_scope_type || "context_exact");
      if (scope === "context_exact" || scope === "context_subtree") {
        // Los ámbitos de contexto resuelven la unidad del proceso vía la posición responsable; si el
        // proceso no tiene reglas objetivo, no se genera posición responsable → resolución null garantizada.
        if (scopeHasRules === false) {
          issues.push(`${label}: el ámbito de contexto no resolvería porque el proceso vinculado no tiene reglas objetivo.`);
        }
      }
      if (scope === "unit_exact" || scope === "unit_subtree") {
        const unitId = normalizeNumericId(resolver?.unit_id);
        if (!unitId) {
          issues.push(`${label}: el ámbito de unidad específica requiere seleccionar una unidad.`);
        } else if (unitIds.size && !unitIds.has(unitId)) {
          issues.push(`${label}: la unidad seleccionada (${unitId}) no existe o está inactiva.`);
        } else if (scopeHasRules && !scopeAllUnits && scopeUnitIds.size && !scopeUnitIds.has(unitId)) {
          issues.push(`${label}: la unidad seleccionada (${unitId}) está fuera del ámbito de las reglas objetivo del proceso.`);
        }
      }
      if (scope === "unit_type") {
        const unitTypeId = normalizeNumericId(resolver?.unit_type_id);
        if (!unitTypeId) {
          issues.push(`${label}: el ámbito "tipo de unidad" requiere seleccionar un tipo de unidad.`);
        } else if (unitTypeIds.size && !unitTypeIds.has(unitTypeId)) {
          issues.push(`${label}: el tipo de unidad seleccionado (${unitTypeId}) no existe o está inactivo.`);
        }
      }
    }
  };

  const fillSteps = Array.isArray(fillWorkflow?.steps) ? fillWorkflow.steps.filter((s) => s && typeof s === "object") : [];
  if (fillSteps.length) {
    checkOrders(fillSteps, "Paso de entrega");
    fillSteps.forEach((step, index) => {
      const label = `Paso de entrega ${index + 1}`;
      const resolver = getStepResolver(step);
      const type = String(resolver.type || "task_assignee");
      if (!FILL_RESOLVER_TYPES.has(type)) {
        issues.push(`${label}: responsable inválido (${type}).`);
        return;
      }
      checkResolverRefs(resolver, type, label);
      const selection = resolver.selection_mode;
      if (selection && !FILL_SELECTION_MODES.has(String(selection))) {
        issues.push(`${label}: modo de selección inválido (${selection}).`);
      }
    });
  }

  const signatureSteps = Array.isArray(signatureWorkflow?.steps) ? signatureWorkflow.steps.filter((s) => s && typeof s === "object") : [];
  if (signatureSteps.length) {
    checkOrders(signatureSteps, "Paso de firma");
    signatureSteps.forEach((step, index) => {
      const label = `Paso de firma ${index + 1}`;
      // Solo valida el tipo de firma si el catálogo está poblado (si no, el sync lo asegura más tarde).
      if (signatureTypeCodeMap.size) {
        const rawType = String(step.step_type_code || "electronic").trim().toLowerCase();
        const normalizedType = slugify(SIGNATURE_TYPE_CODE_ALIASES.get(rawType) || rawType);
        if (!signatureTypeCodeMap.get(normalizedType)) {
          issues.push(`${label}: tipo de firma desconocido (${step.step_type_code || "electronic"}).`);
        }
      }
      const type = String(step?.resolver?.type || "cargo_in_scope");
      if (!SIGNATURE_RESOLVER_TYPES.has(type)) {
        issues.push(`${label}: firmante inválido (${type}).`);
        return;
      }
      checkResolverRefs(step?.resolver, type, label, step.required_cargo_code);
    });
  }

  return issues;
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

const parseJsonObject = (value, fieldLabel) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  if (typeof value !== "string") {
    throw new Error(`El campo ${fieldLabel} debe ser un JSON valido.`);
  }
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("invalid");
    }
    return parsed;
  } catch {
    throw new Error(`El campo ${fieldLabel} debe ser un JSON valido.`);
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
    if (Object.prototype.hasOwnProperty.call(data, field.name)) {
      payload[field.name] = normalizeValue(field, data[field.name]);
    }
  }
  return payload;
};

const buildWhere = (keys, values) => {
  const clauses = [];
  const params = [];
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(values, key)) {
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

const ensureDateOrder = (startDate, endDate, label) => {
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      throw new Error(`La fecha de fin debe ser posterior a la fecha de inicio en ${label}.`);
    }
  }
};

const validateFieldTypes = (config, payload) => {
  for (const field of config.fields) {
    if (!Object.prototype.hasOwnProperty.call(payload, field.name)) {
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

const validateTableRules = (tableName, candidate) => {
  switch (tableName) {
    case "unit_relations":
      if (candidate.parent_unit_id && candidate.child_unit_id) {
        if (Number(candidate.parent_unit_id) === Number(candidate.child_unit_id)) {
          throw new Error("La unidad padre y la unidad hija no pueden ser la misma.");
        }
      }
      break;
    case "terms":
      ensureDateOrder(candidate.start_date, candidate.end_date, "periodos");
      break;
    case "processes":
      break;
    case "process_definition_versions":
      if (!candidate.process_id) {
        throw new Error("Selecciona un proceso base para la configuracion.");
      }
      if (!candidate.series_id) {
        throw new Error("Selecciona una serie de configuracion.");
      }
      if (!candidate.definition_version || !SEMANTIC_VERSION_REGEX.test(String(candidate.definition_version).trim())) {
        throw new Error("La version de la configuracion debe tener formato semantico de tres segmentos (ej: 1.0.0).");
      }
      if (!candidate.effective_from) {
        throw new Error("Selecciona la fecha de vigencia inicial de la configuracion.");
      }
      ensureDateOrder(candidate.effective_from, candidate.effective_to, "configuraciones de proceso");
      break;
    case "process_definition_series":
      if (!candidate.source_type || !PROCESS_SERIES_SOURCE_TYPES.has(String(candidate.source_type))) {
        throw new Error("Selecciona el origen de la serie.");
      }
      if (candidate.source_type === "unit_type" && !candidate.unit_type_id) {
        throw new Error("Una serie por tipo de unidad requiere seleccionar un tipo de unidad.");
      }
      if (candidate.source_type === "cargo" && !candidate.cargo_id) {
        throw new Error("Una serie por cargo requiere seleccionar un cargo.");
      }
      if (candidate.source_type === "unit_type_cargo" && (!candidate.unit_type_id || !candidate.cargo_id)) {
        throw new Error("Una serie combinada requiere seleccionar un tipo de unidad y un cargo.");
      }
      if (candidate.source_type === "unit_type" && candidate.cargo_id) {
        throw new Error("Una serie por tipo de unidad no admite cargo.");
      }
      if (candidate.source_type === "cargo" && candidate.unit_type_id) {
        throw new Error("Una serie por cargo no admite tipo de unidad.");
      }
      if (candidate.source_type === "default" && (candidate.unit_type_id || candidate.cargo_id)) {
        throw new Error("La serie por defecto no admite tipo de unidad ni cargo.");
      }
      break;
    case "process_target_rules":
      ensureDateOrder(candidate.effective_from, candidate.effective_to, "reglas de alcance");
      if (!candidate.process_definition_id) {
        throw new Error("Selecciona una configuracion de proceso.");
      }
      if (candidate.recipient_policy === "exact_position" && !candidate.position_id) {
        throw new Error("La politica exact_position requiere un puesto exacto.");
      }
      if (candidate.unit_scope_type === "unit_exact" || candidate.unit_scope_type === "unit_subtree") {
        if (!candidate.unit_id && !candidate.position_id) {
          throw new Error("El alcance por unidad requiere una unidad base.");
        }
      }
      if (candidate.unit_scope_type === "unit_type" && !candidate.unit_type_id) {
        throw new Error("El alcance por tipo requiere un tipo de unidad.");
      }
      break;
    case "process_definition_triggers":
      if (!candidate.process_definition_id) {
        throw new Error("Selecciona una configuracion de proceso.");
      }
      if (!candidate.trigger_mode) {
        throw new Error("Selecciona un modo de disparo.");
      }
      if (
        candidate.trigger_mode === "automatic_by_term_type"
        && !candidate.term_type_id
      ) {
        throw new Error("El disparo automatico requiere un tipo de periodo.");
      }
      if (
        ["manual_only", "manual_custom_term"].includes(String(candidate.trigger_mode))
        && candidate.term_type_id
      ) {
        throw new Error("Los disparos manuales no deben fijar un tipo de periodo.");
      }
      break;
    case "tasks":
      if (!candidate.process_definition_id) {
        throw new Error("Selecciona una configuracion de proceso.");
      }
      if (!candidate.term_id) {
        throw new Error("Selecciona un periodo para la tarea.");
      }
      if (!candidate.launch_mode || !["automatic", "manual"].includes(String(candidate.launch_mode))) {
        throw new Error("Selecciona un modo de lanzamiento valido.");
      }
      if (candidate.launch_mode === "manual" && !candidate.created_by_user_id) {
        throw new Error("Las tareas manuales requieren indicar quien las crea.");
      }
      if (candidate.launch_mode === "automatic" && candidate.created_by_user_id) {
        throw new Error("Las tareas automaticas no deben indicar usuario creador.");
      }
      ensureDateOrder(candidate.start_date, candidate.end_date, "tareas");
      break;
    case "task_items":
      if (!candidate.task_id) {
        throw new Error("Selecciona una tarea.");
      }
      if (!candidate.process_definition_template_id) {
        throw new Error("Selecciona la plantilla de proceso configurado.");
      }
      if (!candidate.template_artifact_id) {
        throw new Error("Selecciona el paquete.");
      }
      ensureDateOrder(candidate.start_date, candidate.end_date, "items de tarea");
      break;
    case "documents":
      if (!candidate.task_item_id && !candidate.owner_person_id) {
        throw new Error("Selecciona el item de tarea o define un propietario para el documento.");
      }
      if (Object.prototype.hasOwnProperty.call(candidate, "status")) {
        candidate.status = assertDocumentStatusValue(candidate.status);
      }
      break;
    case "fill_flow_templates":
      if (!candidate.process_definition_template_id) {
        throw new Error("Selecciona la plantilla de proceso configurado.");
      }
      break;
    case "fill_flow_steps":
      if (!candidate.fill_flow_template_id) {
        throw new Error("Selecciona la plantilla de entrega.");
      }
      if (!candidate.step_order) {
        throw new Error("Define el orden del paso.");
      }
      break;
    case "document_fill_flows":
      if (!candidate.fill_flow_template_id) {
        throw new Error("Selecciona la plantilla de entrega.");
      }
      if (!candidate.document_version_id) {
        throw new Error("Selecciona la version de documento.");
      }
      break;
    case "fill_requests":
      if (!candidate.document_fill_flow_id) {
        throw new Error("Selecciona la instancia de entrega.");
      }
      if (!candidate.fill_flow_step_id) {
        throw new Error("Selecciona el paso de entrega.");
      }
      break;
    case "signature_flow_templates":
      if (!candidate.process_definition_template_id) {
        throw new Error("Selecciona la plantilla de proceso configurado.");
      }
      break;
    case "task_assignments":
      if (!candidate.task_id) {
        throw new Error("Selecciona una tarea para asignar.");
      }
      if (!candidate.position_id) {
        throw new Error("Selecciona un puesto para la asignacion.");
      }
      break;
    case "vacancies":
      break;
    case "contracts":
      ensureDateOrder(candidate.start_date, candidate.end_date, "contratos");
      break;
    case "role_assignments":
      break;
    case "document_versions":
      if (candidate.version !== undefined) {
        const versionValue = Number(candidate.version);
        if (Number.isNaN(versionValue) || versionValue < 0.1) {
          throw new Error("La version debe ser mayor o igual a 0.1.");
        }
      }
      if (Object.prototype.hasOwnProperty.call(candidate, "status")) {
        candidate.status = assertDocumentVersionStatusValue(candidate.status);
      }
      break;
    case "template_seeds":
      if (!candidate.seed_code || !candidate.source_path) {
        throw new Error("Debes registrar el codigo y la ruta fuente del seed.");
      }
      break;
    case "template_artifacts":
      if (candidate.artifact_stage && !ARTIFACT_STAGE_VALUES.has(String(candidate.artifact_stage))) {
        throw new Error("La etapa del artifact debe ser: draft, review, approved, published o archived.");
      }
      if (!candidate.bucket || !candidate.base_object_prefix) {
        throw new Error("Debes registrar bucket y prefijo base del artifact.");
      }
      {
        const availableFormats = parseJsonObject(candidate.available_formats, "Formatos disponibles (JSON)");
        if (!availableFormats || !Object.keys(availableFormats).length) {
          throw new Error("Debes registrar al menos un formato disponible en available_formats.");
        }
      }
      break;
    default:
      break;
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
  constructor(pool = getMariaDBPool()) {
    this.pool = pool;
  }

  ensurePool() {
    if (!this.pool) {
      throw new Error("La conexion con MariaDB no esta disponible.");
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

  async resolveProcessDefinitionSeries(candidate, { connection = this.pool, allowLegacy = false } = {}) {
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
    if (!allowLegacy && String(series.source_type) === "default") {
      throw new Error("La serie por defecto no se puede usar para nuevas configuraciones. Crea una serie basada en tipo de unidad o cargo.");
    }
    return series;
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
      joinClause = "LEFT JOIN template_seeds ts ON ts.id = template_artifacts.template_seed_id";
      columnPrefix = "template_artifacts.";
      const selectFields = physicalFields.map((field) => `${columnPrefix}${field}`);
      if (availableFields.includes("seed_display_name")) {
        selectFields.push("ts.display_name AS seed_display_name");
        orderableFields.push("seed_display_name");
      }
      selectClause = `SELECT ${selectFields.join(", ")}`;
    }

    if (q && config.searchFields?.length) {
      const like = `%${q}%`;
      const searchClauses = config.searchFields.map((field) => `${columnPrefix}${field} LIKE ?`);
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
      const columnName = columnPrefix ? `${columnPrefix}${field}` : field;
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
        : (tableName === "template_artifacts" && safeOrderBy === "seed_display_name")
          ? safeOrderBy
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
      `SELECT id, process_definition_id, template_artifact_id, instance_mode, sort_order, creates_task
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
         id,
         template_code,
         display_name,
         storage_version,
         bucket,
         meta_object_key
       FROM template_artifacts
       WHERE id = ?
       LIMIT 1`,
      [artifactId]
    );
    return rows?.[0] ?? null;
  }

  async loadTemplateArtifactMetaDocument(artifact, connection = this.pool) {
    if (!artifact?.bucket || !artifact?.meta_object_key) {
      return null;
    }
    const content = await readMinioObjectAsText(
      artifact.bucket,
      String(artifact.meta_object_key || "").trim()
    );
    return parseYamlDocument(content, {
      filePath: `${artifact.bucket}/${artifact.meta_object_key}`
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
    connection = this.pool
  }) {
    const normalizedSourceId = Number(sourceDefinitionId);
    const normalizedTargetId = Number(targetDefinitionId);
    const normalizedTargetProcessId = Number(targetProcessId);

    if (!normalizedSourceId || !normalizedTargetId) {
      return { clonedTemplates: 0, clonedRules: 0, clonedTriggers: 0 };
    }

    const sourceDefinition = await this.getProcessDefinitionVersion(normalizedSourceId, connection);
    if (!sourceDefinition) {
      throw new Error("La configuracion origen para clonar no existe.");
    }
    if (normalizedTargetProcessId && Number(sourceDefinition.process_id) !== normalizedTargetProcessId) {
      throw new Error("Solo se puede clonar desde una configuracion del mismo proceso.");
    }

    const [templateRows] = await connection.query(
      `SELECT template_artifact_id, instance_mode, creates_task, is_required, sort_order
       FROM process_definition_templates
       WHERE process_definition_id = ?
       ORDER BY sort_order ASC, id ASC`,
      [normalizedSourceId]
    );

    for (const row of templateRows) {
      await connection.query(
        `INSERT INTO process_definition_templates (
          process_definition_id,
          template_artifact_id,
          instance_mode,
          creates_task,
          is_required,
          sort_order
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          normalizedTargetId,
          row.template_artifact_id,
          row.instance_mode || "single_document",
          row.creates_task,
          row.is_required,
          row.sort_order
        ]
      );

      if (row.template_artifact_id) {
        await this.syncArtifactWorkflowsForTemplateArtifactId(Number(row.template_artifact_id), connection);
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

    const [triggerRows] = await connection.query(
      `SELECT trigger_mode,
              term_type_id,
              is_active
       FROM process_definition_triggers
       WHERE process_definition_id = ?
       ORDER BY id ASC`,
      [normalizedSourceId]
    );

    for (const row of triggerRows) {
      await connection.query(
        `INSERT INTO process_definition_triggers (
          process_definition_id,
          trigger_mode,
          term_type_id,
          is_active
        ) VALUES (?, ?, ?, ?)`,
        [
          normalizedTargetId,
          row.trigger_mode,
          row.term_type_id,
          row.is_active
        ]
      );
    }

    return {
      clonedTemplates: templateRows.length,
      clonedRules: ruleRows.length,
      clonedTriggers: triggerRows.length
    };
  }

  async ensureDefinitionHasArtifactsForActivation(definitionId, candidate = null, connection = this.pool) {
    const normalizedDefinitionId = Number(definitionId);
    if (!normalizedDefinitionId) {
      return;
    }

    const requiresDocument = Number(candidate?.has_document ?? 0) === 1;
    if (!requiresDocument) {
      return;
    }

    const [rows] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM process_definition_templates
       WHERE process_definition_id = ?`,
      [normalizedDefinitionId]
    );

    const total = Number(rows?.[0]?.total || 0);
    if (total < 1) {
      throw new Error(
        "No se puede activar una configuracion con documento si no tiene al menos un artifact vinculado en Plantillas de configuracion."
      );
    }
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

  async ensureDefinitionHasActiveTriggersForActivation(definitionId, connection = this.pool) {
    const normalizedDefinitionId = Number(definitionId);
    if (!normalizedDefinitionId) {
      return;
    }

    const [rows] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM process_definition_triggers
       WHERE process_definition_id = ?
         AND is_active = 1`,
      [normalizedDefinitionId]
    );

    const total = Number(rows?.[0]?.total || 0);
    if (total < 1) {
      throw new Error(
        "No se puede activar una configuracion si no tiene al menos un disparador activo en Disparadores de configuraciones."
      );
    }
  }

  async ensureDefinitionTriggerAllowsTaskLaunch(
    definitionId,
    termId,
    launchMode,
    connection = this.pool
  ) {
    const normalizedDefinitionId = Number(definitionId);
    const normalizedTermId = Number(termId);
    const normalizedLaunchMode = String(launchMode || "manual");

    if (!normalizedDefinitionId || !normalizedTermId) {
      throw new Error("La tarea requiere una configuracion y un periodo validos.");
    }

    const term = await this.getTermWithType(normalizedTermId, connection);
    if (!term) {
      throw new Error("El periodo seleccionado no existe.");
    }

    let triggerMode;
    let triggerParams;
    if (normalizedLaunchMode === "automatic") {
      triggerMode = "automatic_by_term_type";
      triggerParams = [normalizedDefinitionId, triggerMode, Number(term.term_type_id)];
    } else if (String(term.term_type_code || "").toUpperCase() === "CUS") {
      triggerMode = "manual_custom_term";
      triggerParams = [normalizedDefinitionId, triggerMode];
    } else {
      triggerMode = "manual_only";
      triggerParams = [normalizedDefinitionId, triggerMode];
    }

    const triggerSql =
      triggerMode === "automatic_by_term_type"
        ? `SELECT id
           FROM process_definition_triggers
           WHERE process_definition_id = ?
             AND trigger_mode = ?
             AND term_type_id = ?
             AND is_active = 1
           LIMIT 1`
        : `SELECT id
           FROM process_definition_triggers
           WHERE process_definition_id = ?
             AND trigger_mode = ?
             AND is_active = 1
           LIMIT 1`;

    const [rows] = await connection.query(triggerSql, triggerParams);
    if (!rows?.length) {
      if (triggerMode === "automatic_by_term_type") {
        throw new Error("La configuracion no tiene un disparador automatico activo para el tipo de periodo seleccionado.");
      }
      if (triggerMode === "manual_custom_term") {
        throw new Error("La configuracion no tiene un disparador manual activo para periodos custom.");
      }
      throw new Error("La configuracion no tiene un disparador manual activo para el periodo seleccionado.");
    }
  }

  async create(tableName, data) {
    this.ensurePool();
    const config = getConfig(tableName);
    const payload = pickPayload(config.fields, data);
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
      || tableName === "process_definition_triggers"
    ) {
      await this.ensureDraftDefinitionContext(
        payload.process_definition_id,
        {
          entityLabel:
            tableName === "process_definition_templates"
              ? "las plantillas de configuracion"
              : tableName === "process_target_rules"
                ? "las reglas de alcance"
                : "los disparadores de configuracion"
        }
      );
    }

    if (tableName === "process_target_rules") {
      await this.applyTargetRuleSeriesConstraints(payload.process_definition_id, payload);
    }

    if (tableName === "process_definition_triggers") {
      const definition = await this.getProcessDefinitionVersion(payload.process_definition_id);
      if (!definition) {
        throw new Error("La configuracion de proceso seleccionada no existe.");
      }
      if (String(payload.trigger_mode || "") !== "automatic_by_term_type") {
        payload.term_type_id = null;
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
      payload.launch_mode = String(payload.launch_mode || "manual");
      if (payload.launch_mode === "automatic") {
        payload.created_by_user_id = null;
      }
      await this.ensureDefinitionTriggerAllowsTaskLaunch(
        payload.process_definition_id,
        payload.term_id,
        payload.launch_mode
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
      if (!Number(template.creates_task)) {
        throw new Error("La plantilla seleccionada no esta marcada para generar items de tarea.");
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
            if (cloneSummary.clonedTemplates || cloneSummary.clonedRules || cloneSummary.clonedTriggers) {
              createNotice =
                `Se clonaron ${cloneSummary.clonedTemplates} plantillas, ${cloneSummary.clonedRules} reglas`
                + ` y ${cloneSummary.clonedTriggers} disparadores desde la configuracion origen.`;
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
              runMode: payload.launch_mode === "automatic" ? "automatic_term" : "manual",
              createdByUserId: payload.launch_mode === "manual" ? payload.created_by_user_id : null,
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

    if (tableName === "persons" && Object.prototype.hasOwnProperty.call(data, "password")) {
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
        Object.prototype.hasOwnProperty.call(updates, "process_definition_id")
      ) {
        if (Number(updates.process_definition_id) !== Number(existing.process_definition_id)) {
          throw new Error("No se puede cambiar la configuracion de una tarea ya instanciada.");
        }
        delete updates.process_definition_id;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "term_id")) {
        if (Number(updates.term_id) !== Number(existing.term_id)) {
          throw new Error("No se puede cambiar el periodo de una tarea ya instanciada.");
        }
        delete updates.term_id;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "launch_mode")) {
        if (String(updates.launch_mode) !== String(existing.launch_mode)) {
          throw new Error("No se puede cambiar el modo de lanzamiento de una tarea existente.");
        }
        delete updates.launch_mode;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "created_by_user_id")) {
        if (Number(updates.created_by_user_id || 0) !== Number(existing.created_by_user_id || 0)) {
          throw new Error("No se puede cambiar el usuario creador de una tarea existente.");
        }
        delete updates.created_by_user_id;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "process_run_id")) {
        if (Number(updates.process_run_id || 0) !== Number(existing.process_run_id || 0)) {
          throw new Error("No se puede cambiar la corrida de proceso de una tarea existente.");
        }
        delete updates.process_run_id;
      }
    }
    if (tableName === "task_items") {
      if (Object.prototype.hasOwnProperty.call(updates, "task_id")) {
        if (Number(updates.task_id) !== Number(existing.task_id)) {
          throw new Error("No se puede cambiar la tarea asociada de un item.");
        }
        delete updates.task_id;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "process_definition_template_id")) {
        if (Number(updates.process_definition_template_id) !== Number(existing.process_definition_template_id)) {
          throw new Error("No se puede cambiar la plantilla asociada de un item.");
        }
        delete updates.process_definition_template_id;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "template_artifact_id")) {
        if (Number(updates.template_artifact_id) !== Number(existing.template_artifact_id)) {
          throw new Error("No se puede cambiar el paquete asociado de un item.");
        }
        delete updates.template_artifact_id;
      }
    }
    if (tableName === "documents") {
      if (Object.prototype.hasOwnProperty.call(updates, "task_item_id")) {
        if (Number(updates.task_item_id) !== Number(existing.task_item_id)) {
          throw new Error("No se puede cambiar el item de tarea asociado de un documento.");
        }
        delete updates.task_item_id;
      }
    }
    if (tableName === "signature_flow_templates") {
      if (Object.prototype.hasOwnProperty.call(updates, "process_definition_template_id")) {
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
      if (Object.prototype.hasOwnProperty.call(updates, "process_definition_template_id")) {
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
      if (Object.prototype.hasOwnProperty.call(updates, "fill_flow_template_id")) {
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
    if (tableName === "process_definition_triggers") {
      if (Object.prototype.hasOwnProperty.call(updates, "process_definition_id")) {
        if (Number(updates.process_definition_id) !== Number(existing.process_definition_id)) {
          throw new Error("No se puede cambiar la configuracion asociada de este disparador.");
        }
        delete updates.process_definition_id;
      }
      if (
        Object.prototype.hasOwnProperty.call(updates, "trigger_mode")
        && String(updates.trigger_mode || "") !== "automatic_by_term_type"
      ) {
        updates.term_type_id = null;
      }
    }
    if (
      tableName === "process_definition_templates"
      || tableName === "process_target_rules"
      || tableName === "process_definition_triggers"
    ) {
      if (Object.prototype.hasOwnProperty.call(updates, "process_definition_id")) {
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
                : "los disparadores de configuracion"
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
      // Propiedad, no origen: las plantillas oficiales del sistema (sin owner_ref) se sincronizan desde
      // MinIO/dist y no se editan a mano; las de usuario (con owner_ref) se editan por el flujo de borrador.
      if (!existing.owner_ref) {
        throw new Error("Los artifacts oficiales del sistema se sincronizan desde MinIO y no se pueden editar manualmente.");
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

      if (Object.prototype.hasOwnProperty.call(updates, "definition_version")) {
        if (!isSameValue("definition_version", updates.definition_version, existing.definition_version)) {
          throw new Error("No se puede modificar el numero de version de una configuracion.");
        }
        delete updates.definition_version;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "process_id")) {
        if (!isSameValue("process_id", updates.process_id, existing.process_id)) {
          throw new Error("No se puede cambiar el proceso de una configuracion.");
        }
        delete updates.process_id;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "series_id")) {
        if (!isSameValue("series_id", updates.series_id, existing.series_id)) {
          throw new Error("No se puede cambiar la serie de una configuracion.");
        }
        delete updates.series_id;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "variation_key")) {
        if (!isSameValue("variation_key", updates.variation_key, existing.variation_key)) {
          throw new Error("No se puede cambiar la serie de una configuracion.");
        }
        delete updates.variation_key;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "name")) {
        delete updates.name;
      }

      Object.keys(updates).forEach((key) => {
        if (isSameValue(key, updates[key], existing[key])) {
          delete updates[key];
        }
      });

      const currentStatus = String(existing.status || "draft");
      const nextStatus = Object.prototype.hasOwnProperty.call(updates, "status")
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
          "has_document",
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
          await this.ensureDefinitionHasActiveTriggersForActivation(existing.id ?? keyPayload.id, connection);
          await this.ensureDefinitionHasArtifactsForActivation(existing.id ?? keyPayload.id, candidate, connection);
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
          if (Object.prototype.hasOwnProperty.call(updates, "status")) {
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
        if (tableName === "process_definition_series" && Object.prototype.hasOwnProperty.call(updates, "code")) {
          await this.pool.query(
            `UPDATE process_definition_versions
             SET variation_key = ?
             WHERE series_id = ?`,
            [updates.code, Number(existing.id)]
          );
          await this.refreshProcessDefinitionVersionNames({ seriesId: Number(existing.id) });
        }
        if (tableName === "processes" && Object.prototype.hasOwnProperty.call(updates, "name")) {
          await this.refreshProcessDefinitionVersionNames({ processId: Number(existing.id ?? keyPayload.id) });
        }
        if (
          (tableName === "unit_types" || tableName === "cargos")
          && Object.prototype.hasOwnProperty.call(updates, "name")
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
    if (tableName === "tasks" && Object.prototype.hasOwnProperty.call(updates, "status")) {
      const taskId = existing.id ?? keyPayload.id;
      await updateParentTaskStatusForTask(taskId);
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

  async getSignatureTypeCodeMap(connection = this.pool) {
    const [rows] = await connection.query(
      `SELECT id, code
       FROM signature_types
       WHERE is_active = 1
       ORDER BY id ASC`
    );
    const map = new Map();
    for (const row of rows) {
      const normalizedCode = slugify(row.code);
      if (normalizedCode && !map.has(normalizedCode)) {
        map.set(normalizedCode, Number(row.id));
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

    // Cargo: lo fija la serie. Con exact_position el cargo lo aporta el puesto, así que solo validamos
    // que el puesto pertenezca al cargo de la serie; en el resto, sembramos o blindamos el cargo.
    if (seriesCargoId) {
      if (policy === "exact_position") {
        const positionId = normalizeNumericId(candidate.position_id);
        if (positionId) {
          const [posRows] = await connection.query(
            "SELECT cargo_id FROM unit_positions WHERE id = ? LIMIT 1",
            [positionId]
          );
          const positionCargoId = normalizeNumericId(posRows?.[0]?.cargo_id);
          if (positionCargoId && positionCargoId !== seriesCargoId) {
            throw new Error("El puesto exacto no corresponde al cargo de la serie del proceso.");
          }
        }
      } else {
        const candidateCargoId = normalizeNumericId(candidate.cargo_id);
        if (!candidateCargoId) {
          candidate.cargo_id = seriesCargoId;
        } else if (candidateCargoId !== seriesCargoId) {
          throw new Error("El cargo de la regla debe coincidir con el cargo de la serie del proceso.");
        }
      }
    }

    // Tipo de unidad: si la serie lo fija y el alcance es por tipo, se siembra o se blinda.
    if (seriesUnitTypeId && String(candidate.unit_scope_type) === "unit_type") {
      const candidateUnitTypeId = normalizeNumericId(candidate.unit_type_id);
      if (!candidateUnitTypeId) {
        candidate.unit_type_id = seriesUnitTypeId;
      } else if (candidateUnitTypeId !== seriesUnitTypeId) {
        throw new Error("El tipo de unidad de la regla debe coincidir con el tipo de unidad de la serie del proceso.");
      }
    }
  }

  async ensureSignatureTypeCatalog(connection = this.pool) {
    await connection.query(
      `INSERT INTO signature_types (code, name, description, is_active)
       VALUES
         ('electronic', 'Firma electronica', 'Firma electronica general sincronizada desde artifacts', 1),
         ('digital', 'Firma digital', 'Firma digital general sincronizada desde artifacts', 1)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         description = VALUES(description),
         is_active = VALUES(is_active)`
    );
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
           cargo_id,
           position_id,
           selection_mode,
           is_required,
           can_reject
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fillFlowTemplateId,
          step.stepOrder,
          step.resolverType,
          step.assignedPersonId,
          step.unitScopeType,
          step.unitId,
          step.unitTypeId,
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
           step_type_id,
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
         anchor_refs
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          signatureFlowTemplateId,
          step.stepOrder,
          step.code,
          step.name,
          step.slot,
          step.stepTypeId,
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
          JSON.stringify(Array.isArray(step.anchorRefs) ? step.anchorRefs : [])
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

    await this.ensureSignatureTypeCatalog(connection);
    const syncEnabled = isArtifactSignatureWorkflowSyncEnabled(workflow);
    const templateName = String(workflow?.name || "").trim() || `Flujo de firma - ${displayName}`;
    const templateDescription = buildArtifactSyncedSignatureDescription({
      artifactId,
      templateCode,
      storageVersion
    });

    const cargoCodeMap = await this.getCargoCodeMap(connection);
    const signatureTypeCodeMap = await this.getSignatureTypeCodeMap(connection);
    const unitTypeNameMap = await this.getUnitTypeNameMap(connection);
    const normalizationIssues = syncEnabled
      ? collectSignatureWorkflowNormalizationIssues(workflow, { cargoCodeMap, signatureTypeCodeMap })
      : [];
    if (normalizationIssues.length) {
      throw new Error(
        `No se pudo sincronizar el flujo de firmas de ${templateCode}: ${normalizationIssues.join(" ")}`
      );
    }
    const normalizedSteps = syncEnabled
      ? normalizeSignatureSteps(workflow, { cargoCodeMap, signatureTypeCodeMap, unitTypeNameMap })
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
    const bucket = String(artifact.bucket || MINIO_TEMPLATES_BUCKET);
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
    let signatureWorkflow = { required: false, anchors: [], steps: [] };
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
      signatureWorkflow = {
        required: sig?.required === true,
        anchors: (Array.isArray(sig?.anchors) ? sig.anchors : []).map((a) => ({
          code: a?.code || "",
          token_field_ref: a?.placement?.token_field_ref || "",
          width: a?.size?.width || 124,
          height: a?.size?.height || 48,
        })),
        steps: (Array.isArray(sig?.steps) ? sig.steps : []).map((s, i) => ({
          order: Number(s?.order) || i + 1,
          code: s?.code || "",
          name: s?.name || "",
          step_type_code: s?.step_type_code || "electronic",
          required_cargo_code: s?.required_cargo_code || s?.resolver?.cargo_code || "",
          selection_mode: s?.selection_mode || "auto_all",
          required_signers_min: s?.required_signers_min || 1,
          required_signers_max: s?.required_signers_max || 1,
          required: s?.required !== false,
          anchor_refs: Array.isArray(s?.anchor_refs) ? s.anchor_refs : [],
        })),
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

  // Cambia el stage de un artifact (gobierno del ciclo de vida) actualizando BD y meta.yaml.
  async updateTemplateArtifactStage(artifactId, nextStage) {
    this.ensurePool();
    const stage = String(nextStage || "").trim().toLowerCase();
    if (!ARTIFACT_STAGE_VALUES.has(stage)) {
      throw new Error("Etapa inválida. Debe ser: draft, review, approved, published o archived.");
    }
    const artifact = await this.getByKeys("template_artifacts", { id: Number(artifactId) });
    if (!artifact) {
      throw new Error("El artifact seleccionado no existe.");
    }
    const current = String(artifact.artifact_stage || "draft").toLowerCase();
    if (current === stage) {
      return { artifact_id: Number(artifactId), artifact_stage: stage, changed: false };
    }
    const allowed = ARTIFACT_STAGE_TRANSITIONS[current] || [];
    if (!allowed.includes(stage)) {
      throw new Error(`No se permite pasar de "${current}" a "${stage}".`);
    }

    // Al publicar, exigir que la plantilla tenga al menos un paso de entrega definido en su meta.yaml
    // (regla: las plantillas de proceso no se publican sin flujo de entrega). La firma puede ser ad-hoc.
    if (stage === "published") {
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

    await this.pool.query(
      "UPDATE template_artifacts SET artifact_stage = ? WHERE id = ?",
      [stage, Number(artifactId)]
    );

    // Refleja el stage en el meta.yaml de MinIO (campos stage / repository_stage).
    try {
      const bucket = String(artifact.bucket || MINIO_TEMPLATES_BUCKET);
      const metaKey = String(artifact.meta_object_key || "").trim();
      if (metaKey) {
        let meta = await readMinioObjectAsText(bucket, metaKey);
        const replaceOrAppend = (content, key, value) => {
          const re = new RegExp(`^${key}:.*$`, "m");
          return re.test(content) ? content.replace(re, `${key}: ${value}`) : `${content.trimEnd()}\n${key}: ${value}\n`;
        };
        meta = replaceOrAppend(meta, "stage", stage);
        meta = replaceOrAppend(meta, "repository_stage", stage);
        await putMinioObjectFromText(bucket, metaKey, meta, "text/yaml");
      }
    } catch (metaError) {
      console.warn("Stage actualizado en BD pero no en meta.yaml:", metaError?.message);
    }

    return { artifact_id: Number(artifactId), artifact_stage: stage, previous_stage: current, changed: true };
  }

  // Crea una nueva versión (storage_version) clonando un artifact existente en stage draft.
  async createTemplateArtifactVersion(artifactId) {
    this.ensurePool();
    const artifact = await this.getByKeys("template_artifacts", { id: Number(artifactId) });
    if (!artifact) {
      throw new Error("El artifact seleccionado no existe.");
    }
    const bucket = String(artifact.bucket || MINIO_TEMPLATES_BUCKET);
    const templateCode = String(artifact.template_code);
    const nextStorageVersion = await this.getNextStorageVersionForTemplateCode(templateCode);
    const oldPrefix = String(artifact.base_object_prefix || "").replace(/\/?$/, "/");
    const newPrefix = oldPrefix.replace(/v\d+\/?$/i, `${nextStorageVersion}/`);
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
    const [result] = await this.pool.query(
      `INSERT INTO template_artifacts (
        template_seed_id, owner_person_id, template_code, display_name, description, owner_ref,
        source_version, storage_version, artifact_stage, bucket, base_object_prefix,
        available_formats, schema_object_key, meta_object_key, content_hash, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, 1)`,
      [
        artifact.template_seed_id,
        artifact.owner_person_id,
        templateCode,
        artifact.display_name,
        artifact.description,
        artifact.owner_ref,
        artifact.source_version,
        nextStorageVersion,
        bucket,
        newPrefix,
        JSON.stringify(remappedFormats || {}),
        newSchemaKey,
        newMetaKey,
        artifact.content_hash,
      ]
    );

    return {
      id: Number(result.insertId),
      template_code: templateCode,
      storage_version: nextStorageVersion,
      base_object_prefix: newPrefix,
      bucket,
      artifact_stage: "draft",
      __notice: `Nueva versión ${nextStorageVersion} creada en estado draft.`,
    };
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
    const bucket = String(artifact.bucket || MINIO_TEMPLATES_BUCKET);
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
        if (Object.prototype.hasOwnProperty.call(protectedMap, fullRel)) {
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

      const version = await this.createTemplateArtifactVersion(artifactId);
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
        __notice: `Código verificado y actualizado en nueva versión ${version.storage_version} (draft). Archivos de contenido actualizados: ${editedContent.length}.`
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

  async getNextStorageVersionForTemplateCode(templateCode, connection = this.pool) {
    const [rows] = await connection.query(
      `SELECT storage_version
       FROM template_artifacts
       WHERE template_code = ?`,
      [templateCode]
    );
    let maxVersion = 0;
    for (const row of rows || []) {
      const match = String(row.storage_version || "").match(/^v(\d+)$/i);
      if (!match) {
        continue;
      }
      maxVersion = Math.max(maxVersion, Number(match[1]));
    }
    return `v${String(maxVersion + 1).padStart(4, "0")}`;
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
    const sourceVersion = String(data.source_version || "1.0.0").trim();
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
      // Este flujo edita plantillas creadas desde la web (propiedad de usuario: tienen owner_ref).
      // Las plantillas oficiales del sistema (sin owner_ref, sincronizadas desde dist) no se editan aquí.
      if (!existingArtifact.owner_ref) {
        throw new Error("Las plantillas oficiales del sistema no se editan con este flujo (usa el pipeline de templates).");
      }
    }

    // Fail-fast (antes de subir nada a MinIO): TODA plantilla debe pertenecer a un proceso. Aplica a todos
    // los roles (admin/gestor de procesos incluidos), no solo al ejecutor.
    if (!isEdit && !(data.process_definition_id ? Number(data.process_definition_id) : null)) {
      throw new Error("Debes seleccionar el proceso (o 'default') al que pertenece esta plantilla.");
    }

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
      // Toda plantilla debe definir un flujo de entrega con al menos un paso (fail-fast antes del upload).
      let fillWorkflowCheck = data.fill_workflow;
      if (typeof fillWorkflowCheck === "string") {
        try { fillWorkflowCheck = JSON.parse(fillWorkflowCheck); } catch { fillWorkflowCheck = null; }
      }
      if (!fillWorkflowCheck || !Array.isArray(fillWorkflowCheck.steps) || !fillWorkflowCheck.steps.length) {
        throw new Error("Debes definir al menos un paso en el flujo de entrega.");
      }
    } else if (
      !templateSeedId
      && !Object.values(uploadedFiles).some(Boolean)
      && !Object.keys(existingAvailableFormats).length
    ) {
      throw new Error("Selecciona un seed o sube al menos un archivo para actualizar el borrador.");
    }

    const ownerRef = String(existingArtifact?.owner_ref || ownerCedula).slice(0, 180);
    if (!ownerRef) {
      throw new Error("No se pudo resolver el propietario del artifact.");
    }
    let ownerPersonId = normalizeNumericId(existingArtifact?.owner_person_id);
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
    const bucket = String(existingArtifact?.bucket || MINIO_TEMPLATES_BUCKET);
    const baseObjectPrefix = String(existingArtifact?.base_object_prefix || `${TEMPLATE_USERS_PREFIX}/${ownerRef}/${templateCode}/${storageVersion}/`);
    const artifactStage = String(existingArtifact?.artifact_stage || "draft");
    const draftDir = path.join(
      BACKEND_STORAGE_ROOT,
      "minio-jobs",
      "templates-drafts",
      ownerRef,
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
      `version: "${sourceVersion.replace(/"/g, '\\"')}"`,
      `template_code: "${templateCode.replace(/"/g, '\\"')}"`,
      `owner_ref: "${ownerRef.replace(/"/g, '\\"')}"`,
      `stage: ${artifactStage}`
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
      const [cargoCodeMap, signatureTypeCodeMap, referenceIds, processScope] = await Promise.all([
        this.getCargoCodeMap(),
        this.getSignatureTypeCodeMap(),
        this.getWorkflowReferenceIdSets(),
        this.getProcessTargetScope(linkedDefinitionId)
      ]);
      const workflowIssues = collectAuthoredWorkflowIssues({
        fillWorkflow,
        signatureWorkflow,
        cargoCodeMap,
        signatureTypeCodeMap,
        referenceIds,
        processScope
      });
      if (workflowIssues.length) {
        const error = new Error(`El flujo definido tiene errores:\n- ${workflowIssues.join("\n- ")}`);
        error.statusCode = 422;
        throw error;
      }
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
        await this.pool.query(
          `UPDATE template_artifacts
           SET template_seed_id = ?,
               owner_person_id = ?,
               display_name = ?,
               description = ?,
               owner_ref = ?,
               source_version = ?,
               artifact_stage = ?,
               bucket = ?,
               base_object_prefix = ?,
               available_formats = ?,
               schema_object_key = ?,
               meta_object_key = ?,
               content_hash = ?,
               is_active = 1
           WHERE id = ?`,
          [
            templateSeedId,
            ownerPersonId,
            displayName,
            description,
            ownerRef,
            sourceVersion,
            artifactStage,
            bucket,
            baseObjectPrefix,
            JSON.stringify(availableFormats),
            schemaObjectKey,
            metaObjectKey,
            contentHash,
            createdId
          ]
        );
      } else {
        const [result] = await this.pool.query(
          `INSERT INTO template_artifacts (
            template_seed_id,
            owner_person_id,
            template_code,
            display_name,
            description,
            owner_ref,
            source_version,
            storage_version,
            artifact_stage,
            bucket,
            base_object_prefix,
            available_formats,
            schema_object_key,
            meta_object_key,
            content_hash,
            is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, 1)`,
          [
            templateSeedId,
            ownerPersonId,
            templateCode,
            displayName,
            description,
            ownerRef,
            sourceVersion,
            storageVersion,
            bucket,
            baseObjectPrefix,
            JSON.stringify(availableFormats),
            schemaObjectKey,
            metaObjectKey,
            contentHash
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
              (process_definition_id, template_artifact_id, instance_mode, creates_task, is_required, sort_order)
             VALUES (?, ?, 'single_document', 1, 1, 1)`,
            [requestedProcessDefinitionId, createdId]
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

      return {
        id: createdId,
        template_seed_id: templateSeedId,
        owner_person_id: ownerPersonId,
        template_code: templateCode,
        display_name: displayName,
        description,
        owner_ref: ownerRef,
        source_version: sourceVersion,
        storage_version: storageVersion,
        artifact_stage: artifactStage,
        bucket,
        base_object_prefix: baseObjectPrefix,
        available_formats: availableFormats,
        schema_object_key: schemaObjectKey,
        meta_object_key: metaObjectKey,
        content_hash: contentHash,
        is_active: 1,
        workflow_sync_failed: workflowSyncFailed,
        __warning: workflowSyncFailed ? workflowNotice.trim() : undefined,
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
      || tableName === "process_definition_triggers"
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
                : "los disparadores de configuracion"
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

    await this.pool.query(`DELETE FROM ${tableName} WHERE ${where}`, params);
    return keyPayload;
  }
}
