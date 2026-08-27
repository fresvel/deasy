import { getPostgresPool } from "../../config/postgres.js";

// El catalogo geografico, de lectura y SIN autenticar.
//
// Sin autenticar a proposito: lo consume el formulario de REGISTRO, que por definicion lo usa quien
// todavia no tiene cuenta. Lo que expone son nombres de paises y de divisiones administrativas
// publicas: no hay nada que proteger. Antes esta lista vivia solo en
// `frontend/src/core/constants/countries.js`, o sea duplicada y sin las provincias ni las ciudades.

const errorDeCliente = (mensaje) => {
  const error = new Error(mensaje);
  error.status = 400;
  return error;
};

export default class GeografiaService {
  constructor(pool = getPostgresPool()) {
    this.pool = pool;
  }

  ensurePool() {
    if (!this.pool) {
      throw new Error("La conexión con PostgreSQL no está disponible.");
    }
  }

  async listarPaises() {
    this.ensurePool();
    const [filas] = await this.pool.query(
      `SELECT id, iso_alpha2, name, phone_code
         FROM paises
        WHERE is_active = 1
        ORDER BY name ASC`
    );
    return filas ?? [];
  }

  async listarProvincias({ pais, paisId } = {}) {
    this.ensurePool();
    let id = paisId ? Number(paisId) : null;
    if (!id && pais) {
      const [filas] = await this.pool.query(
        "SELECT id FROM paises WHERE iso_alpha2 = ? LIMIT 1",
        [String(pais).trim().toUpperCase()]
      );
      if (!filas?.length) {
        throw errorDeCliente(`El país '${pais}' no está en el catálogo.`);
      }
      id = Number(filas[0].id);
    }
    if (!id) {
      throw errorDeCliente("Hace falta el país para listar sus provincias.");
    }
    const [filas] = await this.pool.query(
      `SELECT id, dpa_code, name
         FROM provincias
        WHERE pais_id = ? AND is_active = 1
        ORDER BY name ASC`,
      [id]
    );
    return filas ?? [];
  }

  async listarCiudades({ provinciaId } = {}) {
    this.ensurePool();
    if (!provinciaId) {
      throw errorDeCliente("Hace falta la provincia para listar sus ciudades.");
    }
    const [filas] = await this.pool.query(
      `SELECT id, dpa_code, name
         FROM ciudades
        WHERE provincia_id = ? AND is_active = 1
        ORDER BY name ASC`,
      [Number(provinciaId)]
    );
    return filas ?? [];
  }
}
