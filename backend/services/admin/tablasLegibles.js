import RbacService from "../auth/RbacService.js";
import { resolveTableResource } from "../../config/rbacPolicy.js";

const rbac = new RbacService();

// Lo que `/admin/sql/meta` enseña a quien pregunta: las tablas que PUEDE LEER, cada una con el
// RECURSO que la protege.
//
// El recurso viaja aqui para que el frontend deje de llevar su propia copia del mapa tabla ->
// recurso. Hasta P8 eran DOS listas de 53 entradas escritas a mano, una en cada lado, y ninguna
// prueba las comparaba: el contenedor del backend ni siquiera ve el codigo del frontend. Una lista
// que ya no existe no puede desincronizarse.
export const tablasLegibles = (tablas = [], access = null, puede = (a, recurso, accion) => rbac.can(a, recurso, accion)) =>
  tablas
    .map((tabla) => ({ ...tabla, resource: resolveTableResource(tabla.table) }))
    .filter((tabla) => tabla.resource && puede(access, tabla.resource, "read"));
