import crypto from "node:crypto";
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
   * De qué número es esta llave — o por qué no vale.
   *
   * Devuelve SÓLO el número, no de quién es. El servicio no necesita saber a qué persona pertenece,
   * y no dárselo evita que una llave filtrada sirva para averiguar quién es alguien.
   *
   * Distingue los tres casos porque el canal le dice cosas distintas al usuario: «no válido»,
   * «caducado, pide otro» y «ya usado, pide otro» son tres mensajes, no uno.
   */
  async resolver(llave, connection = this.pool) {
    const [filas] = await connection.query(
      `SELECT k.id, k.telefono_id, k.expira_at, k.consumida_at, t.numero
         FROM telefono_verification_keys k
         INNER JOIN telefonos t ON t.id = k.telefono_id
        WHERE k.llave_hash = ?
        LIMIT 1`,
      [huellaDeLlave(llave)]
    );

    const fila = filas?.[0] ?? null;
    if (!fila) return { estado: "desconocida" };
    if (fila.consumida_at) return { estado: "consumida" };
    if (new Date(fila.expira_at) < new Date()) return { estado: "caducada" };
    return { estado: "valida", numero: fila.numero, telefonoId: Number(fila.telefono_id) };
  }

  /**
   * Consume la llave y deja constancia de LAS DOS COSAS que el canal acaba de demostrar.
   *
   * Verificar por Telegram prueba que el número es suyo Y que tiene Telegram: es un solo suceso y
   * se escribe entero, en la misma transacción. Por eso `canal_id` es clave ajena al catálogo y no
   * un CHECK aparte — con dos vocabularios habría que escribirlo dos veces y podrían separarse.
   *
   * ⚠️ El SMS es el caso distinto y es correcto que lo sea: prueba el NÚMERO, no que tenga ninguna
   * aplicación. Marca su propio canal —un móvil recibe SMS, un fijo no— y deja Telegram y WhatsApp
   * como estaban.
   *
   * Y de ahí sale la respuesta a «¿está verificado este teléfono?»: lo está si tiene ALGÚN canal
   * verificado. No hay una bandera en `telefonos` que pueda quedarse en desacuerdo con las filas.
   */
  async consumir({ llave, canal }, connection = this.pool) {
    const resuelta = await this.resolver(llave, connection);
    if (resuelta.estado !== "valida") {
      return { verificado: false, estado: resuelta.estado };
    }

    const [canales] = await connection.query(
      "SELECT id FROM canales_mensajeria WHERE code = ? AND is_active = 1 LIMIT 1",
      [String(canal ?? "").trim().toLowerCase()]
    );
    if (!canales?.length) {
      throw errorDeCliente(`El canal '${canal}' no existe o no está activo.`);
    }
    const canalId = Number(canales[0].id);

    await connection.query(
      `UPDATE telefono_verification_keys
          SET consumida_at = CURRENT_TIMESTAMP, canal_id = ?
        WHERE llave_hash = ? AND consumida_at IS NULL`,
      [canalId, huellaDeLlave(llave)]
    );

    // ⚠️ NO se toca `telefonos`: esa tabla NO tiene columna `verificado`, y es a proposito. El
    // esquema lo dice donde importa — «la verificacion es POR CANAL, que es lo que el modelo viejo
    // no podia decir: `verify_whatsapp` era una bandera suelta que no distinguia este numero existe
    // de este numero tiene WhatsApp». Un telefono esta verificado si tiene ALGUN canal verificado;
    // no hay una segunda bandera que pueda contradecir a la primera.
    await connection.query(
      `INSERT INTO telefono_canales (telefono_id, canal_id, verificado, verificado_at)
       VALUES (?, ?, 1, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE verificado = 1, verificado_at = CURRENT_TIMESTAMP`,
      [resuelta.telefonoId, canalId]
    );

    return { verificado: true, telefonoId: resuelta.telefonoId, numero: resuelta.numero };
  }
}
