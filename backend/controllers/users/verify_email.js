import { verifyEmailCode } from "../../services/mail/emailVerification.js";

export const verifyEmail = async (req, res) => {
  try {
    const { user_id, code } = req.body;

    if (!user_id || !code) {
      return res.status(400).json({
        ok: false,
        error: "user_id y código son requeridos",
      });
    }

    await verifyEmailCode(user_id, code);

    return res.json({
      ok: true,
      message: "Correo verificado correctamente",
    });

  } catch (error) {
    console.error("Error verificando email:", error.message);

    let message = "Error verificando código";

    if (error.message === "NO_CODE") {
      message = "No existe un código activo";
    } else if (error.message === "CODE_EXPIRED") {
      message = "El código ha expirado";
    } else if (error.message === "INVALID_CODE") {
      message = "Código incorrecto";
    }

    return res.status(400).json({
      ok: false,
      error: message,
    });
  }
};
