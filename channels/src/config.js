/**
 * Lo que el servicio necesita del entorno, leído UNA vez y validado al arrancar.
 *
 * ⚠️ **Falla al arrancar, no al primer mensaje.** Un servicio que arranca sin token y muere cuando
 * alguien intenta verificarse le echa la culpa al usuario de un fallo de despliegue. Aquí se cae
 * antes, diciendo qué falta.
 *
 * ⚠️ Los canales son OPCIONALES por separado: un despliegue con Telegram y sin WhatsApp es legítimo,
 * y es justo el de hoy. Lo que no es legítimo es no tener ninguno — entonces el servicio no hace
 * nada y conviene decirlo.
 */
export const leerConfiguracion = (env = process.env) => {
  const faltan = [];
  const pedir = (nombre) => {
    const valor = String(env[nombre] ?? "").trim();
    if (!valor) faltan.push(nombre);
    return valor;
  };

  const deasy = {
    base: pedir("DEASY_API_URL"),
    clave: pedir("INTERNAL_SERVICE_KEY"),
  };

  const telegram = String(env.TELEGRAM_BOT_TOKEN ?? "").trim();
  // ⚠️ WhatsApp NO necesita credenciales: la sesion se vincula escaneando un QR desde el telefono.
  // Lo que se declara es la INTENCION de tenerlo, con el numero dedicado --que ademas es lo que la
  // pantalla necesita para componer el enlace `wa.me`.
  const whatsapp = String(env.WHATSAPP_NUMERO ?? "").trim();

  if (faltan.length) {
    throw new Error(`Faltan variables de entorno: ${faltan.join(", ")}.`);
  }
  if (!telegram && !whatsapp) {
    throw new Error(
      "No hay ningún canal configurado (TELEGRAM_BOT_TOKEN, WHATSAPP_NUMERO). " +
      "El servicio no tendría nada que hacer."
    );
  }

  // ⚠️ LA BARRIDA VIENE APAGADA, y eso es lo correcto por defecto: BORRAR SE SINCRONIZA AL TELEFONO
  // VINCULADO y es irreversible. Un servicio que llega borrando conversaciones en cuanto arranca es
  // exactamente lo que no se quiere en una maquina de desarrollo, donde la linea suele ser un
  // telefono personal con su propia agenda y su propio historial.
  //
  // ⚠️ SE ENCIENDE EN PRODUCCION, y con una condicion: que la linea dedicada sea una cuenta LIMPIA,
  // sin agenda ni historial previos. Con una cuenta con vida propia, la primera pasada se llevaria
  // conversaciones ajenas al sistema -- que es lo correcto segun la regla, y aun asi no es lo que
  // nadie espera ver la primera vez.
  //
  // Decision del dueño, 2026-09-02.
  const barrida = String(env.BARRIDA_CONVERSACIONES ?? "").trim() === "1";

  return { deasy, telegram, whatsapp, barrida };
};
