import { verifyEmailCode } from "../../../services/mail/emailVerification.js";
import { sendEmailVerification } from "../../../services/mail/sendEmailVerification.js";
import { hayCorreoConfigurado } from "../../../services/mail/configuracionDeCorreo.js";
import { getPostgresPool } from "../../../config/postgres.js";
import { ultimoCodigoEnviadoAt } from "../../../services/mail/saveEmailVerificationCode.js";
import EmailService from "../services/EmailService.js";
import TelefonoService from "../services/TelefonoService.js";

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
    // proteger en cuanto hubiera dos instancias.
    //
    // ⚠️ **Y SE QUEDA ASÍ, aunque `C9` ya trajo un limitador general** (`services/limites/`). Se
    // evaluó migrarlo y **éste es mejor**: cuenta desde el `created_at` del último código ENVIADO,
    // que es el hecho que se quiere frenar y que ya está guardado. Contarlo aparte crearía dos
    // fuentes de verdad y costaría una fila por reenvío. El porqué completo, en `limites/reglas.js`.
    const ultimo = await ultimoCodigoEnviadoAt(personId);
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

// ── CORREGIR EL DATO QUE SE ESTÁ VERIFICANDO ────────────────────────────────────────────────────
//
// ⚠️ **SIN ESTO, UNA ERRATA ES UNA CUENTA MUERTA.** Reportado por el dueño: quien escribe mal su
// correo o su teléfono en el registro queda encerrado para siempre — el guard le exige verificar
// algo que no puede recibir, no hay pantalla que le deje cambiarlo (el perfil está detrás de la
// misma puerta), y su correo y su teléfono quedan OCUPADOS, así que tampoco puede volver a
// registrarse. Ni siquiera puede pedir ayuda: no hay nadie a quien escribirle desde dentro.
//
// Cambiar el dato mientras se verifica no debilita nada: lo que la puerta exige es PROBAR el dato
// que se declare, no que se declare a la primera.

export const cambiarMiCorreo = async (req, res) => {
  const personId = Number(req.user?.uid);
  const direccion = String(req.body?.direccion ?? "").trim().toLowerCase();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(direccion)) {
    return res.status(400).json({ message: "Ese correo no tiene una forma válida." });
  }

  try {
    // `guardarPrincipal` ya deja `verificado = 0` cuando la dirección CAMBIA, que es justo lo que
    // hace falta: un correo nuevo no hereda la verificación del anterior.
    const emails = new EmailService(getPostgresPool());
    await emails.guardarPrincipal(personId, { tipo: "personal", direccion });

    // Y se manda el código al nuevo de inmediato: quien acaba de corregirlo está esperándolo.
    if (hayCorreoConfigurado()) {
      await sendEmailVerification({ personId }).catch((error) => {
        console.error("No se pudo enviar el código al correo nuevo:", error.message);
      });
    }
    return res.json({ direccion });
  } catch (error) {
    // El servicio lanza con `status` y con un mensaje escrito para una persona --«ese correo ya está
    // registrado por otra»--, y aplastarlo en un 400 genérico deja a alguien sin saber qué corregir.
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error("No se pudo cambiar el correo:", error.message);
    return res.status(500).json({ message: "No se pudo cambiar el correo." });
  }
};

export const cambiarMiTelefono = async (req, res) => {
  const personId = Number(req.user?.uid);
  const { numero, pais_id: paisId, tipo } = req.body ?? {};

  if (!String(numero ?? "").replace(/\D/g, "")) {
    return res.status(400).json({ message: "Hace falta el número." });
  }

  try {
    const telefonos = new TelefonoService(getPostgresPool());
    const telefonoId = await telefonos.guardarPrincipal(personId, {
      tipo: tipo || "personal",
      numero,
      pais_id: paisId,
    });

    // Las llaves vivas y la verificación por canal las invalida `guardarPrincipal` cuando el número
    // cambia de verdad. Aquí no se repite: estaba escrito en este controller y NO en los otros dos
    // caminos que cambian un número, así que el comportamiento dependía de por qué pantalla entraras.
    return res.json({ telefonoId });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error("No se pudo cambiar el teléfono:", error.message);
    return res.status(500).json({ message: "No se pudo cambiar el teléfono." });
  }
};
