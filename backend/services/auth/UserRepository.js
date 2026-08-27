import { getPostgresPool } from "../../config/postgres.js";
import DireccionService from "../users/DireccionService.js";

const DEFAULT_STATUS = "Inactivo";

export default class UserRepository {
  constructor(pool = getPostgresPool()) {
    this.pool = pool;
    this.direcciones = new DireccionService(pool);
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
    const direcciones = await this.direcciones.listarPorPersona(userRow.id ?? userRow._id);
    return {
      ...userRow,
      direcciones,
      direccion: direcciones.find((d) => d.tipo === "residencia" && Number(d.principal) === 1) ?? null
    };
  }

  async findById(id) {
    this.ensurePool();

    const [rows] = await this.pool.query(
      `SELECT p.*, na.iso_alpha2 AS nacionalidad, na.name AS nacionalidad_nombre
       FROM persons p
       LEFT JOIN paises na ON na.id = p.nacionalidad_pais_id
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
      conditions.push("p.cedula = ?");
      params.push(cedula);
    }

    if (email) {
      conditions.push("p.email = ?");
      params.push(email);
    }

    if (!conditions.length) {
      return null;
    }

    const [rows] = await this.pool.query(
      `SELECT p.*, na.iso_alpha2 AS nacionalidad, na.name AS nacionalidad_nombre
       FROM persons p
       LEFT JOIN paises na ON na.id = p.nacionalidad_pais_id
       WHERE ${conditions.join(" OR ")} LIMIT 1`,
      params
    );

    return this.conDirecciones(rows?.[0] ?? null);
  }

  async findAll() {
    this.ensurePool();

    const [rows] = await this.pool.query(
      `SELECT p.*, na.iso_alpha2 AS nacionalidad, na.name AS nacionalidad_nombre
       FROM persons p
       LEFT JOIN paises na ON na.id = p.nacionalidad_pais_id
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
    return rows.map((row) => {
      const lista = porPersona.get(Number(row.id)) ?? [];
      return {
        ...row,
        direcciones: lista,
        direccion: lista.find((d) => d.tipo === "residencia" && Number(d.principal) === 1) ?? null
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

      conditions.push(
        "(cedula LIKE ? OR email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)"
      );

      params.push(like, like, like, like);
    }

    if (statusFilter) {
      conditions.push("status = ?");
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
         GROUP_CONCAT(DISTINCT ut.id ORDER BY ut.name SEPARATOR ',') AS unit_type_ids,
         GROUP_CONCAT(DISTINCT ut.name ORDER BY ut.name SEPARATOR ' | ') AS unit_type_names,
         GROUP_CONCAT(DISTINCT u.id ORDER BY COALESCE(u.label, u.name) SEPARATOR ',') AS unit_ids,
         GROUP_CONCAT(DISTINCT COALESCE(u.label, u.name) ORDER BY COALESCE(u.label, u.name) SEPARATOR ' | ') AS unit_names,
         GROUP_CONCAT(DISTINCT c.id ORDER BY c.name SEPARATOR ',') AS cargo_ids,
         GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ' | ') AS cargo_names
       FROM persons p
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
       GROUP BY p.id
        ORDER BY p.created_at DESC
        LIMIT ?`,
      [...params, safeLimit]
    );

    return rows;
  }

  async create(userData) {
    this.ensurePool();

    const payload = {
      cedula: userData.cedula,
      email: userData.email ?? null,
      password_hash: userData.password_hash ?? userData.password,
      first_name: userData.first_name ?? userData.nombre,
      last_name: userData.last_name ?? userData.apellido,
      whatsapp: userData.whatsapp ?? null,
      nacionalidad_pais_id: await this.resolveNacionalidadPaisId(userData),
      status: userData.status ?? DEFAULT_STATUS,
      verify_email: Number(userData.verify_email ?? userData.verify?.email ?? 0),
      verify_whatsapp: Number(userData.verify_whatsapp ?? userData.verify?.whatsapp ?? 0),
      photo_url: userData.photo_url ?? userData.photoUrl ?? null,
      is_active: userData.is_active ?? 1,
      token: userData.token
    };

    if (!payload.token) {
      throw new Error("Token no generado");
    }
    const requiredFields = ["cedula", "password_hash", "first_name", "last_name"];

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

    return {
      id: result.insertId,
      ...payload
    };
  }

  toPublicUser(userRow, access = null) {
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
      cedula: userRow.cedula,
      first_name: userRow.first_name,
      last_name: userRow.last_name,
      email: userRow.email,
      whatsapp: userRow.whatsapp,
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
        email: Boolean(userRow.verify_email),
        whatsapp: Boolean(userRow.verify_whatsapp)
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
      "UPDATE persons SET photo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE cedula = ?",
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
      if (direccion) {
        await this.direcciones.guardarPrincipal(userId, direccion);
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

    const updated = await this.findById(userId);

    return this.toPublicUser(updated);
  }

  async updateMe(userId, data) {
    const allowedFields = [
      "first_name",
      "last_name",
      "email",
      "whatsapp",
      "nacionalidad",
      "nacionalidad_pais_id",
      "direccion"
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
