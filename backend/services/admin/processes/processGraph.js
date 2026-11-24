// ProcessGraphService — jerarquia y grafo de PROCESOS. Extraido de SqlAdminService.js (God #1)
// por Extract Class, cut #9.
//
// Es el gemelo exacto de OrgStructureService (cut #2, que hace lo mismo con el grafo de UNIDADES):
// mismo patron —clase con estado + delegadores finos—, mismo grado de acoplamiento (solo
// `this.pool` y una lectura generica del motor, `getByKeys`, inyectada) y misma razon de ser: la
// jerarquia es un subsistema propio, no parte del CRUD.

import { slugify } from "../kernel/primitives.js";
import { isUniqueViolation, translateConstraintError } from "../../../errors/sqlErrors.js";
import { conflict } from "../../../errors/HttpError.js";
import { conTransaccion } from "../../../config/postgres.js";
import { planDeMovimiento } from "../../estructura/planDeMovimiento.js";
import { conSusSucesores } from "../../estructura/sucesores.js";

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

  // --- Jerarquía de procesos (padre→hijo vía process_relations, con fechas), análoga al organigrama ---
  async getProcessGraph() {
    this.ensurePool();
    const [nodes] = await this.pool.query(
      `SELECT p.id, p.name, p.slug,
              -- EL PADRE sale de la vista process_relacion_actual: la arista que cuenta hoy --la que
              -- rige; si no, la programada; si no, el borrador; si no, la ultima--. Es lo que se
              -- DIBUJA, y por eso un proceso en borrador o ya suprimido tambien tiene su sitio.
              rel.parent_process_id AS parent_id, rel.estado AS relacion_estado, rel.id AS relacion_id,
              -- EL CAMBIO QUE YA ESTA PROGRAMADO: cuando termina la relacion de hoy y de quien
              -- colgara despues. Sin esto, tras fechar un cambio a futuro la pantalla seguiria
              -- enseñando el padre de hoy como si no hubiera pasado nada.
              rel.vigente_hasta::text AS relacion_hasta,
              prox.parent_process_id AS proximo_padre_id, prox.desde AS proximo_padre_desde,
              -- LA VIGENCIA sale de la vista process_vigencia_actual: el periodo que cuenta hoy. Sin fila
              -- alli el proceso no ha regido nunca y es un borrador. Las fechas van como TEXTO
              -- (AAAA-MM-DD): son dias, no instantes.
              v.vigencia_id, v.vigente_desde::text AS vigente_desde, v.vigente_hasta::text AS vigente_hasta,
              v.inicio_origen, v.inicio_acto_id, v.fin_origen, v.fin_acto_id,
              COALESCE(v.estado, 'borrador') AS estado,
              -- EL PROCESO DE UNA CONFIGURACION SALE DE SU LINEA (frente 25, P22): la columna
              -- process_id de la configuracion era una copia que nada comprobaba. En una
              -- correlacionada el precio es un JOIN dentro de la subconsulta, que es donde mas se nota.
              (SELECT COUNT(*) FROM process_definition_versions pdv
                 INNER JOIN lineas lin ON lin.id = pdv.linea_id
                WHERE lin.process_id = p.id) AS definitions_count,
              (SELECT COUNT(*) FROM process_definition_versions pdv
                 INNER JOIN lineas lin ON lin.id = pdv.linea_id
                WHERE lin.process_id = p.id AND pdv.status = 'active') AS active_count
         FROM processes p
         LEFT JOIN process_vigencia_actual v ON v.process_id = p.id
         LEFT JOIN process_relacion_actual rel ON rel.child_process_id = p.id
         LEFT JOIN LATERAL (
           SELECT pr.parent_process_id, pr.vigente_desde::text AS desde
             FROM process_relations pr
            WHERE pr.child_process_id = p.id AND pr.vigente_desde > CURRENT_DATE AND pr.id <> rel.id
            ORDER BY pr.vigente_desde ASC
            LIMIT 1
         ) prox ON TRUE
        ORDER BY p.name ASC`
    );
    const edges = nodes
      .filter((node) => node.parent_id)
      .map((node) => ({
        id: `pe-${node.parent_id}-${node.id}`,
        parent_process_id: node.parent_id,
        child_process_id: node.id,
        estado: node.relacion_estado
      }));
    // Configuraciones (process_definition_versions) por proceso, para el grafo multinivel expandible.
    const [configs] = await this.pool.query(
      `SELECT pdv.id AS definition_id, lin.process_id, nombre_configuracion(lin.nombre, pdv.definition_version) AS definition_name,
              pdv.linea_id, lin.nombre AS linea_nombre, pdv.definition_version, pdv.status,
              lin.unit_scope_type, lin.cargo_id AS linea_cargo_id,
              sc.name AS linea_cargo_name, sut.name AS linea_unit_type_name
         FROM process_definition_versions pdv
         INNER JOIN lineas lin ON lin.id = pdv.linea_id
         LEFT JOIN cargos sc ON sc.id = lin.cargo_id
         LEFT JOIN unit_types sut ON sut.id = lin.unit_type_id
        ORDER BY lin.process_id, FIELD(pdv.status, 'active', 'draft', 'retired'), lin.nombre ASC`
    );
    // Entregables (plantillas vinculadas) por configuración, para el 3er nivel del grafo. Una misma plantilla
    // puede estar en varias configuraciones: cada fila pdt es un nodo (duplicado por config) y el template_code
    // es el distintivo que identifica que es el mismo entregable.
    const [templates] = await this.pool.query(
      `SELECT pdt.id, pdt.process_definition_id AS definition_id, lin.process_id,
              pdt.edicion_id, d.code AS template_code, d.display_name, d.template_scope,
              ta.storage_version, ta.lifecycle_state,
              (SELECT COUNT(*) FROM ediciones tav WHERE tav.catalogo_documental_id = ta.catalogo_documental_id) AS version_count
         FROM vinculos pdt
         INNER JOIN process_definition_versions pdv ON pdv.id = pdt.process_definition_id
         INNER JOIN lineas lin ON lin.id = pdv.linea_id
         INNER JOIN ediciones ta ON ta.id = pdt.edicion_id
         INNER JOIN catalogo_documental d ON d.id = ta.catalogo_documental_id
        ORDER BY pdt.process_definition_id, pdt.sort_order ASC`
    );
    return { nodes, edges, configs, templates };
  }

  // Ciclo: poner parentId como padre de childId lo cerraría si parentId ya es descendiente de childId
  // (o son el mismo). CTE recursiva sobre las aristas QUE NO HAN TERMINADO --las que rigen, las
  // programadas y los borradores--: son las que pueden coincidir en el tiempo con la nueva.
  async wouldCreateProcessCycle(parentId, childId, connection = this.pool) {
    if (Number(parentId) === Number(childId)) {
      return true;
    }
    const [rows] = await connection.query(
      `WITH RECURSIVE descendants AS (
         SELECT child_process_id AS id FROM process_relations
          WHERE parent_process_id = ? AND (vigente_hasta IS NULL OR vigente_hasta > CURRENT_DATE)
         UNION
         SELECT pr.child_process_id FROM process_relations pr
         INNER JOIN descendants d ON pr.parent_process_id = d.id
          WHERE pr.vigente_hasta IS NULL OR pr.vigente_hasta > CURRENT_DATE
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
      // El proceso y su arista van juntos: uno creado sin ella quedaria suelto en el mapa.
      return await conTransaccion(async (conexion) => {
        const [r] = await conexion.query(
          // NACE EN BORRADOR (frente 27, D-03): sin fecha de inicio. Ponerlo en vigor es un paso aparte,
          // que pide la fecha, su origen y --si es una reorganizacion-- el acto que lo ordena.
          `INSERT INTO processes (name, slug) VALUES (?, ?)`,
          [cleanName, cleanSlug]
        );
        const id = Number(r.insertId);
        if (parentId) {
          // Y SU ARISTA TAMBIEN (D-04): un borrador, que empezara a regir con el proceso.
          await conexion.query(
            `INSERT INTO process_relations (parent_process_id, child_process_id) VALUES (?, ?)`,
            [parentId, id]
          );
        }
        return { id };
      }, this.pool);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict("Ya existe un proceso con ese identificador (slug).");
      }
      throw error;
    }
  }

  // MUEVE (o desvincula con parentId null) un proceso, con guardia de ciclo. Con aristas fechadas
  // (frente 27, D-04) no es un UPDATE: que hay que hacer lo decide `planDeMovimiento` segun el estado
  // de la arista de hoy --reemparejar un borrador, o cerrar la que rige y abrir otra el mismo dia--.
  // Mover una relacion que ya rige pide `vigente_desde` y `origen`, y `acto_id` si es reorganizacion.
  async setProcessParent(processId, parentId, { vigente_desde = null, origen = null, acto_id = null } = {}) {
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
    }
    return conTransaccion(async (conexion) => {
      const [actuales] = await conexion.query(
        `SELECT rel.id, rel.parent_process_id AS "padreId", rel.estado, rel.vigente_desde::text AS vigente_desde
           FROM process_relacion_actual rel
          WHERE rel.child_process_id = ?`,
        [id]
      );
      // Vida EN CURSO --que rige o que esta programada--, no «rige hoy»: ver `planDeMovimiento`.
      const [rige] = await conexion.query(
        `SELECT EXISTS (
           SELECT 1 FROM process_vigencias pv
            WHERE pv.process_id = ? AND (pv.vigente_hasta IS NULL OR pv.vigente_hasta > CURRENT_DATE)
         ) AS rige`,
        [id]
      );
      const pasos = planDeMovimiento(actuales[0] ?? null, {
        padreId: newParent,
        desde: vigente_desde,
        origen,
        actoId: acto_id,
        hijoConVida: Boolean(rige[0]?.rige)
      });
      if (newParent && pasos.length && (await this.wouldCreateProcessCycle(newParent, id, conexion))) {
        throw new Error("La relación crearía un ciclo en la jerarquía de procesos.");
      }
      for (const paso of pasos) {
        if (paso.op === "reemparejar") {
          await conexion.query(`UPDATE process_relations SET parent_process_id = ? WHERE id = ?`, [paso.padreId, paso.id]);
        } else if (paso.op === "cerrar") {
          await conexion.query(
            `UPDATE process_relations SET vigente_hasta = ?, fin_origen = ?, fin_acto_id = ? WHERE id = ?`,
            [paso.hasta, paso.origen, paso.actoId, paso.id]
          );
        } else if (paso.op === "borrar") {
          await conexion.query(`DELETE FROM process_relations WHERE id = ?`, [paso.id]);
        } else {
          await conexion.query(
            `INSERT INTO process_relations (parent_process_id, child_process_id, vigente_desde, inicio_origen, inicio_acto_id)
             VALUES (?, ?, ?, ?, ?)`,
            [paso.padreId, id, paso.desde, paso.origen, paso.actoId]
          );
        }
      }
      return { id, parent_id: newParent };
    }, this.pool).catch((error) => {
      // Lo que rechaza la base --un solape, un padre que no rige ese dia, una reorganizacion sin
      // acto-- sale con su frase, no con el texto del motor.
      throw translateConstraintError(error, "process_relations") || error;
    });
  }

  // Detalle de un proceso para el cockpit del grafo de procesos: el registro en sí (+ nombre del padre),
  // sus configuraciones (process_definition_versions agrupadas por serie/variación, con estado y conteos de
  // reglas/plantillas/corridas), sus sub-procesos (sus hijos en process_relations) y sus corridas (process_runs).

  // Detalle de un proceso para el cockpit del grafo de procesos: el registro en sí (+ nombre del padre),
  // sus configuraciones (process_definition_versions agrupadas por serie/variación, con estado y conteos de
  // reglas/plantillas/corridas), sus sub-procesos (sus hijos en process_relations) y sus corridas (process_runs).
  async getProcessDetail(processId) {
    this.ensurePool();
    const id = Number(processId);
    if (!id) {
      throw new Error("Proceso inválido.");
    }
    const [processRows] = await this.pool.query(
      `SELECT p.id, p.name, p.slug, rel.parent_process_id AS parent_id, par.name AS parent_name,
              rel.estado AS relacion_estado, rel.vigente_desde::text AS relacion_desde,
              -- LA VIGENCIA sale de la vista process_vigencia_actual: el periodo que cuenta hoy. Sin fila
              -- alli el proceso no ha regido nunca y es un borrador. Las fechas van como TEXTO
              -- (AAAA-MM-DD): son dias, no instantes.
              v.vigencia_id, v.vigente_desde::text AS vigente_desde, v.vigente_hasta::text AS vigente_hasta,
              v.inicio_origen, v.inicio_acto_id, v.fin_origen, v.fin_acto_id,
              COALESCE(v.estado, 'borrador') AS estado
         FROM processes p
         LEFT JOIN process_relacion_actual rel ON rel.child_process_id = p.id
         LEFT JOIN processes par ON par.id = rel.parent_process_id
         LEFT JOIN process_vigencia_actual v ON v.process_id = p.id
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
              nombre_configuracion(lin.nombre, pdv.definition_version) AS definition_name,
              pdv.linea_id,
              lin.nombre AS linea_nombre,
              pdv.definition_version,
              pdv.status,
              pdv.effective_from,
              pdv.effective_to,
              lin.unit_scope_type,
              lin.cargo_id AS linea_cargo_id,
              sc.name AS linea_cargo_name,
              sut.name AS linea_unit_type_name,
              (SELECT COUNT(*) FROM vinculos pdt WHERE pdt.process_definition_id = pdv.id) AS templates_count,
              (SELECT COUNT(*) FROM process_runs pr WHERE pr.process_definition_id = pdv.id) AS runs_count
         FROM process_definition_versions pdv
         INNER JOIN lineas lin ON lin.id = pdv.linea_id
         LEFT JOIN cargos sc ON sc.id = lin.cargo_id
         LEFT JOIN unit_types sut ON sut.id = lin.unit_type_id
        WHERE lin.process_id = ?
        ORDER BY FIELD(pdv.status, 'active', 'draft', 'retired'),
                 lin.nombre ASC, pdv.definition_version DESC`,
      [id]
    );

    const [children] = await this.pool.query(
      `SELECT c.id, c.name, c.slug, COALESCE(vc.estado, 'borrador') AS estado,
              (SELECT COUNT(*) FROM process_definition_versions pdv
                 INNER JOIN lineas lin ON lin.id = pdv.linea_id
                WHERE lin.process_id = c.id) AS definitions_count,
              (SELECT COUNT(*) FROM process_definition_versions pdv
                 INNER JOIN lineas lin ON lin.id = pdv.linea_id
                WHERE lin.process_id = c.id AND pdv.status = 'active') AS active_count
         FROM process_relacion_actual relc
         INNER JOIN processes c ON c.id = relc.child_process_id
         LEFT JOIN process_vigencia_actual vc ON vc.process_id = c.id
        WHERE relc.parent_process_id = ?
        ORDER BY c.name ASC`,
      [id]
    );

    // TODAS LAS VIDAS del proceso, la mas reciente primero: es la historia que enseña la pestaña
    // «Vigencia», con el numero del acto de cada extremo para no obligar a otra peticion.
    const [vigencias] = await this.pool.query(
      `SELECT pv.id, pv.vigente_desde::text AS vigente_desde, pv.vigente_hasta::text AS vigente_hasta,
              pv.inicio_origen, pv.inicio_acto_id, ai.numero AS inicio_acto_numero,
              pv.fin_origen, pv.fin_acto_id, af.numero AS fin_acto_numero,
              estado_de_vigencia(pv.vigente_desde, pv.vigente_hasta) AS estado
         FROM process_vigencias pv
         LEFT JOIN actos ai ON ai.id = pv.inicio_acto_id
         LEFT JOIN actos af ON af.id = pv.fin_acto_id
        WHERE pv.process_id = ?
        ORDER BY pv.vigente_desde DESC`,
      [id]
    );
    // LAS EQUIVALENCIAS (frente 27, D-05), en los dos sentidos: lo que sucedio a cada vida que
    // termino --varios es una division-- y a quien sucede este proceso --varios, una fusion--.
    const [sucesores] = await this.pool.query(
      `SELECT e.id, e.antecesor_vigencia_id, e.sucesor_process_id AS nodo_id, s.name AS nombre
         FROM process_equivalencias e
         INNER JOIN process_vigencias pv ON pv.id = e.antecesor_vigencia_id
         INNER JOIN processes s ON s.id = e.sucesor_process_id
        WHERE pv.process_id = ?
        ORDER BY s.name ASC`,
      [id]
    );
    const [antecesores] = await this.pool.query(
      `SELECT e.id, pv.process_id AS nodo_id, a.name AS nombre, pv.vigente_hasta::text AS desde
         FROM process_equivalencias e
         INNER JOIN process_vigencias pv ON pv.id = e.antecesor_vigencia_id
         INNER JOIN processes a ON a.id = pv.process_id
        WHERE e.sucesor_process_id = ?
        ORDER BY pv.vigente_hasta DESC, a.name ASC`,
      [id]
    );

    const [runs] = await this.pool.query(
      `SELECT pr.id, pr.process_definition_id, pr.run_mode, pr.status, pr.reason, pr.source_run_id, pr.created_at,
              nombre_configuracion(lin.nombre, pdv.definition_version) AS definition_name, pdv.linea_id, lin.nombre AS linea_nombre, pdv.definition_version,
              t.id AS term_id, t.name AS term_name,
              tt.code AS term_type_code, tt.name AS term_type_name
         FROM process_runs pr
         INNER JOIN process_definition_versions pdv ON pdv.id = pr.process_definition_id
         INNER JOIN lineas lin ON lin.id = pdv.linea_id
         LEFT JOIN terms t ON t.id = pr.term_id
         LEFT JOIN term_types tt ON tt.id = t.term_type_id
        WHERE lin.process_id = ?
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
        vigencia_id: process.vigencia_id,
        vigente_desde: process.vigente_desde,
        vigente_hasta: process.vigente_hasta,
        inicio_origen: process.inicio_origen,
        inicio_acto_id: process.inicio_acto_id,
        fin_origen: process.fin_origen,
        fin_acto_id: process.fin_acto_id,
        estado: process.estado
      },
      vigencias: conSusSucesores(vigencias, sucesores),
      antecesores,
      configurations,
      children,
      runs
    };
  }
}
