// Subida y entrega del PDF del documento de identidad escaneado.
//
// ⚠️ POLITICA MAS ESTRICTA QUE LA DE LA FOTO. El avatar lo puede ver cualquier compañero con sesion
// —aparece en listados, chat y firmas—; un documento de identidad escaneado NO. Aqui la lectura
// exige ser el dueño o tener rol elevado, y lo impone la ruta con `requirePersonAccess`.
//
// El fichero nunca se expone por URL directa: se transmite por este handler, igual que la foto.
import UserRepository from "../../services/auth/UserRepository.js";
import DocumentoIdentidadService from "../../services/users/DocumentoIdentidadService.js";
import {
  limpiarTemporal,
  openEscaneo,
  removeEscaneo,
  storeEscaneo
} from "../../services/users/documentoEscaneoStorage.js";

let _userRepository = null;
const userRepository = () => (_userRepository ??= new UserRepository());
let _documentos = null;
const documentos = () => (_documentos ??= new DocumentoIdentidadService());

// Resuelve el documento PRINCIPAL de la persona identificada en la ruta por su ID. Se usa el
// principal y no un id de documento suelto para que la URL no permita apuntar al documento de otro.
const resolverDocumento = async (personId) => {
  const id = Number(personId);
  if (!Number.isInteger(id) || id <= 0) return { error: 400, message: "Se requiere el id de la persona." };
  const persona = await userRepository().findById(id);
  if (!persona) return { error: 404, message: "Usuario no encontrado." };
  const documento = await documentos().principalDe(persona.id ?? persona._id);
  if (!documento) return { error: 404, message: "La persona no tiene un documento de identidad registrado." };
  return { documento };
};

export const subirEscaneoDocumento = async (req, res) => {
  const temporal = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Debe adjuntar el PDF en el campo 'escaneo'." });
    }
    const { documento, error, message } = await resolverDocumento(req.params?.personId);
    if (error) return res.status(error).json({ message });

    const { reference } = await storeEscaneo({
      personId: documento.person_id,
      documentoId: documento.id,
      filePath: req.file.path,
      mimetype: req.file.mimetype
    });
    // El anterior se borra DESPUES de dejar registrado el nuevo, y sin bloquear: perder el objeto
    // viejo es menos grave que dejar el registro apuntando a algo que ya no esta.
    const anterior = await documentos().registrarEscaneoConRastro({
      documento,
      referencia: reference,
      actorId: req.auth?.userId ?? req.user?.uid,
      ip: req.ip ?? null
    });
    if (anterior && anterior !== reference) {
      await removeEscaneo(anterior);
    }

    res.json({ result: "ok", documento_id: documento.id, tiene_escaneo: true });
  } catch (error) {
    if (error?.status === 400) {
      return res.status(400).json({ message: error.message });
    }
    console.error("Error subiendo el escaneo del documento:", error);
    res.status(500).json({ message: "No se pudo subir el escaneo del documento." });
  } finally {
    await limpiarTemporal(temporal);
  }
};

export const descargarEscaneoDocumento = async (req, res) => {
  try {
    const { documento, error, message } = await resolverDocumento(req.params?.personId);
    if (error) return res.status(error).json({ message });

    // Si lo baja un tercero, queda apuntado ANTES de abrirlo: si la bitacora falla, no sale nada.
    if (documento.escaneo_ref) {
      await documentos().registrarLecturaDeEscaneo({
        documento,
        actorId: req.auth?.userId ?? req.user?.uid,
        ip: req.ip ?? null
      });
    }
    const abierto = await openEscaneo(documento.escaneo_ref);
    if (!abierto) {
      return res.status(404).json({ message: "Este documento no tiene un escaneo subido." });
    }
    res.setHeader("Content-Type", abierto.contentType);
    res.setHeader("Content-Disposition", `inline; filename="documento-${documento.id}.pdf"`);
    abierto.stream.pipe(res);
  } catch (error) {
    console.error("Error entregando el escaneo del documento:", error);
    res.status(500).json({ message: "No se pudo entregar el escaneo del documento." });
  }
};
