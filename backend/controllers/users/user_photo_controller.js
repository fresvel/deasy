// Entrega de fotos de perfil. Sustituye al express.static("/uploads") publico:
// aqui la lectura exige sesion valida y el fichero nunca se expone por ruta directa.
//
// Politica: cualquier usuario autenticado y activo puede ver el avatar de otro
// (aparecen en listados de procesos, chat y firmas). Lo que se cierra es el acceso
// anonimo, no el acceso entre companeros.
import fs from "fs-extra";
import UserRepository from "../../services/auth/UserRepository.js";
import {
  openProfilePhoto,
  removeStoredPhoto,
  storeProfilePhoto
} from "../../services/users/profilePhotoStorage.js";

const userRepository = new UserRepository();

// Sube la foto a MinIO y deja en persons.photo_url la referencia minio://.
// La foto anterior se borra a posteriori y sin bloquear: perder el objeto viejo es
// menos grave que dejar al usuario sin la foto nueva.
export const updateUserPhoto = async (req, res) => {
  const tempFilePath = req.file?.path;

  try {
    if (!req.file) {
      return res.status(400).send({ message: "Debe adjuntar la foto en el campo 'photo'." });
    }

    const cedula = String(req.params?.cedula || "").trim();
    const existingUser = await userRepository.findByCedulaOrEmail({ cedula });
    if (!existingUser) {
      return res.status(404).send({ message: "Usuario no encontrado" });
    }

    const stored = await storeProfilePhoto({ cedula, filePath: req.file.path });
    const updatedUser = await userRepository.updatePhotoByCedula(cedula, stored.reference);
    await removeStoredPhoto(existingUser.photo_url);

    res.json({ result: "ok", user: updatedUser });
  } catch (error) {
    if (error?.code === "UNSUPPORTED_IMAGE") {
      return res.status(400).send({ message: error.message });
    }
    console.error("Error actualizando foto de usuario", error);
    res.status(500).send({ message: "Error al actualizar la foto", error: error.message });
  } finally {
    if (tempFilePath) {
      await fs.remove(tempFilePath).catch(() => {});
    }
  }
};

export const getUserPhoto = async (req, res) => {
  const cedula = String(req.params?.cedula || "").trim();
  if (!cedula) {
    return res.status(400).json({ message: "Se requiere la cédula del usuario." });
  }

  try {
    const user = await userRepository.findByCedulaOrEmail({ cedula });
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const photo = await openProfilePhoto(user.photo_url);
    if (!photo) {
      return res.status(404).json({ message: "El usuario no tiene foto de perfil." });
    }

    if (photo.etag && req.headers["if-none-match"] === photo.etag) {
      photo.stream.destroy?.();
      return res.status(304).end();
    }

    res.setHeader("Content-Type", photo.contentType);
    res.setHeader("Cache-Control", "private, max-age=300");
    if (photo.size != null) {
      res.setHeader("Content-Length", photo.size);
    }
    if (photo.etag) {
      res.setHeader("ETag", photo.etag);
    }
    if (photo.lastModified) {
      res.setHeader("Last-Modified", new Date(photo.lastModified).toUTCString());
    }

    photo.stream.on("error", (streamError) => {
      console.error("Error leyendo la foto de perfil:", streamError);
      if (!res.headersSent) {
        res.status(500).json({ message: "No se pudo leer la foto de perfil." });
        return;
      }
      res.destroy(streamError);
    });

    photo.stream.pipe(res);
  } catch (error) {
    console.error("Error obteniendo la foto de perfil:", error);
    res.status(500).json({ message: "No se pudo obtener la foto de perfil." });
  }
};
