import DocumentosLegales from "../../services/legal/DocumentosLegales.js";

const documentos = new DocumentosLegales();

/**
 * La administración de los textos legales.
 *
 * ⚠️ **ESTO ES TRANSPORTE Y NADA MÁS.** Valida la entrada, llama a UN método del servicio y traduce
 * el resultado a HTTP. Publicar es una operación con consecuencias irreversibles —copia a un bucket
 * con retención COMPLIANCE, relee por versión de objeto y compara la huella— y toda esa secuencia
 * vive en `DocumentosLegales.publicar()`. Si alguna vez aparece aquí una transacción o un `if` sobre
 * el estado del documento, es que la lógica se está escapando de su sitio.
 */

// Los nombres de la base son `snake_case` y los de la API `camelCase`. La traducción se hace en un
// solo sitio para que no haya dos formas del mismo documento circulando por el frontend.
const comoRespuesta = (fila) => ({
  id: fila.id,
  clase: fila.clase,
  version: fila.version,
  estado: fila.estado,
  contenidoHash: fila.contenido_hash,
  bucket: fila.bucket,
  objectKey: fila.object_key,
  objectVersionId: fila.object_version_id,
  publicadoAt: fila.publicado_at,
  createdAt: fila.created_at,
});

// Un error de negocio trae su `statusCode` (ver `errors/HttpError.js`); lo que no lo trae es un
// fallo de verdad y se responde 500 sin enseñar el mensaje interno.
const fallar = (res, error, contexto) => {
  const estado = error?.statusCode ?? 500;
  if (estado >= 500) {
    console.error(`${contexto}:`, error?.message);
    return res.status(500).json({ message: "No se pudo completar la operacion sobre el documento legal." });
  }
  return res.status(estado).json({ message: error.message });
};

export const listarDocumentos = async (_req, res) => {
  try {
    const filas = await documentos.todos();
    return res.json({ documentos: filas.map(comoRespuesta) });
  } catch (error) {
    return fallar(res, error, "No se pudieron listar los documentos legales");
  }
};

/** Uno solo, CON su texto: es lo que carga el editor. */
export const verDocumento = async (req, res) => {
  try {
    const fila = await documentos.obtener(req.params.id);
    const texto = await documentos.leerTexto(fila.id);
    return res.json({ documento: { ...comoRespuesta(fila), texto } });
  } catch (error) {
    return fallar(res, error, "No se pudo leer el documento legal");
  }
};

export const crearBorrador = async (req, res) => {
  const clase = String(req.body?.clase ?? "").trim();
  const version = String(req.body?.version ?? "").trim();
  if (!clase || !version) {
    return res.status(400).json({ message: "Hacen falta la clase y la version del documento." });
  }
  try {
    const fila = await documentos.crearBorrador(clase, version);
    return res.status(201).json({ documento: comoRespuesta(fila) });
  } catch (error) {
    return fallar(res, error, "No se pudo crear el borrador legal");
  }
};

export const guardarBorrador = async (req, res) => {
  // Cadena vacía SÍ se admite: vaciar un borrador es una edición legítima. Lo que no se admite es
  // que no venga el campo, que es un cliente mal escrito y no una intención.
  if (typeof req.body?.texto !== "string") {
    return res.status(400).json({ message: "Falta el texto del documento." });
  }
  try {
    const fila = await documentos.guardarBorrador(req.params.id, req.body.texto);
    return res.json({ documento: comoRespuesta(fila) });
  } catch (error) {
    return fallar(res, error, "No se pudo guardar el borrador legal");
  }
};

/**
 * ⚠️ **IRREVERSIBLE, y el frontend tiene que decirlo antes de llamar aquí.** A partir de este clic
 * el texto queda en un bucket con retención COMPLIANCE: no lo borra nadie hasta que venza el plazo.
 */
export const publicarDocumento = async (req, res) => {
  try {
    const fila = await documentos.publicar(req.params.id);
    return res.json({ documento: comoRespuesta(fila) });
  } catch (error) {
    return fallar(res, error, "No se pudo publicar el documento legal");
  }
};

export const retirarDocumento = async (req, res) => {
  try {
    const fila = await documentos.retirar(req.params.id);
    return res.json({ documento: comoRespuesta(fila) });
  } catch (error) {
    return fallar(res, error, "No se pudo retirar el documento legal");
  }
};

export const historialDeDocumento = async (req, res) => {
  try {
    return res.json({ historial: await documentos.historial(req.params.id) });
  } catch (error) {
    return fallar(res, error, "No se pudo leer el historial del borrador legal");
  }
};

/**
 * El estado del archivo, leído DEL BUCKET y no de la configuración.
 *
 * Se enseña de solo lectura porque no hay nada que editar: el bloqueo se concede al crear el bucket
 * y no se puede añadir después. Que la pantalla lo muestre sirve para responder «¿esto es de verdad
 * inmutable?» sin abrir una terminal.
 */
export const estadoDelArchivo = async (_req, res) => {
  try {
    return res.json(await documentos.estadoDelArchivo());
  } catch (error) {
    return fallar(res, error, "No se pudo leer el estado del archivo legal");
  }
};
