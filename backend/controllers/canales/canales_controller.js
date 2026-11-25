import RbacService from "../../services/auth/RbacService.js";
import ClienteDeChannels from "../../services/canales/ClienteDeChannels.js";

let _cliente = null;
const cliente = () => (_cliente ??= new ClienteDeChannels());
let _rbac = null;
const rbac = () => (_rbac ??= new RbacService());

/**
 * Cómo están los canales.
 *
 * ⚠️ **RESPONDE 200 AUNQUE EL SERVICIO NO CONTESTE**, y no es dejadez: no poder hablar con
 * `channels` **es el estado del sistema**, y es exactamente lo que se quería saber el día que estuvo
 * trece horas muerto. Un 500 lo enseñaría como «la pantalla falla», que es la lectura equivocada y
 * la que hace que alguien recargue en vez de ir a mirar el contenedor.
 */
export const estadoDeCanales = async (req, res) => {
  const respuesta = await cliente().estado();

  if (!respuesta.alcanzable) {
    return res.json({
      servicio: { alcanzable: false, error: respuesta.error, comprobadoEn: new Date().toISOString() },
      // `false` aunque quien mire tenga `manage`: no es una cuestión de permiso, es que NO HAY NADA
      // que enseñar. El campo dice «ofrece el botón», y aquí no hay botón que ofrecer.
      puedeVerQr: false,
      // Vacío y NO nulo: la pantalla recorre esto sin preguntarse si existe.
      canales: [],
    });
  }

  return res.json({
    servicio: {
      alcanzable: true,
      ...(respuesta.servicio ?? {}),
      // Lo pone el BACKEND a propósito: dice cuándo se PREGUNTÓ, no cuándo se generó nada. Si algún
      // día la respuesta viniera de una caché, se vería aquí.
      comprobadoEn: new Date().toISOString(),
    },
    // Se dice si PUEDE pedirlo, para que la pantalla no ofrezca un botón que va a dar 403. La
    // comprobación de verdad la hace la ruta del QR: esto es cortesía, no seguridad.
    puedeVerQr: rbac().can(req.access, "channels", "manage"),
    canales: respuesta.canales ?? [],
  });
};

/**
 * El código de vinculación de WhatsApp.
 *
 * ⚠️ **ESTO NO ES «UN DATO MÁS DE ADMINISTRACIÓN».** Quien escanea este código decide **qué cuenta
 * de WhatsApp ES el canal de la institución**: a partir de ahí, las verificaciones de teléfono del
 * sistema pasan por un WhatsApp que eligió quien escaneó. Es una toma de control de la identidad del
 * canal, y por eso pide `manage` y no `read`, y por eso se registra quién lo pidió.
 */
export const codigoDeVinculacion = async (req, res) => {
  const respuesta = await cliente().codigoDeVinculacion();

  if (!respuesta.alcanzable) {
    return res.status(503).json({ message: "No se pudo hablar con el servicio de canales." });
  }

  // ⚠️ 409 y no 404: «el canal no necesita vincularse» es una respuesta útil --dice que está bien--,
  // y hay que distinguirla de «esa ruta no existe».
  if (respuesta.hayQr === false || respuesta.codigo === 409) {
    return res.status(409).json({ message: "El canal no necesita vincularse ahora mismo." });
  }

  // Es la única acción de esta pantalla capaz de cambiar la identidad del canal: queda dicho quién.
  console.warn(
    `[canales] la persona ${req.user?.uid} pidió el código de vinculación de WhatsApp`
  );
  return res.json({ qr: respuesta.qr, generadoEn: respuesta.generadoEn });
};
