import Limitador from "../services/limites/Limitador.js";
import { SUJETOS } from "../services/limites/reglas.js";

/**
 * El puente entre el limitador y HTTP.
 *
 * ── DÓNDE SE PONE, QUE ES LA MITAD DEL VALOR ────────────────────────────────────────────────────
 *
 * **LO PRIMERO de la cadena de la ruta**, antes de validar nada y antes de tocar la base o un
 * servicio externo. Un limitador que corre después del trabajo caro no protege del trabajo caro:
 *
 *  · En `/login` va antes de **bcrypt**, que es caro A PROPÓSITO. Si no, quien dispara sigue
 *    gastando nuestro procesador aunque cada intento se rechace.
 *  · En `/validate/cedula` va antes de la llamada a **webservices.ec**, que cuesta dinero.
 */

const limitadorPorDefecto = new Limitador();

/**
 * De dónde sale el sujeto que se cuenta.
 *
 * ⚠️ `req.ip` es la IP REAL del cliente porque `index.js` declara `app.set("trust proxy", 1)` y
 * nginx manda `X-Forwarded-For`. Sin eso, todas las peticiones parecerían venir del proxy y el
 * limitador contaría a TODO EL MUNDO EN EL MISMO CUBO --que es como se deja fuera a una institución
 * entera con una sola regla--.
 */
export const sujetoDe = (req, forma) => {
  const ip = req.ip || req.socket?.remoteAddress || "";
  switch (forma) {
    case SUJETOS.IP:
      return ip;
    case SUJETOS.CORREO_E_IP: {
      // En minúsculas: `Ana@x.ec` y `ana@x.ec` son la misma cuenta, y contarlos por separado daría
      // el doble de intentos a quien alterne las mayúsculas.
      const correo = String(req.body?.email ?? req.body?.correo ?? "").trim().toLowerCase();
      return correo ? `${correo}|${ip}` : ip;
    }
    case SUJETOS.PERSONA: {
      const persona = req.user?.uid ?? req.auth?.personId;
      return persona ? String(persona) : "";
    }
    default:
      return ip;
  }
};

/**
 * @param {string} accion  una clave de `REGLAS`. Sin regla, no frena nada.
 */
export const limitaIntentos = (accion, { limitador = limitadorPorDefecto } = {}) => {
  const regla = limitador.reglas[accion];

  return async (req, res, next) => {
    if (!regla) return next();

    const sujeto = sujetoDe(req, regla.sujeto);
    const { permitido, reintentarEn } = await limitador.comprobar(accion, sujeto);

    if (permitido) {
      // Se deja a mano para que el controlador pueda decir «este intento contó» SÓLO si falló.
      // Es lo que impide castigar a quien acierta.
      req.anotarIntentoFallido = () => limitador.registrar(accion, sujeto);
      return next();
    }

    // `Retry-After` en segundos, que es lo que dice la norma para un 429 y lo que un cliente
    // razonable respeta solo. Sin esta cabecera, un reintento automático machaca en bucle.
    res.set("Retry-After", String(reintentarEn));
    return res.status(429).json({
      message: "Demasiados intentos. Espera un momento y vuelve a probar.",
      reintentarEn,
    });
  };
};

/**
 * Para las rutas donde CUALQUIER paso cuenta, acierto o fallo — las anónimas que mandan un correo o
 * llaman a un servicio de pago. Ahí no hay «acierto» que premiar: la petición ya costó.
 */
export const limitaYCuenta = (accion, opciones = {}) => {
  const frenar = limitaIntentos(accion, opciones);
  return (req, res, next) =>
    frenar(req, res, () => {
      req.anotarIntentoFallido?.();
      next();
    });
};
