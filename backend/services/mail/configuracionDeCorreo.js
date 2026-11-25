// ¿Puede este despliegue enviar correo?
//
// ⚠️ **Esto existe porque el fallo natural es SILENCIOSO.** Sin `SMTP_HOST`, el transporte cae al
// proveedor que estaba cableado en el código y sin credenciales: el envío revienta en tiempo de
// llamada con un error de red, muy lejos de la causa. Y desde que la verificación del correo es
// obligatoria, eso no es un correo perdido — es que **nadie puede registrarse**.
//
// Es el mismo criterio que `hayAlgunCanal()` para los teléfonos: un despliegue al que se le olvidó
// configurar algo tiene que decirlo donde se ve, no fallarle al usuario como si fuera culpa suya.

/**
 * Lo mínimo para enviar: a dónde y de parte de quién.
 *
 * ⚠️ Las credenciales NO entran en el mínimo, y es a propósito: un buzón local de desarrollo no
 * pide ninguna, y exigirlas rompería justo el montaje que permite probar el envío de verdad.
 */
export const loQueFalta = (env = process.env) =>
  ["SMTP_HOST", "SMTP_FROM"].filter((clave) => !String(env[clave] ?? "").trim());

export const hayCorreoConfigurado = (env = process.env) => loQueFalta(env).length === 0;

/** Para el registro del servidor y para el mensaje de error: qué falta y qué pasa si no se pone. */
export const explicacion = (env = process.env) => {
  const faltan = loQueFalta(env);
  if (!faltan.length) return null;
  return (
    `Falta configurar el correo saliente (${faltan.join(", ")}). ` +
    "Sin él nadie puede registrarse, porque la verificación del correo es obligatoria."
  );
};
