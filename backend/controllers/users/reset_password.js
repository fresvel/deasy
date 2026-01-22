import {
  sendResetCodeService,
  verifyResetCodeService,
  resetPasswordService
} from "../../services/mail/reset_password.js";

/**
 * POST /reset-password/request
 */
export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        ok: false,
        error: "Email requerido"
      });
    }

    await sendResetCodeService(email);

    return res.json({
      ok: true,
      message: "Si el correo existe, se enviará un código"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: "Error interno" });
  }
};

/**
 * POST /reset-password/verify
 */
export const verifyResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    const valid = await verifyResetCodeService(email, code);

    if (!valid) {
      return res.status(400).json({
        ok: false,
        error: "Código inválido o expirado"
      });
    }

    return res.json({
      ok: true,
      message: "Código válido"
    });
  } catch {
    res.status(400).json({
      ok: false,
      error: "Código inválido"
    });
  }
};

/**
 * POST /reset-password/reset
 */
export const resetPassword = async (req, res) => {
  try {
    const { email, code, password, repassword } = req.body;

    if (!password || !repassword) {
      return res.status(400).json({
        ok: false,
        error: "Contraseña requerida"
      });
    }

    if (password !== repassword) {
      return res.status(400).json({
        ok: false,
        error: "Las contraseñas no coinciden"
      });
    }

    await resetPasswordService(email, code, password);

    return res.json({
      ok: true,
      message: "Contraseña actualizada correctamente"
    });
  } catch (error) {
    console.error("Error en resetPassword:", error.message); // para depuración
    res.status(400).json({
      ok: false,
      error: error.message || "No se pudo cambiar la contraseña"
    });
  }
};

