import { getPostgresPool } from "../../config/postgres.js";

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

  // El pais entra por codigo ISO ("EC") o por id; la provincia y la ciudad, por nombre o por id.
  // Por NOMBRE y no solo por id porque el formulario de registro enseña nombres, y porque el nombre
  // de una ciudad solo es unico DENTRO de su provincia: en Ecuador hay un canton "Bolivar" en Carchi
  // y otro en Manabi, y un "Olmedo" en Loja y otro en Manabi. Por eso cada nivel se resuelve
  // ACOTADO por el de arriba, nunca suelto.
  async resolveUbicacion({ pais, pais_id: paisIdDirecto, provincia, provincia_id: provinciaIdDirecto, ciudad, ciudad_id: ciudadIdDirecto } = {}) {
    this.ensurePool();

    let paisId = esVacio(paisIdDirecto) ? null : Number(paisIdDirecto);
    if (paisId === null && !esVacio(pais)) {
      const clave = String(pais).trim();
      const [filas] = await this.pool.query(
        "SELECT id FROM paises WHERE iso_alpha2 = ? OR name = ? LIMIT 1",
        [clave.toUpperCase(), clave]
      );
      if (!filas?.length) {
        throw errorDeCliente(`El país '${clave}' no está en el catálogo.`);
      }
      paisId = Number(filas[0].id);
    }

    let provinciaId = esVacio(provinciaIdDirecto) ? null : Number(provinciaIdDirecto);
    if (provinciaId === null && !esVacio(provincia)) {
      if (paisId === null) {
        throw errorDeCliente("Para resolver la provincia hace falta el país.");
      }
      const [filas] = await this.pool.query(
        "SELECT id FROM provincias WHERE pais_id = ? AND name = ? LIMIT 1",
        [paisId, String(provincia).trim()]
      );
      if (!filas?.length) {
        throw errorDeCliente(`La provincia '${String(provincia).trim()}' no está en el catálogo de ese país.`);
      }
      provinciaId = Number(filas[0].id);
    }

    let ciudadId = esVacio(ciudadIdDirecto) ? null : Number(ciudadIdDirecto);
    if (ciudadId === null && !esVacio(ciudad)) {
      if (provinciaId === null) {
        throw errorDeCliente("Para resolver la ciudad hace falta la provincia.");
      }
      const [filas] = await this.pool.query(
        "SELECT id FROM ciudades WHERE provincia_id = ? AND name = ? LIMIT 1",
        [provinciaId, String(ciudad).trim()]
      );
      if (!filas?.length) {
        throw errorDeCliente(`La ciudad '${String(ciudad).trim()}' no está en el catálogo de esa provincia.`);
      }
      ciudadId = Number(filas[0].id);
    }

    return { paisId, provinciaId, ciudadId };
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
    const { paisId, provinciaId, ciudadId } = await this.resolveUbicacion(direccion ?? {});

    const campos = [
      paisId,
      provinciaId,
      ciudadId,
      esVacio(direccion?.calle_primaria) ? null : String(direccion.calle_primaria).trim(),
      esVacio(direccion?.calle_secundaria) ? null : String(direccion.calle_secundaria).trim(),
      esVacio(direccion?.referencia) ? null : String(direccion.referencia).trim(),
      esVacio(direccion?.latitud) ? null : Number(direccion.latitud),
      esVacio(direccion?.longitud) ? null : Number(direccion.longitud)
    ];

    const [existentes] = await connection.query(
      "SELECT id FROM direcciones WHERE person_id = ? AND tipo = ? AND principal = 1 LIMIT 1",
      [personId, tipo]
    );

    if (existentes?.length) {
      await connection.query(
        `UPDATE direcciones
            SET pais_id = ?, provincia_id = ?, ciudad_id = ?,
                calle_primaria = ?, calle_secundaria = ?, referencia = ?,
                latitud = ?, longitud = ?
          WHERE id = ?`,
        [...campos, Number(existentes[0].id)]
      );
      return Number(existentes[0].id);
    }

    const [resultado] = await connection.query(
      `INSERT INTO direcciones
         (person_id, tipo, pais_id, provincia_id, ciudad_id,
          calle_primaria, calle_secundaria, referencia, latitud, longitud, principal)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [personId, tipo, ...campos]
    );
    return resultado?.insertId ?? null;
  }

  // Las direcciones ya resueltas a nombres, que es lo que se enseña. El id se conserva para poder
  // editarlas sin volver a buscarlas por nombre.
  async listarPorPersona(personId, connection = this.pool) {
    this.ensurePool();
    const [filas] = await connection.query(
      `SELECT d.id, d.tipo, d.principal,
              d.pais_id, pa.iso_alpha2 AS pais_iso, pa.name AS pais,
              d.provincia_id, pr.name AS provincia,
              d.ciudad_id, ci.name AS ciudad,
              d.calle_primaria, d.calle_secundaria, d.referencia,
              d.latitud, d.longitud
         FROM direcciones d
         LEFT JOIN paises pa ON pa.id = d.pais_id
         LEFT JOIN provincias pr ON pr.id = d.provincia_id
         LEFT JOIN ciudades ci ON ci.id = d.ciudad_id
        WHERE d.person_id = ? AND d.is_active = 1
        ORDER BY d.principal DESC, d.id ASC`,
      [personId]
    );
    return filas ?? [];
  }

  async principalDe(personId, tipo = TIPO_POR_DEFECTO, connection = this.pool) {
    const filas = await this.listarPorPersona(personId, connection);
    return filas.find((f) => f.tipo === tipo && Number(f.principal) === 1) ?? null;
  }
}

export { TIPOS as TIPOS_DIRECCION };
