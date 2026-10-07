import crypto from "node:crypto";
import { numerosIguales, numeroMalGuardado } from "./numerosDeTelefono.js";
import { getPostgresPool, conTransaccion } from "../../../config/postgres.js";
import {
  borrarLlavesVivas,
  insertarLlave,
  idDeCanalActivo,
  consumirLlave,
  marcarCanalVerificado
} from "../datos/verificacionDeTelefono.js";
import { telefonoDelDueno, llavePorHuella, cualesVerificaron as cualesVerificaronEnDatos }
  from "../datos/consulta/telefonoConSuPais.js";

// Crear, resolver y consumir la llave con la que alguien demuestra que un número es suyo.
//
// La persona la lleva a un canal —un QR de Telegram, un enlace de WhatsApp— y el microservicio
// `channels` la trae de vuelta. AQUÍ se decide; el servicio sólo transporta.
// Ver `docs/arquitecturas/microservicio-channels.md`.

const errorDeCliente = (mensaje) => {
  const error = new Error(mensaje);
  error.status = 400;
  error.statusCode = 400;
  return error;
};

/**
 * Quince minutos, y no diez como el código del correo.
 *
 * Ahí el usuario lo teclea de vuelta en la misma pantalla; aquí tiene que abrir OTRA aplicación, y
 * puede que instalarla primero. Diez minutos le harían empezar de nuevo justo cuando lo consigue.
 */
export const MINUTOS_DE_VIDA = 15;

/**
 * La llave: 32 bytes aleatorios en base64url.
 *
 * `base64url` y no base64 normal porque VIAJA EN UN ENLACE DE TELEGRAM, que admite 64 caracteres y
 * sólo `A-Z a-z 0-9 _ -` (comprobado en su documentación). Un `+` o un `/` habría que escapar, y un
 * enlace escapado es un enlace que alguien copia mal.
 */
export const generarLlave = () => crypto.randomBytes(32).toString("base64url");

/** Determinista a propósito: es lo que permite BUSCAR por ella. Ver la nota del esquema. */
export const huellaDeLlave = (llave) =>
  crypto.createHash("sha256").update(String(llave ?? ""), "utf8").digest("hex");

export default class TelefonoVerificacionService {
  constructor(pool = getPostgresPool()) {
    this.pool = pool;
  }

  /**
   * Una llave nueva para este teléfono.
   *
   * Invalida las anteriores del mismo teléfono, igual que hace el código del correo: si pides otra
   * es porque la primera no te sirvió, y dejar dos vivas multiplica por dos lo que hay que adivinar
   * sin darle nada al usuario.
   */
  async crear({ telefonoId, personId }, connection = this.pool) {
    const id = Number(telefonoId);
    if (!Number.isInteger(id) || id <= 0) {
      throw errorDeCliente("Hace falta el teléfono que se va a verificar.");
    }
    // El dueño NO es opcional. Se pide como argumento obligatorio, y no con un valor por defecto que
    // signifique «todos», porque un olvido en la llamada tiene que romper la prueba — no abrir la
    // consulta. Es el mismo fallo que el IDOR de los entregables: el guard miraba la tarea y no la
    // pieza que se pedía.
    const duenyo = Number(personId);
    if (!Number.isInteger(duenyo) || duenyo <= 0) {
      throw errorDeCliente("Hace falta saber de quién es el teléfono.");
    }

    const telefono = await telefonoDelDueno(connection, id, duenyo);
    // Un teléfono ajeno responde lo MISMO que uno inexistente. Decir «existe pero no es tuyo»
    // convierte esta ruta en un oráculo para averiguar qué identificadores están ocupados.
    if (!telefono) {
      throw errorDeCliente("Ese teléfono no existe.");
    }

    // ⚠️ SIN PAIS NO HAY VERIFICACION POSIBLE, y hay que decirlo AQUI. Comparar sin prefijo no
    // distingue `+51 99 111 2233` de `+593 99 111 2233`, así que `numerosIguales` lo rechaza — pero
    // si se dejara llegar hasta ahí, el usuario recorrería el canal entero para que le dijeran «ese
    // número no es el tuyo», que es MENTIRA y además no le dice qué arreglar. `telefonos.pais_id`
    // es nullable, así que el caso existe de verdad.
    if (!telefono.phone_code) {
      throw errorDeCliente(
        "Ese teléfono no tiene país. Edítalo y elige el país antes de verificarlo."
      );
    }

    // ⚠️ Y EL PREFIJO NO VA DENTRO DE `numero`: esa columna guarda la parte local. Guardado dos
    // veces compone `593593…`, que no es el teléfono de nadie. Se corta aquí por el mismo motivo
    // que el caso de arriba: dejarlo llegar al final produce un «ese número no es el tuyo» que es
    // MENTIRA y no le dice a nadie qué arreglar.
    if (numeroMalGuardado(telefono)) {
      throw errorDeCliente(
        "Ese teléfono está guardado con el prefijo del país dentro del número. Edítalo y deja " +
        "sólo la parte local."
      );
    }

    await borrarLlavesVivas(connection, id);

    const llave = generarLlave();
    const expira = new Date(Date.now() + MINUTOS_DE_VIDA * 60 * 1000);
    await insertarLlave(connection, id, huellaDeLlave(llave), expira);

    return { llave, expira_at: expira, telefono };
  }

  /**
   * ¿Esta llave sigue viva? Y NADA MÁS.
   *
   * ⚠️ **No devuelve el número, y ése es el cambio de C2b.** Antes sí, y el microservicio comparaba
   * con lo que le llegaba por el canal. Dos problemas, uno grave:
   *
   *   - El servicio NO sabe de qué país es el número guardado, así que sólo podía comparar la cola.
   *     `+51 99 111 2233` y `+593 99 111 2233` le salían iguales — medido, no supuesto.
   *   - Y el número salía del backend en cuanto alguien traía una llave válida.
   *
   * Ahora el número no sale, y quien compara es quien tiene el país. Esto queda como **sonda**: el
   * canal la usa para saber si merece la pena seguir. Telegram la necesita de verdad, porque su bot
   * tiene que PEDIR el contacto en un segundo paso, y pedírselo a alguien cuya llave no vale es
   * hacerle compartir sus datos para nada.
   *
   * Los cuatro estados no son adorno: al usuario le dicen cosas distintas, y sólo «caducada» y
   * «consumida» significan «repite sin cambiar nada de lo que hiciste».
   */
  async estadoDeLlave(llave, connection = this.pool) {
    const { estado } = await this.#buscar(llave, connection);
    return { estado };
  }

  /** La fila de la llave con el teléfono al que pertenece, y en qué estado está. Privada. */
  async #buscar(llave, connection) {
    const fila = await llavePorHuella(connection, huellaDeLlave(llave));
    if (!fila) return { estado: "desconocida", fila: null };
    if (fila.consumida_at) return { estado: "consumida", fila };
    if (new Date(fila.expira_at) < new Date()) return { estado: "caducada", fila };
    return { estado: "valida", fila };
  }

  /**
   * El canal asegura que ESTE número le mandó ESTA llave. Aquí se comprueba y se consuma — o no.
   *
   * ⚠️ **El servicio reporta lo que OBSERVÓ; el veredicto es de aquí.** Es el reparto que arregla
   * C2b: antes `channels` decidía si los números coincidían y luego pedía consumir, así que el
   * backend acababa creyéndose una conclusión ajena tomada sin los datos que hacían falta. Ahora el
   * canal aporta un hecho que su transporte prueba —«este número escribió»— y quien concluye es
   * quien tiene el país del número guardado.
   *
   * Todo ocurre en **una transacción**, y eso también es de C2b: comparar y consumir eran dos
   * llamadas con un hueco en medio, y ese hueco era una carrera de verdad —dos mensajes casi a la
   * vez, o dos pulsaciones—. El `UPDATE` lleva `consumida_at IS NULL` y se mira cuántas filas tocó:
   * si ninguna, alguien se adelantó y esto NO verifica nada.
   *
   * Deja constancia de LAS DOS COSAS que el canal acaba de demostrar. Verificar por Telegram prueba
   * que el número es suyo Y que tiene Telegram: es un solo suceso y se escribe entero. Por eso
   * `canal_id` es clave ajena al catálogo y no un CHECK aparte — con dos vocabularios habría que
   * escribirlo dos veces y podrían separarse.
   *
   * ⚠️ **Un canal no verifica a otro, y es una decisión del dueño.** Probar que un número tiene
   * Telegram no prueba que tenga WhatsApp: son cuentas distintas sobre el mismo número, y una puede
   * estar en un aparato que ya no se tiene. Cada canal marca el suyo.
   *
   * Y de ahí sale la respuesta a «¿está verificado este teléfono?»: lo está si tiene ALGÚN canal
   * verificado. No hay una bandera en `telefonos` que pueda quedarse en desacuerdo con las filas.
   */
  async confirmar({ llave, numero, canal }) {
    // La transacción la abre `conTransaccion`, que hace rollback y propaga ante cualquier error, y
    // suelta la conexión siempre — sin eso se agotan las diez del pool y la aplicación se cuelga.
    //
    // ⚠️ LOS TRES RETORNOS DE «no verificado» YA NO HACEN `rollback` EXPLÍCITO, y es indistinguible:
    // ninguno de los tres ha escrito nada cuando sale —el estado no es válido, el número no coincide,
    // o el `UPDATE` tocó cero filas—, así que confirmar una transacción vacía y deshacerla hacen lo
    // mismo. Lo que sí sigue deshaciendo es el canal inexistente, porque ése LANZA.
    return conTransaccion(async (conexion) => {
      const { estado, fila } = await this.#buscar(llave, conexion);
      if (estado !== "valida") {
        return { verificado: false, estado };
      }

      // La comparación vive en su módulo y conoce el país. Un teléfono guardado SIN país se rechaza
      // aquí dentro: sin prefijo no hay comparación internacional que valga.
      if (!numerosIguales(fila, numero)) {
        return { verificado: false, estado: "numero_distinto" };
      }

      const canalId = await idDeCanalActivo(conexion, String(canal ?? "").trim().toLowerCase());
      if (!canalId) {
        throw errorDeCliente(`El canal '${canal}' no existe o no está activo.`);
      }

      // Cero filas significa que otro mensaje la gastó entre la lectura y esta escritura. Es la
      // carrera, y aquí se pierde limpiamente en vez de verificar dos veces. Por qué se cuenta por
      // `affectedRows` y no por la longitud del array está en la consulta.
      if (!(await consumirLlave(conexion, huellaDeLlave(llave), canalId))) {
        return { verificado: false, estado: "consumida" };
      }

      await marcarCanalVerificado(conexion, Number(fila.telefono_id), canalId);

      // `personId` viaja para que quien llame pueda AVISAR a esa sesion por tiempo real. Sale de la
      // consulta, no de un argumento: quien confirma es el canal, y el canal no sabe de personas
      // --y no debe: una llave filtrada no puede servir para averiguar de quien es un numero.
      return {
        verificado: true,
        telefonoId: Number(fila.telefono_id),
        personId: Number(fila.person_id),
      };
    }, this.pool);
  }

  /**
   * ¿Cuáles de estos números verificaron alguna vez?
   *
   * ── PARA QUÉ ────────────────────────────────────────────────────────────────────────────────
   *
   * Para la barrida de conversaciones de `channels`: se conserva la de quien tuvo una interacción
   * legítima y se borra la de quien no. Es la regla que evita **dos** incumplimientos a la vez —
   * conservar datos de alguien que nunca consintió (juridicidad) y guardar más de lo necesario
   * (minimización).
   *
   * ⚠️ **NO HACE FALTA NINGUNA TABLA NUEVA, y llegué a proponer una.** `telefono_verification_keys`
   * **no se borra**: los dos `DELETE` que existen sólo tocan las llaves NO consumidas, así que una
   * llave usada se queda para siempre. Con eso y `telefonos` la pregunta ya tiene respuesta.
   *
   * ⚠️ **Y quien cambió de teléfono NO aparece, que es lo correcto.** `telefonos.numero` se
   * sobrescribe al cambiarlo, así que su número viejo ya no está — y su conversación vieja **debe
   * borrarse**: la base legal era «este número interactúa con nosotros», y ya no lo hace.
   *
   * @param {string[]} numeros  en internacional y sólo dígitos, como los entrega un canal
   * @returns {Promise<Set<string>>} los que sí. Un conjunto, porque quien pregunta sólo mira si está
   */
  async cualesVerificaron(numeros) {
    const limpios = [...new Set((numeros ?? []).map((n) => String(n).replace(/\D/g, "")).filter(Boolean))];
    if (!limpios.length) return new Set();

    const filas = await cualesVerificaronEnDatos(this.pool, limpios);
    return new Set(filas.map((f) => f.internacional));
  }
}
