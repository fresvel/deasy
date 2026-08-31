import { verifyEmailCode } from "../../services/mail/emailVerification.js";
import { sendEmailVerification } from "../../services/mail/sendEmailVerification.js";
import { hayCorreoConfigurado } from "../../services/mail/configuracionDeCorreo.js";
import { getPostgresPool } from "../../config/postgres.js";

// Los dos pasos del correo dentro del registro obligatorio (C8).
//
// ⚠️ **SIEMPRE SOBRE `me`, NUNCA SOBRE UN `user_id` DEL CUERPO.** La ruta anterior
// (`POST /email/verify`) aceptaba `{ user_id, code }` SIN SESION, así que cualquiera podía probar
// códigos contra la cuenta de cualquiera —y de paso averiguar qué identificadores existen—. Con seis
// cifras y sin limitador de intentos (que es `C9` y todavía no existe), eso es un millón de intentos
// contra un blanco elegido.
//
// Atarlo a la sesión no sustituye al limitador: reduce el blanco de «cualquiera» a «el mío».

/** Un código por minuto. No es el limitador de `C9`: es evitar que el botón se convierta en un grifo. */
const ESPERA_ENTRE_ENVIOS_MS = 60 * 1000;

export const verificarMiCorreo = async (req, res) => {
  try {
    const codigo = String(req.body?.codigo ?? req.body?.code ?? "").trim();
    if (!codigo) {
      return res.status(400).json({ message: "Hace falta el código." });
    }

    await verifyEmailCode(req.user?.uid, codigo);
    return res.json({ verificado: true });
  } catch (error) {
    // Los tres motivos se distinguen porque son tres cosas distintas que hacer: pedir otro, mirar
    // bien lo que se teclea, o pedir otro también. Un «código incorrecto» para los tres dejaría a
    // quien tiene uno caducado tecleándolo una y otra vez.
    const porMotivo = {
      NO_CODE: "No hay ningún código activo. Pide uno nuevo.",
      CODE_EXPIRED: "El código caducó. Pide uno nuevo.",
      INVALID_CODE: "El código no es correcto.",
    };
    const message = porMotivo[error.message];
    if (!message) {
      console.error("Error verificando el correo:", error.message);
      return res.status(500).json({ message: "No se pudo comprobar el código." });
    }
    return res.status(400).json({ message });
  }
};

export const reenviarMiCodigo = async (req, res) => {
  try {
    if (!hayCorreoConfigurado()) {
      return res.status(503).json({ message: "Este servidor no puede enviar correo ahora mismo." });
    }

    const personId = Number(req.user?.uid);

    // El freno se calcula sobre la fila que ya existe, no en memoria: en memoria dejaría de
    // proteger en cuanto hubiera dos instancias, que es justo lo que `C9` tiene que resolver bien.
    const [filas] = await getPostgresPool().query(
      `SELECT c.created_at
         FROM email_verification_codes c
         INNER JOIN emails e ON e.id = c.email_id
        WHERE e.person_id = ?
        ORDER BY c.created_at DESC
        LIMIT 1`,
      [personId]
    );

    const ultimo = filas?.[0]?.created_at ? new Date(filas[0].created_at).getTime() : 0;
    const faltan = ESPERA_ENTRE_ENVIOS_MS - (Date.now() - ultimo);
    if (faltan > 0) {
      return res.status(429).json({
        message: `Espera ${Math.ceil(faltan / 1000)} segundos antes de pedir otro código.`,
        reintentarEn: Math.ceil(faltan / 1000),
      });
    }

    await sendEmailVerification({ personId });
    return res.json({ enviado: true });
  } catch (error) {
    console.error("No se pudo reenviar el código:", error.message);
    return res.status(500).json({ message: "No se pudo enviar el código." });
  }
};
