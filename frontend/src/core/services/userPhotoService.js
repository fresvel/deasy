// Carga de fotos de perfil a traves del endpoint autenticado del backend.
//
// El avatar se descarga con la sesion del usuario y se expone como object URL,
// igual que los PDFs del dossier: no hay ninguna URL publica que sirva la imagen.
import axios from "@/core/services/httpClient";
import { API_ROUTES } from "@/core/config/apiConfig";

export const DEFAULT_USER_PHOTO = "/images/avatar.png";

// personId -> { key, objectUrl }. La clave incluye la referencia y el updatedAt para
// que una foto nueva invalide la anterior sin recargar la aplicacion.
//
// Antes la cache y la URL iban por CEDULA. El endpoint pasó a `/users/:personId/photo` el
// 2026-08-29: lo que la ruta resolvia era el numero del documento principal, y un pasaporte cambia
// de numero al renovarse — la direccion de la foto de una persona cambiaba con su documento.
const photoCache = new Map();

const photoValueOf = (user) => user?.photoUrl ?? user?.photo_url ?? user?.photo ?? null;

const cacheKeyOf = (user) => `${photoValueOf(user) ?? ""}|${user?.updatedAt ?? user?.updated_at ?? ""}`;

export const invalidateUserPhoto = (personId) => {
  const key = String(personId ?? "").trim();
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

  // `id` en el objeto publico del backend, `_id` en el que devuelve el login.
  const personId = String(user?.id ?? user?._id ?? "").trim();
  if (!personId) {
    return DEFAULT_USER_PHOTO;
  }

  const key = cacheKeyOf(user);
  const cached = photoCache.get(personId);
  if (cached?.key === key) {
    return cached.objectUrl;
  }

  try {
    const { data } = await axios.get(`${API_ROUTES.USERS}/${encodeURIComponent(personId)}/photo`, {
      responseType: "blob"
    });
    const objectUrl = URL.createObjectURL(data);
    if (cached?.objectUrl) {
      URL.revokeObjectURL(cached.objectUrl);
    }
    photoCache.set(personId, { key, objectUrl });
    return objectUrl;
  } catch (error) {
    // 404 = el usuario no tiene foto o la referencia quedo colgada: avatar por defecto.
    if (error?.response?.status !== 404) {
      console.error("No se pudo cargar la foto de perfil:", error);
    }
    return DEFAULT_USER_PHOTO;
  }
};
