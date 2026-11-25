import { getPostgresPool } from "../../config/postgres.js";

/**
 * Dónde se cuentan los intentos, HOY.
 *
 * ⚠️ **ES UNA CLASE Y NO UN PUÑADO DE FUNCIONES POR UN MOTIVO CONCRETO:** el día que entre Redis
 * —probablemente por el adaptador de Socket.IO, no por esto— migrar es escribir `AlmacenEnRedis` con
 * estos dos métodos y cambiar UNA línea del montaje. No un refactor.
 *
 * En Redis esto son `INCR` + `EXPIRE`: dos operaciones atómicas y con caducidad automática. Aquí hay
 * que contar filas y borrarlas nosotros, que es la diferencia real entre las dos opciones — no la
 * velocidad, que a esta escala no se nota.
 */
export default class AlmacenEnPostgres {
  constructor(pool = null) {
    this.pool = pool;
  }

  #pool() {
    return this.pool ?? getPostgresPool();
  }

  /**
   * Cuántos intentos hay dentro de la ventana.
   *
   * ⚠️ La ventana es DESLIZANTE, no de reloj: se cuenta hacia atrás desde ahora. Una ventana fija
   * («por hora») permite el doble de intentos a caballo entre dos horas, que es un agujero conocido
   * y aquí no hace falta pagarlo: el índice `(accion, sujeto, ocurrido_at DESC)` hace esto barato.
   */
  async contar(accion, sujeto, ventanaSegundos) {
    const [filas] = await this.#pool().query(
      `SELECT COUNT(*)::int AS total
         FROM intentos_limitados
        WHERE accion = ?
          AND sujeto = ?
          AND ocurrido_at > CURRENT_TIMESTAMP - (? * INTERVAL '1 second')`,
      [accion, sujeto, ventanaSegundos]
    );
    return Number(filas?.[0]?.total ?? 0);
  }

  /** Deja constancia de UN intento. */
  async registrar(accion, sujeto) {
    await this.#pool().query(
      `INSERT INTO intentos_limitados (accion, sujeto) VALUES (?, ?)`,
      [accion, sujeto]
    );
  }

  /**
   * Cuándo podrá volver a intentarlo, en segundos.
   *
   * Es el intento MÁS ANTIGUO de la ventana: cuando ése salga por el otro lado, quedará un hueco.
   * Decir «espera la ventana entera» sería mentir hacia arriba y hacer esperar de más.
   */
  async segundosParaElSiguiente(accion, sujeto, ventanaSegundos) {
    const [filas] = await this.#pool().query(
      `SELECT CEIL(EXTRACT(EPOCH FROM (
                MIN(ocurrido_at) + (? * INTERVAL '1 second') - CURRENT_TIMESTAMP
              )))::int AS faltan
         FROM intentos_limitados
        WHERE accion = ?
          AND sujeto = ?
          AND ocurrido_at > CURRENT_TIMESTAMP - (? * INTERVAL '1 second')`,
      [ventanaSegundos, accion, sujeto, ventanaSegundos]
    );
    const faltan = Number(filas?.[0]?.faltan ?? 0);
    // Nunca cero: un `Retry-After: 0` invita a reintentar de inmediato, que es lo contrario de frenar.
    return faltan > 0 ? faltan : 1;
  }

  /**
   * Borra lo que ya no cuenta para nadie.
   *
   * ⚠️ **LA LIMPIEZA ES PARTE DEL DISEÑO, NO UN EXTRA.** Sin ella la tabla crece para siempre y el
   * índice con ella. Se hace OPORTUNISTAMENTE --una de cada N peticiones frenadas-- en vez de con una
   * tarea programada, porque una tarea que nadie vigila es una tarea que un día deja de correr sin
   * que nadie se entere. Aquí, si el limitador funciona, la limpieza funciona.
   */
  async limpiar(segundosMaximos) {
    await this.#pool().query(
      `DELETE FROM intentos_limitados
        WHERE ocurrido_at < CURRENT_TIMESTAMP - (? * INTERVAL '1 second')`,
      [segundosMaximos]
    );
  }
}
