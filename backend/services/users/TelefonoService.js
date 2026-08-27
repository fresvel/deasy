import { getPostgresPool } from "../../config/postgres.js";

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

const errorDeCliente = (mensaje) => {
  const error = new Error(mensaje);
  error.status = 400;
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
      const [filas] = await this.pool.query(
        "SELECT id FROM paises WHERE iso_alpha2 = ? LIMIT 1",
        [String(pais).trim().toUpperCase()]
      );
      if (!filas?.length) throw errorDeCliente(`El país '${pais}' no está en el catálogo.`);
      return Number(filas[0].id);
    }
    // El prefijo es el ultimo recurso, y es AMBIGUO: "+1" lo comparten Estados Unidos, Canada y
    // media docena de islas. Se acepta porque el formulario lo tiene a mano, pero si empata con
    // varios paises se rechaza en vez de elegir uno al azar.
    if (!esVacio(prefijo)) {
      const clave = String(prefijo).trim().startsWith("+") ? String(prefijo).trim() : `+${String(prefijo).trim()}`;
      const [filas] = await this.pool.query(
        "SELECT id FROM paises WHERE phone_code = ? AND is_active = 1",
        [clave]
      );
      if (!filas?.length) throw errorDeCliente(`El prefijo '${clave}' no corresponde a ningún país del catálogo.`);
      if (filas.length > 1) {
        throw errorDeCliente(`El prefijo '${clave}' lo comparten ${filas.length} países: manda el país en vez del prefijo.`);
      }
      return Number(filas[0].id);
    }
    return null;
  }

  async resolveCanalId(codigo, connection = this.pool) {
    const clave = String(codigo ?? "").trim().toLowerCase();
    const [filas] = await connection.query(
      "SELECT id FROM canales_mensajeria WHERE code = ? AND is_active = 1 LIMIT 1",
      [clave]
    );
    if (!filas?.length) {
      throw errorDeCliente(`El canal de mensajería '${clave}' no está en el catálogo.`);
    }
    return Number(filas[0].id);
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
    const [filas] = await this.pool.query(
      "SELECT id, phone_code FROM paises WHERE phone_code IS NOT NULL AND is_active = 1"
    );
    const candidatos = (filas ?? [])
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
    const numero = separado.numero;
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
    const [ajenos] = await connection.query(
      `SELECT t.id FROM telefonos t
        WHERE t.numero = ? AND t.pais_id IS NOT DISTINCT FROM ?
          AND t.person_id <> ? LIMIT 1`,
      [numero, paisId, personId]
    );
    if (ajenos?.length) {
      throw errorDeCliente("Ese número de teléfono ya está registrado por otra persona.");
    }

    const [existentes] = await connection.query(
      "SELECT id FROM telefonos WHERE person_id = ? AND tipo = ? AND principal = 1 LIMIT 1",
      [personId, tipo]
    );

    let telefonoId;
    if (existentes?.length) {
      telefonoId = Number(existentes[0].id);
      await connection.query(
        "UPDATE telefonos SET pais_id = ?, numero = ? WHERE id = ?",
        [paisId, numero, telefonoId]
      );
    } else {
      const [resultado] = await connection.query(
        "INSERT INTO telefonos (person_id, tipo, pais_id, numero, principal) VALUES (?, ?, ?, ?, 1)",
        [personId, tipo, paisId, numero]
      );
      telefonoId = resultado?.insertId ?? null;
    }

    if (Array.isArray(telefono?.canales)) {
      await this.sincronizarCanales(telefonoId, telefono.canales, connection);
    }
    return telefonoId;
  }

  // Los canales que se pasan quedan; los que no, se van. Se conserva `verificado` de los que
  // sobreviven: cambiar de opinion sobre si un numero tiene Telegram no invalida que se haya
  // comprobado que tiene WhatsApp.
  async sincronizarCanales(telefonoId, canales, connection = this.pool) {
    const ids = [];
    for (const canal of canales) {
      const codigo = typeof canal === "string" ? canal : canal?.code ?? canal?.canal;
      const canalId = await this.resolveCanalId(codigo, connection);
      ids.push(canalId);
      const verificado = typeof canal === "object" && canal?.verificado ? 1 : 0;
      // Existencia y luego INSERT o UPDATE, en vez de un ON DUPLICATE KEY con GREATEST. El
      // adaptador de PostgreSQL solo traduce `= VALUES(col)` a `EXCLUDED.col`
      // (`config/postgres.js:442`), asi que un `VALUES(...)` ANIDADO dentro de una funcion se queda
      // sin traducir y PostgreSQL responde "syntax error at or near (" en tiempo de llamada.
      const [existente] = await connection.query(
        "SELECT id, verificado FROM telefono_canales WHERE telefono_id = ? AND canal_id = ? LIMIT 1",
        [telefonoId, canalId]
      );
      if (existente?.length) {
        // Nunca se DESVERIFICA al re-declarar los canales: haber comprobado que el numero tiene
        // WhatsApp sigue siendo cierto aunque el usuario vuelva a guardar el formulario.
        if (verificado && !Number(existente[0].verificado)) {
          await connection.query(
            "UPDATE telefono_canales SET verificado = 1, verificado_at = CURRENT_TIMESTAMP WHERE id = ?",
            [Number(existente[0].id)]
          );
        }
      } else {
        await connection.query(
          `INSERT INTO telefono_canales (telefono_id, canal_id, verificado, verificado_at)
           VALUES (?, ?, ?, ${verificado ? "CURRENT_TIMESTAMP" : "NULL"})`,
          [telefonoId, canalId, verificado]
        );
      }
    }
    if (ids.length) {
      await connection.query(
        `DELETE FROM telefono_canales WHERE telefono_id = ? AND canal_id NOT IN (${ids.map(() => "?").join(", ")})`,
        [telefonoId, ...ids]
      );
    } else {
      await connection.query("DELETE FROM telefono_canales WHERE telefono_id = ?", [telefonoId]);
    }
  }

  async marcarCanalVerificado(telefonoId, codigoCanal, connection = this.pool) {
    const canalId = await this.resolveCanalId(codigoCanal, connection);
    const [existente] = await connection.query(
      "SELECT id FROM telefono_canales WHERE telefono_id = ? AND canal_id = ? LIMIT 1",
      [telefonoId, canalId]
    );
    if (existente?.length) {
      await connection.query(
        "UPDATE telefono_canales SET verificado = 1, verificado_at = CURRENT_TIMESTAMP WHERE id = ?",
        [Number(existente[0].id)]
      );
    } else {
      await connection.query(
        `INSERT INTO telefono_canales (telefono_id, canal_id, verificado, verificado_at)
         VALUES (?, ?, 1, CURRENT_TIMESTAMP)`,
        [telefonoId, canalId]
      );
    }
  }

  async listarPorPersona(personId, connection = this.pool) {
    this.ensurePool();
    const [filas] = await connection.query(
      `SELECT t.id, t.tipo, t.principal, t.numero,
              t.pais_id, pa.iso_alpha2 AS pais_iso, pa.phone_code AS prefijo,
              COALESCE(pa.phone_code, '') || t.numero AS numero_completo
         FROM telefonos t
         LEFT JOIN paises pa ON pa.id = t.pais_id
        WHERE t.person_id = ? AND t.is_active = 1
        ORDER BY t.principal DESC, t.id ASC`,
      [personId]
    );
    const telefonos = filas ?? [];
    if (!telefonos.length) return telefonos;

    const ids = telefonos.map((t) => Number(t.id));
    const [canales] = await connection.query(
      `SELECT tc.telefono_id, cm.code, cm.name, tc.verificado, tc.verificado_at
         FROM telefono_canales tc
         JOIN canales_mensajeria cm ON cm.id = tc.canal_id
        WHERE tc.telefono_id IN (${ids.map(() => "?").join(", ")})
        ORDER BY cm.code ASC`,
      ids
    );
    const porTelefono = new Map();
    for (const canal of canales ?? []) {
      const lista = porTelefono.get(Number(canal.telefono_id)) ?? [];
      lista.push({ code: canal.code, name: canal.name, verificado: Number(canal.verificado) === 1, verificado_at: canal.verificado_at });
      porTelefono.set(Number(canal.telefono_id), lista);
    }
    return telefonos.map((t) => ({ ...t, canales: porTelefono.get(Number(t.id)) ?? [] }));
  }
}

export { TIPOS as TIPOS_TELEFONO };
