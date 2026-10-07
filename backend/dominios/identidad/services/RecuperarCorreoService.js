import bcrypt from "bcrypt";
import { getPostgresPool } from "../../../config/postgres.js";
import { InstitucionService } from "../../organizacion/index.js";
import PasswordService from "./PasswordService.js";
import { resolverPersonaPorDocumento, TIPO_NACIONAL } from "./DocumentoIdentidadService.js";

// «Olvidé mi correo» — que NO es «olvidé mi contraseña».
//
// EL PROBLEMA DE FONDO: «recuérdame mi correo» y «no reveles quién está registrado» son opuestos.
// Cualquier cosa que le diga a alguien su correo se lo dice también a quien pruebe con una cédula
// ajena — y en Ecuador el número de cédula es SEMIPÚBLICO: aparece en facturas y registros. Un
// endpoint que responda a documento + país solo es un ORÁCULO DE EXISTENCIA: enumerando cédulas se
// averigua quién tiene cuenta.
//
// LA SALIDA: pedir la contraseña. Quien olvidó cuál de sus correos usó SIGUE SABIÉNDOLA, y quien
// tenga una cédula ajena sin su contraseña no obtiene nada. Deja de ser un oráculo, y no hace falta
// ni limitador de intentos ni bitácora — que el backend no tiene.
//
// SE DEVUELVE EL CORREO COMPLETO, no enmascarado, a propósito: si has probado tu identidad con la
// contraseña, `a***n@…` no te sirve para entrar y no protege de nada que la contraseña no proteja ya.
//
// SU LÍMITE, Y ESTÁ ASUMIDO: quien haya olvidado LAS DOS COSAS se queda fuera. No hay salida técnica
// —el reset de contraseña también empieza pidiendo el correo— y el destino es una persona. La
// pantalla lo dice; el flujo de solicitud con revisión humana es la tarea I10.

const HASH_SEÑUELO = bcrypt.hashSync("no-existe-esta-persona", 10);

const errorGenerico = () => {
  const error = new Error("No pudimos verificar esos datos. Revisa el documento, el país y la contraseña.");
  error.status = 401;
  error.statusCode = 401;
  return error;
};

export default class RecuperarCorreoService {
  constructor(pool = getPostgresPool()) {
    this.pool = pool;
    this.instituciones = new InstitucionService(pool);
    this.passwords = new PasswordService();
  }

  /** El país por defecto es el de la institución: el documento nacional no lleva otro. */
  async resolverPaisId({ pais, pais_id: paisId }) {
    if (paisId !== undefined && paisId !== null && String(paisId).trim() !== "") {
      return Number(paisId);
    }
    const iso = String(pais ?? "").trim().toUpperCase();
    if (!iso) {
      const actual = await this.instituciones.paisActual(this.pool);
      return actual.id;
    }
    const [filas] = await this.pool.query("SELECT id FROM paises WHERE iso_alpha2 = ? LIMIT 1", [iso]);
    return filas?.length ? Number(filas[0].id) : null;
  }

  /**
   * Devuelve el correo principal de quien pruebe ser dueño del documento con su contraseña.
   *
   * TODOS los fallos dan EL MISMO error, y la contraseña se compara SIEMPRE —contra un hash señuelo
   * si la persona no existe— para que el tiempo de respuesta no delate si el documento está
   * registrado. Distinguir «ese documento no existe» de «esa contraseña no es» reconstruiría el
   * oráculo que este diseño evita.
   */
  async recuperar({ tipo, pais, pais_id, numero, password } = {}) {
    if (!password || !numero) {
      throw errorGenerico();
    }

    const paisId = await this.resolverPaisId({ pais, pais_id });
    const personId = paisId
      ? await resolverPersonaPorDocumento(this.pool, { tipo: tipo || TIPO_NACIONAL, paisId, numero })
      : null;

    const [filas] = personId
      ? await this.pool.query(
          `SELECT p.password_hash, e.direccion AS email
             FROM persons p
             LEFT JOIN emails e ON e.person_id = p.id AND e.principal = 1 AND e.is_active = 1
            WHERE p.id = ? AND p.is_active = 1
            LIMIT 1`,
          [personId]
        )
      : [[]];

    const fila = filas?.[0] ?? null;
    const valida = await this.passwords.verifyPassword(password, fila?.password_hash ?? HASH_SEÑUELO);

    if (!fila || !valida || !fila.email) {
      throw errorGenerico();
    }
    return { email: fila.email };
  }
}
