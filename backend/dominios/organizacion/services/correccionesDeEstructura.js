// REGISTRAR UNA CORRECCIÓN DE LA ESTRUCTURA: la regla, antes de escribir (frente 27, D-05).
//
// Una corrección reescribe algo que ya rigió, y por eso pide lo que un cambio normal no: un motivo
// escrito. El permiso —distinto del de editar la estructura— lo comprueba la ruta; aquí se comprueba
// lo que la ruta no puede: que haya quién, que haya por qué, y que la tabla sea de las que se corrigen.
import { badRequest } from "../../../errors/HttpError.js";
import { anotarCorreccion } from "../datos/correcciones.js";
import { leerFilaAntesDeCorregir, TABLAS_CON_CORRECCION } from "../datos/consulta/filaAntesDeCorregir.js";

export const MOTIVO_MINIMO = 10;
export { TABLAS_CON_CORRECCION };

export const registrarCorreccion = async (conexion, { tabla, registroId = null, actorId, motivo, cambios }) => {
  const porQue = String(motivo ?? "").trim();
  if (porQue.length < MOTIVO_MINIMO) {
    throw badRequest(`Una corrección necesita su motivo, escrito (al menos ${MOTIVO_MINIMO} caracteres).`);
  }
  if (!Number(actorId)) {
    throw badRequest("Una corrección necesita saber quién la registra.");
  }
  if (!TABLAS_CON_CORRECCION.includes(tabla)) {
    throw badRequest("Eso no es algo que se corrija por este camino.");
  }
  // EL «ANTES» LO LEE ESTE DOMINIO, de la base y dentro de la transacción: no se acepta de quien
  // corrige. Una bitácora cuyo «antes» lo dicta el interesado no prueba lo que la fila decía.
  const id = registroId ? Number(registroId) : null;
  const antes = id ? await leerFilaAntesDeCorregir(conexion, tabla, id) : null;
  if (id && !antes) {
    throw badRequest("Lo que se quiere corregir no existe.");
  }
  return anotarCorreccion(conexion, {
    tabla,
    registroId: id,
    actorId: Number(actorId),
    motivo: porQue,
    antes,
    despues: { ...(antes ?? {}), ...(cambios ?? {}) }
  });
};
