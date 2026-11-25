// EL ÚNICO SITIO DONDE SE CONSTRUYE EL CLIENTE S3 DEL BACKEND.
//
// Hasta el 2026-11-25 lo construían cuatro ficheros, cada uno con su copia de estas líneas, y sólo
// uno llevaba el ajuste del Content-MD5 de abajo. Cambiar de librería cliente, o de forma de
// firmar, es ahora tocar este fichero.
//
// La librería es `minio` (npm, Apache-2.0): un cliente S3 genérico que conserva el nombre de su
// autor. El servidor es Versity Gateway.
import * as Minio from "minio";

/** Lee el entorno AL LLAMAR, no al cargar: un test puede fijar las variables antes de pedirlo. */
export const crearClienteAlmacen = (entorno = process.env) => {
  const url = new URL(entorno.ALMACEN_ENDPOINT || "http://almacen:9000");
  const useSSL = String(entorno.ALMACEN_USE_SSL || "").trim() === "1" || url.protocol === "https:";
  const cliente = new Minio.Client({
    endPoint: url.hostname,
    port: Number(url.port || (useSSL ? 443 : 80)),
    useSSL,
    accessKey: entorno.ALMACEN_ACCESS_KEY || entorno.ALMACEN_ROOT_USER || "",
    secretKey: entorno.ALMACEN_SECRET_KEY || entorno.ALMACEN_ROOT_PASSWORD || "",
  });
  // ⚠️ ESTA LÍNEA NO ES UN AJUSTE: SIN ELLA NO SE ARCHIVA NADA. Versity, como S3 y al revés que
  // MinIO, RECHAZA un PUT a un bucket con retención por defecto si no trae Content-MD5 o
  // x-amz-checksum-* («Content-MD5 OR x-amz-checksum- HTTP header is required for Put Object
  // requests with Object Lock parameters»). minio-js 8.0.7 sólo manda Content-MD5 cuando NO firma
  // el cuerpo con SHA-256, que es lo que hace por sí solo bajo TLS; por HTTP plano hay que
  // pedírselo, y putObject no deja pasar esa cabecera por sus metadatos (la prefija con
  // x-amz-meta-). Medido en F29.P1.T2: sin esto, el sembrado del archivo legal muere.
  // Vale para todos los buckets, no sólo el legal: así uno nuevo con bloqueo no depende de que
  // alguien se acuerde.
  cliente.enableSHA256 = false;
  return cliente;
};

let _compartido = null;
/** El cliente compartido del proceso, construido al primer uso. */
export const clienteAlmacen = () => (_compartido ??= crearClienteAlmacen());
