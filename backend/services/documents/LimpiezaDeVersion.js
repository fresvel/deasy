// BORRAR UNA VERSIÓN DE DOCUMENTO SE LLEVA TAMBIÉN SUS FICHEROS (frente 27, F27.P4.T25).
//
// Medido el 2026-11-24 (F27.P5.T24): al borrar a mano una versión, la base se lleva sus filas de
// subidas y anexos, pero los objetos del almacén se quedaban —3 de 3— y nada los limpiaba después.
// Una cascada de la base no toca un bucket.
//
// Va en DOS TIEMPOS, y no es estilo. Las rutas se leen ANTES de borrar, porque la cascada se lleva
// las filas que las nombran. Y los objetos se borran DESPUÉS, con el borrado ya confirmado y fuera
// de su transacción: una transacción no deshace un objeto borrado, así que borrar el objeto primero
// dejaría, si la base rechaza el borrado, una versión que apunta a ficheros que ya no existen.
//
// Lo que NO se borra: una ruta que todavía nombra otra fila. Y que un objeto no se pueda borrar no
// deshace nada: la versión ya no existe; se avisa y se sigue, que es lo que hace el borrado de un
// anexo suelto.
import { getPostgresPool } from "../../config/postgres.js";
import { listarFicherosDeLaVersion, rutasQueSiguenEnUso } from "../../dominios/tareas/index.js";
import { resolveStoredDocumentObject } from "../../dominios/identidad/controllers/user_controler.storage.js";
import { removeAlmacenObject } from "../storage/almacen_service.js";

export const ficherosDeLaVersion = (documentVersionId, { connection = getPostgresPool() } = {}) =>
  listarFicherosDeLaVersion(connection, documentVersionId);

// `borrar` y `resolver` se pueden sustituir para probar sin almacén.
export const borrarFicherosSinDueno = async (
  rutas,
  { connection = getPostgresPool(), borrar = removeAlmacenObject, resolver = resolveStoredDocumentObject } = {}
) => {
  const candidatas = [...new Set((rutas || []).filter(Boolean))];
  if (!candidatas.length) return { borrados: 0, conservados: 0, fallidos: 0 };
  const enUso = new Set(await rutasQueSiguenEnUso(connection, candidatas));
  let borrados = 0;
  let fallidos = 0;
  for (const ruta of candidatas) {
    if (enUso.has(ruta)) continue;
    const objeto = resolver(ruta);
    if (!objeto) continue;
    try {
      await borrar(objeto.bucket, objeto.objectName);
      borrados += 1;
    } catch (error) {
      fallidos += 1;
      console.warn(`No se pudo borrar del almacén el fichero de una versión eliminada (${ruta}):`, error?.message);
    }
  }
  return { borrados, conservados: enUso.size, fallidos };
};
