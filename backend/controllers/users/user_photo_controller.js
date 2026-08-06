// Entrega de fotos de perfil. Sustituye al express.static("/uploads") publico:
// aqui la lectura exige sesion valida y el fichero nunca se expone por ruta directa.
//
// Politica: cualquier usuario autenticado y activo puede ver el avatar de otro
// (aparecen en listados de procesos, chat y firmas). Lo que se cierra es el acceso
// anonimo, no el acceso entre companeros.
import UserRepository from "../../services/auth/UserRepository.js";
import { openProfilePhoto } from "../../services/users/profilePhotoStorage.js";

const userRepository = new UserRepository();

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
