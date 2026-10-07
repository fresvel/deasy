import RecuperarCorreoService from "../../services/auth/RecuperarCorreoService.js";

let _servicio = null;
const servicio = () => (_servicio ??= new RecuperarCorreoService());

// PÚBLICO a propósito: lo usa quien no puede entrar. Ver el porqué del diseño en el servicio.
export const recuperarCorreo = async (req, res) => {
  try {
    const { email } = await servicio().recuperar(req.body ?? {});
    res.json({ email });
  } catch (error) {
    // El mismo código y el mismo mensaje para todo: el 401 no distingue «no existe» de «no es tu
    // contraseña», y el 500 no se puede confundir con ninguno de los dos.
    if (error.status === 401) {
      return res.status(401).json({ message: error.message });
    }
    console.error("Error recuperando el correo:", error);
    res.status(500).json({ message: "No se pudo procesar la solicitud." });
  }
};
