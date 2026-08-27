import { getPostgresPool } from "../../config/postgres.js";

// Los correos de una persona.
//
// ESTO SOSTIENE EL LOGIN. `persons.email` era UNIQUE y se entraba por el; al pasar a 1:N hacen falta
// dos garantias que antes daba gratis una sola columna:
//
//   · la direccion es unica EN TODO EL SISTEMA (`uq_emails_direccion`), o el login no sabria a quien
//     dejar entrar;
//   · hay UN principal por persona (`uq_emails_principal`), o "manda el correo a esta persona" no
//     tiene respuesta.
//
// El principal es uno POR PERSONA, no por tipo: con la direccion y el telefono tiene sentido tener a
// la vez una de residencia y una de trabajo; con el correo no.

const TIPOS = ["personal", "institucional"];
const TIPO_POR_DEFECTO = "institucional";

// 400 = el cliente mando mal el dato. Se ponen los DOS nombres a proposito: el transporte de
// usuarios lee `error.status` y el motor generico de /admin lee `error.statusCode`.
const errorDeCliente = (mensaje) => {
  const error = new Error(mensaje);
  error.status = 400;
  error.statusCode = 400;
  return error;
};

// 409 = el dato esta bien formado pero YA ESTA COGIDO. Es otra cosa que un 400, y el editor
// generico ya distinguia las dos: sus violaciones de unicidad son 409 desde `errors/sqlErrors.js`.
const errorDeConflicto = (mensaje) => {
  const error = new Error(mensaje);
  error.status = 409;
  error.statusCode = 409;
  return error;
};

const esVacio = (valor) => valor === undefined || valor === null || String(valor).trim() === "";

// Se guarda en minusculas. El correo no distingue mayusculas en la practica, y sin normalizar
// "Ana@x.com" y "ana@x.com" serian dos filas distintas que el indice unico dejaria pasar: dos
// personas con el mismo correo y el login eligiendo una.
const normalizar = (valor) => String(valor ?? "").trim().toLowerCase();

export default class EmailService {
  constructor(pool = getPostgresPool()) {
    this.pool = pool;
  }

  ensurePool() {
    if (!this.pool) {
      throw new Error("La conexión con PostgreSQL no está disponible.");
    }
  }

  normalizarTipo(tipo) {
    const valor = esVacio(tipo) ? TIPO_POR_DEFECTO : String(tipo).trim().toLowerCase();
    if (!TIPOS.includes(valor)) {
      throw errorDeCliente(`El tipo de correo '${valor}' no existe. Los válidos son: ${TIPOS.join(", ")}.`);
    }
    return valor;
  }

  // Guarda EL principal. Es lo que necesitan el registro y el perfil, que manejan un solo correo.
  async guardarPrincipal(personId, correo, connection = this.pool) {
    this.ensurePool();
    const datos = typeof correo === "string" ? { direccion: correo } : (correo ?? {});
    const direccion = normalizar(datos.direccion ?? datos.email);
    if (!direccion) {
      throw errorDeCliente("El correo necesita una dirección.");
    }
    const tipo = this.normalizarTipo(datos.tipo);

    // La direccion es de UNA persona. Se dice antes de que lo diga el indice, porque el error de
    // PostgreSQL no le sirve a nadie.
    const [ajenos] = await connection.query(
      "SELECT id FROM emails WHERE direccion = ? AND person_id <> ? LIMIT 1",
      [direccion, personId]
    );
    if (ajenos?.length) {
      throw errorDeConflicto("Ese correo ya está registrado por otra persona.");
    }

    const [existentes] = await connection.query(
      "SELECT id, direccion, verificado FROM emails WHERE person_id = ? AND principal = 1 LIMIT 1",
      [personId]
    );

    if (existentes?.length) {
      const actual = existentes[0];
      // CAMBIAR DE DIRECCION DESVERIFICA. Es el punto en el que un modelo descuidado deja entrar a
      // cualquiera: si la verificacion sobreviviera al cambio, bastaria con verificar un correo
      // propio y luego apuntarlo a otro para heredar la confianza.
      const cambia = normalizar(actual.direccion) !== direccion;
      await connection.query(
        `UPDATE emails
            SET direccion = ?, tipo = ?${cambia ? ", verificado = 0, verificado_at = NULL" : ""}
          WHERE id = ?`,
        [direccion, tipo, Number(actual.id)]
      );
      return Number(actual.id);
    }

    const [resultado] = await connection.query(
      "INSERT INTO emails (person_id, tipo, direccion, principal) VALUES (?, ?, ?, 1)",
      [personId, tipo, direccion]
    );
    return resultado?.insertId ?? null;
  }

  async principalDe(personId, connection = this.pool) {
    this.ensurePool();
    const [filas] = await connection.query(
      `SELECT id, tipo, direccion, verificado, verificado_at
         FROM emails
        WHERE person_id = ? AND principal = 1 AND is_active = 1
        LIMIT 1`,
      [personId]
    );
    return filas?.[0] ?? null;
  }

  async listarPorPersona(personId, connection = this.pool) {
    this.ensurePool();
    const [filas] = await connection.query(
      `SELECT id, tipo, direccion, verificado, verificado_at, principal
         FROM emails
        WHERE person_id = ? AND is_active = 1
        ORDER BY principal DESC, id ASC`,
      [personId]
    );
    return filas ?? [];
  }

  // Por aqui entra el login. Busca por CUALQUIERA de los correos de la persona, no solo el
  // principal: si alguien se registro con el personal y luego declara el institucional, los dos
  // deben seguir sirviendo para entrar.
  async buscarPersonaPorEmail(direccion, connection = this.pool) {
    this.ensurePool();
    const [filas] = await connection.query(
      `SELECT person_id FROM emails WHERE direccion = ? AND is_active = 1 LIMIT 1`,
      [normalizar(direccion)]
    );
    return filas?.length ? Number(filas[0].person_id) : null;
  }

  async marcarVerificado(emailId, connection = this.pool) {
    await connection.query(
      "UPDATE emails SET verificado = 1, verificado_at = CURRENT_TIMESTAMP WHERE id = ?",
      [Number(emailId)]
    );
  }
}

export { TIPOS as TIPOS_EMAIL, normalizar as normalizarEmail };
