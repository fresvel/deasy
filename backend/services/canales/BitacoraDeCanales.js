import { getPostgresPool } from "../../config/postgres.js";

/**
 * El historial de cómo han estado los canales.
 *
 * ── UNA FILA POR CAMBIO, NO POR COMPROBACIÓN ────────────────────────────────────────────────────
 *
 * Se comprueba cada minuto; anotar cada vuelta serían **1 440 filas al día por canal** para decir
 * «sigue bien». Lo que interesa no es el estado —eso lo da la pantalla— sino **cuándo cambió**, que
 * es lo que contesta «¿cuánto llevaba roto?».
 *
 * Esa pregunta es la que nadie pudo responder el 2026-08-31, cuando el servicio estuvo TRECE HORAS
 * parado. La pantalla (`C7A`) tampoco la contesta: enseña el ahora.
 */
export default class BitacoraDeCanales {
  constructor(pool = null) {
    this.pool = pool;
  }

  #pool() {
    return this.pool ?? getPostgresPool();
  }

  /** El tramo abierto de cada canal: lo que está pasando ahora mismo, y desde cuándo. */
  async abiertos() {
    const [filas] = await this.#pool().query(
      `SELECT id, canal, salud, evidencia, detalle, desde, avisado_at
         FROM canales_bitacora
        WHERE hasta IS NULL`
    );
    return new Map((filas ?? []).map((f) => [f.canal, f]));
  }

  /**
   * Anota que un canal cambió de estado.
   *
   * ⚠️ Cierra el tramo anterior Y abre el nuevo **en una transacción**. Si se hiciera en dos pasos
   * sueltos, un fallo entre medias dejaría dos tramos abiertos del mismo canal, y entonces «desde
   * cuándo lleva así» tendría dos respuestas.
   */
  async cambio(canal, { salud, evidencia = null, detalle = null }) {
    const conexion = await this.#pool().getConnection();
    try {
      await conexion.beginTransaction();
      await conexion.query(
        `UPDATE canales_bitacora SET hasta = CURRENT_TIMESTAMP
          WHERE canal = ? AND hasta IS NULL`,
        [canal]
      );
      await conexion.query(
        `INSERT INTO canales_bitacora (canal, salud, evidencia, detalle) VALUES (?, ?, ?, ?)`,
        [canal, salud, evidencia, detalle]
      );
      await conexion.commit();
    } catch (error) {
      await conexion.rollback();
      throw error;
    } finally {
      conexion.release();
    }
  }

  /** Deja constancia de que ya se avisó de este tramo, para no repetirlo cada vuelta. */
  async marcarAvisado(id) {
    await this.#pool().query(
      `UPDATE canales_bitacora SET avisado_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [id]
    );
  }
}
