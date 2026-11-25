import { getPostgresPool, conTransaccion } from "../../../config/postgres.js";
import {
  personasConElNumero,
  personaPorTerna,
  otroDuenoDelDocumento,
  principalCrudo,
  actualizarPrincipal,
  insertarPrincipal,
  referenciaDeEscaneo,
  guardarReferenciaDeEscaneo,
  documentoParaDescarga,
  principalVigente,
  marcarVerificado as marcarVerificadoEnDatos
} from "../datos/documentos.js";
import { idDePaisPorIso, isoDelPais } from "../datos/consulta/paisPorIso.js";
import { listarConPaisYVisa } from "../datos/consulta/documentosConPais.js";
import { InstitucionService } from "../../organizacion/index.js";
import AccesosSensiblesService from "../../../services/auth/AccesosSensiblesService.js";
import { resolveTableResource } from "../../../config/rbacPolicy.js";
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

// Las clases de documento. Son las mismas en cualquier pais: `documento_nacional` no dice de cual,
// eso lo dice `pais_id`, y de quien es "el nacional" lo dice `instituciones.pais_id`.
//
// Hasta el 2026-08-29 esto era una tabla de tres filas con clave ajena, y la nacional se llamaba
// `cedula_ec` — Ecuador metido en el vocabulario del sistema. Ahora es un CHECK, como en las tres
// tablas hermanas (`emails`, `telefonos`, `direcciones`).
export const TIPO_NACIONAL = "documento_nacional";
export const TIPO_VISA = "visa";
export const TIPOS_DOCUMENTO = [TIPO_NACIONAL, "documento_extranjero", "pasaporte", TIPO_VISA];

// ⚠️ NO TODO LO QUE VIVE EN ESTA TABLA ACREDITA IDENTIDAD, y esa es la linea que la visa trajo
// (frente 20, P4). Los otros tres dicen QUIEN ERES; la visa dice QUE PUEDES ESTAR AQUI, y la lleva
// quien ademas tiene un pasaporte. Por eso la visa NO PUEDE SER EL PRINCIPAL: el principal es "el
// documento por el que se te identifica", y una persona con visa se identifica con su pasaporte.
//
// Esto no es una sutileza de vocabulario, es un agujero medido: `guardarPrincipal` reescribe la
// fila principal EN SU SITIO, asi que un PATCH /users/me con tipo `visa` no anadia una visa —
// CONVERTIA la cedula de la persona en una visa y su documento de identidad desaparecia. Le paso al
// gestor de la base de dev el 2026-09-09.
export const TIPOS_QUE_ACREDITAN_IDENTIDAD = TIPOS_DOCUMENTO.filter((t) => t !== TIPO_VISA);

const esVacio = (valor) => valor === undefined || valor === null || String(valor).trim() === "";

// Se guarda en MAYUSCULAS y sin separadores. Los pasaportes se escriben con espacios y guiones de
// formas distintas segun quien los teclee, y sin normalizar "AB 123456" y "AB-123456" serian dos
// documentos distintos que el indice unico dejaria pasar.
export const normalizarNumero = (valor) => String(valor ?? "").trim().toUpperCase().replace(/[\s.-]/g, "");

// El validador vive en `documentosPorPais.js` desde el 2026-08-29, y se busca POR PAIS: colgado del
// tipo, el dia que esto se despliegue en Peru el documento nacional seguiria validando como cedula
// ecuatoriana. Se reexporta `cedulaEcuatorianaValida` porque su bateria de tests entra por aqui.
export { cedulaEcuatorianaValida };

/**
 * La persona dueña de un número de documento — o NINGUNA si el número es ambiguo.
 *
 * EL PROBLEMA: la unicidad de un documento es `(tipo, país, número)`. El número SOLO no es único:
 * dos pasaportes de países distintos con el mismo número son legales en el modelo. Media docena de
 * sitios resolvían `WHERE numero = ? LIMIT 1`, que ante dos coincidencias **elige una en silencio**
 * — y devuelve el expediente, las tareas o las plantillas de otra persona.
 *
 * POR QUE NO SE ACOTA A `documento_nacional`: seria unico, si, pero dejaria **inalcanzable a todo
 * extranjero que solo tenga pasaporte**. El numero llega de una URL o de un formulario, sin su tipo
 * ni su pais, asi que acotar es cambiar quien existe para esas pantallas.
 *
 * LO QUE SE HACE EN SU LUGAR: mirar si hay mas de una, y **negarse** si la hay. Un `LIMIT 2` cuesta
 * lo mismo que un `LIMIT 1` y convierte "acierta mal en silencio" en "no acierta y lo dice". El
 * arreglo de verdad es que estas rutas entren por el id de la persona, como ya hacen la foto y el
 * escaneo; mientras tanto, esto es lo que impide el fallo grave.
 *
 * `DISTINCT` porque una misma persona puede tener dos documentos con el mismo numero (un pasaporte
 * y un documento extranjero, pongamos): eso no es ambiguedad, es la misma respuesta dos veces.
 */
export async function resolverPersonaPorNumero(connection, numero) {
  const limpio = normalizarNumero(numero);
  if (!limpio) {
    return { personId: null, ambiguo: false };
  }
  const filas = await personasConElNumero(connection, limpio);
  if (!filas.length) {
    return { personId: null, ambiguo: false };
  }
  if (filas.length > 1) {
    return { personId: null, ambiguo: true };
  }
  return { personId: Number(filas[0].person_id), ambiguo: false };
}

/**
 * La persona dueña de un documento identificado por su TERNA COMPLETA.
 *
 * Aqui la ambiguedad NO PUEDE existir: `uq_documentos_numero` es unico sobre (tipo, pais, numero),
 * asi que o hay una fila o no hay ninguna. Es la diferencia con `resolverPersonaPorNumero`, que
 * recibe el numero suelto —de una URL, de un formulario— y tiene que defenderse.
 *
 * Devuelve `null` sin distinguir por que: quien la llama no debe poder averiguar si el documento
 * existe. Es lo que separa "recuperar mi correo" de un directorio de cedulas.
 */
export async function resolverPersonaPorDocumento(connection, { tipo, paisId, numero } = {}) {
  const limpio = normalizarNumero(numero);
  const clase = String(tipo ?? "").trim().toLowerCase();
  const pais = Number(paisId);
  if (!limpio || !clase || !Number.isInteger(pais) || pais <= 0) {
    return null;
  }
  return personaPorTerna(connection, clase, pais, limpio);
}

/** El mensaje del caso ambiguo, en un solo sitio para que los tres lo digan igual. */
export const MENSAJE_DOCUMENTO_AMBIGUO =
  "Ese número corresponde a más de una persona. Hace falta identificarla de otra forma.";

export default class DocumentoIdentidadService {
  constructor(pool = getPostgresPool()) {
    this.pool = pool;
    this.instituciones = new InstitucionService(pool);
  }

  /** El ISO de un pais por su id. Se necesita para elegir el validador, que va por pais. */
  async isoDelPais(paisId, connection = this.pool) {
    if (paisId === null || paisId === undefined) return null;
    return isoDelPais(connection, paisId);
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
    const id = await idDePaisPorIso(connection, documento.pais);
    if (id === null) {
      throw errorDeCliente(`El país '${documento.pais}' no está en el catálogo.`);
    }
    return id;
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
    // El principal se REESCRIBE en su sitio, asi que dejar pasar aqui un tipo que no acredita
    // identidad no anade nada: borra el documento que la persona ya tenia. Ver
    // `TIPOS_QUE_ACREDITAN_IDENTIDAD`.
    if (!TIPOS_QUE_ACREDITAN_IDENTIDAD.includes(tipo)) {
      throw errorDeCliente(
        `Un documento de tipo '${tipo}' no puede ser el documento principal: no acredita identidad. ` +
          "Se registra aparte, sin sustituir al documento con el que la persona se identifica."
      );
    }
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

    if (await otroDuenoDelDocumento(connection, tipo, paisId, numero, personId)) {
      throw errorDeConflicto("Ese documento de identidad ya está registrado por otra persona.");
    }

    const actual = await principalCrudo(connection, personId);
    if (actual) {
      // Cambiar de documento DESVERIFICA, por el mismo motivo que con el correo: si la verificación
      // sobreviviera al cambio, bastaría verificar un documento propio y luego sustituirlo.
      const cambia = normalizarNumero(actual.numero) !== numero;
      // Cambiar de documento DESVERIFICA y ademas SUELTA EL ESCANEO: ese PDF es del documento
      // viejo. Dejarlo colgando del nuevo seria peor que no tenerlo — parece que hay respaldo y no
      // lo hay. Quien llama recibe la referencia huerfana para poder borrar el objeto.
      const escaneoSoltado = cambia ? actual.escaneo_ref : null;
      await actualizarPrincipal(connection, actual.id, { tipo, paisId, numero, desverificar: cambia });
      this.ultimoEscaneoSoltado = escaneoSoltado;
      return Number(actual.id);
    }

    return insertarPrincipal(connection, personId, tipo, paisId, numero);
  }

  // Deja registrada la referencia del escaneo. Devuelve la anterior para que quien llama borre el
  // objeto viejo: aqui no se toca MinIO, esto es la capa de datos.
  async registrarEscaneo(documentoId, referencia, connection = this.pool) {
    const anterior = await referenciaDeEscaneo(connection, documentoId);
    await guardarReferenciaDeEscaneo(connection, documentoId, referencia);
    return anterior;
  }

  // La referencia cruda, para el handler que hace el stream. No sale por la API.
  async referenciaEscaneo(documentoId, connection = this.pool) {
    return documentoParaDescarga(connection, documentoId);
  }

  // La bitacora se crea al primer uso y con el mismo pool: las pruebas construyen este servicio con
  // un pool falso, y crearla en el constructor les obligaria a todas a saber de ella.
  get bitacora() {
    this._bitacora ??= new AccesosSensiblesService(this.pool);
    return this._bitacora;
  }

  // EL ESCANEO, con su entrada en la bitacora EN LA MISMA TRANSACCION. Lo sube el titular o -- porque la
  // ruta lo admite-- AdminSistema o GestorTalentoHumano; en los dos casos es una escritura sobre un dato
  // sensible y queda apuntada. Devuelve la referencia anterior, como `registrarEscaneo`.
  async registrarEscaneoConRastro({ documento, referencia, actorId, ip = null }) {
    this.ensurePool();
    return conTransaccion(async (conexion) => {
      const anterior = await this.registrarEscaneo(documento.id, referencia, conexion);
      await this.bitacora.registrarEscritura({
        actorId,
        ip,
        recurso: resolveTableResource("documentos_identidad"),
        tabla: "documentos_identidad",
        accion: "update",
        fila: { id: documento.id, person_id: documento.person_id },
        campos: ["escaneo_ref"]
      }, conexion);
      return anterior;
    }, this.pool);
  }

  // Quien DESCARGA el escaneo de otra persona queda apuntado ANTES de recibirlo: si la bitacora falla,
  // no se entrega. Lo que el titular baja de si mismo no se apunta, porque no es un tercero.
  registrarLecturaDeEscaneo({ documento, actorId, ip = null }) {
    return this.bitacora.registrarLectura({
      actorId,
      ip,
      recurso: resolveTableResource("documentos_identidad"),
      tabla: "documentos_identidad",
      filas: [{ id: documento.id, person_id: documento.person_id }]
    });
  }

  async principalDe(personId, connection = this.pool) {
    this.ensurePool();
    return principalVigente(connection, personId);
  }

  async listarPorPersona(personId, connection = this.pool) {
    this.ensurePool();
    const filas = await listarConPaisYVisa(connection, personId);
    // El nombre se COMPONE del pais, no se guarda: aqui habia un JOIN a `tipos_documento` para leer
    // una columna `name` que decia "Cedula (Ecuador)" en todos los despliegues del mundo.
    return filas.map((fila) => ({ ...fila, tipo_nombre: nombreDeTipo(fila.tipo, fila.pais_iso, fila.pais) }));
  }


  async marcarVerificado(documentoId, connection = this.pool) {
    await marcarVerificadoEnDatos(connection, documentoId);
  }
}
