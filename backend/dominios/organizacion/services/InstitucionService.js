// La institución que usa esta instalación.
//
// Existe para que el código deje de asumir Ecuador. De aquí sale el país, y del país salen el
// validador del documento nacional, su nombre local y el valor que el formulario precarga.
//
// `actual()` FALLA si hay cero o más de una fila, en vez de elegir en silencio. No es celo: elegir
// «la primera» ante dos instituciones daría un país equivocado, y con él un validador equivocado —
// un número se rechazaría o se aceptaría sin que nadie entendiera por qué. Un fallo ruidoso al
// arrancar cuesta un minuto; uno silencioso, una tarde.
//
// Y es la COSTURA del multi-inquilino: el día que haya varias instituciones, la resolución entra
// por aquí y no hay que buscarla por el código.

import { getPostgresPool } from "../../../config/postgres.js";

const errorDeConfiguracion = (mensaje) => {
  const error = new Error(mensaje);
  error.status = 500;
  error.statusCode = 500;
  return error;
};

export default class InstitucionService {
  // El pool por defecto, como en el resto de servicios. Sin el, un controlador que instancie
  // `new InstitucionService()` revienta con "Cannot read properties of undefined (reading 'query')",
  // que es exactamente lo que paso al estrenar el endpoint publico.
  constructor(pool = getPostgresPool()) {
    this.pool = pool;
  }

  /** La institución de esta instalación, con su país ya resuelto (id, ISO y nombre). */
  async actual(connection = this.pool) {
    const [filas] = await connection.query(
      `SELECT i.id, i.nombre, i.pais_id, p.iso_alpha2 AS pais_iso, p.name AS pais_nombre
         FROM instituciones i
         INNER JOIN paises p ON p.id = i.pais_id
        WHERE i.is_active = 1
        ORDER BY i.id ASC`
    );

    if (!filas.length) {
      throw errorDeConfiguracion(
        "No hay ninguna institución configurada. La siembra el bootstrap: ejecuta /setup."
      );
    }
    if (filas.length > 1) {
      throw errorDeConfiguracion(
        `Hay ${filas.length} instituciones activas y el sistema todavía no sabe elegir entre ellas. ` +
        "Deja una sola activa en /admin."
      );
    }
    return filas[0];
  }

  /** El país de la institución, que es lo que casi todo el mundo quiere de aquí. */
  async paisActual(connection = this.pool) {
    const institucion = await this.actual(connection);
    return {
      id: institucion.pais_id,
      iso: institucion.pais_iso,
      nombre: institucion.pais_nombre
    };
  }
}
