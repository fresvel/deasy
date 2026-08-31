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

  if (faltan.length) {
    throw new Error(`Faltan variables de entorno: ${faltan.join(", ")}.`);
  }
  if (!telegram) {
    throw new Error(
      "No hay ningún canal configurado (TELEGRAM_BOT_TOKEN). El servicio no tendría nada que hacer."
    );
  }

  return { deasy, telegram };
};
