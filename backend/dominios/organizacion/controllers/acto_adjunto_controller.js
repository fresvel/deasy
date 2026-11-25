// EL FICHERO DE UN ACTO EXTERNO, POR HTTP (frente 27, F27.P4.T11). Sólo traduce: la regla está en el
// servicio. Las dos rutas de corrección exigen el permiso de correcciones; por eso son ellas —y no
// el cuerpo de la petición— las que dicen `comoCorreccion`.
import {
  abrirAdjuntoDelActo,
  adjuntarAlActo,
  buscarDocumentosParaUnActo,
  desenlazarDocumentoFirmado,
  enlazarDocumentoFirmado,
  listarActosYSuDocumento,
  listarVidasDeLaClase,
  quitarAdjuntoDelActo
} from "../services/actoAdjuntos.js";

const responder = (res, error) => res.status(error.statusCode || 400).json({ message: error.message });
const actor = (req) => Number(req.auth?.userId) || null;

// Las vidas de una clase de nodo —unidad, puesto o proceso— con el nombre de su nodo.
export const listarVidasConSuNodo = async (req, res) => {
  try {
    res.json(await listarVidasDeLaClase(req.params.clase));
  } catch (error) {
    responder(res, error);
  }
};

// El documento firmado en el sistema: buscarlo, enlazarlo a un acto y desenlazarlo.
export const buscarDocumentosFirmadosParaActo = async (req, res) => {
  try {
    res.json(await buscarDocumentosParaUnActo(req.query.q));
  } catch (error) {
    responder(res, error);
  }
};
export const enlazarDocumentoDelActo = async (req, res) => {
  try {
    res.json(await enlazarDocumentoFirmado({ actoId: req.params.id, documentVersionId: req.body?.document_version_id }));
  } catch (error) {
    responder(res, error);
  }
};
export const desenlazarDocumentoDeActo = async (req, res) => {
  try {
    res.json(await desenlazarDocumentoFirmado({ actoId: req.params.id }));
  } catch (error) {
    responder(res, error);
  }
};

export const listarActosDocumentos = async (req, res) => {
  try {
    res.json(await listarActosYSuDocumento({ soloSinDocumento: req.query.sin_documento === "1" }));
  } catch (error) {
    responder(res, error);
  }
};

// El nombre del fichero llega en latin1 —así lo entrega quien parte el formulario—, y un nombre con
// tildes («Resolución 014.pdf») salía estropeado. Se recompone aquí, que es cosa del transporte.
const conNombreLegible = (archivo) =>
  archivo ? { ...archivo, originalname: Buffer.from(String(archivo.originalname || ""), "latin1").toString("utf8") } : archivo;

const adjuntar = (comoCorreccion) => async (req, res) => {
  try {
    res.json(await adjuntarAlActo({
      actoId: req.params.id,
      archivo: conNombreLegible(req.file),
      actorId: actor(req),
      motivo: req.body?.motivo,
      comoCorreccion
    }));
  } catch (error) {
    responder(res, error);
  }
};
export const adjuntarFicheroAlActo = adjuntar(false);
export const corregirFicheroDelActo = adjuntar(true);

const quitar = (comoCorreccion) => async (req, res) => {
  try {
    res.json(await quitarAdjuntoDelActo({ actoId: req.params.id, actorId: actor(req), motivo: req.body?.motivo, comoCorreccion }));
  } catch (error) {
    responder(res, error);
  }
};
export const quitarFicheroDelActo = quitar(false);
export const quitarFicheroDelActoComoCorreccion = quitar(true);

export const descargarFicheroDelActo = async (req, res) => {
  try {
    const { nombre, tipo, bytes, flujo } = await abrirAdjuntoDelActo(req.params.id);
    res.setHeader("Content-Type", tipo);
    res.setHeader("Content-Length", String(bytes));
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(nombre)}`);
    flujo.on("error", () => res.destroy());
    flujo.pipe(res);
  } catch (error) {
    responder(res, error);
  }
};
