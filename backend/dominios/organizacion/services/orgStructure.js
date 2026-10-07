// OrgStructureService — unidades, puestos y grafo de unidades. Extraido de SqlAdminService.js
// (God #1) por Extract Class (cut #2 del plan de refactor backend). El cluster era autocontenido:
// solo usa this.pool + una lectura generica del motor (getByKeys), inyectada. SqlAdminService
// mantiene delegadores finos con la misma firma, asi el controller y los grafts de create()/update()
// (que llaman this.wouldCreateUnitCycle / this.assertUnitHeadAllowed) no se tocan.
// `isForeignKeyViolation` se importaba para traducir el fallo del borrado de un puesto a un mensaje
// amable. Ya no hace falta: desde el 2026-08-23 se PREGUNTA antes en vez de intentar y traducir, asi
// que el mensaje puede decir cuantos y de que en vez de «esta referenciado».
//
// EL SQL YA NO ESTA AQUI (F7.4, 2026-10-07). Aqui quedan las reglas —que la cabeza de unidad sea un
// puesto ocupable, que el perfil sea un JSON de cuatro secciones, que un puesto con historia se
// desactive en vez de borrarse, que una arista nueva no cierre un ciclo— y la forma de la respuesta.
// Las consultas viven en `../datos/` si solo nombran tablas de `organizacion`, y en
// `../datos/consulta/` si cruzan a otro dominio.
import { isUniqueViolation } from "../../../errors/sqlErrors.js";
import { conflict, notFound } from "../../../errors/HttpError.js";
import { conTransaccion } from "../../../config/postgres.js";
import { slugify, normalizeNumericId } from "../../../services/admin/kernel/primitives.js";
import {
  listarNodosDelGrafo,
  listarTiposDeRelacion,
  listarAristasDelGrafo,
  existeCaminoEntreUnidades,
  insertarUnidad,
  insertarRelacion
} from "../datos/unidades.js";
import {
  siguienteSlot,
  insertarPuesto,
  actualizarPuesto,
  existePuesto,
  borrarPuesto,
  cerrarOcupacionVigente,
  abrirOcupacion
} from "../datos/puestos.js";
import { listarPuestosConOcupante } from "../datos/consulta/ocupantesDeLaUnidad.js";
import {
  listarProcesosQueAlcanzanLaUnidad,
  listarProcesosEnganchables
} from "../datos/consulta/procesosDeLaUnidad.js";
import { contarDependenciasDelPuesto } from "../datos/consulta/dependenciasDelPuesto.js";

export default class OrgStructureService {
  constructor(pool, { getByKeys } = {}) {
    this.pool = pool;
    this._getByKeys = getByKeys;
  }

  ensurePool() {
    if (!this.pool) {
      throw new Error("La conexion con PostgreSQL no esta disponible.");
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
    const nodes = await listarNodosDelGrafo(this.pool);
    const relationTypes = await listarTiposDeRelacion(this.pool);
    const edges = await listarAristasDelGrafo(this.pool, relationTypeCode);
    return { nodes, edges, relationTypes };
  }


  // Detecta si crear la arista parent->child (en un tipo de relación) cerraría un ciclo: ocurre si el padre
  // ya es descendiente del hijo dentro de ese mismo tipo.
  async wouldCreateUnitCycle(parentUnitId, childUnitId, relationTypeId, connection = this.pool) {
    if (Number(parentUnitId) === Number(childUnitId)) {
      return true;
    }
    return existeCaminoEntreUnidades(connection, childUnitId, parentUnitId, relationTypeId);
  }


  // Detalle de una unidad para el panel del organigrama: sus puestos (cargo, slot, jefatura, activo) y el
  // ocupante actual de cada uno.
  async getUnitDetail(unitId) {
    this.ensurePool();
    const id = Number(unitId);
    if (!id) {
      throw new Error("Unidad inválida.");
    }
    const unit = await this._getByKeys("units", { id });
    if (!unit) {
      throw new Error("La unidad no existe.");
    }
    const positions = await listarPuestosConOcupante(this.pool, id);
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
    const unit = await this._getByKeys("units", { id });
    if (!unit) {
      throw new Error("La unidad no existe.");
    }
    const rows = await listarProcesosQueAlcanzanLaUnidad(this.pool, id, unit.unit_type_id);
    return {
      unit: { id: unit.id, name: unit.name },
      processes: rows
    };
  }


  // Configuraciones de proceso a las que se puede vincular esta unidad vía regla de alcance. Las dos
  // restricciones del modelo que lo acotan están explicadas en la consulta.
  async getUnitAttachableProcesses(unitId) {
    this.ensurePool();
    if (!Number(unitId)) {
      throw new Error("Unidad inválida.");
    }
    // La consulta no se acota por unidad a proposito: las dos restricciones que la filtran son del
    // modelo de procesos. La unidad se valida igual, para que un id roto no devuelva una lista.
    const rows = await listarProcesosEnganchables(this.pool);
    return { definitions: rows };
  }


  // --- Gestión de puestos y ocupaciones desde el organigrama ---
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


  // Crea un puesto en una unidad. El slot_no se autoincrementa por (unidad, cargo).
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
    const slotNo = await siguienteSlot(this.pool, uId, cargoId);
    try {
      const id = await insertarPuesto(this.pool, {
        unitId: uId,
        cargoId,
        slotNo,
        title: String(data.title || "").trim() || null,
        profile: profileJson,
        positionType,
        isHead
      });
      return { id };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict("La unidad ya tiene una jefatura asignada (solo se permite una).");
      }
      throw error;
    }
  }


  async updateUnitPosition(positionId, data = {}) {
    this.ensurePool();
    const pid = Number(positionId);
    const existing = await this._getByKeys("unit_positions", { id: pid });
    if (!existing) {
      throw new Error("El puesto no existe.");
    }
    const effType = data.position_type !== undefined ? data.position_type : existing.position_type;
    const effHead = data.is_unit_head !== undefined ? (data.is_unit_head ? 1 : 0) : existing.is_unit_head;
    this.assertUnitHeadAllowed(effHead, effType);
    const cambios = {};
    if (data.title !== undefined) cambios.title = String(data.title || "").trim() || null;
    if (data.cargo_id !== undefined) cambios.cargo_id = Number(data.cargo_id);
    if (data.position_type !== undefined) cambios.position_type = effType;
    if (data.is_unit_head !== undefined) cambios.is_unit_head = effHead;
    if (data.is_active !== undefined) cambios.is_active = data.is_active ? 1 : 0;
    if (data.profile !== undefined) cambios.profile = this.normalizePositionProfile(data.profile);
    try {
      await actualizarPuesto(this.pool, pid, cambios);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict("La unidad ya tiene una jefatura asignada (solo se permite una).");
      }
      throw error;
    }
    return { id: pid };
  }


  // Elimina un puesto SOLO si esta virgen. Si algo depende de el, se rechaza nombrando QUE. La lista
  // de las ocho dependencias, con su motivo, esta en `../datos/consulta/dependenciasDelPuesto.js`.
  //
  // ⚠️ ESTE METODO ESTUVO MUERTO AL 100%, y conviene saber por que antes de tocarlo. Empezaba con un
  // `DELETE rart FROM ... INNER JOIN ...`, sintaxis multi-tabla de MySQL que PostgreSQL rechaza, asi
  // que **cualquier** llamada respondia con un error de sintaxis — incluso la de un puesto
  // inexistente—. Es la regla 5 del metodo: el SQL no lo valida nadie hasta que se ejecuta esa rama,
  // y este endpoint no tenia contrato HTTP que lo ejecutara.
  //
  // Daño colateral que eso tapaba: habia un `catch` que traducia la violacion de clave foranea al
  // mensaje amable «desactivalo en su lugar». Como el error de sintaxis saltaba ANTES, ese mensaje
  // no lo vio nunca nadie.
  //
  // Y BORRABA HISTORIA: arrastraba `position_assignments` y los roles derivados. Eso contradice la
  // decision escrita en `docs/planes/plan_data/acceso-al-entregable.md` §F-2 — «un puesto no debe
  // poder borrarse si tiene historia: se desactiva, y `position_assignments` no se borra nunca en
  // ese camino»—. Los tres DELETE en cascada se retiraron: un puesto virgen no tiene ocupaciones, y
  // sin ocupaciones no hay roles derivados que limpiar (cuelgan de `derived_from_assignment_id`).
  //
  // El camino para un puesto EN USO es desactivarlo: `PUT /admin/sql/units/positions/:id` con
  // `is_active`, que ya existe y funciona.
  async removeUnitPosition(positionId) {
    this.ensurePool();
    const pid = normalizeNumericId(positionId);
    if (!pid) {
      throw new Error("Puesto invalido.");
    }

    if (!(await existePuesto(this.pool, pid))) {
      throw notFound("El puesto no existe.");
    }

    // Se pregunta ANTES en vez de intentar y traducir el fallo: asi el mensaje puede decir CUANTOS y
    // DE QUE, que es lo unico accionable. «Esta referenciado» no le dice a nadie que hacer.
    const dependencias = await contarDependenciasDelPuesto(this.pool, pid);
    if (dependencias.length) {
      const total = dependencias.reduce((suma, { n }) => suma + n, 0);
      const bloqueos = dependencias.map(({ n, singular, plural }) => `${n} ${n === 1 ? singular : plural}`);
      throw conflict(
        `No se puede eliminar: ${bloqueos.join(", ")} ${total === 1 ? "depende" : "dependen"} ` +
        "de este puesto. Desactivalo en su lugar."
      );
    }

    await borrarPuesto(this.pool, pid);
    return { id: pid };
  }


  // Asigna (o cambia) el ocupante de un puesto: cierra la ocupación vigente y crea la nueva. Las dos
  // escrituras van en UNA transacción — cerrar sin abrir deja el puesto vacante, y abrir sin cerrar
  // deja dos ocupantes vigentes del mismo puesto.
  async assignUnitPosition(positionId, personId) {
    this.ensurePool();
    const pid = Number(positionId);
    const perId = Number(personId);
    if (!pid || !perId) {
      throw new Error("El puesto y la persona son obligatorios.");
    }
    const position = await this._getByKeys("unit_positions", { id: pid });
    if (!position) {
      throw new Error("El puesto no existe.");
    }
    const person = await this._getByKeys("persons", { id: perId });
    if (!person) {
      throw new Error("La persona no existe.");
    }
    await conTransaccion(async (conexion) => {
      await cerrarOcupacionVigente(conexion, pid);
      await abrirOcupacion(conexion, pid, perId);
    }, this.pool);
    return { ok: true };
  }


  // Quita el ocupante vigente de un puesto (cierra la ocupación).
  async unassignUnitPosition(positionId) {
    this.ensurePool();
    await cerrarOcupacionVigente(this.pool, Number(positionId));
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
    try {
      return await conTransaccion(async (conexion) => {
        const newUnitId = await insertarUnidad(conexion, {
          name: nm.slice(0, 180),
          label: (String(label || "").trim() || nm).slice(0, 180),
          slug: finalSlug,
          unitTypeId
        });
        let relationId = null;
        const parentId = Number(parent_unit_id);
        const relTypeId = Number(relation_type_id);
        if (parentId && relTypeId) {
          relationId = await insertarRelacion(conexion, {
            relationTypeId: relTypeId,
            parentUnitId: parentId,
            childUnitId: newUnitId
          });
        }
        return { unit_id: newUnitId, relation_id: relationId };
      }, this.pool);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw conflict("Ya existe una unidad con ese slug. Cambia el nombre o el slug.");
      }
      throw error;
    }
  }
}
