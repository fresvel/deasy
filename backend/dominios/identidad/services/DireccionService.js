import { getPostgresPool } from "../../../config/postgres.js";
import { principalDeSuTipo, actualizarPrincipal, insertarPrincipal } from "../datos/direcciones.js";
import {
  idDePaisPorIsoONombre,
  idDeProvinciaEnElPais,
  idDeCantonEnLaProvincia,
  listarConNombres
} from "../datos/consulta/ubicacionDeLaDireccion.js";

// Las direcciones de una persona. Una fila por direccion, con su tipo.
//
// POR QUE ESTA FUERA DE `UserRepository`. Porque es otra responsabilidad: resolver un nombre de
// provincia contra el catalogo no tiene nada que ver con autenticar a nadie, y `UserRepository` ya
// arrastra bastante. La regla de capas del repositorio dice que la logica va en `services/`.
//
// EL ERROR QUE ESTO SUSTITUYE. `persons` tenia SIETE columnas de direccion en DOS modelos que no se
// hablaban: `direccion` (texto libre) que exponia /admin, y las seis `*_residencia`/`calle_*`/
// `codigo_postal` que escribe el registro y que el editor generico ni mostraba.

const TIPOS = ["residencia", "trabajo"];
const TIPO_POR_DEFECTO = "residencia";

// Un error de dato mal enviado, no una averia: el transporte lo traduce a 400.
const errorDeCliente = (mensaje) => {
  const error = new Error(mensaje);
  error.status = 400;
  return error;
};

const esVacio = (valor) => valor === undefined || valor === null || String(valor).trim() === "";

export default class DireccionService {
  constructor(pool = getPostgresPool()) {
    this.pool = pool;
  }

  ensurePool() {
    if (!this.pool) {
      throw new Error("La conexión con PostgreSQL no está disponible.");
    }
  }

  // El pais entra por codigo ISO ("EC") o por id; la provincia y el canton, por nombre o por id.
  // Por NOMBRE y no solo por id porque el formulario de registro enseña nombres, y porque el nombre
  // de un canton solo es unico DENTRO de su provincia: en Ecuador hay un canton "Bolivar" en Carchi
  // y otro en Manabi, y un "Olmedo" en Loja y otro en Manabi. Por eso cada nivel se resuelve
  // ACOTADO por el de arriba, nunca suelto.
  async resolveUbicacion({ pais, pais_id: paisIdDirecto, provincia, provincia_id: provinciaIdDirecto, canton, canton_id: cantonIdDirecto } = {}) {
    this.ensurePool();

    let paisId = esVacio(paisIdDirecto) ? null : Number(paisIdDirecto);
    if (paisId === null && !esVacio(pais)) {
      const clave = String(pais).trim();
      paisId = await idDePaisPorIsoONombre(this.pool, clave);
      if (paisId === null) {
        throw errorDeCliente(`El país '${clave}' no está en el catálogo.`);
      }
    }

    let provinciaId = esVacio(provinciaIdDirecto) ? null : Number(provinciaIdDirecto);
    if (provinciaId === null && !esVacio(provincia)) {
      if (paisId === null) {
        throw errorDeCliente("Para resolver la provincia hace falta el país.");
      }
      provinciaId = await idDeProvinciaEnElPais(this.pool, paisId, String(provincia).trim());
      if (provinciaId === null) {
        throw errorDeCliente(`La provincia '${String(provincia).trim()}' no está en el catálogo de ese país.`);
      }
    }

    let cantonId = esVacio(cantonIdDirecto) ? null : Number(cantonIdDirecto);
    if (cantonId === null && !esVacio(canton)) {
      if (provinciaId === null) {
        throw errorDeCliente("Para resolver el cantón hace falta la provincia.");
      }
      cantonId = await idDeCantonEnLaProvincia(this.pool, provinciaId, String(canton).trim());
      if (cantonId === null) {
        throw errorDeCliente(`El cantón '${String(canton).trim()}' no está en el catálogo de esa provincia.`);
      }
    }

    return { paisId, provinciaId, cantonId };
  }

  normalizarTipo(tipo) {
    const valor = esVacio(tipo) ? TIPO_POR_DEFECTO : String(tipo).trim().toLowerCase();
    if (!TIPOS.includes(valor)) {
      throw errorDeCliente(`El tipo de dirección '${valor}' no existe. Los válidos son: ${TIPOS.join(", ")}.`);
    }
    return valor;
  }

  // Guarda LA principal de su tipo: si ya hay una, la actualiza; si no, la crea. Es lo que necesitan
  // el registro y el perfil, que manejan una sola direccion. Para varias, `crear`.
  async guardarPrincipal(personId, direccion, connection = this.pool) {
    this.ensurePool();
    const tipo = this.normalizarTipo(direccion?.tipo);
    const { paisId, provinciaId, cantonId } = await this.resolveUbicacion(direccion ?? {});

    const campos = [
      paisId,
      provinciaId,
      cantonId,
      esVacio(direccion?.sector) ? null : String(direccion.sector).trim(),
      esVacio(direccion?.barrio) ? null : String(direccion.barrio).trim(),
      esVacio(direccion?.calle_primaria) ? null : String(direccion.calle_primaria).trim(),
      esVacio(direccion?.calle_secundaria) ? null : String(direccion.calle_secundaria).trim(),
      esVacio(direccion?.referencia) ? null : String(direccion.referencia).trim(),
      esVacio(direccion?.latitud) ? null : Number(direccion.latitud),
      esVacio(direccion?.longitud) ? null : Number(direccion.longitud)
    ];

    const existente = await principalDeSuTipo(connection, personId, tipo);
    if (existente) {
      await actualizarPrincipal(connection, existente, campos);
      return existente;
    }

    return insertarPrincipal(connection, personId, tipo, campos);
  }

  async listarPorPersona(personId, connection = this.pool) {
    this.ensurePool();
    return listarConNombres(connection, personId);
  }

  async principalDe(personId, tipo = TIPO_POR_DEFECTO, connection = this.pool) {
    const filas = await this.listarPorPersona(personId, connection);
    return filas.find((f) => f.tipo === tipo && Number(f.principal) === 1) ?? null;
  }
}

export { TIPOS as TIPOS_DIRECCION };
