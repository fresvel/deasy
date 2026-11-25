import AlmacenEnPostgres from "./AlmacenEnPostgres.js";
import { ACCIONES_QUE_CIERRAN_SI_FALLA_LA_BASE, REGLAS } from "./reglas.js";

/**
 * Cuántas veces se puede intentar algo, y qué pasa cuando se pasa.
 *
 * ── DOS MÉTODOS Y NO UNO, Y ES LO MÁS IMPORTANTE DE ESTA CLASE ──────────────────────────────────
 *
 * `comprobar` va ANTES de trabajar; `registrar` va DESPUÉS de saber cómo acabó. Fundirlos —«cuenta
 * y dime si puedes»— obligaría a contar también los aciertos, y en el acceso eso castigaría a quien
 * trabaja: aquí se entra y se sale muchas veces al día. **Sólo cuentan los FALLOS.**
 *
 * Y de la separación sale la otra regla que no es negociable: **`comprobar` se llama antes de
 * bcrypt**. Si se cuenta después, el ataque de CPU funciona igual aunque el intento se rechace.
 *
 * ── NO SABE DE HTTP ─────────────────────────────────────────────────────────────────────────────
 *
 * Devuelve un hecho, no una respuesta. Quien traduce a `429` es el middleware; quien decide si un
 * intento contó es quien conoce el resultado. Así esto se prueba sin levantar un servidor.
 */
export default class Limitador {
  /**
   * @param {object} almacen  cualquier cosa con `contar`, `registrar`, `segundosParaElSiguiente` y
   *                          `limpiar`. Hoy Postgres; mañana, quizá, Redis.
   * @param {object} reglas   por si un despliegue quiere las suyas
   */
  constructor(almacen = new AlmacenEnPostgres(), reglas = REGLAS) {
    this.almacen = almacen;
    this.reglas = reglas;
    // Para la limpieza oportunista: no tiene sentido borrar por debajo de la ventana más larga.
    this.ventanaMasLarga = Math.max(...Object.values(reglas).map((r) => r.ventanaSegundos), 0);
  }

  /**
   * ¿Puede seguir?
   *
   * @returns {Promise<{permitido: boolean, reintentarEn?: number}>}
   */
  async comprobar(accion, sujeto) {
    const regla = this.reglas[accion];
    // Una acción sin regla NO se frena. Es deliberado: así añadir una ruta al limitador es añadir
    // una regla, y olvidarse de la regla no rompe la ruta --sólo la deja sin proteger, que es
    // exactamente el estado de hoy--.
    if (!regla) return { permitido: true };
    if (!sujeto) return { permitido: true };

    let cuantos;
    try {
      cuantos = await this.almacen.contar(accion, sujeto, regla.ventanaSegundos);
    } catch (error) {
      return this.#cuandoFallaLaBase(accion, error);
    }

    if (cuantos < regla.tope) return { permitido: true };

    let reintentarEn = regla.ventanaSegundos;
    try {
      reintentarEn = await this.almacen.segundosParaElSiguiente(accion, sujeto, regla.ventanaSegundos);
    } catch {
      // Si esto falla ya da igual: se frena de todas formas y se dice la ventana entera.
    }
    return { permitido: false, reintentarEn };
  }

  /** Deja constancia de un intento que CUENTA. En `login`, sólo si falló. */
  async registrar(accion, sujeto) {
    if (!this.reglas[accion] || !sujeto) return;
    try {
      await this.almacen.registrar(accion, sujeto);
      await this.#limpiarDeVezEnCuando();
    } catch {
      // ⚠️ No registrar NO puede tumbar la petición: el limitador es una protección, no el trabajo.
      // Se pierde una cuenta; el usuario no pierde su operación.
    }
  }

  /**
   * ⚠️ **QUÉ HACER SI LA BASE NO CONTESTA NO TIENE UNA SOLA RESPUESTA**, y elegir una sola sería un
   * error en los dos sentidos: abrir siempre deja sin protección justo lo que cuesta dinero de otro;
   * cerrar siempre convierte una caída de la base en «nadie puede entrar» por culpa del limitador,
   * cuando sin base tampoco se podría entrar de todos modos.
   */
  #cuandoFallaLaBase(accion, error) {
    if (ACCIONES_QUE_CIERRAN_SI_FALLA_LA_BASE.includes(accion)) {
      console.error(`[limitador] sin poder contar «${accion}»: se CIERRA — ${error?.message}`);
      return { permitido: false, reintentarEn: 60 };
    }
    console.error(`[limitador] sin poder contar «${accion}»: se abre — ${error?.message}`);
    return { permitido: true };
  }

  /** Una de cada 50, para que la limpieza no cueste una consulta por intento. */
  async #limpiarDeVezEnCuando() {
    if (Math.random() >= 0.02) return;
    try {
      await this.almacen.limpiar(this.ventanaMasLarga);
    } catch {
      // Que la limpieza falle no es motivo para romper nada: se reintentará sola.
    }
  }
}
