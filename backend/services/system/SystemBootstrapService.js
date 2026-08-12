import bcrypt from "bcrypt";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPostgresPool } from "../../config/postgres.js";
import { minioClient, ensureBucketExists, statMinioObject } from "../storage/minio_service.js";
import { getGenericCatalogOptions, seedGenericCatalog } from "./genericCatalog.js";
import { buildProcessDefinitionVersionName } from "../admin/processes/processDefinitionSeries.js";
import {
  ACTION_CATALOG,
  ADMIN_ROLE_NAME,
  RESOURCE_CATALOG,
  ROLE_CATALOG,
  ROLE_PERMISSION_MATRIX
} from "../../config/rbacCatalog.js";

const BOOTSTRAP_UNIT_TYPE_NAME = "Sistema";
const BOOTSTRAP_UNIT_NAME = "Raiz del sistema";
const BOOTSTRAP_UNIT_LABEL = "Sistema";
const BOOTSTRAP_UNIT_SLUG = "root-system";
const MANUAL_ROLE_SOURCE = "manual";
const GESTOR_ROLE_NAME = "GestorProcesos";
const USUARIO_ROLE_NAME = "Usuario";

const TOKEN_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const TOKEN_LENGTH = 10;

const fetchOne = async (connection, sql, params = []) => {
  const [rows] = await connection.query(sql, params);
  return rows?.[0] ?? null;
};

const toBoolean = (value) => Number(value || 0) > 0;

const buildError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const generateRawToken = () => {
  const bytes = crypto.randomBytes(TOKEN_LENGTH);
  let token = "";
  for (let index = 0; index < TOKEN_LENGTH; index += 1) {
    token += TOKEN_CHARS[bytes[index] % TOKEN_CHARS.length];
  }
  return token;
};

const generateUniqueTokenWithConnection = async (connection) => {
  for (let attempts = 0; attempts < 10; attempts += 1) {
    const token = generateRawToken();
    const row = await fetchOne(
      connection,
      "SELECT id FROM persons WHERE token = ? LIMIT 1",
      [token]
    );
    if (!row) {
      return token;
    }
  }
  throw buildError("No se pudo generar un token unico para el administrador.", 500);
};

const normalizeString = (value, { lower = false } = {}) => {
  const normalized = String(value || "").trim();
  return lower ? normalized.toLowerCase() : normalized;
};

const normalizeCedula = (value) => String(value || "").replace(/\D/g, "");

const validateAdminPayload = (payload = {}) => {
  const cedula = normalizeCedula(payload.cedula);
  const firstName = normalizeString(payload.first_name);
  const lastName = normalizeString(payload.last_name);
  const email = normalizeString(payload.email, { lower: true });
  const whatsapp = normalizeString(payload.whatsapp);
  const password = String(payload.password || "");
  const confirmPassword = String(payload.confirm_password || payload.repassword || "");

  if (!cedula) throw buildError("La cedula del administrador es requerida.");
  if (cedula.length < 10) throw buildError("La cedula del administrador no es valida.");
  if (!firstName) throw buildError("Los nombres del administrador son requeridos.");
  if (!lastName) throw buildError("Los apellidos del administrador son requeridos.");
  if (!email) throw buildError("El correo del administrador es requerido.");
  if (!password) throw buildError("La contraseña del administrador es requerida.");
  if (password.length < 8) throw buildError("La contraseña debe tener al menos 8 caracteres.");
  if (!confirmPassword) throw buildError("Debes confirmar la contraseña del administrador.");
  if (password !== confirmPassword) throw buildError("Las contraseñas no coinciden.");

  return {
    cedula,
    first_name: firstName,
    last_name: lastName,
    email,
    whatsapp: whatsapp || null,
    password
  };
};

const upsertRole = async (connection, role) => {
  await connection.query(
    `INSERT INTO roles (name, description, is_active)
     VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE
       description = VALUES(description),
       is_active = 1`,
    [role.name, role.description]
  );
  const row = await fetchOne(connection, "SELECT id FROM roles WHERE name = ? LIMIT 1", [role.name]);
  return Number(row.id);
};

const upsertResource = async (connection, resource) => {
  await connection.query(
    `INSERT INTO resources (code, name, description, is_active)
     VALUES (?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       description = VALUES(description),
       is_active = 1`,
    [resource.code, resource.name, resource.description]
  );
  const row = await fetchOne(connection, "SELECT id FROM resources WHERE code = ? LIMIT 1", [resource.code]);
  return Number(row.id);
};

const upsertAction = async (connection, action) => {
  await connection.query(
    `INSERT INTO actions (code, name, description, is_active)
     VALUES (?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       description = VALUES(description),
       is_active = 1`,
    [action.code, action.name, action.description]
  );
  const row = await fetchOne(connection, "SELECT id FROM actions WHERE code = ? LIMIT 1", [action.code]);
  return Number(row.id);
};

const upsertPermission = async (connection, { resourceId, actionId, code, description }) => {
  await connection.query(
    `INSERT INTO permissions (resource_id, action_id, code, description, is_active)
     VALUES (?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       code = VALUES(code),
       description = VALUES(description),
       is_active = 1`,
    [resourceId, actionId, code, description]
  );
  const row = await fetchOne(connection, "SELECT id FROM permissions WHERE code = ? LIMIT 1", [code]);
  return Number(row.id);
};

const seedBaseRbacCatalog = async (connection) => {
  const roleIds = new Map();
  const resourceIds = new Map();
  const actionIds = new Map();
  const permissionIds = new Map();

  for (const role of ROLE_CATALOG) {
    roleIds.set(role.name, await upsertRole(connection, role));
  }

  for (const resource of RESOURCE_CATALOG) {
    resourceIds.set(resource.code, await upsertResource(connection, resource));
  }

  for (const action of ACTION_CATALOG) {
    actionIds.set(action.code, await upsertAction(connection, action));
  }

  for (const resource of RESOURCE_CATALOG) {
    for (const action of ACTION_CATALOG) {
      const permissionCode = `${resource.code}.${action.code}`;
      const permissionId = await upsertPermission(connection, {
        resourceId: resourceIds.get(resource.code),
        actionId: actionIds.get(action.code),
        code: permissionCode,
        description: `${action.name} ${resource.name}`.trim()
      });
      permissionIds.set(permissionCode, permissionId);
    }
  }

  for (const [roleName, resourceMatrix] of Object.entries(ROLE_PERMISSION_MATRIX)) {
    const roleId = roleIds.get(roleName);
    if (!roleId) continue;
    await connection.query("DELETE FROM role_permissions WHERE role_id = ?", [roleId]);
    for (const [resourceCode, actionCodes] of Object.entries(resourceMatrix)) {
      for (const actionCode of actionCodes) {
        const permissionId = permissionIds.get(`${resourceCode}.${actionCode}`);
        if (!permissionId) continue;
        await connection.query(
          "INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
          [roleId, permissionId]
        );
      }
    }
  }

  return roleIds;
};

const ensureBootstrapUnit = async (connection) => {
  const existingUnit = await fetchOne(
    connection,
    "SELECT id FROM units WHERE is_active = 1 ORDER BY id ASC LIMIT 1"
  );
  if (existingUnit) {
    return Number(existingUnit.id);
  }

  let unitType = await fetchOne(
    connection,
    "SELECT id FROM unit_types WHERE name = ? LIMIT 1",
    [BOOTSTRAP_UNIT_TYPE_NAME]
  );

  if (!unitType) {
    const [result] = await connection.query(
      "INSERT INTO unit_types (name, is_active) VALUES (?, 1)",
      [BOOTSTRAP_UNIT_TYPE_NAME]
    );
    unitType = { id: result.insertId };
  }

  await connection.query(
    `INSERT INTO units (name, label, slug, unit_type_id, is_active)
     VALUES (?, ?, ?, ?, 1)`,
    [BOOTSTRAP_UNIT_NAME, BOOTSTRAP_UNIT_LABEL, BOOTSTRAP_UNIT_SLUG, unitType.id]
  );

  const inserted = await fetchOne(
    connection,
    "SELECT id FROM units WHERE slug = ? LIMIT 1",
    [BOOTSTRAP_UNIT_SLUG]
  );

  return Number(inserted.id);
};

// Proceso por defecto 'default': paraguas de tareas libres / no clasificadas.
// Su plantilla base NACE DE UN SEED real (contrato latex/jinja2 + schema), empaquetado dentro del backend
// en services/system/seeds/informe-general. El bootstrap lo publica a MinIO (catálogo Seeds/ + artifact
// instanciado System/) y registra la fila template_seeds + template_artifacts. El flujo de entrega queda
// simple (1 paso: el dueño llena) y la firma ad-hoc, para ser robusto en instalación virgen.
const DEFAULT_PROCESS_SLUG = "default";
const DEFAULT_PROCESS_NAME = "Proceso por defecto";
const DEFAULT_SERIES_CODE = "default";
const DEFAULT_VARIATION = "general";
const DEFAULT_DEFINITION_VERSION = "1.0.0";
// Periodo sentinela "de todos los tiempos": ancla los procesos sin ciclo de periodo
// (p. ej. memorandos) y las tareas sueltas. Obligatorio: se crea en el bootstrap.
const PERMANENT_TERM_TYPE_CODE = "PERM";
const PERMANENT_TERM_NAME = "Permanente";
const PERMANENT_TERM_START = "1900-01-01";
const PERMANENT_TERM_END = "9999-12-31";

// Seed base "informe-general" empaquetado y autocontenido en el backend (contrato latex/jinja2 + schema).
const BASE_SEED_TYPE = "latex";
const BASE_SEED_NAME = "informe-general";
const BASE_SEED_CODE = `${BASE_SEED_TYPE}/${BASE_SEED_NAME}`;
const BASE_SEED_DISPLAY = "Informe general";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_SEED_DIR = path.join(__dirname, "seeds", BASE_SEED_NAME);

const DEFAULT_TEMPLATE_CODE = "tpl_informe_general";
const DEFAULT_TEMPLATE_BUCKET = "deasy-templates";
const DEFAULT_TEMPLATE_PREFIX = `System/${DEFAULT_TEMPLATE_CODE}/1.0.0/`;
const DEFAULT_TEMPLATE_SRC_PREFIX = `${DEFAULT_TEMPLATE_PREFIX}template/jinja2/`;
const SEEDS_CATALOG_PREFIX = `Seeds/${BASE_SEED_CODE}/`;

// El artifact base YA NO LLEVA meta.yaml (sub-paso 7 del §0.8; ver plan-maestro-2026-08.md).
//
// Aquí vivía `BASE_META_YAML`: un meta.yaml escrito a mano como literal de código que se subía a
// MinIO junto al seed y que `WorkflowSyncService` proyectaba a `fill_flow_templates`. Era el ÚNICO
// productor vivo del resolver `document_owner` —nadie lo autoró nunca desde la web— y sembraba un
// paso de entrega sobre el vínculo del Proceso por defecto, que es `routed` y cuyo bootstrap declara
// justo lo contrario (ver el punto 6 de `ensureDefaultProcess`). Además se auto-replicaba:
// `createTemplateArtifactVersion` copia el prefijo de MinIO en binario, así que cada versión nueva
// heredaba el paso sin pasar por el formulario.
//
// ✅ LA VENTANA QUE ESTO DEJÓ ABIERTA ESTÁ CERRADA (sub-paso 8). Entre el 7 y el 8, la columna
// `template_artifacts.meta_object_key` era NOT NULL y el bootstrap la rellenaba con la ruta de un
// objeto que ya no se subía. El 8 borró la columna, el `meta.yaml` entero y el `WorkflowSyncService`
// que lo leía: no queda puntero que colgar ni lector que se lo encuentre ausente.

const SEED_CONTENT_TYPES = {
  ".json": "application/json",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
  ".j2": "text/plain",
  ".tex": "text/plain",
  ".sh": "text/x-shellscript",
  ".md": "text/markdown",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".bib": "text/plain"
};
const guessSeedContentType = (filePath) => SEED_CONTENT_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";

// Lista recursiva de archivos de un directorio como [{ abs, rel }] con rel en formato POSIX.
const walkSeedFiles = (dir, base = dir) => {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkSeedFiles(abs, base));
    } else if (entry.isFile()) {
      out.push({ abs, rel: path.relative(base, abs).split(path.sep).join("/") });
    }
  }
  return out;
};

const putBufferObject = (bucket, objectName, buffer, contentType = "application/octet-stream") =>
  new Promise((resolve, reject) => {
    minioClient.putObject(bucket, objectName, buffer, buffer.length, { "Content-Type": contentType }, (error, etag) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(etag);
    });
  });

const putSeedFileObject = async (bucket, objectName, absPath) => {
  const buffer = await fs.promises.readFile(absPath);
  return putBufferObject(bucket, objectName, buffer, guessSeedContentType(absPath));
};

// Publica en MinIO el seed base: (1) el árbol completo al catálogo Seeds/ y (2) el artifact instanciado en
// System/ (src jinja2 + schema.json + data.yaml desde defaults.yaml). SIN meta.yaml desde el sub-paso 7
// del §0.8: el flujo se autora en la base, no en un YAML (ver el bloque de arriba). Idempotente: si el
// main.tex.j2 del artifact ya existe no reescribe (respeta ediciones del admin). Best-effort: un fallo de
// MinIO no debe abortar el bootstrap (las filas SQL ya quedan registradas y se puede re-publicar).
export const publishBaseSeedAssets = async () => {
  const bucket = DEFAULT_TEMPLATE_BUCKET;
  const mainKey = `${DEFAULT_TEMPLATE_SRC_PREFIX}main.tex.j2`;
  try {
    await ensureBucketExists(bucket);
    try {
      await statMinioObject(bucket, mainKey);
      return { published: false, reason: "ya_existe" };
    } catch {
      // No existe: se publica.
    }
    if (!fs.existsSync(BASE_SEED_DIR)) {
      console.warn("publishBaseSeedAssets: no se encontró el seed base empaquetado en", BASE_SEED_DIR);
      return { published: false, reason: "seed_no_empaquetado" };
    }

    const files = walkSeedFiles(BASE_SEED_DIR);
    // 1. Catálogo Seeds/<tipo>/<nombre>/...
    for (const file of files) {
      await putSeedFileObject(bucket, `${SEEDS_CATALOG_PREFIX}${file.rel}`, file.abs);
    }
    // 2. Artifact instanciado System/<code>/v0001/...
    for (const file of files) {
      if (file.rel === "schema.json") {
        await putSeedFileObject(bucket, `${DEFAULT_TEMPLATE_PREFIX}schema.json`, file.abs);
      } else if (file.rel === "defaults.yaml") {
        await putSeedFileObject(bucket, `${DEFAULT_TEMPLATE_PREFIX}data.yaml`, file.abs);
        await putSeedFileObject(bucket, `${DEFAULT_TEMPLATE_SRC_PREFIX}data.yaml`, file.abs);
      } else if (file.rel.startsWith("src/")) {
        await putSeedFileObject(bucket, `${DEFAULT_TEMPLATE_SRC_PREFIX}${file.rel.slice("src/".length)}`, file.abs);
      }
      // README.md sólo vive en el catálogo Seeds/ (de ahí lo lee `syncTemplateSeedsFromSource` para
      // describir la semilla). El artifact instanciado ya no lleva meta.yaml.
    }
    return { published: true };
  } catch (error) {
    console.warn("publishBaseSeedAssets: no se pudieron publicar los objetos del seed base:", error?.message);
    return { published: false, reason: error?.message };
  }
};

export const ensureDefaultProcess = async (connection) => {
  // 1. proceso
  let process = await fetchOne(connection, "SELECT id FROM processes WHERE slug = ? LIMIT 1", [DEFAULT_PROCESS_SLUG]);
  if (!process) {
    const [r] = await connection.query(
      "INSERT INTO processes (name, slug, parent_id, is_active) VALUES (?, ?, NULL, 1)",
      [DEFAULT_PROCESS_NAME, DEFAULT_PROCESS_SLUG]
    );
    process = { id: r.insertId };
  }
  const processId = Number(process.id);

  // 2. serie
  let series = await fetchOne(
    connection,
    "SELECT id, source_type, code FROM process_definition_series WHERE code = ? LIMIT 1",
    [DEFAULT_SERIES_CODE]
  );
  if (!series) {
    const [r] = await connection.query(
      "INSERT INTO process_definition_series (source_type, unit_type_id, cargo_id, code, is_active) VALUES ('default', NULL, NULL, ?, 1)",
      [DEFAULT_SERIES_CODE]
    );
    series = { id: r.insertId, source_type: "default", code: DEFAULT_SERIES_CODE };
  }
  const defaultDefinitionName = buildProcessDefinitionVersionName({
    processName: DEFAULT_PROCESS_NAME,
    series: { source_type: "default", code: DEFAULT_VARIATION }
  });

  // 3. configuración activa
  let definition = await fetchOne(
    connection,
    "SELECT id, status, name FROM process_definition_versions WHERE process_id = ? AND variation_key = ? AND definition_version = ? LIMIT 1",
    [processId, DEFAULT_VARIATION, DEFAULT_DEFINITION_VERSION]
  );
  if (!definition) {
    const [r] = await connection.query(
      `INSERT INTO process_definition_versions
        (process_id, series_id, variation_key, definition_version, name, description, status, effective_from)
       VALUES (?, ?, ?, ?, ?, ?, 'active', CURDATE())`,
      [processId, Number(series.id), DEFAULT_VARIATION, DEFAULT_DEFINITION_VERSION,
       defaultDefinitionName, "Tareas libres y no clasificadas."]
    );
    definition = { id: r.insertId, status: "active", name: defaultDefinitionName };
  } else if (definition.status !== "active") {
    await connection.query("UPDATE process_definition_versions SET status = 'active' WHERE id = ?", [definition.id]);
  }
  if (definition?.id && String(definition.name || "") !== defaultDefinitionName) {
    await connection.query("UPDATE process_definition_versions SET name = ? WHERE id = ?", [defaultDefinitionName, definition.id]);
  }
  const definitionId = Number(definition.id);

  // 4. seed base (catálogo). El template nace de este seed (contrato latex/jinja2 + schema).
  let seedRow = await fetchOne(
    connection,
    "SELECT id FROM template_seeds WHERE seed_code = ? LIMIT 1",
    [BASE_SEED_CODE]
  );
  if (!seedRow) {
    const [r] = await connection.query(
      `INSERT INTO template_seeds
        (seed_code, display_name, description, seed_type, source_path, preview_path, is_active)
       VALUES (?, ?, ?, ?, ?, NULL, 1)`,
      [BASE_SEED_CODE, BASE_SEED_DISPLAY, "Seed base del sistema (informe general).", BASE_SEED_TYPE, SEEDS_CATALOG_PREFIX]
    );
    seedRow = { id: r.insertId };
  }
  const templateSeedId = Number(seedRow.id);

  // 5. entregable base (deliverable) + su versión publicada. Modelo libro/ediciones: identidad/scope/owner/seed
  //    viven en `deliverables` (dueño = proceso por defecto + variación); la versión solo guarda el storage MinIO.
  let deliverable = await fetchOne(
    connection,
    "SELECT id FROM deliverables WHERE code = ? LIMIT 1",
    [DEFAULT_TEMPLATE_CODE]
  );
  if (!deliverable) {
    const [r] = await connection.query(
      `INSERT INTO deliverables
        (code, display_name, description, owner_process_id, owner_variation_key, template_scope, template_seed_id, owner_person_id)
       VALUES (?, ?, ?, ?, ?, 'official', ?, NULL)`,
      [
        DEFAULT_TEMPLATE_CODE,
        BASE_SEED_DISPLAY,
        "Plantilla base del proceso por defecto, instanciada del seed informe-general.",
        processId,
        DEFAULT_VARIATION,
        templateSeedId,
      ]
    );
    deliverable = { id: r.insertId };
  }
  const deliverableId = Number(deliverable.id);

  let artifact = await fetchOne(
    connection,
    "SELECT id FROM template_artifacts WHERE deliverable_id = ? LIMIT 1",
    [deliverableId]
  );
  if (!artifact) {
    const availableFormats = { jinja2: { entry_object_key: DEFAULT_TEMPLATE_SRC_PREFIX } };
    const [r] = await connection.query(
      `INSERT INTO template_artifacts
        (deliverable_id, storage_version, lifecycle_state, base_object_prefix,
         available_formats, schema_object_key, is_active)
       VALUES (?, '1.0.0', 'published', ?, ?, ?, 1)`,
      [
        deliverableId,
        DEFAULT_TEMPLATE_PREFIX,
        JSON.stringify(availableFormats),
        `${DEFAULT_TEMPLATE_PREFIX}schema.json`,
      ]
    );
    artifact = { id: r.insertId };
  }
  const artifactId = Number(artifact.id);

  // 5bis. publica en MinIO el seed base (catálogo Seeds/ + artifact System/) desde el seed empaquetado.
  //       Idempotente; si la publicación falla (MinIO caído, seed no empaquetado) se PROPAGA el error para
  //       abortar/rollback el bootstrap: así no quedan filas SQL apuntando a objetos MinIO inexistentes.
  //       'ya_existe' es éxito (re-ejecución idempotente).
  const publishResult = await publishBaseSeedAssets();
  if (!publishResult?.published && publishResult?.reason !== "ya_existe") {
    throw new Error(
      `No se pudieron publicar los objetos del seed base en MinIO (${publishResult?.reason || "desconocido"}). ` +
      "Se aborta el bootstrap para no dejar plantillas apuntando a objetos inexistentes."
    );
  }

  // 5. vínculo configuración↔plantilla
  let pdt = await fetchOne(
    connection,
    "SELECT id FROM process_definition_templates WHERE process_definition_id = ? AND template_artifact_id = ? LIMIT 1",
    [definitionId, artifactId]
  );
  if (!pdt) {
    const [r] = await connection.query(
      `INSERT INTO process_definition_templates
        (process_definition_id, template_artifact_id, sort_order, item_mode)
       VALUES (?, ?, 1, 'routed')`,
      [definitionId, artifactId]
    );
    pdt = { id: r.insertId };
  }
  const pdtId = Number(pdt.id);
  // Proceso por defecto = routed comodín: cualquiera crea una tarea y la endosa a alguien
  // (que puede ser uno mismo). Idempotente para instalaciones previas.
  await connection.query(
    "UPDATE process_definition_templates SET item_mode = 'routed' WHERE id = ? AND item_mode <> 'routed'",
    [pdtId]
  );

  // 6. Sin flujo predefinido: el proceso por defecto es routed → el usuario DEFINE su flujo
  // de entrega y firma AL ENVIAR (runtime, materializado por instancia con task_item_id).
  // Antes se sembraba un paso de entrega `document_owner` (atajo deprecado); retirado (P1.4).

  // 7. periodo sentinela "Permanente" + vínculo de tipo de periodo (corre en Permanente) + regla all_units
  const permanentTermType = await fetchOne(
    connection,
    "SELECT id FROM term_types WHERE code = ? LIMIT 1",
    [PERMANENT_TERM_TYPE_CODE]
  );
  if (!permanentTermType) {
    throw new Error("No existe el tipo de periodo 'Permanente' (PERM). Revisa el schema/seed de term_types.");
  }
  const permanentTermTypeId = Number(permanentTermType.id);
  let permanentTerm = await fetchOne(
    connection,
    "SELECT id FROM terms WHERE term_type_id = ? AND name = ? LIMIT 1",
    [permanentTermTypeId, PERMANENT_TERM_NAME]
  );
  if (!permanentTerm) {
    const [r] = await connection.query(
      "INSERT INTO terms (name, term_type_id, start_date, end_date, is_active) VALUES (?, ?, ?, ?, 1)",
      [PERMANENT_TERM_NAME, permanentTermTypeId, PERMANENT_TERM_START, PERMANENT_TERM_END]
    );
    permanentTerm = { id: r.insertId };
  }

  const periodType = await fetchOne(
    connection,
    "SELECT id FROM process_definition_period_types WHERE process_definition_id = ? AND term_type_id = ? LIMIT 1",
    [definitionId, permanentTermTypeId]
  );
  if (!periodType) {
    await connection.query(
      "INSERT INTO process_definition_period_types (process_definition_id, term_type_id, is_active) VALUES (?, ?, 1)",
      [definitionId, permanentTermTypeId]
    );
  }
  const rule = await fetchOne(
    connection,
    "SELECT id FROM process_target_rules WHERE process_definition_id = ? AND unit_scope_type = 'all_units' LIMIT 1",
    [definitionId]
  );
  if (!rule) {
    await connection.query(
      "INSERT INTO process_target_rules (process_definition_id, unit_scope_type, recipient_policy, priority, is_active) VALUES (?, 'all_units', 'all_matches', 1, 1)",
      [definitionId]
    );
  }

  return { processId, definitionId, artifactId };
};

const upsertAdminPerson = async (connection, payload) => {
  const existingPerson = await fetchOne(
    connection,
    `SELECT id, cedula, email, token
     FROM persons
     WHERE cedula = ? OR email = ?
     LIMIT 1`,
    [payload.cedula, payload.email]
  );

  const passwordHash = await bcrypt.hash(payload.password, 10);
  const token = existingPerson?.token || await generateUniqueTokenWithConnection(connection);

  if (existingPerson) {
    await connection.query(
      `UPDATE persons
       SET cedula = ?,
           first_name = ?,
           last_name = ?,
           email = ?,
           whatsapp = ?,
           password_hash = ?,
           status = 'Activo',
           verify_email = 1,
           verify_whatsapp = 1,
           is_active = 1,
           token = ?
       WHERE id = ?`,
      [
        payload.cedula,
        payload.first_name,
        payload.last_name,
        payload.email,
        payload.whatsapp,
        passwordHash,
        token,
        existingPerson.id
      ]
    );
    return { id: Number(existingPerson.id), token };
  }

  const [result] = await connection.query(
    `INSERT INTO persons (
       cedula,
       first_name,
       last_name,
       email,
       whatsapp,
       password_hash,
       status,
       verify_email,
       verify_whatsapp,
       is_active,
       token
     )
     VALUES (?, ?, ?, ?, ?, ?, 'Activo', 1, 1, 1, ?)`,
    [
      payload.cedula,
      payload.first_name,
      payload.last_name,
      payload.email,
      payload.whatsapp,
      passwordHash,
      token
    ]
  );

  return { id: Number(result.insertId), token };
};

const ensureAdminRoleAssignment = async (connection, { personId, roleId, unitId }) => {
  await connection.query(
    `UPDATE role_assignments
     SET is_current = 0,
         end_date = COALESCE(end_date, CURDATE()),
         revoked_at = COALESCE(revoked_at, NOW()),
         revoked_reason = COALESCE(revoked_reason, 'Reasignacion de administrador bootstrap')
     WHERE person_id = ?
       AND role_id = ?
       AND source = ?
       AND is_current = 1`,
    [personId, roleId, MANUAL_ROLE_SOURCE]
  );

  await connection.query(
    `INSERT INTO role_assignments (
       role_id,
       unit_id,
       source,
       person_id,
       max_depth,
       start_date,
       is_current,
       assigned_at
     )
     VALUES (?, ?, ?, ?, 0, CURDATE(), 1, NOW())`,
    [roleId, unitId, MANUAL_ROLE_SOURCE, personId]
  );
};

export default class SystemBootstrapService {
  constructor(pool = getPostgresPool()) {
    this.pool = pool;
  }

  ensurePool() {
    if (!this.pool) {
      throw buildError("Conexion PostgreSQL no disponible.", 500);
    }
  }

  async getBootstrapStatus() {
    this.ensurePool();

    const [rows] = await this.pool.query(
      `SELECT
         (SELECT COUNT(*) FROM persons) AS persons_count,
         (SELECT COUNT(*) FROM roles WHERE is_active = 1) AS roles_count,
         (SELECT COUNT(*) FROM permissions WHERE is_active = 1) AS permissions_count,
         (
           SELECT COUNT(*)
           FROM role_assignments ra
           INNER JOIN roles r ON r.id = ra.role_id
           INNER JOIN persons p ON p.id = ra.person_id
           WHERE r.name = ?
             AND r.is_active = 1
             AND ra.is_current = 1
             AND (ra.end_date IS NULL OR ra.end_date >= CURDATE())
             AND p.is_active = 1
         ) AS admin_count,
         (
           SELECT
             IF(
               EXISTS(SELECT 1 FROM process_runs LIMIT 1)
               OR EXISTS(SELECT 1 FROM tasks LIMIT 1)
               OR EXISTS(SELECT 1 FROM documents LIMIT 1)
               OR EXISTS(SELECT 1 FROM document_versions LIMIT 1)
               OR EXISTS(SELECT 1 FROM signature_requests LIMIT 1)
               OR EXISTS(SELECT 1 FROM position_assignments LIMIT 1),
               1,
               0
             )
         ) AS has_operational_data`,
      [ADMIN_ROLE_NAME]
    );

    const row = rows?.[0] || {};
    const hasAnyPerson = Number(row.persons_count || 0) > 0;
    const hasAnyRole = Number(row.roles_count || 0) > 0;
    const hasAnyPermission = Number(row.permissions_count || 0) > 0;
    const hasAnyAdmin = Number(row.admin_count || 0) > 0;
    const hasOperationalData = toBoolean(row.has_operational_data);
    const isVirginInstall = !hasAnyAdmin && !hasOperationalData;

    let installationMode = "normal";
    if (!hasAnyAdmin) {
      installationMode = isVirginInstall ? "bootstrap" : "recovery_required";
    }

    return {
      installationMode,
      hasAnyPerson,
      hasAnyRole,
      hasAnyPermission,
      hasAnyAdmin,
      hasOperationalData,
      isVirginInstall,
      environment: process.env.NODE_ENV || "development",
      catalogOptions: getGenericCatalogOptions()
    };
  }

  async initializeSystem(payload = {}) {
    this.ensurePool();
    const status = await this.getBootstrapStatus();
    if (status.installationMode !== "bootstrap") {
      throw buildError(
        status.installationMode === "recovery_required"
          ? "La instancia contiene datos operativos y requiere recuperacion administrativa, no reinicializacion desde UI."
          : "El sistema ya fue inicializado.",
        409
      );
    }

    const adminPayload = validateAdminPayload(payload);
    // Gestor por defecto OPCIONAL (mismos campos que el admin).
    const gestorPayload = payload.gestor ? validateAdminPayload(payload.gestor) : null;
    // Usuario de prueba OPCIONAL (rol base "Usuario"): para validar el flujo operativo (Home/tareas/firmas).
    const usuarioPayload = payload.usuario ? validateAdminPayload(payload.usuario) : null;
    // Bloques de catálogos genéricos OPCIONALES a preconfigurar.
    const preconfig = payload.preconfig && typeof payload.preconfig === "object" ? payload.preconfig : {};
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const roleIds = await seedBaseRbacCatalog(connection);
      const unitId = await ensureBootstrapUnit(connection);
      const admin = await upsertAdminPerson(connection, adminPayload);
      await ensureAdminRoleAssignment(connection, {
        personId: admin.id,
        roleId: roleIds.get(ADMIN_ROLE_NAME),
        unitId
      });
      // Gestor por defecto (opcional): persona + rol GestorProcesos.
      let gestor = null;
      if (gestorPayload) {
        const gestorPerson = await upsertAdminPerson(connection, gestorPayload);
        await ensureAdminRoleAssignment(connection, {
          personId: gestorPerson.id,
          roleId: roleIds.get(GESTOR_ROLE_NAME),
          unitId
        });
        // Rol base "Usuario" además del funcional: permite al gestor gestionar su propio dossier (dossier.*).
        await ensureAdminRoleAssignment(connection, {
          personId: gestorPerson.id,
          roleId: roleIds.get(USUARIO_ROLE_NAME),
          unitId
        });
        gestor = {
          id: gestorPerson.id,
          cedula: gestorPayload.cedula,
          email: gestorPayload.email,
          first_name: gestorPayload.first_name,
          last_name: gestorPayload.last_name
        };
      }
      // Usuario de prueba (opcional): persona + rol Usuario.
      let usuario = null;
      if (usuarioPayload) {
        const usuarioPerson = await upsertAdminPerson(connection, usuarioPayload);
        await ensureAdminRoleAssignment(connection, {
          personId: usuarioPerson.id,
          roleId: roleIds.get(USUARIO_ROLE_NAME),
          unitId
        });
        usuario = {
          id: usuarioPerson.id,
          cedula: usuarioPayload.cedula,
          email: usuarioPayload.email,
          first_name: usuarioPayload.first_name,
          last_name: usuarioPayload.last_name
        };
      }
      await ensureDefaultProcess(connection);
      // Catálogos genéricos seleccionados (idempotente).
      const seededCatalog = await seedGenericCatalog(connection, preconfig, roleIds);
      await connection.commit();

      return {
        message: "El sistema se inicializo correctamente.",
        admin: {
          id: admin.id,
          cedula: adminPayload.cedula,
          email: adminPayload.email,
          first_name: adminPayload.first_name,
          last_name: adminPayload.last_name
        },
        gestor,
        usuario,
        preconfig: seededCatalog
      };
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  }

  async recoverAdmin(payload = {}) {
    this.ensurePool();
    const adminPayload = validateAdminPayload(payload);
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const roleIds = await seedBaseRbacCatalog(connection);
      const unitId = await ensureBootstrapUnit(connection);
      const admin = await upsertAdminPerson(connection, adminPayload);
      await ensureAdminRoleAssignment(connection, {
        personId: admin.id,
        roleId: roleIds.get(ADMIN_ROLE_NAME),
        unitId
      });
      await connection.commit();
      return {
        message: "Administrador recuperado correctamente.",
        admin: {
          id: admin.id,
          cedula: adminPayload.cedula,
          email: adminPayload.email
        }
      };
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  }
}
