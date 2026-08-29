import { getPostgresPool } from "../../config/postgres.js";
import InstitucionService from "../system/InstitucionService.js";
import { validadorPara, cedulaEcuatorianaValida, nombreDeTipo } from "./documentosPorPais.js";

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

// Las TRES clases de documento. Son las mismas en cualquier pais: `documento_nacional` no dice de
// cual, eso lo dice `pais_id`, y de quien es "el nacional" lo dice `instituciones.pais_id`.
//
// Hasta el 2026-08-29 esto era una tabla de tres filas con clave ajena, y la nacional se llamaba
// `cedula_ec` — Ecuador metido en el vocabulario del sistema. Ahora es un CHECK, como en las tres
// tablas hermanas (`emails`, `telefonos`, `direcciones`).
export const TIPO_NACIONAL = "documento_nacional";
export const TIPOS_DOCUMENTO = [TIPO_NACIONAL, "documento_extranjero", "pasaporte"];

const esVacio = (valor) => valor === undefined || valor === null || String(valor).trim() === "";

// Se guarda en MAYUSCULAS y sin separadores. Los pasaportes se escriben con espacios y guiones de
// formas distintas segun quien los teclee, y sin normalizar "AB 123456" y "AB-123456" serian dos
// documentos distintos que el indice unico dejaria pasar.
export const normalizarNumero = (valor) => String(valor ?? "").trim().toUpperCase().replace(/[\s.-]/g, "");

// El validador vive en `documentosPorPais.js` desde el 2026-08-29, y se busca POR PAIS: colgado del
// tipo, el dia que esto se despliegue en Peru el documento nacional seguiria validando como cedula
// ecuatoriana. Se reexporta `cedulaEcuatorianaValida` porque su bateria de tests entra por aqui.
export { cedulaEcuatorianaValida };

export default class DocumentoIdentidadService {
  constructor(pool = getPostgresPool()) {
    this.pool = pool;
    this.instituciones = new InstitucionService(pool);
  }

  /** El ISO de un pais por su id. Se necesita para elegir el validador, que va por pais. */
  async isoDelPais(paisId, connection = this.pool) {
    if (paisId === null || paisId === undefined) return null;
    const [filas] = await connection.query(
      "SELECT iso_alpha2 FROM paises WHERE id = ? LIMIT 1",
      [Number(paisId)]
    );
    return filas?.length ? filas[0].iso_alpha2 : null;
  }

  ensurePool() {
    if (!this.pool) {
      throw new Error("La conexión con PostgreSQL no está disponible.");
    }
  }

  // Antes esto era una CONSULTA: el tipo vivia en una tabla y habia que resolver el codigo o el id
  // contra ella. Con el vocabulario cerrado en un CHECK, validar es comparar contra tres cadenas —
  // sin red, sin base y sin poder equivocarse de catalogo.
  normalizarTipo(valor) {
    const bruto = String(valor ?? "").trim().toLowerCase();
    if (!bruto) {
      throw errorDeCliente("Hace falta el tipo de documento.");
    }
    if (!TIPOS_DOCUMENTO.includes(bruto)) {
      throw errorDeCliente(
        `El tipo de documento '${valor}' no existe. Los válidos son: ${TIPOS_DOCUMENTO.join(", ")}.`
      );
    }
    return bruto;
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

  // El pais es un argumento y no se saca del tipo: es de lo que de verdad depende el formato.
  validarNumero(tipo, numero, paisIso) {
    const problema = validadorPara({ tipoCode: tipo, paisIso })(numero);
    if (problema) throw errorDeCliente(problema);
  }

  // Guarda EL principal. Es lo que necesitan el registro y el perfil, que manejan un solo documento.
  async guardarPrincipal(personId, documento, connection = this.pool) {
    this.ensurePool();
    const datos = typeof documento === "string" ? { numero: documento } : (documento ?? {});
    const tipo = this.normalizarTipo(datos.tipo ?? TIPO_NACIONAL);
    const numero = normalizarNumero(datos.numero);
    if (!numero) {
      throw errorDeCliente("El documento de identidad necesita un número.");
    }
    // EL PAIS SE RESUELVE ANTES DE VALIDAR, y el orden importa: no se puede saber si un numero esta
    // bien formado sin saber de que pais es. Antes se validaba primero porque el validador colgaba
    // del tipo.
    //
    // El pais emisor es OBLIGATORIO salvo para el documento nacional, que lo hereda de la
    // institucion. Sin esta regla, dos pasaportes con el mismo numero de paises distintos chocarian
    // en el indice.
    let paisId = await this.resolvePaisId(datos, connection);
    let paisIso = datos?.pais ? String(datos.pais).trim().toUpperCase() : null;

    if (tipo === TIPO_NACIONAL && paisId === null) {
      // Aqui habia un SELECT con 'EC' escrito a mano. Ahora sale de la institucion, que es donde el
      // dueño lo puede cambiar sin tocar codigo.
      const pais = await this.instituciones.paisActual(connection);
      paisId = pais.id;
      paisIso = pais.iso;
    }
    if (tipo !== TIPO_NACIONAL && paisId === null) {
      throw errorDeCliente("Un documento que no es el nacional necesita su país emisor.");
    }
    if (!paisIso && paisId !== null) {
      paisIso = await this.isoDelPais(paisId, connection);
    }

    this.validarNumero(tipo, numero, paisIso);

    const [ajenos] = await connection.query(
      `SELECT d.id FROM documentos_identidad d
        WHERE d.tipo = ? AND d.pais_id = ? AND d.numero = ?
          AND d.person_id <> ? LIMIT 1`,
      [tipo, paisId, numero, personId]
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
            SET tipo = ?, pais_id = ?, numero = ?${cambia ? ", verificado = 0, verificado_at = NULL, escaneo_ref = NULL, escaneo_subido_at = NULL" : ""}
          WHERE id = ?`,
        [tipo, paisId, numero, Number(actual.id)]
      );
      this.ultimoEscaneoSoltado = escaneoSoltado;
      return Number(actual.id);
    }

    const [resultado] = await connection.query(
      "INSERT INTO documentos_identidad (person_id, tipo, pais_id, numero, principal) VALUES (?, ?, ?, ?, 1)",
      [personId, tipo, paisId, numero]
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
      `SELECT d.id, d.tipo, d.numero, d.principal,
              d.pais_id, pa.iso_alpha2 AS pais_iso, pa.name AS pais,
              d.verificado, d.verificado_at, d.emitido_el, d.expira_el,
              -- La referencia minio:// NO sale al cliente: es interna y no le sirve a nadie fuera
              -- del backend. Lo que necesita quien pinta la pantalla es si HAY escaneo.
              (d.escaneo_ref IS NOT NULL) AS tiene_escaneo, d.escaneo_subido_at
         FROM documentos_identidad d
         LEFT JOIN paises pa ON pa.id = d.pais_id
        WHERE d.person_id = ? AND d.is_active = 1
        ORDER BY d.principal DESC, d.id ASC`,
      [personId]
    );
    // El nombre se COMPONE del pais, no se guarda: aqui habia un JOIN a `tipos_documento` para leer
    // una columna `name` que decia "Cedula (Ecuador)" en todos los despliegues del mundo.
    return (filas ?? []).map((fila) => ({ ...fila, tipo_nombre: nombreDeTipo(fila.tipo, fila.pais_iso, fila.pais) }));
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
