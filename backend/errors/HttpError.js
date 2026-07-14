// Error de NEGOCIO con código HTTP.
//
// POR QUÉ EXISTE. El backend tenía un defecto sistémico: las excepciones de negocio se
// lanzaban como `new Error("...")` y caían en el catch genérico de los controllers, que
// respondía SIEMPRE 500. Resultado: un periodo inexistente, un entregable ya iniciado o un
// intento de operar la solicitud de OTRA persona salían todos como "error de servidor", con
// el mensaje interno en crudo. Eso:
//   - miente al cliente (no es un fallo del servidor, es una petición inválida),
//   - ensucia la monitorización (los 500 dejan de significar nada),
//   - impide al frontend distinguir "no existe" de "no puedes" de "ya está hecho".
//
// La convención ya existía a medias: `sql_admin_controller` hace `error.statusCode || 400`
// y `SqlAdminService` ponía `error.statusCode = 403` a mano. Esto la formaliza.
//
// USO:
//   throw new HttpError("Periodo no encontrado.", 404);
//   throw notFound("Periodo no encontrado.");
//
// En el controller:
//   catch (error) { res.status(error.statusCode ?? 500).json({ error: error.message }); }
//
// Un error SIN statusCode sigue siendo un 500 — y eso está bien: significa que es un fallo
// de verdad, no una regla de negocio.
export default class HttpError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
}

/** 404 — el recurso no existe. */
export const notFound = (message) => new HttpError(message, 404);

/** 403 — existe, pero no es tuyo / no puedes. */
export const forbidden = (message) => new HttpError(message, 403);

/** 409 — el estado actual no admite la operación (p. ej. "ya está iniciado"). */
export const conflict = (message) => new HttpError(message, 409);

/** 400 — la petición está mal formada o le faltan datos. */
export const badRequest = (message) => new HttpError(message, 400);
