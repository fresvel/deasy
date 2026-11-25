import { getPostgresPool } from "../../config/postgres.js";
import { badRequest, conflict, notFound } from "../../errors/HttpError.js";
import ArchivoLegal from "./ArchivoLegal.js";
import { huellaDe } from "./huella.js";

/**
 * Los textos legales que una persona acepta, y su huella.
 *
 * ── POR QUÉ HAY QUE GUARDAR LA HUELLA ───────────────────────────────────────────────────────────
 *
 * El **Art. 5 del Reglamento** de la LOPDP exige que el consentimiento *«deberá ser DEMOSTRADO por
 * el responsable que lo obtiene»*. Demostrar son cuatro cosas: **quién**, **a qué**, **cuándo** y
 * **qué decía el texto**. Las tres primeras son fáciles; la cuarta es la que casi todo el mundo
 * olvida, y sin ella las otras no valen: guardar «aceptó la versión 2» no prueba nada si nadie puede
 * demostrar qué decía la versión 2.
 *
 * ⚠️ **Y por eso la huella es del TEXTO, no de la versión.** Un número de versión lo puede reescribir
 * cualquiera; una huella SHA-256 delata el cambio.
 *
 * ── EL TEXTO YA NO ESTÁ AQUÍ ────────────────────────────────────────────────────────────────────
 *
 * Esta tabla **no guarda el texto**: guarda **dónde está** (`bucket`, `object_key`,
 * `object_version_id`) y **qué decía** (`contenido_hash`). El texto vive en MinIO — el borrador en
 * un bucket corriente y lo publicado en uno con bloqueo de objetos. La razón está en
 * `ArchivoLegal.js`, y se resume en que una columna `TEXT` no demuestra nada: quien puede escribir
 * en la base puede reescribir texto y huella en la misma sentencia.
 *
 * ⚠️ **DOS EJES DE VERSIÓN, Y NO SE CONFUNDEN.** La versión de **objeto** (la de MinIO) cuenta cómo
 * evolucionó el borrador: cuarenta guardados son cuarenta versiones de objeto y **una sola fila**
 * aquí. La versión de **negocio** (`v1`, `v2`, la columna `version`) es lo que una persona aceptó.
 */
export const CLASES = Object.freeze({
  TERMINOS: "terminos_de_uso",
  DATOS: "tratamiento_de_datos",
});

export { huellaDe };

const ESTADOS = Object.freeze({ BORRADOR: "draft", PUBLICADO: "published", RETIRADO: "retired" });

/**
 * CACHÉ DE TEXTOS ARCHIVADOS.
 *
 * El formulario de registro pide los textos vigentes **en cada carga de la página**, y sin caché eso
 * es una descarga de MinIO por visita para un contenido que, por definición, no puede cambiar.
 *
 * ⚠️ **La clave incluye el `objectVersionId`**, así que una entrada de la caché es inmutable por
 * construcción: no existe «caché sucia», solo entradas que ya nadie pide. Se vacía igualmente al
 * publicar o retirar, que es cuando cambia *qué* documentos hay que servir.
 */
const cacheDeTextos = new Map();
const olvidarTextos = () => cacheDeTextos.clear();

export default class DocumentosLegales {
  constructor(pool = null, archivo = null) {
    this.pool = pool;
    this.archivo = archivo ?? new ArchivoLegal();
  }

  #pool() {
    return this.pool ?? getPostgresPool();
  }

  async #fila(id) {
    const [filas] = await this.#pool().query(
      `SELECT id, clase, version, contenido_hash, bucket, object_key, object_version_id, estado, publicado_at, created_at
         FROM documentos_legales
        WHERE id = ?`,
      [Number(id)]
    );
    const fila = filas?.[0];
    if (!fila) {
      throw notFound(`No existe el documento legal ${id}.`);
    }
    return fila;
  }

  /** El texto de una fila, del archivo y por version_id, con la caché delante. */
  async #textoDe(fila) {
    if (!fila?.object_version_id || !fila?.object_key) {
      // Estado degradado y no una excepción: la lista de documentos tiene que poder enseñarse
      // aunque a uno le falte el puntero, o un fallo de datos deja la pantalla entera en blanco.
      return null;
    }
    const clave = `${fila.bucket}|${fila.object_key}|${fila.object_version_id}`;
    if (cacheDeTextos.has(clave)) {
      return cacheDeTextos.get(clave);
    }
    const texto = await this.archivo.leerArchivado({
      bucket: fila.bucket,
      objectKey: fila.object_key,
      objectVersionId: fila.object_version_id,
      // Se verifica al leer, no solo al escribir: es el único momento en que la huella registrada y
      // el objeto archivado se pueden desmentir.
      hash: fila.contenido_hash,
    });
    cacheDeTextos.set(clave, texto);
    return texto;
  }

  /**
   * Las filas publicadas, SIN texto.
   *
   * Existe aparte de `publicados()` porque validar un alta solo necesita saber qué ids y qué clases
   * están vigentes. Mezclarlo obligaría a bajar de MinIO dos documentos en cada registro para no
   * mirarlos.
   */
  async #filasPublicadas() {
    const [filas] = await this.#pool().query(
      `SELECT id, clase, version, contenido_hash, bucket, object_key, object_version_id, publicado_at
         FROM documentos_legales
        WHERE estado = 'published'`
    );
    return filas ?? [];
  }

  /** La versión vigente de cada clase, con su texto. Es lo que se le enseña a quien se registra. */
  async publicados() {
    const filas = await this.#filasPublicadas();
    return Promise.all(filas.map(async (fila) => ({ ...fila, texto: await this.#textoDe(fila) })));
  }

  async publicadoDe(clase) {
    const [filas] = await this.#pool().query(
      `SELECT id, clase, version, contenido_hash, bucket, object_key, object_version_id
         FROM documentos_legales
        WHERE clase = ? AND estado = 'published'
        LIMIT 1`,
      [clase]
    );
    const fila = filas?.[0];
    if (!fila) {
      return null;
    }
    return { ...fila, texto: await this.#textoDe(fila) };
  }

  /** Todos, con su estado. Es la lista de la pantalla de administración. */
  async todos() {
    const [filas] = await this.#pool().query(
      `SELECT id, clase, version, contenido_hash, bucket, object_key, object_version_id, estado, publicado_at, created_at
         FROM documentos_legales
        ORDER BY clase ASC, created_at DESC`
    );
    return filas ?? [];
  }

  /**
   * Comprueba que los identificadores que manda quien se registra son documentos **publicados**.
   *
   * ⚠️ **Se comprueba AQUÍ y no en el navegador**, que es donde estaba antes y por eso no protegía
   * nada. Y se comprueba que estén PUBLICADOS: aceptar un borrador —o una versión retirada— sería
   * registrar un consentimiento a un texto que nadie está ofreciendo.
   */
  async validarAceptacion(ids) {
    const pedidos = [...new Set((ids ?? []).map(Number).filter(Boolean))];
    const publicados = await this.#filasPublicadas();
    const porId = new Map(publicados.map((d) => [d.id, d]));

    const invalidos = pedidos.filter((id) => !porId.has(id));
    if (invalidos.length) {
      return { valida: false, motivo: "documento_no_publicado" };
    }

    // Todas las clases publicadas tienen que estar aceptadas. Es la traducción del Art. 8: con una
    // pluralidad de finalidades, debe CONSTAR el consentimiento para TODAS ellas.
    const clasesPublicadas = new Set(publicados.map((d) => d.clase));
    const clasesAceptadas = new Set(pedidos.map((id) => porId.get(id).clase));
    const faltan = [...clasesPublicadas].filter((c) => !clasesAceptadas.has(c));
    if (faltan.length) {
      return { valida: false, motivo: "falta_aceptar", faltan };
    }

    return { valida: true, documentos: pedidos };
  }

  /**
   * Deja constancia. Recibe la conexión porque **va dentro de la transacción del alta**: una persona
   * creada sin su consentimiento registrado es exactamente el agujero que esto viene a tapar.
   */
  async registrarAceptacion(conexion, { personId, documentos, ip }) {
    for (const documentoId of documentos) {
      await conexion.query(
        `INSERT INTO consentimientos (person_id, documento_id, ip) VALUES (?, ?, ?)`,
        [personId, documentoId, ip ?? null]
      );
    }
  }

  // ── EL CICLO DE VIDA: BORRADOR → PUBLICADO → RETIRADO ─────────────────────────────────────────

  /**
   * Un borrador nuevo. La fila nace apuntando ya al bucket de borradores para que nunca exista un
   * documento sin sitio donde escribir su texto.
   */
  async crearBorrador(clase, version) {
    if (!Object.values(CLASES).includes(clase)) {
      throw badRequest(`Clase de documento legal desconocida: '${clase}'.`);
    }
    const [existentes] = await this.#pool().query(
      `SELECT id FROM documentos_legales WHERE clase = ? AND version = ?`,
      [clase, version]
    );
    if (existentes?.length) {
      throw conflict(`Ya existe la version '${version}' de '${clase}'.`);
    }

    // El objeto se crea vacío ANTES de la fila: si MinIO falla, no queda una fila apuntando a un
    // objeto inexistente.
    const { bucket, objectKey } = await this.archivo.guardarBorrador(clase, version, "");

    const [resultado] = await this.#pool().query(
      `INSERT INTO documentos_legales (clase, version, bucket, object_key, estado)
       VALUES (?, ?, ?, ?, 'draft')`,
      [clase, version, bucket, objectKey]
    );
    return this.#fila(resultado.insertId);
  }

  /**
   * Guarda el texto del borrador. Cada llamada deja una versión de objeto en MinIO: **ese es el
   * historial de edición**, y por eso aquí no hay ninguna tabla de revisiones.
   */
  async guardarBorrador(id, texto) {
    const fila = await this.#fila(id);
    if (fila.estado !== ESTADOS.BORRADOR) {
      throw conflict(
        `El documento ${id} esta '${fila.estado}' y ya no se edita: lo publicado es inmutable por ` +
        "diseño. Para cambiar el texto se crea una version nueva."
      );
    }

    const { bucket, objectKey } = await this.archivo.guardarBorrador(fila.clase, fila.version, texto);
    // La huella se adelanta al sellado: mientras es borrador dice qué hay escrito ahora, y publicar
    // la vuelve a calcular sobre los bytes que realmente entran en el archivo.
    const contenidoHash = huellaDe(texto);
    await this.#pool().query(
      `UPDATE documentos_legales SET bucket = ?, object_key = ?, contenido_hash = ? WHERE id = ?`,
      [bucket, objectKey, contenidoHash, fila.id]
    );
    return this.#fila(fila.id);
  }

  /** Uno solo, por id. Lanza 404 si no existe. */
  async obtener(id) {
    return this.#fila(id);
  }

  /**
   * El texto de un documento, venga de donde venga.
   *
   * Un borrador se lee de su bucket **por clave**, que ahí es lo correcto: no hay nada que
   * demostrar y lo que interesa es lo último escrito. Uno publicado o retirado se lee **por versión
   * de objeto**, porque ahí sí hay algo que demostrar.
   */
  async leerTexto(id) {
    const fila = await this.#fila(id);
    if (fila.estado === ESTADOS.BORRADOR) {
      return this.archivo.leerBorrador(fila.clase, fila.version);
    }
    return this.#textoDe(fila);
  }

  /** El historial de edición del borrador: una entrada por guardado. */
  async historial(id) {
    const fila = await this.#fila(id);
    return this.archivo.historialBorrador(fila.clase, fila.version);
  }

  /**
   * PUBLICAR: copiar los bytes del borrador al archivo inmutable, releerlos por su versión, y solo
   * entonces sellar la fila.
   *
   * ⚠️ **El orden es la garantía.** La fila se escribe LA ÚLTIMA: si la copia falla, si MinIO no
   * devuelve versión, o si lo releído no cuadra con lo escrito, esto lanza y la base **no se toca**.
   * Un puntero que dice apuntar a una prueba y apunta a otra cosa es peor que no tener puntero.
   *
   * ⚠️ **Y es IRREVERSIBLE.** El objeto entra en un bucket con retención COMPLIANCE: a partir de
   * aquí nadie —tampoco el administrador— puede borrarlo ni cambiarlo hasta que venza el plazo.
   */
  async publicar(id) {
    const fila = await this.#fila(id);
    if (fila.estado !== ESTADOS.BORRADOR) {
      throw conflict(`El documento ${id} no es un borrador (esta '${fila.estado}'): no se publica dos veces.`);
    }

    const bytes = await this.archivo.bytesDelBorrador(fila.clase, fila.version);
    if (!bytes?.length) {
      throw badRequest(`El borrador ${id} esta vacio: publicar un texto vacio dejaria un consentimiento sin contenido.`);
    }

    // Se archiva ANTES de abrir la transacción: es la parte que puede fallar, y no tiene sentido
    // tener la base bloqueada mientras se sube un objeto por red.
    const sellado = await this.archivo.archivar(fila.clase, fila.version, bytes);

    const conexion = await this.#pool().getConnection();
    try {
      await conexion.beginTransaction();
      // Solo puede haber UNA versión publicada por clase (lo impone un índice único parcial). La
      // anterior se RETIRA, no se borra: hay gente cuya prueba apunta a ella.
      await conexion.query(
        `UPDATE documentos_legales SET estado = 'retired' WHERE clase = ? AND estado = 'published' AND id <> ?`,
        [fila.clase, fila.id]
      );
      await conexion.query(
        `UPDATE documentos_legales
            SET bucket = ?, object_key = ?, object_version_id = ?, contenido_hash = ?,
                estado = 'published', publicado_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [sellado.bucket, sellado.objectKey, sellado.objectVersionId, sellado.hash, fila.id]
      );
      await conexion.commit();
    } catch (error) {
      await conexion.rollback().catch(() => {});
      throw error;
    } finally {
      conexion.release();
    }

    olvidarTextos();
    return this.#fila(fila.id);
  }

  /**
   * RETIRAR **no mueve nada**: cambia el estado y ya. El objeto archivado se queda donde está —no
   * podría irse aunque quisiéramos— porque quien lo aceptó necesita que siga demostrable.
   */
  async retirar(id) {
    const fila = await this.#fila(id);
    if (fila.estado !== ESTADOS.PUBLICADO) {
      throw conflict(`El documento ${id} no esta publicado (esta '${fila.estado}'): no hay nada que retirar.`);
    }
    await this.#pool().query(`UPDATE documentos_legales SET estado = 'retired' WHERE id = ?`, [fila.id]);
    olvidarTextos();
    return this.#fila(fila.id);
  }

  /** Qué bloqueo tiene el archivo, para enseñarlo de solo lectura. */
  async estadoDelArchivo() {
    return this.archivo.estadoDelArchivo();
  }

  /** Crea los buckets si faltan. Lanza si el de archivo existe SIN bloqueo (ver `ArchivoLegal`). */
  async asegurarBuckets() {
    return this.archivo.asegurarBuckets();
  }

  /**
   * CONECTA LA TABLA CON EL ARCHIVO: indexa lo que ya está subido, y **repara** las filas que se
   * quedaron sin puntero.
   *
   * ⚠️ **Por qué hace falta, y por qué no puede ser un `INSERT` del esquema.** La semilla del texto
   * entra por MinIO —la importación del bucket—, y una fila necesita el `object_version_id`, que
   * **no existe hasta después de subir el objeto**. SQL no puede conocerlo. Sin esto, los objetos
   * estarían subidos y ninguna fila los indexaría: quien se registra no vería ningún documento.
   *
   * Hace dos cosas, y solo una de ellas en cada instalación:
   *
   *   **(a) Tabla vacía — instalación nueva.** Se crea una fila `published` por clase, con el
   *   `object_version_id` real y la huella **calculada leyendo el objeto por esa versión**.
   *
   *   **(b) Tabla con filas antiguas.** Las que están `published` **sin puntero** son las que sembró
   *   el `INSERT` del esquema cuando el texto vivía en una columna. Se sellan contra el objeto de su
   *   misma clase y versión — **pero solo si la huella cuadra**. Esa comprobación es la que hace la
   *   reparación segura: la fila ya traía la huella del texto que la gente aceptó, así que si el
   *   objeto archivado da la misma, son demostrablemente el mismo texto. Si no cuadra, **no se toca
   *   y se avisa**: sellarla sería cambiarle a alguien, en silencio, el documento que aceptó.
   *
   * Lo que ya tiene puntero no se toca nunca. Esto no es una sincronización.
   */
  async adoptarDelArchivo() {
    const clasesConocidas = new Set(Object.values(CLASES));
    // Del archivo solo interesa lo que tiene forma de documento legal. Lo demás se ignora en vez de
    // adivinar: una fila mal formada apuntaria a una prueba que no lo es.
    const catalogo = [...(await this.archivo.inventarioDelArchivo())]
      .sort((a, b) => new Date(b.fecha ?? 0) - new Date(a.fecha ?? 0))
      .map((objeto) => ({ objeto, partes: /^([^/]+)\/([^/]+)\.md$/.exec(objeto.objectKey) }))
      .filter(({ partes }) => partes && clasesConocidas.has(partes[1]))
      .map(({ objeto, partes }) => ({ objeto, clase: partes[1], version: partes[2] }));

    const [filas] = await this.#pool().query(
      `SELECT id, clase, version, contenido_hash, object_version_id, estado FROM documentos_legales`
    );

    const hechos = filas?.length
      ? await this.#sellarFilasSinPuntero(filas, catalogo)
      : await this.#indexarArchivoEnTablaVacia(catalogo);

    if (hechos.length) {
      olvidarTextos();
    }
    return hechos;
  }

  /** (a) Instalación nueva: una fila publicada por clase, la versión más reciente de cada una. */
  async #indexarArchivoEnTablaVacia(catalogo) {
    const hechos = [];
    const vistas = new Set();

    for (const { objeto, clase, version } of catalogo) {
      // Solo puede haber UNA publicada por clase (indice unico parcial). Si el archivo trae varias,
      // la mas reciente es la vigente y las demas son historia.
      if (vistas.has(clase)) {
        continue;
      }
      vistas.add(clase);

      const texto = await this.archivo.leerArchivado({
        bucket: objeto.bucket,
        objectKey: objeto.objectKey,
        objectVersionId: objeto.objectVersionId,
      });

      await this.#pool().query(
        `INSERT INTO documentos_legales
           (clase, version, bucket, object_key, object_version_id, contenido_hash, estado, publicado_at)
         VALUES (?, ?, ?, ?, ?, ?, 'published', CURRENT_TIMESTAMP)`,
        [clase, version, objeto.bucket, objeto.objectKey, objeto.objectVersionId, huellaDe(texto)]
      );
      hechos.push({ clase, version, objectVersionId: objeto.objectVersionId, accion: "indexado" });
    }
    return hechos;
  }

  /** (b) Reparación: sellar lo publicado sin puntero, y SOLO si la huella lo demuestra. */
  async #sellarFilasSinPuntero(filas, catalogo) {
    const hechos = [];

    for (const fila of filas) {
      if (fila.estado !== ESTADOS.PUBLICADO || fila.object_version_id) {
        continue;
      }
      const encontrado = catalogo.find((c) => c.clase === fila.clase && c.version === fila.version);
      if (!encontrado) {
        console.warn(`[legal] la fila ${fila.id} (${fila.clase} ${fila.version}) esta publicada y no hay objeto archivado que le corresponda.`);
        continue;
      }

      const texto = await this.archivo.leerArchivado({
        bucket: encontrado.objeto.bucket,
        objectKey: encontrado.objeto.objectKey,
        objectVersionId: encontrado.objeto.objectVersionId,
      });
      const hash = huellaDe(texto);
      // ⚠️ AQUI ESTA LA GARANTIA. La fila ya traia la huella del texto que la gente acepto; si el
      // objeto da otra, no son el mismo texto y sellarla cambiaria en silencio lo que consta que
      // alguien acepto. Se avisa y se deja como esta.
      if (fila.contenido_hash && fila.contenido_hash !== hash) {
        console.warn(`[legal] la fila ${fila.id} (${fila.clase} ${fila.version}) NO se sella: su huella no coincide con la del objeto archivado.`);
        continue;
      }

      await this.#pool().query(
        `UPDATE documentos_legales
            SET bucket = ?, object_key = ?, object_version_id = ?, contenido_hash = ?
          WHERE id = ?`,
        [encontrado.objeto.bucket, encontrado.objeto.objectKey, encontrado.objeto.objectVersionId, hash, fila.id]
      );
      hechos.push({ clase: fila.clase, version: fila.version, objectVersionId: encontrado.objeto.objectVersionId, accion: "sellado" });
    }
    return hechos;
  }
}
