import * as Minio from "minio";

import { huellaDe } from "./huella.js";

/**
 * DÓNDE VIVE EL TEXTO LEGAL: dos buckets de MinIO, y no la base de datos.
 *
 * ── POR QUÉ SALE DE LA BASE ─────────────────────────────────────────────────────────────────────
 *
 * El Art. 5 del Reglamento de la LOPDP exige poder **DEMOSTRAR** el consentimiento, y demostrarlo
 * incluye demostrar **qué decía el texto**. Una columna `TEXT` no demuestra nada: quien puede
 * escribir en la base puede reescribir el texto y recalcular la huella en la misma sentencia, y no
 * queda rastro. El archivo con bloqueo de objetos sí: una vez escrito, **ni el administrador del
 * sistema puede borrarlo ni alterarlo** hasta que venza la retención.
 *
 * ── LOS DOS BUCKETS, Y POR QUÉ SON DOS ──────────────────────────────────────────────────────────
 *
 *   `deasy-legal-borradores`  versionado, SIN bloqueo. Es donde se escribe mientras el documento es
 *                             borrador. Cada guardado deja una versión de objeto: ése, y no otro, es
 *                             el historial de edición.
 *   `deasy-legal`             versionado + Object Lock con retención COMPLIANCE por defecto. Aquí
 *                             solo entra lo que se publica, y entra para quedarse.
 *
 * Si fuera un solo bucket con bloqueo, **cada pulsación de «guardar» quedaría inmutable durante diez
 * años**: una errata de borrador sería tan permanente como el texto aprobado. Separarlos es lo que
 * permite editar sin miedo y publicar con consecuencias.
 *
 * ── CUATRO COSAS MEDIDAS QUE NO SON EVIDENTES ───────────────────────────────────────────────────
 *
 * 1. Un bucket con Object Lock admite objetos **sin bloquear** si no hay retención por defecto. El
 *    bloqueo del bucket es la CAPACIDAD; la retención por defecto es lo que la aplica.
 * 2. Con retención por defecto, **todo `put` sale bloqueado sin pedirlo**. Por eso aquí no se llama
 *    a `putObjectRetention` en ninguna parte: sería redundante y daría la falsa impresión de que sin
 *    esa llamada el objeto queda suelto.
 * 3. ⚠️ **EL WORM PROTEGE LA VERSIÓN, NO LA CLAVE.** Un objeto bloqueado **se puede sobrescribir**:
 *    la versión vieja sobrevive intacta, pero quien lea «el objeto en esa clave» recibe lo nuevo.
 *    Por eso aquí **se lee SIEMPRE por `objectVersionId` y JAMÁS por clave** — leer por clave sería
 *    tener el archivo inmutable y no usarlo.
 * 4. ⚠️ **El bloqueo es de CREACIÓN e IRREVERSIBLE.** A un bucket creado sin `--with-lock` no se le
 *    puede añadir después (MinIO responde `does not support locking`). De ahí que `asegurarBuckets`
 *    LANCE en vez de seguir: usar un bucket sin bloqueo «mientras tanto» produciría un archivo que
 *    parece prueba y no lo es.
 */

const BUCKET_ARCHIVO_POR_DEFECTO = "deasy-legal";
const BUCKET_BORRADORES_POR_DEFECTO = "deasy-legal-borradores";
const DIAS_POR_DEFECTO = 1; // dev; producción pone 3650 en su .env
const MODO_POR_DEFECTO = "COMPLIANCE";

const TIPO_MARKDOWN = "text/markdown; charset=utf-8";

// Un segmento de clave se compone con datos que llegan del administrador. Sin esta reja, una clase
// llamada `../../otra-cosa` escribiría fuera de su sitio.
const SEGMENTO_VALIDO = /^[a-z0-9][a-z0-9_.-]*$/i;

/** `terminos_de_uso` + `v2` → `terminos_de_uso/v2.md`. */
export const claveDe = (clase, version) => {
  if (!SEGMENTO_VALIDO.test(String(clase ?? "")) || !SEGMENTO_VALIDO.test(String(version ?? ""))) {
    throw new Error(`Clase o version no validas para una clave de objeto: '${clase}' / '${version}'.`);
  }
  return `${clase}/${version}.md`;
};

const aBuffer = (contenido) =>
  (Buffer.isBuffer(contenido) ? contenido : Buffer.from(String(contenido ?? ""), "utf8"));

const juntarStream = (stream) => new Promise((resolve, reject) => {
  const trozos = [];
  stream.on("data", (trozo) => trozos.push(trozo));
  stream.on("error", reject);
  stream.on("end", () => resolve(Buffer.concat(trozos)));
});

const clienteDeEntorno = () => {
  const url = new URL(process.env.MINIO_ENDPOINT || "http://minio:9000");
  const useSSL = String(process.env.MINIO_USE_SSL || "").trim() === "1" || url.protocol === "https:";
  return new Minio.Client({
    endPoint: url.hostname,
    port: Number(url.port || (useSSL ? 443 : 80)),
    useSSL,
    accessKey: process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || "",
    secretKey: process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || "",
  });
};

export default class ArchivoLegal {
  /**
   * El cliente se inyecta para poder probar las garantías sin levantar un MinIO. Todo lo demás sale
   * del entorno, con los mismos valores por defecto que documenta `.env_model`.
   */
  constructor({ cliente = null, bucket = null, bucketBorradores = null, dias = null, modo = null } = {}) {
    this.cliente = cliente;
    this.bucket = bucket || process.env.MINIO_LEGAL_BUCKET || BUCKET_ARCHIVO_POR_DEFECTO;
    this.bucketBorradores =
      bucketBorradores || process.env.MINIO_LEGAL_DRAFTS_BUCKET || BUCKET_BORRADORES_POR_DEFECTO;
    this.dias = Number(dias ?? process.env.MINIO_LEGAL_RETENTION_DAYS ?? DIAS_POR_DEFECTO);
    this.modo = String(modo || process.env.MINIO_LEGAL_RETENTION_MODE || MODO_POR_DEFECTO).toUpperCase();
  }

  #minio() {
    if (!this.cliente) {
      this.cliente = clienteDeEntorno();
    }
    return this.cliente;
  }

  /**
   * La configuración de bloqueo de un bucket, o `null` si NO lo tiene.
   *
   * MinIO responde con error a `getObjectLockConfig` cuando el bucket se creó sin bloqueo, así que
   * «no hay configuración» llega como excepción y no como respuesta vacía. Se traduce a `null` aquí
   * para que quien pregunta no tenga que distinguir.
   *
   * ⚠️ **ESTA, Y NO CREAR EL BUCKET, ES LA COMPROBACIÓN.** Medido contra MinIO: pedir la creación
   * con bloqueo sobre un bucket **que ya existe sin él** responde «Bucket created successfully» y
   * sale con código 0 (`mc mb --with-lock --ignore-existing`), sin bloquear nada. Quien deduzca «no
   * lanzó, luego está bloqueado» **no detecta nada** y deja un archivo legal sin bloqueo, en
   * silencio y para siempre. Hay que PREGUNTARLE al bucket por su retención.
   */
  async #bloqueoDe(bucket) {
    try {
      const conf = await this.#minio().getObjectLockConfig(bucket);
      if (String(conf?.objectLockEnabled ?? "").toLowerCase() !== "enabled") {
        return null;
      }
      return conf;
    } catch {
      return null;
    }
  }

  /**
   * Crea los dos buckets si faltan y deja el de archivo con su retención por defecto.
   *
   * ⚠️ **FAIL-CLOSED**: si el bucket de archivo YA EXISTE y no tiene bloqueo, esto LANZA. No se
   * puede arreglar sobre la marcha —el bloqueo solo se concede al crear el bucket— y seguir con él
   * produciría un archivo que parece prueba sin serlo, que es peor que no tener archivo.
   */
  async asegurarBuckets() {
    const minio = this.#minio();

    // El de borradores es un bucket corriente. Lo único que se le exige es versionado: sin él,
    // guardar dos veces pierde lo anterior y el historial de edición no existe.
    if (!(await minio.bucketExists(this.bucketBorradores))) {
      await minio.makeBucket(this.bucketBorradores, "");
    }
    await minio.setBucketVersioning(this.bucketBorradores, { Status: "Enabled" });

    const existiaArchivo = await minio.bucketExists(this.bucket);
    if (!existiaArchivo) {
      // `ObjectLocking: true` solo se admite AQUÍ, al crear. Es la única oportunidad.
      await minio.makeBucket(this.bucket, "", { ObjectLocking: true });
    }

    const bloqueo = await this.#bloqueoDe(this.bucket);
    if (!bloqueo) {
      throw new Error(
        `El bucket '${this.bucket}' existe SIN bloqueo de objetos y eso NO se puede añadir despues: ` +
        "el Object Lock solo se concede al crear el bucket (MinIO responde 'does not support locking' " +
        "a cualquier intento posterior). Hay que RECREARLO: renombra o vacia y elimina el bucket " +
        "actual y deja que el arranque lo cree de nuevo, o crealo a mano con 'mc mb --with-lock'. " +
        "No se sigue adelante a proposito: un archivo sin bloqueo parece prueba y no lo es."
      );
    }

    // La retención POR DEFECTO es lo que hace que cada `put` salga bloqueado sin pedirlo. Se
    // reafirma en cada arranque para que un cambio de `MINIO_LEGAL_RETENTION_DAYS` surta efecto.
    await minio.setObjectLockConfig(this.bucket, { mode: this.modo, unit: "Days", validity: this.dias });

    return { bucket: this.bucket, bucketBorradores: this.bucketBorradores };
  }

  /** Qué bloqueo tiene el archivo AHORA MISMO, leído del bucket. Es lo que el admin ve, sin editar. */
  async estadoDelArchivo() {
    const bucket = this.bucket;
    try {
      if (!(await this.#minio().bucketExists(bucket))) {
        return { bucket, bloqueado: false, modo: null, dias: null, motivo: "el bucket todavia no existe" };
      }
      const bloqueo = await this.#bloqueoDe(bucket);
      if (!bloqueo) {
        return { bucket, bloqueado: false, modo: null, dias: null, motivo: "el bucket se creo sin bloqueo de objetos" };
      }
      // La retención se puede declarar en años o en días; se enseña siempre en días para no obligar
      // a nadie a convertir mentalmente.
      const dias = bloqueo.unit === "Years" ? Number(bloqueo.validity) * 365 : Number(bloqueo.validity);
      return {
        bucket,
        bloqueado: true,
        modo: bloqueo.mode ?? null,
        dias: Number.isFinite(dias) ? dias : null,
        // Sin retención por defecto el bucket PUEDE bloquear y no bloquea nada. Es un estado real y
        // hay que poder verlo.
        motivo: bloqueo.mode ? null : "el bucket admite bloqueo pero NO tiene retencion por defecto",
      };
    } catch (error) {
      return { bucket, bloqueado: false, modo: null, dias: null, motivo: error.message };
    }
  }

  // ── BORRADORES ────────────────────────────────────────────────────────────────────────────────

  async guardarBorrador(clase, version, texto) {
    const objectKey = claveDe(clase, version);
    const bytes = aBuffer(texto);
    await this.#minio().putObject(this.bucketBorradores, objectKey, bytes, bytes.length, {
      "Content-Type": TIPO_MARKDOWN,
    });
    return { bucket: this.bucketBorradores, objectKey };
  }

  /**
   * Los BYTES del borrador, tal cual están en MinIO.
   *
   * Existe además de `leerBorrador` porque publicar copia bytes: convertirlos a texto y volver a
   * serializarlos es una vuelta de más en la que se pierden cosas (un BOM, un final de línea) sin
   * que nadie lo note hasta que la huella no cuadra.
   */
  async bytesDelBorrador(clase, version) {
    const objectKey = claveDe(clase, version);
    return juntarStream(await this.#minio().getObject(this.bucketBorradores, objectKey));
  }

  async leerBorrador(clase, version) {
    return (await this.bytesDelBorrador(clase, version)).toString("utf8");
  }

  /**
   * El historial de edición del borrador: una entrada por guardado.
   *
   * ⚠️ Son versiones de OBJETO, no versiones de negocio. Cuarenta guardados son cuarenta entradas
   * aquí y **una sola** fila en `documentos_legales`. No se mezclan: la versión de negocio (`v1`,
   * `v2`) es lo que una persona acepta; esto es cómo se llegó a escribirla.
   */
  async historialBorrador(clase, version) {
    const objectKey = claveDe(clase, version);
    const entradas = await new Promise((resolve, reject) => {
      const encontradas = [];
      const flujo = this.#minio().listObjects(this.bucketBorradores, objectKey, false, { IncludeVersion: true });
      flujo.on("data", (item) => {
        // El prefijo puede casar con claves más largas (`v1.md` no, pero `v1` sí casaría con
        // `v10.md` si algún día se lista por prefijo corto). Se filtra por igualdad exacta.
        //
        // ⚠️ Y se descartan los *delete markers*: el listado por versiones los devuelve como una
        // entrada más, de tamaño 0 y sin contenido. Colarlos aquí sería enseñar «un guardado» que
        // nadie hizo — y pedirle el objeto responde «method not allowed», no un texto vacío.
        if (item?.name === objectKey && !item.isDeleteMarker) {
          encontradas.push(item);
        }
      });
      flujo.on("error", reject);
      flujo.on("end", () => resolve(encontradas));
    });

    return entradas
      .map((item) => ({
        objectVersionId: item.versionId ?? null,
        fecha: item.lastModified ?? null,
        tamano: Number(item.size ?? 0),
        esUltima: Boolean(item.isLatest),
      }))
      .sort((a, b) => new Date(b.fecha ?? 0) - new Date(a.fecha ?? 0));
  }

  // ── ARCHIVO ───────────────────────────────────────────────────────────────────────────────────

  /**
   * Escribe en el archivo inmutable y **comprueba lo escrito releyéndolo**.
   *
   * La relectura no es paranoia decorativa: se hace **por `versionId`**, que es la única forma de
   * preguntar por *este* objeto y no por «lo que hoy haya en esa clave». Si la huella de lo releído
   * no coincide con la de lo que se quiso escribir, esto LANZA y quien llama no sella nada — un
   * puntero de la base a un objeto que no contiene lo que dice es peor que no tener puntero.
   */
  async archivar(clase, version, texto) {
    const objectKey = claveDe(clase, version);
    const bytes = aBuffer(texto);
    const hashEsperado = huellaDe(bytes.toString("utf8"));

    const subida = await this.#minio().putObject(this.bucket, objectKey, bytes, bytes.length, {
      "Content-Type": TIPO_MARKDOWN,
    });
    const objectVersionId = subida?.versionId ?? null;
    if (!objectVersionId) {
      throw new Error(
        `MinIO no devolvio un identificador de version al escribir '${objectKey}' en '${this.bucket}'. ` +
        "Sin el, el objeto solo se puede leer por clave, y leer por clave NO es leer lo archivado: " +
        "una escritura posterior sobre la misma clave devolveria otro contenido. Revisa que el bucket " +
        "tenga versionado (se activa solo al crearlo con bloqueo de objetos)."
      );
    }

    const releido = await this.leerArchivado({ bucket: this.bucket, objectKey, objectVersionId });
    const hash = huellaDe(releido);
    if (hash !== hashEsperado) {
      throw new Error(
        `Lo archivado en '${this.bucket}/${objectKey}' (version ${objectVersionId}) NO coincide con lo ` +
        `que se quiso archivar: se esperaba ${hashEsperado} y se leyo ${hash}.`
      );
    }

    return { bucket: this.bucket, objectKey, objectVersionId, hash };
  }

  /**
   * Qué hay en el archivo: la ÚLTIMA versión de cada clave.
   *
   * Sirve para reconstruir el índice cuando la base está vacía y los objetos ya están subidos —el
   * caso de una instalación nueva, donde la semilla entra por MinIO y no por un `INSERT`, porque
   * `object_version_id` no existe hasta DESPUÉS de subir.
   */
  async inventarioDelArchivo() {
    const entradas = await new Promise((resolve, reject) => {
      const encontradas = [];
      const flujo = this.#minio().listObjects(this.bucket, "", true, { IncludeVersion: true });
      flujo.on("data", (item) => encontradas.push(item));
      flujo.on("error", reject);
      flujo.on("end", () => resolve(encontradas));
    });

    return entradas
      // ⚠️ `isDeleteMarker` NO es opcional aquí. Un borrado corriente sobre un objeto bloqueado se
      // acepta y deja una marca que el listado por versiones devuelve como entrada `isLatest` de
      // tamaño 0. Sin este filtro, esa marca se tomaría por un documento y leerla responde «method
      // not allowed» — comprobado contra el MinIO de la pila C.
      .filter((item) => item?.name && item.isLatest && item.versionId && !item.isDeleteMarker)
      .map((item) => ({
        bucket: this.bucket,
        objectKey: item.name,
        objectVersionId: item.versionId,
        fecha: item.lastModified ?? null,
        tamano: Number(item.size ?? 0),
      }));
  }

  /**
   * Lee un texto archivado.
   *
   * ⚠️ **EXIGE `objectVersionId`, y por eso no tiene valor por defecto.** El WORM protege la VERSIÓN,
   * no la clave: el objeto se puede sobrescribir y la clave pasa a devolver lo nuevo. Leer por clave
   * daría un texto plausible que puede no ser el que alguien aceptó, y la comprobación de huella lo
   * delataría demasiado tarde. Se prefiere no poder leer a leer otra cosa.
   *
   * ⚠️ **Y salva un segundo caso, medido:** un borrado corriente sobre un objeto bloqueado **sí se
   * acepta** — no destruye nada, pone un *delete marker* y el objeto **desaparece del listado**. La
   * versión sigue ahí e indestructible, así que la prueba no se pierde; pero leer por clave
   * respondería «no existe». Leyendo por versión, el borrado no tiene ningún efecto sobre la prueba.
   */
  async leerArchivado({ bucket = null, objectKey, objectVersionId, hash = null } = {}) {
    if (!objectVersionId) {
      throw new Error(
        "Para leer del archivo legal hace falta el identificador de version del objeto. El bloqueo " +
        "protege la VERSION, no la clave: leer por clave devolveria lo ultimo que haya ahi, que no " +
        "tiene por que ser lo que la persona acepto."
      );
    }
    if (!objectKey) {
      throw new Error("Para leer del archivo legal hace falta la clave del objeto.");
    }

    const desde = bucket || this.bucket;
    const flujo = await this.#minio().getObject(desde, objectKey, { versionId: objectVersionId });
    const texto = (await juntarStream(flujo)).toString("utf8");

    if (hash) {
      const leida = huellaDe(texto);
      if (leida !== hash) {
        throw new Error(
          `El texto archivado en '${desde}/${objectKey}' (version ${objectVersionId}) no cuadra con la ` +
          `huella registrada: se esperaba ${hash} y se leyo ${leida}.`
        );
      }
    }

    return texto;
  }
}
