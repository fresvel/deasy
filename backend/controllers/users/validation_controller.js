import { validateCedulaEc, validateWhatsappEc } from "../../services/external/webservices_ec.js";

const CEDULA_REGEX = /^\d{10}$/;
const WHATSAPP_REGEX = /^\d{12,15}$/; // incluye código de país sin "+"

export const verifyCedulaEc = async (req, res) => {
  const { cedula } = req.params;

  if (!CEDULA_REGEX.test(cedula)) {
    return res.status(400).json({
      message: "La cédula debe contener exactamente 10 dígitos"
    });
  }

  try {
    const result = await validateCedulaEc(cedula);
    res.json(result);
  } catch (error) {
    console.error("Error al validar cédula en WebServices.ec:", error);
    res.status(error.status || 500).json({
      message: error.message || "Error al validar la cédula"
    });
  }
};

export const verifyWhatsappEc = async (req, res) => {
  const { phone } = req.params;

  if (!WHATSAPP_REGEX.test(phone)) {
    return res.status(400).json({
      message: "El número debe incluir el código de país y contener solo dígitos"
    });
  }

  try {
    const result = await validateWhatsappEc(phone);
    res.json(result);
  } catch (error) {
    console.error("Error al validar número de WhatsApp en WebServices.ec:", error);
    res.status(error.status || 500).json({
      message: error.message || "Error al validar el número de WhatsApp"
    });
  }
};

