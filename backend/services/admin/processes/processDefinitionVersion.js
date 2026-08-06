// ProcessDefinitionVersionService — series, versionado, clonado y contexto de borrador de las
// process definitions. Extraido de SqlAdminService.js (God #1) por Extract Class (cut #4). El cluster
// solo depende de this.pool + getByKeys y syncArtifactWorkflows(TemplateArtifactId), ambos inyectados;
// los helpers puros (nombres de version, semver, ids) se importan de los modulos hermanos. SqlAdminService
// mantiene delegadores; el controller y los grafts de create()/update() (que llaman resolve/ensure/clone/
// refresh...) no se tocan.
import {
  buildProcessDefinitionVersionName,
  resolveProcessDefinitionSeriesIdentity,
} from "./processDefinitionSeries.js";
import { bumpSemanticVersion } from "../kernel/versioning.js";
import { normalizeNumericId } from "../kernel/primitives.js";

export default class ProcessDefinitionVersionService {
  constructor(pool, { getByKeys, syncArtifactWorkflows } = {}) {
    this.pool = pool;
    this._getByKeys = getByKeys;
    this._syncArtifactWorkflows = syncArtifactWorkflows;
  }

  ensurePool() {
    if (!this.pool) {
      throw new Error("La conexion con PostgreSQL no esta disponible.");
    }
  }


  async resolveProcessDefinitionSeriesIdentity(candidate) {
    return resolveProcessDefinitionSeriesIdentity(candidate, {
      findUnitType: (id) => this._getByKeys("unit_types", { id }),
      findCargo: (id) => this._getByKeys("cargos", { id })
    });
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
          await this._syncArtifactWorkflows(Number(targetArtifactId), connection);
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
}
