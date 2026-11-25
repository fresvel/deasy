// La referencia canonica a un objeto de MinIO: `minio://<bucket>/<objeto>`.
//
// POR QUE NO SE GUARDA UNA URL. Una URL publica lleva dentro el endpoint del entorno
// (`MINIO_PUBLIC_ENDPOINT`), asi que mover la pila, cambiar de dominio o publicar detras de otro
// proxy invalida TODAS las filas que la guardaron. La referencia solo dice bucket y objeto; la URL
// —si hace falta— se compone al leer. El expediente si guarda URL completa (`url_documento`) y es
// justo el ejemplo de lo que no hay que repetir.
//
// Estas dos funciones vivian en `users/profilePhotoStorage.js` con nombre de foto
// (`parsePhotoReference`). Se movieron aqui el 2026-08-27, sin tocar su comportamiento, cuando el
// escaneo del documento de identidad necesito la misma convencion. Ese modulo las reexporta.

const MINIO_SCHEME = "minio://";

export const buildMinioReference = (bucket, objectName) =>
  `${MINIO_SCHEME}${bucket}/${String(objectName || "").replace(/^\/+/, "")}`;

// Devuelve { bucket, objectName } o null si el valor esta vacio o no es una referencia valida (un
// fichero ilegible acaba en 404, no en una excepcion).
export const parseMinioReference = (rawValue) => {
  const value = String(rawValue ?? "").trim();
  if (!value.startsWith(MINIO_SCHEME)) {
    return null;
  }
  // Sin normalizar barras iniciales: "minio:///obj" no tiene bucket y no debe reinterpretarse como
  // si el primer segmento del objeto lo fuera.
  const withoutScheme = value.slice(MINIO_SCHEME.length);
  const separatorIndex = withoutScheme.indexOf("/");
  if (separatorIndex <= 0) {
    return null;
  }
  const bucket = withoutScheme.slice(0, separatorIndex);
  const objectName = withoutScheme.slice(separatorIndex + 1).replace(/^\/+/, "");
  if (!bucket || !objectName) {
    return null;
  }
  return { bucket, objectName };
};

export { MINIO_SCHEME };
