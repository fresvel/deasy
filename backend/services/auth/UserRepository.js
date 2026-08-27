import { getPostgresPool } from "../../config/postgres.js";
import DireccionService from "../users/DireccionService.js";
import TelefonoService from "../users/TelefonoService.js";
import EmailService from "../users/EmailService.js";
import DocumentoIdentidadService from "../users/DocumentoIdentidadService.js";

const DEFAULT_STATUS = "Inactivo";

export default class UserRepository {
  constructor(pool = getPostgresPool()) {
    this.pool = pool;
    this.direcciones = new DireccionService(pool);
    this.telefonos = new TelefonoService(pool);
    this.emails = new EmailService(pool);
    this.documentos = new DocumentoIdentidadService(pool);
  }

  ensurePool() {
    if (!this.pool) {
      throw new Error("La conexión con PostgreSQL no está disponible.");
    }
  }

  // La nacionalidad entra por la API como codigo ISO-3166 alfa-2 ("EC"), que es lo que un cliente
  // puede escribir, y se guarda como clave ajena a `paises`. Se admite tambien el id ya resuelto,
  // que es lo que manda el editor generico de /admin.
  async resolveNacionalidadPaisId(userData) {
    if (userData.nacionalidad_pais_id !== undefined && userData.nacionalidad_pais_id !== null && userData.nacionalidad_pais_id !== "") {
      return Number(userData.nacionalidad_pais_id);
    }
    const iso = String(userData.nacionalidad ?? "").trim().toUpperCase();
    if (!iso) {
      return null;
    }
    const [rows] = await this.pool.query(
      "SELECT id FROM paises WHERE iso_alpha2 = ? LIMIT 1",
      [iso]
    );
    if (!rows?.length) {
      const error = new Error(`La nacionalidad '${iso}' no corresponde a ningun pais del catalogo.`);
      // Marca para que el transporte lo traduzca a 400 y no a 500: es dato mal enviado por el
      // cliente, no una averia. Antes `pais` era texto libre y no habia nada que validar.
      error.status = 400;
      throw error;
    }
    return Number(rows[0].id);
  }

  // Las direcciones viven en su tabla desde el paso 3, asi que hay que colgarlas de la fila antes de
  // mapearla. `direccion` (singular) es LA principal de residencia, que es lo que enseña el perfil.
  async conDirecciones(userRow) {
    if (!userRow) return userRow;
    const personId = userRow.id ?? userRow._id;
    const [direcciones, telefonos, emails, documentos] = await Promise.all([
      this.direcciones.listarPorPersona(personId),
      this.telefonos.listarPorPersona(personId),
      this.emails.listarPorPersona(personId),
      this.documentos.listarPorPersona(personId)
    ]);
    return {
      ...userRow,
      direcciones,
      direccion: direcciones.find((d) => d.tipo === "residencia" && Number(d.principal) === 1) ?? null,
      telefonos,
      emails,
      documentos
    };
  }

  async findById(id) {
    this.ensurePool();

    const [rows] = await this.pool.query(
      `SELECT p.*, na.iso_alpha2 AS nacionalidad, na.name AS nacionalidad_nombre,
              em.direccion AS email, em.verificado AS email_verificado, em.id AS email_id,
              di.numero AS cedula, di.verificado AS documento_verificado, dt.code AS documento_tipo
       FROM persons p
       LEFT JOIN paises na ON na.id = p.nacionalidad_pais_id
       LEFT JOIN emails em ON em.person_id = p.id AND em.principal = 1 AND em.is_active = 1
       LEFT JOIN documentos_identidad di ON di.person_id = p.id AND di.principal = 1 AND di.is_active = 1
       LEFT JOIN tipos_documento dt ON dt.id = di.tipo_id
       WHERE p.id = ? LIMIT 1`,
      [id]
    );

    return this.conDirecciones(rows?.[0] ?? null);
  }

  async findByCedulaOrEmail({ cedula, email }) {
    this.ensurePool();

    const conditions = [];
    const params = [];

    if (cedula) {
      // El documento ya no es columna de `persons`: se entra por CUALQUIERA de los de la persona,
      // no solo el principal. Quien se registro con pasaporte y luego declara su cedula debe poder
      // entrar con los dos.
      conditions.push("EXISTS (SELECT 1 FROM documentos_identidad d WHERE d.person_id = p.id AND d.numero = ? AND d.is_active = 1)");
      params.push(String(cedula).trim().toUpperCase().replace(/[\s.-]/g, ""));
    }

    if (email) {
      // El correo ya no es columna de `persons`: se entra por CUALQUIERA de los de la tabla, no
      // solo el principal. Quien se registro con el personal y luego declara el institucional debe
      // poder seguir entrando con los dos.
      conditions.push("EXISTS (SELECT 1 FROM emails e WHERE e.person_id = p.id AND e.direccion = ? AND e.is_active = 1)");
      params.push(String(email).trim().toLowerCase());
    }

    if (!conditions.length) {
      return null;
    }

    const [rows] = await this.pool.query(
      `SELECT p.*, na.iso_alpha2 AS nacionalidad, na.name AS nacionalidad_nombre,
              em.direccion AS email, em.verificado AS email_verificado, em.id AS email_id,
              di.numero AS cedula, di.verificado AS documento_verificado, dt.code AS documento_tipo
       FROM persons p
       LEFT JOIN paises na ON na.id = p.nacionalidad_pais_id
       LEFT JOIN emails em ON em.person_id = p.id AND em.principal = 1 AND em.is_active = 1
       LEFT JOIN documentos_identidad di ON di.person_id = p.id AND di.principal = 1 AND di.is_active = 1
       LEFT JOIN tipos_documento dt ON dt.id = di.tipo_id
       WHERE ${conditions.join(" OR ")} LIMIT 1`,
      params
    );

    return this.conDirecciones(rows?.[0] ?? null);
  }

  async findAll() {
    this.ensurePool();

    const [rows] = await this.pool.query(
      `SELECT p.*, na.iso_alpha2 AS nacionalidad, na.name AS nacionalidad_nombre,
              em.direccion AS email, em.verificado AS email_verificado, em.id AS email_id,
              di.numero AS cedula, di.verificado AS documento_verificado, dt.code AS documento_tipo
       FROM persons p
       LEFT JOIN paises na ON na.id = p.nacionalidad_pais_id
       LEFT JOIN emails em ON em.person_id = p.id AND em.principal = 1 AND em.is_active = 1
       LEFT JOIN documentos_identidad di ON di.person_id = p.id AND di.principal = 1 AND di.is_active = 1
       LEFT JOIN tipos_documento dt ON dt.id = di.tipo_id
       ORDER BY p.created_at DESC`
    );

    // Una sola consulta para TODAS las direcciones, no una por persona: en una lista de 43
    // usuarios eso serian 43 viajes a la base para pintar una tabla.
    return this.adjuntarDireccionesEnLote(rows ?? []);
  }

  async adjuntarDireccionesEnLote(rows) {
    if (!rows.length) return rows;
    const ids = rows.map((r) => Number(r.id)).filter(Boolean);
    if (!ids.length) return rows;
    const [filas] = await this.pool.query(
      `SELECT d.person_id, d.id, d.tipo, d.principal,
              pa.iso_alpha2 AS pais_iso, pa.name AS pais,
              pr.name AS provincia, ci.name AS ciudad,
              d.calle_primaria, d.calle_secundaria, d.referencia, d.latitud, d.longitud
         FROM direcciones d
         LEFT JOIN paises pa ON pa.id = d.pais_id
         LEFT JOIN provincias pr ON pr.id = d.provincia_id
         LEFT JOIN ciudades ci ON ci.id = d.ciudad_id
        WHERE d.person_id IN (${ids.map(() => "?").join(", ")}) AND d.is_active = 1
        ORDER BY d.principal DESC, d.id ASC`,
      ids
    );
    const porPersona = new Map();
    for (const fila of filas ?? []) {
      const lista = porPersona.get(Number(fila.person_id)) ?? [];
      lista.push(fila);
      porPersona.set(Number(fila.person_id), lista);
    }
    // Los telefonos, tambien en lote y por el mismo motivo. Devolver `telefonos: []` aqui seria
    // MENTIR: `whatsapp` se deriva de esa lista, asi que una lista vacia lo dejaria en null para
    // todo el mundo y pareceria que nadie tiene numero.
    const [tels] = await this.pool.query(
      `SELECT t.person_id, t.id, t.tipo, t.principal, t.numero,
              pa.iso_alpha2 AS pais_iso, pa.phone_code AS prefijo,
              COALESCE(pa.phone_code, '') || t.numero AS numero_completo
         FROM telefonos t
         LEFT JOIN paises pa ON pa.id = t.pais_id
        WHERE t.person_id IN (${ids.map(() => "?").join(", ")}) AND t.is_active = 1
        ORDER BY t.principal DESC, t.id ASC`,
      ids
    );
    const telefonosPorPersona = new Map();
    const telefonoIds = [];
    for (const tel of tels ?? []) {
      telefonoIds.push(Number(tel.id));
      const lista = telefonosPorPersona.get(Number(tel.person_id)) ?? [];
      lista.push({ ...tel, canales: [] });
      telefonosPorPersona.set(Number(tel.person_id), lista);
    }
    if (telefonoIds.length) {
      const [canales] = await this.pool.query(
        `SELECT tc.telefono_id, cm.code, cm.name, tc.verificado, tc.verificado_at
           FROM telefono_canales tc
           JOIN canales_mensajeria cm ON cm.id = tc.canal_id
          WHERE tc.telefono_id IN (${telefonoIds.map(() => "?").join(", ")})`,
        telefonoIds
      );
      const porTelefono = new Map();
      for (const canal of canales ?? []) {
        const lista = porTelefono.get(Number(canal.telefono_id)) ?? [];
        lista.push({ code: canal.code, name: canal.name, verificado: Number(canal.verificado) === 1, verificado_at: canal.verificado_at });
        porTelefono.set(Number(canal.telefono_id), lista);
      }
      for (const lista of telefonosPorPersona.values()) {
        for (const tel of lista) {
          tel.canales = porTelefono.get(Number(tel.id)) ?? [];
        }
      }
    }

    return rows.map((row) => {
      const lista = porPersona.get(Number(row.id)) ?? [];
      return {
        ...row,
        direcciones: lista,
        direccion: lista.find((d) => d.tipo === "residencia" && Number(d.principal) === 1) ?? null,
        telefonos: telefonosPorPersona.get(Number(row.id)) ?? []
      };
    });
  }

  async search(term = "", limit = 20, status = null, filters = {}) {
    this.ensurePool();

    const normalized = term?.trim();
    const safeLimit = Number.isFinite(Number(limit))
      ? Math.max(1, Number(limit))
      : 20;

    const statusFilter = status?.trim();
    const unitTypeId = filters?.unitTypeId ? Number(filters.unitTypeId) : null;
    const unitId = filters?.unitId ? Number(filters.unitId) : null;
    const cargoId = filters?.cargoId ? Number(filters.cargoId) : null;

    const conditions = [];
    const params = [];

    if (normalized) {
      const like = `%${normalized}%`;

      // Ni la cedula ni el correo son columnas de `persons`: se filtra por sus tablas. Se busca en
      // TODOS los documentos y correos de la persona, no solo en el principal, que es lo que espera
      // quien teclea un numero en el buscador.
      conditions.push(
        `(EXISTS (SELECT 1 FROM documentos_identidad sd WHERE sd.person_id = p.id AND sd.numero LIKE ?)
          OR EXISTS (SELECT 1 FROM emails se WHERE se.person_id = p.id AND se.direccion LIKE ?)
          OR p.first_name LIKE ? OR p.last_name LIKE ?)`
      );

      params.push(like, like, like, like);
    }

    if (statusFilter) {
      conditions.push("p.status = ?");
      params.push(statusFilter);
    }

    if (unitTypeId) {
      conditions.push("ut.id = ?");
      params.push(unitTypeId);
    }

    if (unitId) {
      conditions.push("u.id = ?");
      params.push(unitId);
    }

    if (cargoId) {
      conditions.push("c.id = ?");
      params.push(cargoId);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const [rows] = await this.pool.query(
      `SELECT
         p.*,
         sdoc.numero AS cedula,
         semail.direccion AS email,
         GROUP_CONCAT(DISTINCT ut.id ORDER BY ut.name SEPARATOR ',') AS unit_type_ids,
         GROUP_CONCAT(DISTINCT ut.name ORDER BY ut.name SEPARATOR ' | ') AS unit_type_names,
         GROUP_CONCAT(DISTINCT u.id ORDER BY COALESCE(u.label, u.name) SEPARATOR ',') AS unit_ids,
         GROUP_CONCAT(DISTINCT COALESCE(u.label, u.name) ORDER BY COALESCE(u.label, u.name) SEPARATOR ' | ') AS unit_names,
         GROUP_CONCAT(DISTINCT c.id ORDER BY c.name SEPARATOR ',') AS cargo_ids,
         GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ' | ') AS cargo_names
       FROM persons p
       LEFT JOIN documentos_identidad sdoc
         ON sdoc.person_id = p.id AND sdoc.principal = 1 AND sdoc.is_active = 1
       LEFT JOIN emails semail
         ON semail.person_id = p.id AND semail.principal = 1 AND semail.is_active = 1
       LEFT JOIN position_assignments pa
         ON pa.person_id = p.id
        AND pa.is_current = 1
       LEFT JOIN unit_positions up
         ON up.id = pa.position_id
        AND up.is_active = 1
       LEFT JOIN units u
         ON u.id = up.unit_id
        AND u.is_active = 1
       LEFT JOIN unit_types ut
         ON ut.id = u.unit_type_id
       LEFT JOIN cargos c
         ON c.id = up.cargo_id
        AND c.is_active = 1
        ${whereClause}
       GROUP BY p.id, sdoc.numero, semail.direccion
        ORDER BY p.created_at DESC
        LIMIT ?`,
      [...params, safeLimit]
    );

    return rows;
  }

  async create(userData) {
    this.ensurePool();

    const payload = {
      password_hash: userData.password_hash ?? userData.password,
      first_name: userData.first_name ?? userData.nombre,
      last_name: userData.last_name ?? userData.apellido,
      nacionalidad_pais_id: await this.resolveNacionalidadPaisId(userData),
      status: userData.status ?? DEFAULT_STATUS,
      photo_url: userData.photo_url ?? userData.photoUrl ?? null,
      is_active: userData.is_active ?? 1,
      token: userData.token
    };

    if (!payload.token) {
      throw new Error("Token no generado");
    }
    const requiredFields = ["password_hash", "first_name", "last_name"];

    const missingFields = requiredFields.filter(
      (field) => !payload[field]
    );

    if (missingFields.length) {
      throw new Error(
        `Datos incompletos del usuario: ${missingFields.join(", ")}`
      );
    }

    const columns = Object.keys(payload);
    const values = columns.map((key) => payload[key]);
    const placeholders = columns.map(() => "?").join(", ");

    const [result] = await this.pool.query(
      `INSERT INTO persons (${columns.join(", ")}) VALUES (${placeholders})`,
      values
    );

    // La direccion va DESPUES, porque necesita el id de la persona. Si viene mal (una provincia que
    // no esta en el catalogo) el servicio lanza con status 400 y la persona ya esta creada: es lo
    // mismo que pasaba antes con las siete columnas sueltas, solo que antes se guardaba basura en
    // silencio en vez de avisar.
    if (userData.direccion) {
      await this.direcciones.guardarPrincipal(result.insertId, userData.direccion);
    }
    if (userData.telefono) {
      await this.telefonos.guardarPrincipal(result.insertId, userData.telefono);
    }
    if (userData.email) {
      await this.emails.guardarPrincipal(result.insertId, userData.email);
    }
    // El documento de identidad: `documento` es el objeto {tipo, pais, numero}; `cedula` es la
    // forma corta que sigue aceptandose y significa "cedula ecuatoriana".
    const documento = userData.documento ?? (userData.cedula ? { tipo: "cedula_ec", numero: userData.cedula } : null);
    if (documento) {
      await this.documentos.guardarPrincipal(result.insertId, documento);
    }

    return {
      id: result.insertId,
      ...payload
    };
  }

  toPublicUser(userRow, access = null) {
    // El telefono principal que declara canal WhatsApp. Si no hay ninguno, no hay whatsapp.
    const telefonos = userRow?.telefonos ?? [];
    const telefonoDeCanal = telefonos.find((t) => (t.canales ?? []).some((c) => c.code === "whatsapp"));
    const canalWhatsapp = (telefonoDeCanal?.canales ?? []).find((c) => c.code === "whatsapp");

    if (!userRow) return null;

    const toNumericArray = (value) => {
      if (!value) return [];
      return String(value)
        .split(",")
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item));
    };

    const toStringArray = (value) => {
      if (!value) return [];
      return String(value)
        .split(" | ")
        .map((item) => item.trim())
        .filter(Boolean);
    };

    const unitTypeNames = toStringArray(userRow.unit_type_names);
    const unitNames = toStringArray(userRow.unit_names);
    const cargoNames = toStringArray(userRow.cargo_names);

    const publicUser = {
      id: userRow.id ?? userRow._id,
      _id: (userRow.id ?? userRow._id)?.toString(),
      // `cedula` YA NO ES UNA COLUMNA: es el numero del documento principal, colgado por JOIN. Se
      // conserva en el objeto publico porque es identificador de acceso y medio frontend lo lee.
      cedula: userRow.cedula ?? null,
      documento_tipo: userRow.documento_tipo ?? null,
      documentos: userRow.documentos ?? [],
      first_name: userRow.first_name,
      last_name: userRow.last_name,
      // `email` YA NO ES UNA COLUMNA de `persons`: es el principal de la tabla `emails`, colgado
      // por JOIN en las tres lecturas. Se conserva en el objeto publico porque es el identificador
      // de acceso y medio frontend lo lee.
      email: userRow.email ?? null,
      emails: userRow.emails ?? [],
      // `whatsapp` YA NO ES UNA COLUMNA: se deriva del telefono principal que tiene ese canal. Se
      // conserva en el objeto publico porque el bot de bienvenida y el frontend lo leen, pero es
      // una proyeccion, no un dato: no hay dos sitios donde el numero pueda discrepar.
      whatsapp: telefonoDeCanal?.numero_completo ?? null,
      telefonos: userRow.telefonos ?? [],
      nacionalidad: userRow.nacionalidad ?? null,
      nacionalidad_nombre: userRow.nacionalidad_nombre ?? null,
      // Las direcciones ya no son columnas de `persons`: las cuelga quien lee (ver `conDirecciones`).
      direcciones: userRow.direcciones ?? [],
      direccion: userRow.direccion ?? null,
      signatureToken: userRow.token ?? null,
      signatureMarker: userRow.token ? `!-${userRow.token}-!` : null,
      photoUrl: userRow.photo_url ?? userRow.photoUrl ?? null,
      status: userRow.status ?? DEFAULT_STATUS,
      current_assignment: {
        unit_type_ids: toNumericArray(userRow.unit_type_ids),
        unit_type_names: unitTypeNames,
        unit_ids: toNumericArray(userRow.unit_ids),
        unit_names: unitNames,
        cargo_ids: toNumericArray(userRow.cargo_ids),
        cargo_names: cargoNames
      },
      unit_type_name: unitTypeNames[0] ?? "",
      unit_name: unitNames[0] ?? "",
      cargo_name: cargoNames[0] ?? "",
      verify: {
        email: Boolean(userRow.email_verificado),
        // Verificado EN WHATSAPP, que es lo que la bandera vieja no sabia decir.
        whatsapp: Boolean(canalWhatsapp?.verificado)
      },
      createdAt: userRow.created_at ?? userRow.createdAt ?? null,
      updatedAt: userRow.updated_at ?? userRow.updatedAt ?? null
    };

    if (access) {
      publicUser.access = access;
      publicUser.roles = access.roleNames || [];
      publicUser.permissions = access.permissions || [];
      publicUser.role = access.primaryRole || null;
    }

    return publicUser;
  }

  async updatePhotoByCedula(cedula, photoUrl) {
    this.ensurePool();

    if (!cedula) {
      throw new Error("La cédula es requerida");
    }

    await this.pool.query(
      `UPDATE persons SET photo_url = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id IN (SELECT d.person_id FROM documentos_identidad d WHERE d.numero = ? AND d.is_active = 1)`,
      [photoUrl, cedula]
    );

    const updated = await this.findByCedulaOrEmail({ cedula });

    return this.toPublicUser(updated);
  }

  async update(userId, data) {
    this.ensurePool();

    // La nacionalidad se traduce AQUI, en el unico sitio por el que pasan todas las escrituras, y no
    // en cada llamador: hay al menos dos caminos (`updateMe` y el PATCH de perfil, que llama directo)
    // y parchear cada uno es exactamente como se olvida uno. Sin esto, `nacionalidad` viajaba como
    // nombre de columna y PostgreSQL respondia 42703 en tiempo de LLAMADA -- que ninguna prueba de
    // caracterizacion veia, porque ningun fixture manda nacionalidad.
    const payload = { ...data };

    // `direccion` NO es una columna de `persons` desde el paso 3. Se aparta ANTES de componer el
    // UPDATE o PostgreSQL responde 42703 en tiempo de llamada, que es exactamente como se rompio
    // `nacionalidad` en el paso anterior.
    const direccion = payload.direccion;
    delete payload.direccion;
    delete payload.direcciones;
    const telefono = payload.telefono;
    delete payload.telefono;
    delete payload.telefonos;
    delete payload.whatsapp;
    const documento = payload.documento ?? (payload.cedula ? { tipo: "cedula_ec", numero: payload.cedula } : null);
    delete payload.documento;
    delete payload.documentos;
    delete payload.cedula;
    delete payload.documento_tipo;
    delete payload.documento_verificado;
    const email = payload.email;
    delete payload.email;
    delete payload.emails;
    delete payload.email_verificado;
    delete payload.email_id;

    if (payload.nacionalidad !== undefined) {
      const resuelto = await this.resolveNacionalidadPaisId(payload);
      delete payload.nacionalidad;
      payload.nacionalidad_pais_id = resuelto;
    }
    delete payload.nacionalidad_nombre;

    const fields = [];
    const values = [];

    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (!fields.length) {
      if (direccion || telefono || email || documento) {
        if (direccion) await this.direcciones.guardarPrincipal(userId, direccion);
        if (telefono) await this.telefonos.guardarPrincipal(userId, telefono);
        if (email) await this.emails.guardarPrincipal(userId, email);
        if (documento) await this.documentos.guardarPrincipal(userId, documento);
        return this.toPublicUser(await this.findById(userId));
      }
      return null;
    }

    values.push(userId);

    await this.pool.query(
      `UPDATE persons SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    if (direccion) {
      await this.direcciones.guardarPrincipal(userId, direccion);
    }
    if (telefono) {
      await this.telefonos.guardarPrincipal(userId, telefono);
    }
    if (email) {
      await this.emails.guardarPrincipal(userId, email);
    }
    if (documento) {
      await this.documentos.guardarPrincipal(userId, documento);
    }

    const updated = await this.findById(userId);

    return this.toPublicUser(updated);
  }

  async updateMe(userId, data) {
    const allowedFields = [
      "first_name",
      "last_name",
      "email",
      "nacionalidad",
      "nacionalidad_pais_id",
      "direccion",
      "telefono",
      "documento"
    ];

    const filtered = {};

    allowedFields.forEach((field) => {
      if (data[field] !== undefined) {
        filtered[field] = data[field];
      }
    });

    return this.update(userId, filtered);
  }
}
