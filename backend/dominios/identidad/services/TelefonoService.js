import { parteLocal } from "./numerosDeTelefono.js";
import { getPostgresPool } from "../../../config/postgres.js";
import {
  otroDuenoDelNumero,
  principalDeSuTipo,
  actualizarNumero,
  insertarPrincipal,
  desverificarCanales,
  canalDelTelefono,
  declararCanal,
  verificarCanalPorId,
  insertarCanalVerificado,
  dejarSoloEstosCanales,
  canalesDeLosTelefonos
} from "../datos/telefonos.js";
import { idDeCanalActivo, borrarLlavesVivas } from "../datos/verificacionDeTelefono.js";
import { idDePaisPorIso } from "../datos/consulta/paisPorIso.js";
import { paisesConPrefijo, prefijosActivos, listarConPrefijo } from "../datos/consulta/telefonosConPrefijo.js";

// Los telefonos de una persona y los canales de mensajeria de cada telefono.
//
// LO QUE ESTO SUSTITUYE. `persons.whatsapp` (un numero) y `persons.verify_whatsapp` (una bandera):
// UN numero y UN canal. La bandera ademas no decia verificado EN QUE — no distinguia "este numero
// existe" de "este numero tiene WhatsApp".
//
// NO HAY OPERADORA. Decision del dueno del 2026-08-27: con portabilidad numerica cambia sin avisar,
// asi que guardarla es tener un campo que se pudre solo.

const TIPOS = ["personal", "trabajo"];
const TIPO_POR_DEFECTO = "personal";

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

// Deja el numero en digitos. Se guarda LOCAL, sin prefijo: el prefijo sale de `paises.phone_code`,
// asi se corrige en un sitio si un pais lo cambia y la unicidad compara lo que debe.
const soloDigitos = (valor) => String(valor ?? "").replace(/\D/g, "");

export default class TelefonoService {
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
      throw errorDeCliente(`El tipo de teléfono '${valor}' no existe. Los válidos son: ${TIPOS.join(", ")}.`);
    }
    return valor;
  }

  async resolvePaisId({ pais, pais_id: paisIdDirecto, prefijo } = {}) {
    if (!esVacio(paisIdDirecto)) return Number(paisIdDirecto);
    if (!esVacio(pais)) {
      const id = await idDePaisPorIso(this.pool, pais);
      if (id === null) throw errorDeCliente(`El país '${pais}' no está en el catálogo.`);
      return id;
    }
    // El prefijo es el ultimo recurso, y es AMBIGUO: "+1" lo comparten Estados Unidos, Canada y
    // media docena de islas. Se acepta porque el formulario lo tiene a mano, pero si empata con
    // varios paises se rechaza en vez de elegir uno al azar.
    if (!esVacio(prefijo)) {
      const clave = String(prefijo).trim().startsWith("+") ? String(prefijo).trim() : `+${String(prefijo).trim()}`;
      const filas = await paisesConPrefijo(this.pool, clave);
      if (!filas.length) throw errorDeCliente(`El prefijo '${clave}' no corresponde a ningún país del catálogo.`);
      if (filas.length > 1) {
        throw errorDeCliente(`El prefijo '${clave}' lo comparten ${filas.length} países: manda el país en vez del prefijo.`);
      }
      return Number(filas[0].id);
    }
    return null;
  }

  async resolveCanalId(codigo, connection = this.pool) {
    const clave = String(codigo ?? "").trim().toLowerCase();
    const canalId = await idDeCanalActivo(connection, clave);
    if (!canalId) {
      throw errorDeCliente(`El canal de mensajería '${clave}' no está en el catálogo.`);
    }
    return canalId;
  }

  // Un numero que llega con "+" trae el prefijo pegado, y hay que separarlo o se guarda como si
  // fuera parte del numero local: "+593990000000" acabaria en la columna entero y sin pais, y la
  // unicidad compararia manzanas con peras.
  //
  // Se busca el prefijo MAS LARGO que case, no el primero: "+1" es Estados Unidos pero "+1-684" es
  // Samoa Americana, y quedarse con "+1" mandaria las dos al mismo sitio.
  async separarPrefijo(bruto) {
    const texto = String(bruto ?? "").trim();
    if (!texto.startsWith("+")) return { paisId: null, numero: soloDigitos(texto) };
    const filas = await prefijosActivos(this.pool);
    const candidatos = filas
      .map((f) => ({ id: Number(f.id), code: String(f.phone_code) }))
      .filter((f) => texto.startsWith(f.code))
      .sort((a, b) => b.code.length - a.code.length);
    if (!candidatos.length) return { paisId: null, numero: soloDigitos(texto) };
    const elegido = candidatos[0];
    // Si varios paises comparten EXACTAMENTE el prefijo mas largo, no se puede elegir: se deja el
    // pais sin resolver antes que inventarlo.
    const empatan = candidatos.filter((c) => c.code === elegido.code);
    return {
      paisId: empatan.length === 1 ? elegido.id : null,
      numero: soloDigitos(texto.slice(elegido.code.length))
    };
  }

  // Guarda EL principal de su tipo con sus canales. Es lo que necesitan el registro y el perfil,
  // que manejan un solo numero.
  async guardarPrincipal(personId, telefono, connection = this.pool) {
    this.ensurePool();
    const tipo = this.normalizarTipo(telefono?.tipo);
    const separado = await this.separarPrefijo(telefono?.numero);
    // ⚠️ SE GUARDA EN SU FORMA CANONICA: la parte local SIN el cero de marcacion nacional. El indice
    // `uq_telefonos_numero` es sobre la cadena cruda, asi que sin esto `0987651100` y `987651100`
    // son dos numeros distintos para la base --y el MISMO telefono se registraba dos veces con dos
    // personas. Comprobado en el navegador el 2026-08-31.
    //
    // El resto del codigo ya daba por hecho esta forma al LEER (`aFormatoInternacional`,
    // `numerosIguales`, el `numero_completo` del SQL). Lo que faltaba era escribirla igual.
    const numero = parteLocal(separado.numero);
    if (!numero) {
      throw errorDeCliente("El teléfono necesita un número.");
    }
    // El pais dicho gana al deducido del prefijo: quien manda `pais` sabe mas que un prefijo, que
    // es ambiguo por naturaleza.
    const paisId = (await this.resolvePaisId(telefono ?? {})) ?? separado.paisId;

    // El numero es de UNA persona. Si ya lo tiene otra, se dice; sin esto el indice unico responde
    // con un error de PostgreSQL que no le sirve a nadie.
    // `IS NOT DISTINCT FROM` y no `= ? OR (... IS NULL AND ? IS NULL)`: la segunda forma deja un
    // parametro suelto comparado contra NULL y PostgreSQL no puede inferirle el tipo
    // ("could not determine data type of parameter $3"). Y no lo ve nadie hasta que se ejecuta esa
    // rama: el SQL es una cadena de texto para todo lo demas.
    if (await otroDuenoDelNumero(connection, numero, paisId, personId)) {
      throw errorDeConflicto("Ese número de teléfono ya está registrado por otra persona.");
    }

    const existente = await principalDeSuTipo(connection, personId, tipo);

    let telefonoId;
    if (existente) {
      telefonoId = Number(existente.id);
      // ⚠️ CAMBIAR EL NÚMERO TIRA LO QUE SE HABÍA PROBADO DEL ANTERIOR, y se hace AQUÍ.
      //
      // La fila se reutiliza --mismo id, número nuevo--, así que todo lo que colgaba de ella pasa a
      // hablar de un número que nadie ha probado: los canales seguían marcados verificados y las
      // llaves pendientes seguían vivas. Medido el 2026-10-04 sobre la pila B: tras cambiar el
      // número, telegram y whatsapp seguían en verificado = 1. El número nuevo respondía
      // "verificado" sin que se hubiera demostrado nada, y "esta verificado" es justamente "tiene
      // algun canal verificado".
      //
      // Va en el servicio y no en el llamador porque son TRES los caminos que cambian un número
      // --este servicio lo llaman el controller de verificación, UserRepository.updateUser y el
      // bootstrap-- y sólo el primero se acordaba de invalidar. Es el mismo motivo que ya está
      // escrito en UserRepository.updateUser sobre el cantón de nacimiento: parchear cada llamador
      // es exactamente como se olvida uno. Y es lo que EmailService ya hacía con la dirección.
      //
      // Se marca verificado = 0, no se borra la fila del canal: DECLARAR un canal no es VERIFICARLO,
      // y la declaración sigue siendo verdad. Lo que deja de serlo es la prueba.
      const cambiaNumero =
        String(existente.numero ?? "") !== String(numero) ||
        Number(existente.pais_id ?? 0) !== Number(paisId ?? 0);
      await actualizarNumero(connection, telefonoId, paisId, numero);
      if (cambiaNumero) {
        await desverificarCanales(connection, telefonoId);
        await borrarLlavesVivas(connection, telefonoId);
      }
    } else {
      telefonoId = await insertarPrincipal(connection, personId, tipo, paisId, numero);
    }

    if (Array.isArray(telefono?.canales)) {
      await this.sincronizarCanales(telefonoId, telefono.canales, connection);
    }
    return telefonoId;
  }

  // Los canales que se pasan quedan; los que no, se van. Se conserva `verificado` de los que
  // sobreviven: cambiar de opinion sobre si un numero tiene Telegram no invalida que se haya
  // comprobado que tiene WhatsApp.
  //
  // ⚠️ DECLARAR UN CANAL NO LO VERIFICA, y hasta el 2026-08-31 SI LO HACIA. Esta funcion leia
  // `canal.verificado` del objeto que le llegaba, y ese objeto viene del CUERPO DE LA PETICION
  // (`user_controler.js` -> `req.body.telefono` -> `UserRepository.createUser`). Comprobado con una
  // peticion real: registrarse mandando
  //
  //     "telefono": { "canales": [{ "code": "telegram", "verificado": true }] }
  //
  // dejaba el canal verificado SIN PROBAR NADA. Con el telefono obligatorio (C8) eso no es un dato
  // sucio: es la puerta abierta, porque la condicion para entrar se cumple poniendo `true` en un
  // JSON.
  //
  // Ahora un canal declarado nace SIN VERIFICAR, siempre. Solo escriben `verificado = 1`:
  //   · `TelefonoVerificacionService.confirmar` — tras probarlo por un canal real.
  //   · `marcarCanalVerificado` — que usa el arranque para el administrador que el propio
  //     instalador acaba de crear, y que NO es alcanzable desde ninguna ruta.
  async sincronizarCanales(telefonoId, canales, connection = this.pool) {
    const ids = [];
    for (const canal of canales) {
      const codigo = typeof canal === "string" ? canal : canal?.code ?? canal?.canal;
      const canalId = await this.resolveCanalId(codigo, connection);
      ids.push(canalId);
      // Existencia y luego INSERT o UPDATE, en vez de un ON DUPLICATE KEY con GREATEST. El
      // adaptador de PostgreSQL solo traduce `= VALUES(col)` a `EXCLUDED.col`
      // (`config/postgres.js:442`), asi que un `VALUES(...)` ANIDADO dentro de una funcion se queda
      // sin traducir y PostgreSQL responde "syntax error at or near (" en tiempo de llamada.
      const yaEsta = await canalDelTelefono(connection, telefonoId, canalId);
      if (!yaEsta) {
        await declararCanal(connection, telefonoId, canalId);
      }
      // Si ya estaba no se toca: nunca se DESVERIFICA al re-declarar los canales —haber comprobado
      // que el numero tiene WhatsApp sigue siendo cierto aunque el usuario vuelva a guardar el
      // formulario— y tampoco se ASCIENDE, que es lo que se retiro: guardar el formulario no prueba
      // nada.
    }
    await dejarSoloEstosCanales(connection, telefonoId, ids);
  }

  async marcarCanalVerificado(telefonoId, codigoCanal, connection = this.pool) {
    const canalId = await this.resolveCanalId(codigoCanal, connection);
    const existente = await canalDelTelefono(connection, telefonoId, canalId);
    if (existente) {
      await verificarCanalPorId(connection, existente.id);
    } else {
      await insertarCanalVerificado(connection, telefonoId, canalId);
    }
  }

  async listarPorPersona(personId, connection = this.pool) {
    this.ensurePool();
    const telefonos = await listarConPrefijo(connection, personId);
    if (!telefonos.length) return telefonos;

    const canales = await canalesDeLosTelefonos(connection, telefonos.map((t) => Number(t.id)));
    const porTelefono = new Map();
    for (const canal of canales) {
      const lista = porTelefono.get(Number(canal.telefono_id)) ?? [];
      lista.push({ code: canal.code, name: canal.name, verificado: Number(canal.verificado) === 1, verificado_at: canal.verificado_at });
      porTelefono.set(Number(canal.telefono_id), lista);
    }
    return telefonos.map((t) => ({ ...t, canales: porTelefono.get(Number(t.id)) ?? [] }));
  }
}

export { TIPOS as TIPOS_TELEFONO };
