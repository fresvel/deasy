import { getPostgresPool } from "../../config/postgres.js";

// El catalogo geografico, de lectura y SIN autenticar.
//
// Sin autenticar a proposito: lo consume el formulario de REGISTRO, que por definicion lo usa quien
// todavia no tiene cuenta. Lo que expone son nombres de paises y de divisiones administrativas
// publicas: no hay nada que proteger. Antes esta lista vivia solo en
// `frontend/src/core/constants/countries.js`, o sea duplicada y sin las divisiones interiores.

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

  async listarCantones({ provinciaId } = {}) {
    this.ensurePool();
    if (!provinciaId) {
      throw errorDeCliente("Hace falta la provincia para listar sus cantones.");
    }
    const [filas] = await this.pool.query(
      `SELECT id, dpa_code, name
         FROM cantones
        WHERE provincia_id = ? AND is_active = 1
        ORDER BY name ASC`,
      [Number(provinciaId)]
    );
    return filas ?? [];
  }

  // La parroquia se pide POR CANTON y no por provincia: son 1 314 en Ecuador y listarlas todas no le
  // sirve a nadie. Devuelve tambien la clase, que es lo que deja al formulario separar la cabecera
  // de las urbanas y las rurales sin hacer aritmetica con el codigo DPA.
  async listarParroquias({ cantonId } = {}) {
    this.ensurePool();
    if (!cantonId) {
      throw errorDeCliente("Hace falta el cantón para listar sus parroquias.");
    }
    const [filas] = await this.pool.query(
      `SELECT p.id, p.dpa_code, p.name, cl.code AS clase, cl.name AS clase_nombre
         FROM parroquias p
         LEFT JOIN clases_parroquia cl ON cl.id = p.clase_id
        WHERE p.canton_id = ? AND p.is_active = 1
        ORDER BY cl.orden ASC, p.name ASC`,
      [Number(cantonId)]
    );
    return filas ?? [];
  }

  // COMO SE LLAMA CADA NIVEL en el pais de la institucion. Sin esto el formulario tendria que
  // escribir "Canton" a fuego, y eso solo vale para Ecuador: en España el nivel 2 es la provincia.
  async nomenclatura({ paisId } = {}) {
    this.ensurePool();
    if (!paisId) {
      throw errorDeCliente("Hace falta el país para resolver la nomenclatura territorial.");
    }
    const [filas] = await this.pool.query(
      `SELECT nivel, singular, plural
         FROM nomenclatura_territorial
        WHERE pais_id = ? AND is_active = 1
        ORDER BY nivel ASC`,
      [Number(paisId)]
    );
    return filas ?? [];
  }
}
