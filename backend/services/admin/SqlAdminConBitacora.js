import AccesosSensiblesService from "../auth/AccesosSensiblesService.js";
import { esRecursoSensible } from "../../config/rbacPolicy.js";

// El editor generico de /admin con la bitacora de accesos sensibles delante (frente 20, P8).
//
// Es una envoltura y no un `if` dentro de `SqlAdminService`, a proposito: lo que decide si un acceso
// se apunta es el RECURSO de la tabla -- una propiedad de la politica de acceso--, no nada de la
// tabla en si, y coserlo en el motor generico seria el injerto por tabla que tableHooks.js existe
// para evitar.
//
// ⚠️ LA LECTURA SE APUNTA ANTES DE DEVOLVER LAS FILAS: si la bitacora falla, la peticion falla y no
// sale nada. Servir el dato sin rastro es justo lo que esto impide.
//
// ⚠️ LA ESCRITURA SE APUNTA EN SU MISMA TRANSACCION, con la conexion de la transaccion: si la entrada
// no se puede escribir, la transaccion se deshace y EL CAMBIO NO QUEDA. No hay escritura confirmada
// sobre una tabla sensible sin su entrada.
//
// Hasta el 2026-09-10 se apuntaba DESPUES de confirmar, y el hueco no era teorico. Medido en la pila:
// un PUT que no mandaba `person_id` -- cambiar solo la fecha de emision de una cedula-- quedaba
// guardado, respondia 400 «no trae person_id» y no dejaba entrada, porque la fila con la que se
// apuntaba era la del cuerpo de la peticion y no la de la base. Ahora el titular sale de la fila
// real (`ctx.existing` al actualizar, la leida con FOR UPDATE al borrar).
//
// Fuera de lo sensible, las tres escrituras van por el camino de siempre, sin transaccion de mas.
export default class SqlAdminConBitacora {
  constructor(service, bitacora = new AccesosSensiblesService()) {
    this.service = service;
    this.bitacora = bitacora;
  }

  async list(tabla, opciones, contexto) {
    const filas = await this.service.list(tabla, opciones);
    await this.bitacora.registrarLectura({ ...contexto, tabla, filas });
    return filas;
  }

  async create(tabla, datos, contexto) {
    if (!esRecursoSensible(contexto?.recurso)) {
      return this.service.create(tabla, datos);
    }
    return this.service.create(tabla, datos, {
      transaccion: {
        despues: (ctx) => this.bitacora.registrarEscritura({
          ...contexto,
          tabla,
          accion: "create",
          fila: { id: ctx.insertId, ...ctx.payload },
          campos: Object.keys(datos ?? {})
        }, ctx.connection)
      }
    });
  }

  async update(tabla, claves, datos, contexto) {
    if (!esRecursoSensible(contexto?.recurso)) {
      return this.service.update(tabla, claves, datos);
    }
    const campos = Object.keys(datos ?? {}).filter((campo) => !Object.hasOwn(claves ?? {}, campo));
    return this.service.update(tabla, claves, datos, {
      transaccion: {
        despues: (ctx) => this.bitacora.registrarEscritura({
          ...contexto,
          tabla,
          accion: "update",
          fila: { ...ctx.existing, ...ctx.updates },
          campos
        }, ctx.connection)
      }
    });
  }

  async remove(tabla, claves, contexto) {
    if (!esRecursoSensible(contexto?.recurso)) {
      return this.service.remove(tabla, claves);
    }
    // El titular se lee DENTRO de la transaccion y ANTES del DELETE -- despues ya no hay fila--, con
    // FOR UPDATE: son exactamente las filas que se van a borrar, y nadie las cambia entre medias. Es
    // una lectura del propio sistema, y por eso no va a la bitacora como lectura.
    let previas = [];
    return this.service.remove(tabla, claves, {
      transaccion: {
        antes: async (ctx) => {
          const [filas] = await ctx.connection.query(
            `SELECT * FROM ${ctx.tableName} WHERE ${ctx.where} FOR UPDATE`,
            ctx.params
          );
          previas = filas ?? [];
        },
        despues: async (ctx) => {
          for (const fila of previas) {
            await this.bitacora.registrarEscritura({ ...contexto, tabla, accion: "delete", fila }, ctx.connection);
          }
        }
      }
    });
  }
}
