import crypto from "node:crypto";

import { getPostgresPool } from "../../config/postgres.js";

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
 */
export const CLASES = Object.freeze({
  TERMINOS: "terminos_de_uso",
  DATOS: "tratamiento_de_datos",
});

/**
 * ⚠️ **SOBRE UN TEXTO NORMALIZADO**, y no sobre los bytes tal cual. Un fichero editado en Windows
 * llega con `\r\n` y en Linux con `\n`: el contenido que lee la persona es el mismo, pero la huella
 * sería distinta y la comprobación fallaría sin que nada esté mal. También se recorta el final,
 * porque un salto de línea de más lo añade cualquier editor.
 */
export const huellaDe = (texto) =>
  crypto.createHash("sha256").update(String(texto ?? "").replace(/\r\n/g, "\n").trimEnd(), "utf8").digest("hex");

export default class DocumentosLegales {
  constructor(pool = null) {
    this.pool = pool;
  }

  #pool() {
    return this.pool ?? getPostgresPool();
  }

  /** La versión vigente de cada clase. Es lo que se le enseña a quien se registra. */
  async publicados() {
    const [filas] = await this.#pool().query(
      `SELECT id, clase, version, texto, contenido_hash, publicado_at
         FROM documentos_legales
        WHERE estado = 'published'`
    );
    return filas ?? [];
  }

  async publicadoDe(clase) {
    const [filas] = await this.#pool().query(
      `SELECT id, clase, version, texto, contenido_hash
         FROM documentos_legales
        WHERE clase = ? AND estado = 'published'
        LIMIT 1`,
      [clase]
    );
    return filas?.[0] ?? null;
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
    const publicados = await this.publicados();
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
}
