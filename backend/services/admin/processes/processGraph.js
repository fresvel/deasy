// ProcessGraphService — jerarquia y grafo de PROCESOS. Extraido de SqlAdminService.js (God #1)
// por Extract Class, cut #9.
//
// Es el gemelo exacto de OrgStructureService (cut #2, que hace lo mismo con el grafo de UNIDADES):
// mismo patron —clase con estado + delegadores finos—, mismo grado de acoplamiento (solo
// `this.pool` y una lectura generica del motor, `getByKeys`, inyectada) y misma razon de ser: la
// jerarquia es un subsistema propio, no parte del CRUD.

import { slugify } from "../kernel/primitives.js";
import { isUniqueViolation } from "../../../errors/sqlErrors.js";
import { conflict } from "../../../errors/HttpError.js";

export default class ProcessGraphService {
  constructor(pool, { getByKeys } = {}) {
    this.pool = pool;
    this._getByKeys = getByKeys;
  }

  ensurePool() {
    if (!this.pool) {
      throw new Error("Conexion PostgreSQL no disponible");
    }
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

  // Ciclo: poner parentId como padre de childId lo cerraría si parentId ya es descendiente de childId
  // (o son el mismo). CTE recursiva sobre processes.parent_id.

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
      const parent = await this._getByKeys("processes", { id: parentId });
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
      if (isUniqueViolation(error)) {
        throw conflict("Ya existe un proceso con ese identificador (slug).");
      }
      throw error;
    }
  }

  // Reparenta (o desvincula con parentId null) un proceso, con guardia de ciclo.

  // Reparenta (o desvincula con parentId null) un proceso, con guardia de ciclo.
  async setProcessParent(processId, parentId) {
    this.ensurePool();
    const id = Number(processId);
    const newParent = parentId ? Number(parentId) : null;
    const proc = await this._getByKeys("processes", { id });
    if (!proc) {
      throw new Error("El proceso no existe.");
    }
    if (newParent) {
      if (newParent === id) {
        throw new Error("Un proceso no puede ser su propio padre.");
      }
      const parent = await this._getByKeys("processes", { id: newParent });
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
}
