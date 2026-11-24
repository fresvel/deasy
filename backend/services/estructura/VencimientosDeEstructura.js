import { getPostgresPool } from "../../config/postgres.js";

/**
 * Aplica los efectos de lo que venció sin que nadie escribiera nada.
 *
 * ── QUÉ CIERRA ──────────────────────────────────────────────────────────────────────────────────
 *
 * Suprimir una unidad revoca sus roles y cancela sus vacantes. Cuando la supresión rige desde el
 * mismo día, eso lo hace un disparador en la base, al registrarla. Pero se admiten fechas FUTURAS
 * (frente 27, D-03): «se suprime el 1 de enero», registrado en noviembre. Ese día nadie escribe
 * ninguna fila, y **un disparador no tiene reloj**: no hay nada que lo despierte. Las consultas ya
 * dejan de ver la unidad —eso se pregunta al leer—, pero sus roles seguirían figurando vigentes.
 *
 * ── CÓMO ────────────────────────────────────────────────────────────────────────────────────────
 *
 * No lleva lista de pendientes: **la deduce**. Pregunta a la base qué hay suprimido que todavía
 * conserve efectos sin aplicar, y lo aplica. Las dos cosas las hace una función del esquema,
 * `aplicar_vencimientos_de_estructura`, que es la misma que usa el disparador por dentro: aquí sólo
 * se decide CUÁNDO llamarla. Por eso:
 *
 *   · **se repara sola** — si el proceso estuvo caído tres días, al volver encuentra lo vencido;
 *   · **repetirla no hace daño** — la segunda vez no queda nada que aplicar;
 *   · **no hay un segundo dato que pueda mentir** — no existe una marca de «ya aplicado».
 *
 * ⚠️ **VIVE EN EL PROCESO DEL BACKEND, que está fijado a UNA instancia** (`replicas: 1`). Con dos,
 * las dos correrían; no rompería nada, por lo anterior, pero sería trabajo duplicado.
 *
 * ⚠️ **Hay un desfase de hasta una vuelta** entre que llega la fecha y se aplican los efectos.
 */
export default class VencimientosDeEstructura {
  constructor({
    pool = null,
    cadaMs = 60 * 60_000,
    registro = console,
  } = {}) {
    // La conexión se resuelve al usarla, no al construir: el pool aún no existe al cargar el módulo.
    this.pool = pool;
    this.cadaMs = cadaMs;
    this.registro = registro;
    this.reloj = null;
  }

  conexion() {
    const pool = this.pool ?? getPostgresPool();
    if (!pool) throw new Error("La conexión a PostgreSQL no está disponible.");
    return pool;
  }

  /** Arranca: una vuelta ya —para ponerse al día de lo que venció con el proceso parado— y luego cada `cadaMs`. */
  iniciar() {
    if (this.reloj) return;
    const vuelta = () => this.unaVuelta().catch((error) => {
      // Si esto falla y nadie lo ve, los efectos dejan de aplicarse en silencio: que conste.
      this.registro.error(`[vencimientos] la vuelta falló: ${error.message}`);
    });
    vuelta();
    this.reloj = setInterval(vuelta, this.cadaMs);
    // Que no impida al proceso terminar: es una tarea de fondo, no una razón para seguir vivo.
    this.reloj.unref?.();
    this.registro.log(`[vencimientos] estructura: comprobando cada ${Math.round(this.cadaMs / 60_000)} min`);
  }

  detener() {
    clearInterval(this.reloj);
    this.reloj = null;
  }

  /** Una comprobación completa. Es la unidad que se prueba: sin temporizador. */
  async unaVuelta() {
    const [filas] = await this.conexion().query(
      `SELECT clase, nodo_id, afectadas FROM aplicar_vencimientos_de_estructura()`
    );
    const aplicados = filas ?? [];
    // Sólo se dice algo cuando se hizo algo: una línea por hora diciendo «nada» deja de leerse.
    for (const { clase, nodo_id: nodoId, afectadas } of aplicados) {
      this.registro.log(`[vencimientos] ${clase} ${nodoId}: supresión vencida aplicada (${afectadas} efectos)`);
    }
    return aplicados;
  }
}
