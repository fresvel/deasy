import fs from "node:fs";
import path from "node:path";

import pkg from "whatsapp-web.js";
import qrTerminal from "qrcode-terminal";

const { Client, LocalAuth } = pkg;

/**
 * El cliente real de WhatsApp. Es la ÚNICA pieza que sabe de `whatsapp-web.js`.
 *
 * ⚠️ **ESTO CONDUCE UN NAVEGADOR.** `whatsapp-web.js` no habla con una API: abre WhatsApp Web en un
 * Chromium y actúa como si fuera una persona. De ahí salen tres cosas que no son opcionales:
 *
 *  1. **La imagen lleva Chromium** (~400 MB). Se usa el del sistema en vez del que Puppeteer se
 *     descarga solo: uno por imagen, no dos.
 *  2. **`--no-sandbox`**, porque dentro de un contenedor el aislamiento de Chromium no puede crear
 *     sus espacios de nombres. Es lo que se hace en todos lados y el proceso ya está aislado por el
 *     propio contenedor.
 *  3. **La sesión vive en disco** (`LocalAuth`) y hay que darle un volumen, o cada reinicio pide
 *     volver a escanear el QR desde el teléfono. Eso no es un incordio: es un canal caído.
 *  4. **Y el perfil en disco se queda con un candado si el proceso no cierra limpio** — ver
 *     `retirarCandadosObsoletos`, que es lo que impide que ese candado deje el canal muerto.
 */

/**
 * Retira los candados de instancia única que Chromium deja en el perfil.
 *
 * ⚠️ **SIN ESTO, UN `SIGKILL` DEJA EL CANAL MUERTO PARA SIEMPRE.** Chromium marca el perfil como
 * suyo con `SingletonLock` --un enlace a `<host>-<pid>`-- y lo borra al salir. Si el contenedor
 * muere sin cerrar (`SIGKILL`, `docker kill`, la máquina apagada), el candado se queda apuntando a
 * un contenedor que ya no existe y el arranque siguiente falla con `Code: 21`. Como el nombre de
 * host cambia en cada contenedor, Chromium **nunca** lo reconoce como propio y no lo limpia solo.
 *
 * Y con `restart: unless-stopped` eso no es un fallo: es un **bucle** de reinicios contra un
 * candado que nadie va a quitar, con el mismo silencio de siempre --el backend emitiendo llaves
 * tan contento y nadie recibiendo nada--.
 *
 * Es seguro porque **el contenedor corre UN solo proceso** (`replicas: 1`, y los canales no se
 * escalan): si este código se está ejecutando, no hay otro Chromium vivo sobre este perfil.
 *
 * Medido el 2026-09-01: `SingletonLock -> 9b42716eb02a-19`, de un contenedor ya retirado.
 *
 * @param {string} rutaDeSesion  la carpeta de `LocalAuth`
 * @returns {string[]}  los candados retirados, para poder decirlo en el registro
 */
export const retirarCandadosObsoletos = (rutaDeSesion) => {
  const perfil = path.join(rutaDeSesion, "session");
  const retirados = [];
  for (const nombre of ["SingletonLock", "SingletonCookie", "SingletonSocket"]) {
    const candado = path.join(perfil, nombre);
    try {
      // `lstat`, NO `existsSync`: son ENLACES SIMBÓLICOS y apuntan a algo que ya no existe, así
      // que `existsSync` los sigue y dice que no están.
      fs.lstatSync(candado);
      fs.unlinkSync(candado);
      retirados.push(nombre);
    } catch {
      // No estaba, que es el caso normal de un cierre limpio.
    }
  }
  return retirados;
};
export const crearClienteDeWhatsApp = ({ rutaDeSesion = "/app/.wwebjs_auth" } = {}) => {
  const retirados = retirarCandadosObsoletos(rutaDeSesion);
  if (retirados.length) {
    console.warn(
      `[channels] whatsapp: el proceso anterior no cerró limpio; retiro ${retirados.join(", ")}.`
    );
  }

  return new Client({
    authStrategy: new LocalAuth({ dataPath: rutaDeSesion }),
    puppeteer: {
      headless: true,
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        // Chromium usa /dev/shm para memoria compartida y en un contenedor son 64 MB por defecto:
        // sin esto se cae solo al cargar una página pesada, y WhatsApp Web lo es.
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    },
  });
};

/** El QR en el registro del contenedor, para poder vincular sin pantalla de administración. */
export const dibujarQREnConsola = (qr) => qrTerminal.generate(qr, { small: true });
