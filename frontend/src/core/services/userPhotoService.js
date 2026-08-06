// Carga de fotos de perfil a traves del endpoint autenticado del backend.
//
// El avatar se descarga con la sesion del usuario y se expone como object URL,
// igual que los PDFs del dossier: no hay ninguna URL publica que sirva la imagen.
import axios from "@/core/services/httpClient";
import { API_ROUTES } from "@/core/config/apiConfig";

export const DEFAULT_USER_PHOTO = "/images/avatar.png";

// cedula -> { key, objectUrl }. La clave incluye la referencia y el updatedAt para
// que una foto nueva invalide la anterior sin recargar la aplicacion.
const photoCache = new Map();

const photoValueOf = (user) => user?.photoUrl ?? user?.photo_url ?? user?.photo ?? null;

const cacheKeyOf = (user) => `${photoValueOf(user) ?? ""}|${user?.updatedAt ?? user?.updated_at ?? ""}`;

export const invalidateUserPhoto = (cedula) => {
  const key = String(cedula ?? "").trim();
  const cached = photoCache.get(key);
  if (cached?.objectUrl) {
    URL.revokeObjectURL(cached.objectUrl);
  }
  photoCache.delete(key);
};

export const resolveUserPhotoUrl = async (user) => {
  if (!photoValueOf(user)) {
    return DEFAULT_USER_PHOTO;
  }

  const cedula = String(user?.cedula ?? "").trim();
  if (!cedula) {
    return DEFAULT_USER_PHOTO;
  }

  const key = cacheKeyOf(user);
  const cached = photoCache.get(cedula);
  if (cached?.key === key) {
    return cached.objectUrl;
  }

  try {
    const { data } = await axios.get(`${API_ROUTES.USERS}/${encodeURIComponent(cedula)}/photo`, {
      responseType: "blob"
    });
    const objectUrl = URL.createObjectURL(data);
    if (cached?.objectUrl) {
      URL.revokeObjectURL(cached.objectUrl);
    }
    photoCache.set(cedula, { key, objectUrl });
    return objectUrl;
  } catch (error) {
    // 404 = el usuario no tiene foto o la referencia quedo colgada: avatar por defecto.
    if (error?.response?.status !== 404) {
      console.error("No se pudo cargar la foto de perfil:", error);
    }
    return DEFAULT_USER_PHOTO;
  }
};
