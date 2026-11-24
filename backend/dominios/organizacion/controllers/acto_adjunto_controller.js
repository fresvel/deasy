// EL FICHERO DE UN ACTO EXTERNO, POR HTTP (frente 27, F27.P4.T11). Sólo traduce: la regla está en el
// servicio. Las dos rutas de corrección exigen el permiso de correcciones; por eso son ellas —y no
// el cuerpo de la petición— las que dicen `comoCorreccion`.
import {
  abrirAdjuntoDelActo,
  adjuntarAlActo,
  listarActosYSuDocumento,
  quitarAdjuntoDelActo
} from "../services/actoAdjuntos.js";

const responder = (res, error) => res.status(error.statusCode || 400).json({ message: error.message });
const actor = (req) => Number(req.auth?.userId) || null;

export const listarActosDocumentos = async (req, res) => {
  try {
    res.json(await listarActosYSuDocumento({ soloSinDocumento: req.query.sin_documento === "1" }));
  } catch (error) {
    responder(res, error);
  }
};

const adjuntar = (comoCorreccion) => async (req, res) => {
  try {
    res.json(await adjuntarAlActo({
      actoId: req.params.id,
      archivo: req.file,
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
