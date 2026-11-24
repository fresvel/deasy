// CORREGIR LA ESTRUCTURA: el camino por el que se arregla en su sitio algo que ya rigió (frente 27,
// D-05, puntos 5 y 7).
//
// Es una envoltura del editor genérico, igual que `SqlAdminConBitacora` y por el mismo motivo: la
// escritura es la de siempre —la misma validación, los mismos ganchos de la tabla—, y lo que se
// añade es que va en una transacción que ANTES deja la entrada de la bitácora. Si la entrada no se
// puede escribir, la corrección no ocurre; y sin entrada, la base rechaza lo que una corrección tiene
// de especial (cambiar la fecha de inicio de algo que ya rige, el padre de una relación que ya rige,
// o escribir el origen «corrección»).
//
// Lo que NO hace una corrección es BORRAR: lo que rigió por error se cierra con origen «corrección»,
// no se elimina. Así queda escrito que existió y que fue un error.
import { badRequest } from "../../errors/HttpError.js";
import { registrarCorreccion, TABLAS_CON_CORRECCION } from "../../dominios/organizacion/index.js";

const DE_UN_PERIODO = ["vigente_desde", "vigente_hasta", "inicio_origen", "inicio_acto_id", "fin_origen", "fin_acto_id"];

// Qué se puede tocar en cada tabla. Al CORREGIR una fila, sólo estas columnas; al dar de ALTA una
// que faltó registrar, además la que dice de quién es.
const COLUMNAS = Object.freeze({
  unit_vigencias: { corregibles: DE_UN_PERIODO, alAlta: ["unit_id"] },
  position_vigencias: { corregibles: DE_UN_PERIODO, alAlta: ["position_id"] },
  process_vigencias: { corregibles: DE_UN_PERIODO, alAlta: ["process_id"] },
  unit_relations: { corregibles: [...DE_UN_PERIODO, "parent_unit_id"], alAlta: ["child_unit_id", "relation_type_id"] },
  process_relations: { corregibles: [...DE_UN_PERIODO, "parent_process_id"], alAlta: ["child_process_id"] }
});

// LAS EQUIVALENCIAS SOLO SE CORRIGEN QUITANDOLAS. No tienen columnas corregibles —una equivalencia no
// se modifica— ni alta por este camino: registrar tarde un sucesor es el camino normal.
const SOLO_SE_QUITAN = Object.freeze(["unit_equivalencias", "position_equivalencias", "process_equivalencias"]);

export default class CorreccionesDeEstructura {
  // `registrar` es la operación del dominio dueño de la bitácora; se puede pasar otra para probar.
  constructor(editor, registrar = registrarCorreccion) {
    this.editor = editor;
    this.registrar = registrar;
  }

  async corregir({ tabla, id = null, cambios, motivo, quitar = false } = {}, { actorId } = {}) {
    if (!TABLAS_CON_CORRECCION.includes(tabla)) {
      throw badRequest("Eso no es algo que se corrija por este camino.");
    }
    if (SOLO_SE_QUITAN.includes(tabla) || quitar) {
      return this.quitar({ tabla, id, motivo, quitar }, { actorId });
    }
    const registroId = id ? Number(id) : null;
    const permitidas = [...COLUMNAS[tabla].corregibles, ...(registroId ? [] : COLUMNAS[tabla].alAlta)];
    const datos = Object.fromEntries(Object.entries(cambios ?? {}).filter(([columna]) => permitidas.includes(columna)));
    const sobran = Object.keys(cambios ?? {}).filter((columna) => !permitidas.includes(columna));
    if (sobran.length) {
      throw badRequest(`Una corrección no puede cambiar: ${sobran.join(", ")}.`);
    }
    if (!Object.keys(datos).length) {
      throw badRequest("La corrección no cambia nada.");
    }
    const transaccion = {
      antes: (ctx) => this.registrar(ctx.connection, { tabla, registroId, actorId, motivo, cambios: datos })
    };
    return registroId
      ? this.editor.update(tabla, { id: registroId }, datos, { transaccion })
      : this.editor.create(tabla, datos, { transaccion });
  }

  // QUITAR, COMO CORRECCION: la fila desaparece y en la bitácora queda lo que decía, con el motivo.
  async quitar({ tabla, id = null, motivo, quitar = false } = {}, { actorId } = {}) {
    if (!SOLO_SE_QUITAN.includes(tabla) || !quitar) {
      throw badRequest(SOLO_SE_QUITAN.includes(tabla)
        ? "Una equivalencia no se modifica: se quita y se registra otra."
        : "Eso no se quita por este camino.");
    }
    const registroId = Number(id);
    if (!registroId) {
      throw badRequest("Para quitar algo hay que decir qué.");
    }
    const transaccion = {
      antes: (ctx) => this.registrar(ctx.connection, { tabla, registroId, actorId, motivo, baja: true })
    };
    return this.editor.remove(tabla, { id: registroId }, { transaccion });
  }
}
