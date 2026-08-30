import crypto from "node:crypto";
import { numerosIguales } from "./numerosDeTelefono.js";
import { getPostgresPool } from "../../config/postgres.js";

// Crear, resolver y consumir la llave con la que alguien demuestra que un número es suyo.
//
// La persona la lleva a un canal —un QR de Telegram, un enlace de WhatsApp, un SMS que envía ella—
// y el microservicio `channels` la trae de vuelta. AQUÍ se decide; el servicio sólo transporta.
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

    const [telefonos] = await connection.query(
      `SELECT t.id, t.numero, p.phone_code
         FROM telefonos t
         LEFT JOIN paises p ON p.id = t.pais_id
        WHERE t.id = ? AND t.person_id = ? AND t.is_active = 1
        LIMIT 1`,
      [id, duenyo]
    );
    // Un teléfono ajeno responde lo MISMO que uno inexistente. Decir «existe pero no es tuyo»
    // convierte esta ruta en un oráculo para averiguar qué identificadores están ocupados.
    if (!telefonos?.length) {
      throw errorDeCliente("Ese teléfono no existe.");
    }

    // ⚠️ SIN PAIS NO HAY VERIFICACION POSIBLE, y hay que decirlo AQUI. Comparar sin prefijo no
    // distingue `+51 99 111 2233` de `+593 99 111 2233`, así que `numerosIguales` lo rechaza — pero
    // si se dejara llegar hasta ahí, el usuario recorrería el canal entero para que le dijeran «ese
    // número no es el tuyo», que es MENTIRA y además no le dice qué arreglar. `telefonos.pais_id`
    // es nullable, así que el caso existe de verdad.
    if (!telefonos[0].phone_code) {
      throw errorDeCliente(
        "Ese teléfono no tiene país. Edítalo y elige el país antes de verificarlo."
      );
    }

    await connection.query(
      "DELETE FROM telefono_verification_keys WHERE telefono_id = ? AND consumida_at IS NULL",
      [id]
    );

    const llave = generarLlave();
    const expira = new Date(Date.now() + MINUTOS_DE_VIDA * 60 * 1000);
    await connection.query(
      "INSERT INTO telefono_verification_keys (telefono_id, llave_hash, expira_at) VALUES (?, ?, ?)",
      [id, huellaDeLlave(llave), expira]
    );

    return { llave, expira_at: expira, telefono: telefonos[0] };
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
    const [filas] = await connection.query(
      `SELECT k.id, k.telefono_id, k.expira_at, k.consumida_at, t.numero, p.phone_code
         FROM telefono_verification_keys k
         INNER JOIN telefonos t ON t.id = k.telefono_id
         LEFT JOIN paises p ON p.id = t.pais_id
        WHERE k.llave_hash = ?
        LIMIT 1`,
      [huellaDeLlave(llave)]
    );

    const fila = filas?.[0] ?? null;
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
   * ⚠️ El SMS es el caso distinto y es correcto que lo sea: prueba el NÚMERO, no que tenga ninguna
   * aplicación. Marca su propio canal —un móvil recibe SMS, un fijo no— y deja Telegram y WhatsApp
   * como estaban.
   *
   * Y de ahí sale la respuesta a «¿está verificado este teléfono?»: lo está si tiene ALGÚN canal
   * verificado. No hay una bandera en `telefonos` que pueda quedarse en desacuerdo con las filas.
   */
  async confirmar({ llave, numero, canal }) {
    const conexion = await this.pool.getConnection();
    try {
      await conexion.beginTransaction();

      const { estado, fila } = await this.#buscar(llave, conexion);
      if (estado !== "valida") {
        await conexion.rollback();
        return { verificado: false, estado };
      }

      // La comparación vive en su módulo y conoce el país. Un teléfono guardado SIN país se rechaza
      // aquí dentro: sin prefijo no hay comparación internacional que valga.
      if (!numerosIguales(fila, numero)) {
        await conexion.rollback();
        return { verificado: false, estado: "numero_distinto" };
      }

      const [canales] = await conexion.query(
        "SELECT id FROM canales_mensajeria WHERE code = ? AND is_active = 1 LIMIT 1",
        [String(canal ?? "").trim().toLowerCase()]
      );
      if (!canales?.length) {
        await conexion.rollback();
        throw errorDeCliente(`El canal '${canal}' no existe o no está activo.`);
      }
      const canalId = Number(canales[0].id);

      const [gastada] = await conexion.query(
        `UPDATE telefono_verification_keys
            SET consumida_at = CURRENT_TIMESTAMP, canal_id = ?
          WHERE llave_hash = ? AND consumida_at IS NULL`,
        [canalId, huellaDeLlave(llave)]
      );
      // ⚠️ SE CUENTA POR `affectedRows`, no por la longitud del array. El adaptador decide por el
      // PRIMER VERBO: un UPDATE devuelve una CABECERA `{affectedRows}`, no filas — está explicado en
      // `services/admin/org/taskAssignment.js:262`, donde el mismo despiste costó el defecto 1.10.
      // Contar mal aquí no daría un error: daría «ya consumida» SIEMPRE, y en silencio.
      //
      // Cero filas significa que otro mensaje la gastó entre la lectura y esta escritura. Es la
      // carrera, y aquí se pierde limpiamente en vez de verificar dos veces.
      if (!Number(gastada?.affectedRows)) {
        await conexion.rollback();
        return { verificado: false, estado: "consumida" };
      }

      // ⚠️ NO se toca `telefonos`: esa tabla NO tiene columna `verificado`, y es a propósito. El
      // esquema lo dice donde importa — la verificación es POR CANAL, que es lo que el modelo viejo
      // no podía decir: `verify_whatsapp` era una bandera suelta que no distinguía «este número
      // existe» de «este número tiene WhatsApp».
      await conexion.query(
        `INSERT INTO telefono_canales (telefono_id, canal_id, verificado, verificado_at)
         VALUES (?, ?, 1, CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE verificado = 1, verificado_at = CURRENT_TIMESTAMP`,
        [Number(fila.telefono_id), canalId]
      );

      await conexion.commit();
      return { verificado: true, telefonoId: Number(fila.telefono_id) };
    } catch (error) {
      await conexion.rollback().catch(() => {});
      throw error;
    } finally {
      // Sin esto se agotan las diez del pool y la aplicación entera se cuelga esperando.
      conexion.release();
    }
  }
}
