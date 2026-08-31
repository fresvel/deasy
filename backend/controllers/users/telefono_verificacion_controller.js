import TelefonoVerificacionService from "../../services/users/TelefonoVerificacionService.js";
import realtimeGateway from "../../services/realtime/RealtimeGateway.js";
import { canalesConQR, hayAlgunCanal } from "../../services/users/canalesDeVerificacion.js";
import { aFormatoInternacional } from "../../services/users/numerosDeTelefono.js";

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
      // Los canales van bajo su propia llave y no esparcidos en la raiz: la pantalla tiene que poder
      // recorrerlos para pintar el selector, y con ellos sueltos junto a `expira_at` y `numero` habia
      // que saberse de memoria cuales eran canales y cuales no.
      canales: await canalesConQR(llave),
      numero: aFormatoInternacional(telefono.numero, telefono.phone_code),
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
};

// ── Lo que llama el microservicio `channels` ────────────────────────────────────────────────────

// La SONDA: ¿esta llave sigue viva? No devuelve el número, y ése es el cambio de C2b — antes sí, y
// el servicio comparaba sin saber de qué país era. Telegram la necesita porque su bot tiene que
// PEDIR el contacto en un segundo paso, y pedírselo a alguien cuya llave no vale es hacerle
// compartir sus datos para nada.
export const estadoDeLlave = async (req, res) => {
  try {
    const { estado } = await servicio.estadoDeLlave(req.body?.llave);
    // Un 404 para todo lo que no vale, con el motivo dentro: al usuario le dicen cosas distintas y
    // sólo «caducada» y «consumida» significan «repite sin cambiar nada».
    return estado === "valida" ? res.json({ estado }) : res.status(404).json({ estado });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// El canal asegura que ESTE número mandó ESTA llave. Aporta un hecho que su transporte prueba; el
// veredicto lo dicta el backend, que es quien tiene el país del número guardado.
export const confirmarLlave = async (req, res) => {
  try {
    const { llave, numero, canal } = req.body ?? {};
    const resultado = await servicio.confirmar({ llave, numero, canal });
    if (!resultado.verificado) {
      // 409 y no 422: la petición está bien formada y lo que falla es el estado del mundo. Un solo
      // código para los cuatro motivos mantiene simple al cliente, que los traduce por `estado`.
      return res.status(409).json({ estado: resultado.estado });
    }
    // ⚠️ SE AVISA A LA SESION POR TIEMPO REAL, y el aviso va DESPUES de responder al canal --su
    // peticion no depende de que la persona tenga el navegador abierto.
    //
    // Sin esto, la pantalla del paso 3 obliga a pulsar «Ya lo hice» para enterarse de algo que el
    // servidor YA SABE. Ese boton se queda como respaldo --si el socket no conecta, o si la persona
    // verifico desde otro dispositivo-- pero deja de ser el camino normal.
    realtimeGateway.emitToUser(resultado.personId, "telefono:verificado", {
      telefonoId: resultado.telefonoId,
    });

    res.json({ verificado: true });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
};
