// TemplateArtifactService — ciclo de vida de los template artifacts (publicar/retirar/versionar,
// esquema, fuente, activacion) extraido de SqlAdminService.js (God #1) por Extract Class (cut #3).
// Se DEJA FUERA saveTemplateArtifactDraft (542 L, God-method que llama 6 colaboradores de scope/workflow):
// necesita su propia descomposicion. El resto solo depende de this.pool + getByKeys (inyectado), como
// OrgStructureService. SqlAdminService mantiene 11 delegadores; el controller y saveTemplateArtifactDraft
// (que llama estos metodos) no se tocan.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import {
  copyMinioObjectBinary,
  listMinioObjects,
  putMinioObjectFromText,
  readMinioObjectAsText,
  unzipToDirectory,
  walkFiles,
} from "../kernel/storage.js";
import { parseAvailableFormats, parseYamlDocument } from "./artifacts.js";
import { bumpSemanticVersion } from "../kernel/versioning.js";
import {
  MINIO_TEMPLATES_BUCKET,
  CONTRACT_FORMAT,
  EDITABLE_CONTENT_SUBPATH,
} from "../kernel/constants.js";

// Config espejo del env (mismo valor que SqlAdminService.js). Deuda menor: unificar en un modulo de
// constantes compartido. Son deterministas (env + literal), asi que ambos modulos leen lo mismo.

export default class TemplateArtifactService {
  constructor(pool, { getByKeys } = {}) {
    this.pool = pool;
    this._getByKeys = getByKeys;
  }

  ensurePool() {
    if (!this.pool) {
      throw new Error("La conexion con PostgreSQL no esta disponible.");
    }
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


  // Lee el schema.json de un artifact desde MinIO y lo devuelve como lista de campos
  // editables en la web (formato inverso de buildSchemaJsonFromFields).
  async getTemplateArtifactSchema(artifactId) {
    this.ensurePool();
    const artifact = await this._getByKeys("template_artifacts", { id: Number(artifactId) });
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
    const artifact = await this._getByKeys("template_artifacts", { id: Number(artifactId) });
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
    const artifact = await this._getByKeys("template_artifacts", { id });
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
    const artifact = await this._getByKeys("template_artifacts", { id });
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


  // Crea una nueva versión (storage_version semver) clonando un artifact existente. Nace inactiva
  // (is_active=0): el gestor la activa cuando esté lista. El nivel de cambio (patch/minor/major) lo elige
  // quien crea la versión.
  async createTemplateArtifactVersion(artifactId, bumpLevel = "minor") {
    this.ensurePool();
    const artifact = await this._getByKeys("template_artifacts", { id: Number(artifactId) });
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
    const artifact = await this._getByKeys("template_artifacts", { id: Number(artifactId) });
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
}
