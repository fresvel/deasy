import { getPostgresPool } from "../../config/postgres.js";
import { esRecursoSensible } from "../../config/rbacPolicy.js";

// La bitacora de accesos a datos sensibles y de pago (frente 20, P8). El porque -- y por que NO la
// exige la ley con ese nombre-- esta en el comentario de `accesos_sensibles` en el esquema.
//
// EL TITULAR ES SIEMPRE `person_id`. Toda tabla asignada a un recurso sensible lo lleva, y lo exige
// `config/rbacCatalog.test.js`: por eso este servicio no necesita saber nada de cada tabla.
export const COLUMNA_TITULAR = "person_id";

const titularDe = (fila, tabla) => {
  const titular = Number(fila?.[COLUMNA_TITULAR]);
  // ⚠️ Una fila sensible SIN titular no se sirve. Apuntarla con un titular inventado mentiria, y no
  // apuntarla dejaria un acceso sin rastro, que es justo lo que esto existe para impedir.
  if (!Number.isInteger(titular) || titular <= 0) {
    throw new Error(`Una fila de ${tabla} no trae ${COLUMNA_TITULAR}: no se puede registrar el acceso.`);
  }
  return titular;
};

// El registro concreto. En las tablas 1:1 (`persona_autoidentificacion`) la clave ES el titular.
const idDe = (fila) => {
  const id = Number(fila?.id ?? fila?.[COLUMNA_TITULAR]);
  return Number.isFinite(id) ? id : null;
};

// Las entradas de una LECTURA, sin tocar la base: separado para poder probarlo.
//
// Se omite lo que el titular lee DE SI MISMO. La pregunta que responde la bitacora es «quien vio lo
// de esta persona», y la persona no es un tercero.
export const entradasDeLectura = ({ actorId, recurso, tabla, filas }) => {
  if (!esRecursoSensible(recurso)) return [];
  return (filas ?? []).flatMap((fila) => {
    const titular = titularDe(fila, tabla);
    if (titular === Number(actorId)) return [];
    return [{ titular, registro: idDe(fila), accion: "read", detalle: null }];
  });
};

// Las entradas de una ESCRITURA. Esta SI se apunta aunque la haga el titular: un cambio es un hecho
// que hay que poder reconstruir, lo haga quien lo haga.
//
// ⚠️ De los campos se guardan los NOMBRES, nunca los valores. Copiar aqui la discapacidad de alguien
// convertiria la bitacora en otra copia del dato que protege -- y esta copia la lee Auditor.
export const entradasDeEscritura = ({ recurso, tabla, accion, fila, campos = [] }) => {
  if (!esRecursoSensible(recurso) || !fila) return [];
  const nombres = [...new Set(campos)].filter((campo) => campo !== COLUMNA_TITULAR).sort();
  return [{
    titular: titularDe(fila, tabla),
    registro: idDe(fila),
    accion,
    detalle: nombres.length ? { campos: nombres } : null
  }];
};

export default class AccesosSensiblesService {
  constructor(pool = getPostgresPool()) {
    this.pool = pool;
  }

  // Una sola sentencia por peticion, con tantas filas como entradas: una pagina de 50 son 50 filas,
  // no 50 viajes a la base.
  async registrar(entradas, { actorId, recurso, tabla, ip = null }) {
    if (!entradas.length) return 0;
    const huecos = [];
    const valores = [];
    for (const entrada of entradas) {
      huecos.push("(?, ?, ?, ?, ?, ?, ?, ?)");
      valores.push(
        entrada.titular,
        Number(actorId),
        recurso,
        tabla,
        entrada.registro,
        entrada.accion,
        entrada.detalle ? JSON.stringify(entrada.detalle) : null,
        ip
      );
    }
    await this.pool.query(
      `INSERT INTO accesos_sensibles
         (titular_person_id, actor_person_id, recurso, tabla, registro_id, accion, detalle, ip)
       VALUES ${huecos.join(", ")}`,
      valores
    );
    return entradas.length;
  }

  registrarLectura(contexto) {
    return this.registrar(entradasDeLectura(contexto), contexto);
  }

  registrarEscritura(contexto) {
    return this.registrar(entradasDeEscritura(contexto), contexto);
  }
}
