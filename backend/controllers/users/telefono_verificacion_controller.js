import TelefonoVerificacionService from "../../services/users/TelefonoVerificacionService.js";
import { canalesConfigurados, hayAlgunCanal, aFormatoInternacional } from "../../services/users/canalesDeVerificacion.js";

const servicio = new TelefonoVerificacionService();

// Pide una llave para verificar UN teléfono propio. Devuelve ya compuesto lo que la pantalla necesita
// para pintar el QR y los botones, para que el frontend no tenga que saber armar enlaces de
// Telegram ni acordarse de que el prefijo va sin el `+`.
export const pedirVerificacionDeTelefono = async (req, res) => {
  try {
    // Con cero canales no se llega a tocar la base. Comprobar primero cuesta una lectura de entorno
    // y evita dejar llaves vivas que sólo sirven para invalidar la siguiente.
    if (!hayAlgunCanal()) {
      return res.status(503).json({
        message: "No hay ningún canal de verificación configurado en este entorno.",
      });
    }

    // La ruta es `/me/…`, así que el dueño sale del token y NUNCA de la petición. Sin esto,
    // cualquiera con sesión pedía una llave para el teléfono de otro y se llevaba su número en la
    // respuesta — el mismo IDOR que ya mordió en los entregables.
    const { llave, expira_at, telefono } = await servicio.crear({
      telefonoId: req.params?.id,
      personId: req.user?.uid,
    });

    res.json({
      expira_at,
      ...canalesConfigurados(llave),
      numero: aFormatoInternacional(telefono.numero, telefono.phone_code),
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
};

// ── Lo que llama el microservicio `channels` ────────────────────────────────────────────────────

export const resolverLlave = async (req, res) => {
  try {
    const resultado = await servicio.resolver(req.body?.llave);
    if (resultado.estado !== "valida") {
      // El estado viaja para que el canal le diga al usuario la verdad: «no válido», «caducado» y
      // «ya usado» son tres mensajes distintos, y sólo el tercero le dice que pida otro sin cambiar
      // nada de lo que hizo.
      return res.status(404).json({ estado: resultado.estado });
    }
    // Va SOLO el número, no de quién es: el servicio no lo necesita, y no dárselo evita que una
    // llave filtrada sirva para averiguar quién es alguien.
    res.json({ estado: "valida", numero: resultado.numero });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const consumirLlave = async (req, res) => {
  try {
    const resultado = await servicio.consumir({ llave: req.body?.llave, canal: req.body?.canal });
    if (!resultado.verificado) {
      return res.status(409).json({ estado: resultado.estado });
    }
    res.json({ verificado: true });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
};
