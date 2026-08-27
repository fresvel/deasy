import { getPostgresPool } from "../../config/postgres.js";

// Los documentos de identidad de una persona. Sustituye a `persons.cedula`.
//
// LA UNICIDAD ES (tipo, pais, numero), NO el numero suelto: un numero de pasaporte es unico POR PAIS
// EMISOR, no en el mundo. "AB123456" puede ser un pasaporte ecuatoriano Y uno español.
//
// Y hay UN principal por persona: el que se enseña y por el que se entra.

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

// Se guarda en MAYUSCULAS y sin separadores. Los pasaportes se escriben con espacios y guiones de
// formas distintas segun quien los teclee, y sin normalizar "AB 123456" y "AB-123456" serian dos
// documentos distintos que el indice unico dejaria pasar.
export const normalizarNumero = (valor) => String(valor ?? "").trim().toUpperCase().replace(/[\s.-]/g, "");

// El digito verificador de la cedula ecuatoriana: modulo 10 sobre los nueve primeros digitos, con
// los de posicion impar duplicados (y restandoles 9 si pasan de 9).
//
// Se comprueba AQUI, gratis y sin red. El servicio externo `validateCedulaEc` sigue existiendo y
// hace otra cosa: preguntarle al registro civil si esa persona existe. Esto caza la errata antes
// de gastar la llamada, y funciona aunque ese servicio este caido o sin token.
export const cedulaEcuatorianaValida = (numero) => {
  const digitos = String(numero ?? "").replace(/\D/g, "");
  if (!/^\d{10}$/.test(digitos)) return false;
  // Los dos primeros son la provincia: 01..24, mas 30 para los emitidos en el exterior.
  const provincia = Number(digitos.slice(0, 2));
  if (!((provincia >= 1 && provincia <= 24) || provincia === 30)) return false;
  // El tercero identifica el tipo: menor que 6 son personas naturales.
  if (Number(digitos[2]) >= 6) return false;

  let suma = 0;
  for (let i = 0; i < 9; i += 1) {
    let valor = Number(digitos[i]);
    if (i % 2 === 0) {
      valor *= 2;
      if (valor > 9) valor -= 9;
    }
    suma += valor;
  }
  const verificador = (10 - (suma % 10)) % 10;
  return verificador === Number(digitos[9]);
};

const VALIDADORES = {
  cedula_ec: (numero) => {
    if (!/^\d{10}$/.test(numero)) {
      return "La cédula ecuatoriana tiene exactamente 10 dígitos.";
    }
    if (!cedulaEcuatorianaValida(numero)) {
      return "La cédula ecuatoriana no es válida: el dígito verificador no cuadra.";
    }
    return null;
  },
  alfanumerico: (numero) => {
    if (!/^[A-Z0-9]{5,20}$/.test(numero)) {
      return "El documento debe tener entre 5 y 20 caracteres, sólo letras y números.";
    }
    return null;
  },
  libre: (numero) => (numero.length >= 3 ? null : "El documento es demasiado corto."),
};

export default class DocumentoIdentidadService {
  constructor(pool = getPostgresPool()) {
    this.pool = pool;
  }

  ensurePool() {
    if (!this.pool) {
      throw new Error("La conexión con PostgreSQL no está disponible.");
    }
  }

  async resolveTipo(codigo, connection = this.pool) {
    const clave = String(codigo ?? "").trim().toLowerCase();
    if (!clave) {
      throw errorDeCliente("Hace falta el tipo de documento.");
    }
    const [filas] = await connection.query(
      "SELECT id, code, name, validacion FROM tipos_documento WHERE code = ? AND is_active = 1 LIMIT 1",
      [clave]
    );
    if (!filas?.length) {
      throw errorDeCliente(`El tipo de documento '${clave}' no está en el catálogo.`);
    }
    return filas[0];
  }

  async resolvePaisId(documento, connection = this.pool) {
    if (!esVacio(documento?.pais_id)) return Number(documento.pais_id);
    if (esVacio(documento?.pais)) return null;
    const [filas] = await connection.query(
      "SELECT id FROM paises WHERE iso_alpha2 = ? LIMIT 1",
      [String(documento.pais).trim().toUpperCase()]
    );
    if (!filas?.length) {
      throw errorDeCliente(`El país '${documento.pais}' no está en el catálogo.`);
    }
    return Number(filas[0].id);
  }

  validarNumero(tipo, numero) {
    const validador = VALIDADORES[tipo.validacion] ?? VALIDADORES.libre;
    const problema = validador(numero);
    if (problema) throw errorDeCliente(problema);
  }

  // Guarda EL principal. Es lo que necesitan el registro y el perfil, que manejan un solo documento.
  async guardarPrincipal(personId, documento, connection = this.pool) {
    this.ensurePool();
    const datos = typeof documento === "string" ? { numero: documento } : (documento ?? {});
    const tipo = await this.resolveTipo(datos.tipo ?? "cedula_ec", connection);
    const numero = normalizarNumero(datos.numero);
    if (!numero) {
      throw errorDeCliente("El documento de identidad necesita un número.");
    }
    this.validarNumero(tipo, numero);

    // El pais emisor es OBLIGATORIO para un pasaporte y no para una cédula ecuatoriana, que ya lo
    // lleva en el tipo. Sin esta regla, dos pasaportes con el mismo numero de paises distintos
    // chocarian en el indice.
    let paisId = await this.resolvePaisId(datos, connection);
    if (tipo.code === "cedula_ec" && paisId === null) {
      const [ec] = await connection.query("SELECT id FROM paises WHERE iso_alpha2 = 'EC' LIMIT 1");
      paisId = ec?.length ? Number(ec[0].id) : null;
    }
    if (tipo.code !== "cedula_ec" && paisId === null) {
      throw errorDeCliente("Un documento que no es cédula ecuatoriana necesita su país emisor.");
    }

    const [ajenos] = await connection.query(
      `SELECT d.id FROM documentos_identidad d
        WHERE d.tipo_id = ? AND COALESCE(d.pais_id, 0) = COALESCE(?, 0) AND d.numero = ?
          AND d.person_id <> ? LIMIT 1`,
      [tipo.id, paisId, numero, personId]
    );
    if (ajenos?.length) {
      throw errorDeConflicto("Ese documento de identidad ya está registrado por otra persona.");
    }

    const [existentes] = await connection.query(
      "SELECT id, numero, verificado, escaneo_ref FROM documentos_identidad WHERE person_id = ? AND principal = 1 LIMIT 1",
      [personId]
    );

    if (existentes?.length) {
      const actual = existentes[0];
      // Cambiar de documento DESVERIFICA, por el mismo motivo que con el correo: si la verificación
      // sobreviviera al cambio, bastaría verificar un documento propio y luego sustituirlo.
      const cambia = normalizarNumero(actual.numero) !== numero;
      // Cambiar de documento DESVERIFICA y ademas SUELTA EL ESCANEO: ese PDF es del documento
      // viejo. Dejarlo colgando del nuevo seria peor que no tenerlo — parece que hay respaldo y no
      // lo hay. Quien llama recibe la referencia huerfana para poder borrar el objeto.
      const escaneoSoltado = cambia ? actual.escaneo_ref : null;
      await connection.query(
        `UPDATE documentos_identidad
            SET tipo_id = ?, pais_id = ?, numero = ?${cambia ? ", verificado = 0, verificado_at = NULL, escaneo_ref = NULL, escaneo_subido_at = NULL" : ""}
          WHERE id = ?`,
        [tipo.id, paisId, numero, Number(actual.id)]
      );
      this.ultimoEscaneoSoltado = escaneoSoltado;
      return Number(actual.id);
    }

    const [resultado] = await connection.query(
      "INSERT INTO documentos_identidad (person_id, tipo_id, pais_id, numero, principal) VALUES (?, ?, ?, ?, 1)",
      [personId, tipo.id, paisId, numero]
    );
    return resultado?.insertId ?? null;
  }

  // Deja registrada la referencia del escaneo. Devuelve la anterior para que quien llama borre el
  // objeto viejo: aqui no se toca MinIO, esto es la capa de datos.
  async registrarEscaneo(documentoId, referencia, connection = this.pool) {
    const [previas] = await connection.query(
      "SELECT escaneo_ref FROM documentos_identidad WHERE id = ? LIMIT 1",
      [Number(documentoId)]
    );
    await connection.query(
      "UPDATE documentos_identidad SET escaneo_ref = ?, escaneo_subido_at = CURRENT_TIMESTAMP WHERE id = ?",
      [referencia, Number(documentoId)]
    );
    return previas?.[0]?.escaneo_ref ?? null;
  }

  // La referencia cruda, para el handler que hace el stream. No sale por la API.
  async referenciaEscaneo(documentoId, connection = this.pool) {
    const [filas] = await connection.query(
      "SELECT id, person_id, escaneo_ref FROM documentos_identidad WHERE id = ? AND is_active = 1 LIMIT 1",
      [Number(documentoId)]
    );
    return filas?.[0] ?? null;
  }

  async principalDe(personId, connection = this.pool) {
    this.ensurePool();
    const [filas] = await connection.query(
      `SELECT id, person_id, numero, escaneo_ref
         FROM documentos_identidad
        WHERE person_id = ? AND principal = 1 AND is_active = 1
        LIMIT 1`,
      [personId]
    );
    return filas?.[0] ?? null;
  }

  async listarPorPersona(personId, connection = this.pool) {
    this.ensurePool();
    const [filas] = await connection.query(
      `SELECT d.id, td.code AS tipo, td.name AS tipo_nombre, d.numero, d.principal,
              d.pais_id, pa.iso_alpha2 AS pais_iso, pa.name AS pais,
              d.verificado, d.verificado_at, d.emitido_el, d.expira_el,
              -- La referencia minio:// NO sale al cliente: es interna y no le sirve a nadie fuera
              -- del backend. Lo que necesita quien pinta la pantalla es si HAY escaneo.
              (d.escaneo_ref IS NOT NULL) AS tiene_escaneo, d.escaneo_subido_at
         FROM documentos_identidad d
         JOIN tipos_documento td ON td.id = d.tipo_id
         LEFT JOIN paises pa ON pa.id = d.pais_id
        WHERE d.person_id = ? AND d.is_active = 1
        ORDER BY d.principal DESC, d.id ASC`,
      [personId]
    );
    return filas ?? [];
  }

  // Por aqui entra el login. Busca por CUALQUIERA de los documentos, no solo el principal: quien se
  // registro con pasaporte y luego declara su cedula debe poder entrar con los dos.
  async buscarPersonaPorNumero(numero, connection = this.pool) {
    this.ensurePool();
    const [filas] = await connection.query(
      "SELECT person_id FROM documentos_identidad WHERE numero = ? AND is_active = 1 LIMIT 1",
      [normalizarNumero(numero)]
    );
    return filas?.length ? Number(filas[0].person_id) : null;
  }

  async marcarVerificado(documentoId, connection = this.pool) {
    await connection.query(
      "UPDATE documentos_identidad SET verificado = 1, verificado_at = CURRENT_TIMESTAMP WHERE id = ?",
      [Number(documentoId)]
    );
  }
}
