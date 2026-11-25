// ADJUNTAR EL FICHERO DE UN ACTO EXTERNO, Y SABER QUÉ ACTOS SIGUEN SIN PAPEL (frente 27, D-05 punto
// 3; F27.P4.T11).
//
// LA REGLA (decisión del dueño, 2026-11-24): mientras el acto no ordena nada, su fichero se sube, se
// cambia o se quita sin trámite. Desde que una vida o una relación lo cita, cambiarlo o quitarlo es
// una CORRECCIÓN: permiso propio —lo exige la ruta—, motivo, y lo que la fila decía en la bitácora.
// La base impone lo mismo (`proteger_adjunto_de_acto`); aquí se dice antes, y con palabras.
//
// EL ORDEN: primero el objeto al almacén, después la fila. Una transacción no deshace un objeto ya
// escrito, así que no se finge que lo abarca. Si la fila falla queda un objeto sin dueño —inofensivo:
// su ruta lleva la huella del contenido y nadie lo apunta—; al revés quedaría una fila apuntando a
// un fichero que no existe, que es peor. Y por la misma huella, reemplazar NO pisa el anterior: el
// objeto viejo se queda donde estaba, que es lo que la bitácora de correcciones necesita.
import { createHash } from "node:crypto";
import { conTransaccion, getPostgresPool } from "../../../config/postgres.js";
import { badRequest, conflict as conflicto, notFound } from "../../../errors/HttpError.js";
import { almacenClient, getAlmacenObjectStream } from "../../../services/storage/almacen_service.js";
import { insertarAdjunto, leerAdjuntoDelActo, leerAdjuntoParaDescargar, quitarAdjunto, reemplazarAdjunto } from "../datos/actoAdjuntos.js";
import {
  contarActosSinDocumentoPorNodo,
  leerActoParaAdjuntar,
  listarActosConSuDocumento,
  listarActosDeUnNodo
} from "../datos/consulta/actosYSuDocumento.js";
import { CLASES_CON_VIDAS, listarVidasConNombre } from "../datos/consulta/vidasConNombre.js";
import { registrarCorreccion } from "./correccionesDeEstructura.js";
import { buscarDocumentosFirmados, desenlazarDocumentoDelActo, enlazarDocumentoAlActo } from "../../tareas/index.js";

const BUCKET = process.env.ALMACEN_DOCUMENTS_BUCKET || "deasy-documents";
const PDF = "application/pdf";
const FIRMA_DE_PDF = "%PDF-";

// Lo que se guarda de un fichero. La ruta lleva la huella: dos subidas del mismo contenido son el
// mismo objeto, y dos contenidos distintos nunca se pisan.
export const describirFichero = (actoId, { buffer, originalname } = {}) => {
  if (!buffer?.length) {
    throw badRequest("Falta el fichero del acto.");
  }
  if (buffer.subarray(0, FIRMA_DE_PDF.length).toString("latin1") !== FIRMA_DE_PDF) {
    throw badRequest("El fichero de un acto tiene que ser un PDF.");
  }
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  return {
    file_path: `actos/${Number(actoId)}/${sha256}.pdf`,
    file_name: String(originalname || "acto.pdf").slice(0, 255),
    mime_type: PDF,
    size_bytes: buffer.length,
    sha256
  };
};

const subirAlAlmacen = (fichero, buffer) =>
  almacenClient.putObject(BUCKET, fichero.file_path, buffer, buffer.length, { "Content-Type": PDF });

export const listarActosYSuDocumento = ({ soloSinDocumento = false } = {}, { connection = getPostgresPool() } = {}) =>
  listarActosConSuDocumento(connection, { soloSinDocumento });

// Sube el fichero de un acto, o lo cambia. `comoCorreccion` lo pone la ruta de correcciones, que es
// la que ha comprobado el permiso; `subir` se puede sustituir para probar sin almacén.
export const adjuntarAlActo = async (
  { actoId, archivo, actorId, motivo = "", comoCorreccion = false },
  { subir = subirAlAlmacen } = {}
) => {
  const fichero = describirFichero(actoId, archivo);
  // Se mira ANTES de subir nada: lo que se puede rechazar sin tocar el almacén, se rechaza así.
  const previo = await leerActoParaAdjuntar(getPostgresPool(), actoId);
  if (!previo) throw notFound("Ese acto no existe.");
  if (previo.tieneDocumentoFirmado) {
    throw conflicto(`El acto «${previo.numero}» ya tiene enlazado el documento que se firmó en el sistema: no se le adjunta otro fichero.`);
  }
  await subir(fichero, archivo.buffer);
  return conTransaccion(async (conexion) => {
    const actual = await leerAdjuntoDelActo(conexion, actoId);
    if (!actual) {
      await insertarAdjunto(conexion, actoId, fichero, actorId);
      return { acto_id: Number(actoId), ...fichero, reemplazado: false, correccion: false };
    }
    if (actual.sha256 === fichero.sha256) {
      throw conflicto("Ese es el mismo fichero que el acto ya tiene.");
    }
    const acto = await leerActoParaAdjuntar(conexion, actoId);
    if (acto.ordenaAlgo) {
      if (!comoCorreccion) {
        throw conflicto(`El acto «${acto.numero}» ya ordena cambios de la estructura: cambiar su fichero es una corrección, con su motivo.`);
      }
      await registrarCorreccion(conexion, { tabla: "acto_adjuntos", registroId: actual.id, actorId, motivo, cambios: fichero });
    }
    await reemplazarAdjunto(conexion, actual.id, fichero, actorId);
    return { acto_id: Number(actoId), ...fichero, reemplazado: true, correccion: acto.ordenaAlgo };
  });
};

export const quitarAdjuntoDelActo = async ({ actoId, actorId, motivo = "", comoCorreccion = false }) =>
  conTransaccion(async (conexion) => {
    const actual = await leerAdjuntoDelActo(conexion, actoId);
    if (!actual) throw notFound("Ese acto no tiene fichero adjunto.");
    const acto = await leerActoParaAdjuntar(conexion, actoId);
    if (acto.ordenaAlgo) {
      if (!comoCorreccion) {
        throw conflicto(`El acto «${acto.numero}» ya ordena cambios de la estructura: quitar su fichero es una corrección, con su motivo.`);
      }
      await registrarCorreccion(conexion, { tabla: "acto_adjuntos", registroId: actual.id, actorId, motivo, baja: true });
    }
    await quitarAdjunto(conexion, actual.id);
    return { acto_id: Number(actoId), quitado: true, correccion: acto.ordenaAlgo };
  });

// Para descargarlo: lo que la fila dice y el flujo del objeto.
export const abrirAdjuntoDelActo = async (actoId, { connection = getPostgresPool() } = {}) => {
  const fila = await leerAdjuntoParaDescargar(connection, actoId);
  if (!fila) throw notFound("Ese acto no tiene fichero adjunto.");
  return { nombre: fila.file_name, tipo: fila.mime_type, bytes: Number(fila.size_bytes), flujo: await getAlmacenObjectStream(BUCKET, fila.file_path) };
};

// EL OTRO CAMINO DEL PAPEL: el acto se produjo y se firmó aquí, y se ENLAZA a ese documento (frente
// 27, F27.P4.T24). El enlace lo escribe el dominio de tareas, dueño de la tabla; aquí está la regla,
// que es del acto: uno de los dos papeles y nunca los dos, y desenlazar sólo mientras el acto no
// ordena nada —la base rechaza lo demás, y esto lo dice antes—.
export const buscarDocumentosParaUnActo = (texto, { connection = getPostgresPool() } = {}) =>
  buscarDocumentosFirmados(connection, texto);

export const enlazarDocumentoFirmado = async ({ actoId, documentVersionId }) =>
  conTransaccion(async (conexion) => {
    const acto = await leerActoParaAdjuntar(conexion, actoId);
    if (!acto) throw notFound("Ese acto no existe.");
    if (acto.tieneDocumentoFirmado) throw conflicto(`El acto «${acto.numero}» ya tiene enlazado un documento firmado.`);
    if (await leerAdjuntoDelActo(conexion, actoId)) {
      throw conflicto(`El acto «${acto.numero}» ya tiene un fichero adjunto: quítalo antes de enlazarle el documento firmado en el sistema.`);
    }
    if (!Number(documentVersionId)) throw badRequest("Hay que decir qué documento se enlaza.");
    await enlazarDocumentoAlActo(conexion, actoId, documentVersionId);
    return { acto_id: Number(actoId), document_version_id: Number(documentVersionId) };
  });

export const desenlazarDocumentoFirmado = async ({ actoId }) =>
  conTransaccion(async (conexion) => {
    const acto = await leerActoParaAdjuntar(conexion, actoId);
    if (!acto) throw notFound("Ese acto no existe.");
    if (!acto.tieneDocumentoFirmado) throw notFound("Ese acto no tiene enlazado ningún documento firmado.");
    if (acto.ordenaAlgo) {
      throw conflicto(`El acto «${acto.numero}» ya ordena cambios de la estructura: su documento firmado no se desenlaza.`);
    }
    await desenlazarDocumentoDelActo(conexion, actoId);
    return { acto_id: Number(actoId), desenlazado: true };
  });

// LAS VIDAS DE UNA CLASE DE NODO CON SU NOMBRE, para etiquetar una referencia a una vida.
export const listarVidasDeLaClase = (clase, { connection = getPostgresPool() } = {}) => {
  if (!CLASES_CON_VIDAS.includes(clase)) throw badRequest("Esa no es una clase de nodo con vidas.");
  return listarVidasConNombre(connection, clase);
};

// LOS ACTOS DE UN NODO, para su modal: los que cita una `unidad` o un `proceso`, con su documento.
export const listarActosDelNodo = (clase, nodoId, { connection = getPostgresPool() } = {}) =>
  listarActosDeUnNodo(connection, clase, nodoId);

// Y para el mapa: añade a cada nodo cuántos de los actos que cita siguen sin documento.
export const conSusActosSinDocumento = async (clase, nodos, { connection = getPostgresPool() } = {}) => {
  const cuenta = await contarActosSinDocumentoPorNodo(connection, clase);
  return nodos.map((nodo) => ({ ...nodo, actos_sin_documento: cuenta.get(Number(nodo.id)) ?? 0 }));
};
