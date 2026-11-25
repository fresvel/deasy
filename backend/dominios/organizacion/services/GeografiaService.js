import { getPostgresPool } from "../../../config/postgres.js";
import {
  paisesActivos,
  idDePaisPorIso,
  provinciasDelPais,
  cantonesDeLaProvincia,
  parroquiasDelCanton,
  nomenclaturaDelPais
} from "../datos/geografia.js";

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
    return paisesActivos(this.pool);
  }

  async listarProvincias({ pais, paisId } = {}) {
    this.ensurePool();
    let id = paisId ? Number(paisId) : null;
    if (!id && pais) {
      id = await idDePaisPorIso(this.pool, pais);
      if (!id) {
        throw errorDeCliente(`El país '${pais}' no está en el catálogo.`);
      }
    }
    if (!id) {
      throw errorDeCliente("Hace falta el país para listar sus provincias.");
    }
    return provinciasDelPais(this.pool, id);
  }

  async listarCantones({ provinciaId } = {}) {
    this.ensurePool();
    if (!provinciaId) {
      throw errorDeCliente("Hace falta la provincia para listar sus cantones.");
    }
    return cantonesDeLaProvincia(this.pool, provinciaId);
  }

  async listarParroquias({ cantonId } = {}) {
    this.ensurePool();
    if (!cantonId) {
      throw errorDeCliente("Hace falta el cantón para listar sus parroquias.");
    }
    return parroquiasDelCanton(this.pool, cantonId);
  }

  async nomenclatura({ paisId } = {}) {
    this.ensurePool();
    if (!paisId) {
      throw errorDeCliente("Hace falta el país para resolver la nomenclatura territorial.");
    }
    return nomenclaturaDelPais(this.pool, paisId);
  }
}
