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
// ⚠️ LA ESCRITURA SE APUNTA DESPUES de hacerse -- antes no hay fila ni id--, asi que si la bitacora
// falla ahi, el cambio queda hecho y la peticion responde error. El hueco es conocido y queda escrito.
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
    const fila = await this.service.create(tabla, datos);
    await this.bitacora.registrarEscritura({ ...contexto, tabla, accion: "create", fila, campos: Object.keys(datos ?? {}) });
    return fila;
  }

  async update(tabla, claves, datos, contexto) {
    const fila = await this.service.update(tabla, claves, datos);
    const campos = Object.keys(datos ?? {}).filter((campo) => !Object.hasOwn(claves ?? {}, campo));
    await this.bitacora.registrarEscritura({ ...contexto, tabla, accion: "update", fila, campos });
    return fila;
  }

  async remove(tabla, claves, contexto) {
    // El titular se lee ANTES: despues del DELETE ya no hay fila de la que sacarlo. Esta lectura es
    // del propio sistema y por eso no va a la bitacora como lectura.
    const previa = esRecursoSensible(contexto?.recurso)
      ? (await this.service.list(tabla, { filters: claves, limit: 1 }))?.[0] ?? null
      : null;
    const borradas = await this.service.remove(tabla, claves);
    if (previa) {
      await this.bitacora.registrarEscritura({ ...contexto, tabla, accion: "delete", fila: previa });
    }
    return borradas;
  }
}
