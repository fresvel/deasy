// Catálogos GENÉRICOS reutilizables, curados a partir de la semilla de BD (pucese.seed.json).
// Solo datos institucionalmente neutros (tipos de unidad, relación, cargos y periodos), NO datos
// PUCESE-específicos (unidades reales, personas, procesos). Se ofrecen como bloques opcionales en el
// wizard de bootstrap y se siembran de forma idempotente.
import bcrypt from "bcrypt";

// Genera N puestos de Docente (slots 1..N) para una unidad, todos del mismo tipo (real|simbolico).
const docenteSlots = (unitSlug, positionType, count) =>
  Array.from({ length: count }, (_, i) => ({
    unit_slug: unitSlug,
    cargo_code: "DOCENTE",
    title: "Docente",
    position_type: positionType,
    is_unit_head: false,
    slot_no: i + 1
  }));

export const GENERIC_CATALOG = {
  unit_types: ["Prorrectorado", "Coordinación", "Dirección", "Escuela", "Jefatura", "Carrera", "Tecnología", "Sede"],
  relation_unit_types: [
    { code: "org", name: "Orgánica", description: "Relación jerárquica organizacional", inheritance: 1 }
  ],
  cargos: [
    { code: "COORDINADOR", name: "Coordinador" },
    { code: "DOCENTE", name: "Docente" },
    { code: "RESPONSABLE", name: "Responsable" },
    { code: "DIRECTOR", name: "Director" },
    { code: "PRORRECTOR", name: "Prorrector" },
    { code: "ASISTENTE", name: "Asistente" },
    { code: "JEFE", name: "Jefe" }
  ],
  // Mapa cargo (por nombre) -> rol (por nombre, resuelto contra el catálogo RBAC base).
  cargo_role_map: [
    { cargo: "Coordinador", role: "GestorProcesos" },
    { cargo: "Director", role: "GestorProcesos" },
    { cargo: "Docente", role: "GestorEjecucionProcesos" },
    { cargo: "Jefe", role: "GestorTalentoHumano" }
  ],
  term_types: [
    { code: "SEM", name: "Semestre", description: "Periodo académico semestral" },
    { code: "TRI", name: "Trimestre", description: "Periodo académico trimestral" },
    { code: "INT", name: "Intensivo", description: "Periodo académico intensivo" },
    { code: "CUS", name: "Custom", description: "Periodo operativo personalizado" }
  ],
  // Estructura de unidades de DEMOSTRACIÓN (árbol orgánico de ejemplo, inspirado en PUCESE). Opt-in:
  // pensada para evaluar el organigrama y los procesos con datos de muestra en una instalación virgen.
  // Cada unidad referencia su tipo por NOMBRE (se crea si falta) y su padre por SLUG; relaciones 'org'.
  // El orden es topológico (padres antes que hijos) para resolver el padre al insertar.
  example_units: [
    { slug: "PREC", name: "Prorrectorado", label: "Prorrectorado", unit_type: "Prorrectorado", parent: null },
    { slug: "DDE", name: "Dirección de Docencia y Estudiantes", label: "Dirección de Docencia y Estudiantes", unit_type: "Dirección", parent: "PREC" },
    { slug: "DIVI", name: "Dirección de Investigación", label: "Dirección de Investigación Vinculación e Innovación", unit_type: "Dirección", parent: "PREC" },
    { slug: "TTHH", name: "Talento Humano", label: "Jefatura de Talento Humano", unit_type: "Jefatura", parent: "PREC" },
    { slug: "CAE", name: "Coordinación de Aprendizaje y Enseñanza", label: "Coordinación de Aprendizaje y Enseñanza", unit_type: "Coordinación", parent: "DDE" },
    { slug: "EHIC", name: "Hábitat Infraestructura y Creatividad", label: "Escuela de Hábitat Infraestructura y Creatividad", unit_type: "Escuela", parent: "CAE" },
    { slug: "E055", name: "Tecnologías de la Información", label: "Carrera de Tecnologías de la Información", unit_type: "Carrera", parent: "EHIC" },
    { slug: "E140", name: "Sistemas de Información", label: "Carrera de Sistemas de Información", unit_type: "Carrera", parent: "EHIC" },
    { slug: "JTIC", name: "Tecnologías de la Información", label: "Tecnologías de la Información", unit_type: "Jefatura", parent: "PREC" },
    { slug: "salud-y-bienestar", name: "Salud y Bienestar", label: "Salud y Bienestar", unit_type: "Escuela", parent: "CAE" },
    { slug: "derecho-educacion-y-sociedad", name: "Derecho Educación y Sociedad", label: "Derecho Educación y Sociedad", unit_type: "Escuela", parent: "CAE" },
    { slug: "formacion-tecnica-y-tecnologica", name: "Formación Técnica y Tecnológica", label: "Formación Técnica y Tecnológica", unit_type: "Escuela", parent: "CAE" },
    { slug: "negocios-y-empresas", name: "Negocios y Empresas", label: "Negocios y Empresas", unit_type: "Escuela", parent: "CAE" }
  ],
  // Puestos de DEMOSTRACIÓN para el árbol de unidades de ejemplo. Cada puesto referencia su unidad por SLUG y
  // su cargo por CÓDIGO (ambos del catálogo de arriba). 'is_unit_head' marca la jefatura (una por unidad).
  // slot_no permite varios puestos del mismo cargo en una unidad (p. ej. dos docentes). Opt-in: requiere las
  // unidades de ejemplo (se siembran juntas).
  example_positions: [
    // Jefaturas (cabeza de unidad) + un Asistente por unidad. Excepción: JTIC no lleva puestos de ejemplo.
    { unit_slug: "PREC", cargo_code: "PRORRECTOR", title: "Prorrector", position_type: "promocion", is_unit_head: true, slot_no: 1 },
    { unit_slug: "PREC", cargo_code: "ASISTENTE", title: "Asistente de Prorrectorado", position_type: "real", is_unit_head: false, slot_no: 1 },
    { unit_slug: "DDE", cargo_code: "DIRECTOR", title: "Director de Docencia y Estudiantes", position_type: "promocion", is_unit_head: true, slot_no: 1 },
    { unit_slug: "DDE", cargo_code: "ASISTENTE", title: "Asistente", position_type: "real", is_unit_head: false, slot_no: 1 },
    { unit_slug: "DIVI", cargo_code: "DIRECTOR", title: "Director de Investigación", position_type: "promocion", is_unit_head: true, slot_no: 1 },
    { unit_slug: "DIVI", cargo_code: "ASISTENTE", title: "Asistente", position_type: "real", is_unit_head: false, slot_no: 1 },
    { unit_slug: "TTHH", cargo_code: "JEFE", title: "Jefe de Talento Humano", position_type: "real", is_unit_head: true, slot_no: 1 },
    { unit_slug: "TTHH", cargo_code: "ASISTENTE", title: "Asistente", position_type: "real", is_unit_head: false, slot_no: 1 },
    { unit_slug: "CAE", cargo_code: "COORDINADOR", title: "Coordinador/a de Aprendizaje y Enseñanza", position_type: "promocion", is_unit_head: true, slot_no: 1 },
    { unit_slug: "CAE", cargo_code: "ASISTENTE", title: "Asistente", position_type: "real", is_unit_head: false, slot_no: 1 },
    // Escuelas (Director como cabeza + Asistente).
    { unit_slug: "EHIC", cargo_code: "DIRECTOR", title: "Director de Escuela", position_type: "promocion", is_unit_head: true, slot_no: 1 },
    { unit_slug: "EHIC", cargo_code: "ASISTENTE", title: "Asistente", position_type: "real", is_unit_head: false, slot_no: 1 },
    { unit_slug: "salud-y-bienestar", cargo_code: "DIRECTOR", title: "Director de Escuela", position_type: "promocion", is_unit_head: true, slot_no: 1 },
    { unit_slug: "salud-y-bienestar", cargo_code: "ASISTENTE", title: "Asistente", position_type: "real", is_unit_head: false, slot_no: 1 },
    { unit_slug: "derecho-educacion-y-sociedad", cargo_code: "DIRECTOR", title: "Director de Escuela", position_type: "promocion", is_unit_head: true, slot_no: 1 },
    { unit_slug: "derecho-educacion-y-sociedad", cargo_code: "ASISTENTE", title: "Asistente", position_type: "real", is_unit_head: false, slot_no: 1 },
    { unit_slug: "formacion-tecnica-y-tecnologica", cargo_code: "DIRECTOR", title: "Director de Escuela", position_type: "promocion", is_unit_head: true, slot_no: 1 },
    { unit_slug: "formacion-tecnica-y-tecnologica", cargo_code: "ASISTENTE", title: "Asistente", position_type: "real", is_unit_head: false, slot_no: 1 },
    { unit_slug: "negocios-y-empresas", cargo_code: "DIRECTOR", title: "Director de Escuela", position_type: "promocion", is_unit_head: true, slot_no: 1 },
    { unit_slug: "negocios-y-empresas", cargo_code: "ASISTENTE", title: "Asistente", position_type: "real", is_unit_head: false, slot_no: 1 },
    // Carreras: Coordinador (cabeza) + Asistente + plantilla docente.
    { unit_slug: "E055", cargo_code: "COORDINADOR", title: "Coordinador de Carrera", position_type: "promocion", is_unit_head: true, slot_no: 1 },
    { unit_slug: "E055", cargo_code: "ASISTENTE", title: "Asistente", position_type: "real", is_unit_head: false, slot_no: 1 },
    { unit_slug: "E140", cargo_code: "COORDINADOR", title: "Coordinador de Carrera", position_type: "promocion", is_unit_head: true, slot_no: 1 },
    { unit_slug: "E140", cargo_code: "ASISTENTE", title: "Asistente", position_type: "real", is_unit_head: false, slot_no: 1 },
    // Tecnologías de la Información: 8 docentes reales; Sistemas de Información: 8 docentes simbólicos.
    ...docenteSlots("E055", "real", 8),
    ...docenteSlots("E140", "simbolico", 8)
  ]
};

// Bloques que el wizard puede ofrecer como opcionales (claves de preconfig).
export const PRECONFIG_BLOCKS = ["unit_types", "relation_unit_types", "cargos", "term_types", "example_units", "example_positions", "example_occupants"];

const selectCatalogEntries = (selection, entries, getId) => {
  if (selection === true) {
    return entries;
  }
  if (!Array.isArray(selection)) {
    return [];
  }

  const selectedIds = new Set(selection.map((value) => String(value || "").trim()).filter(Boolean));
  return entries.filter((entry) => selectedIds.has(getId(entry)));
};

export const getGenericCatalogOptions = () => ({
  unit_types: GENERIC_CATALOG.unit_types.map((name) => ({
    id: name,
    label: name
  })),
  cargos: GENERIC_CATALOG.cargos.map((cargo) => ({
    id: cargo.code,
    label: cargo.name
  })),
  term_types: GENERIC_CATALOG.term_types.map((termType) => ({
    id: termType.code,
    label: termType.name,
    description: termType.description
  }))
});

const ORG_RELATION = GENERIC_CATALOG.relation_unit_types.find((relation) => relation.code === "org");

// Siembra idempotente del árbol de unidades de ejemplo. Asegura primero los tipos de unidad usados y el
// tipo de relación orgánica (dependencias), crea las unidades por slug y luego las relaciones padre->hijo.
const seedExampleUnits = async (connection) => {
  // 1. Tipos de unidad requeridos por el árbol (por nombre, idempotente).
  const neededTypes = [...new Set(GENERIC_CATALOG.example_units.map((unit) => unit.unit_type))];
  for (const name of neededTypes) {
    await connection.query(
      "INSERT INTO unit_types (name, is_active) SELECT ?, 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM unit_types WHERE name = ?)",
      [name, name]
    );
  }
  const typeIdByName = new Map();
  for (const name of neededTypes) {
    const [rows] = await connection.query("SELECT id FROM unit_types WHERE name = ? LIMIT 1", [name]);
    if (rows?.[0]?.id) typeIdByName.set(name, Number(rows[0].id));
  }

  // 2. Tipo de relación orgánica (dependencia de las relaciones del árbol).
  await connection.query(
    "INSERT IGNORE INTO relation_unit_types (code, name, description, is_inheritance_allowed, is_active) VALUES (?, ?, ?, ?, 1)",
    [ORG_RELATION.code, ORG_RELATION.name, ORG_RELATION.description, ORG_RELATION.inheritance]
  );
  const [relationRows] = await connection.query("SELECT id FROM relation_unit_types WHERE code = ? LIMIT 1", [ORG_RELATION.code]);
  const orgRelationId = relationRows?.[0]?.id ? Number(relationRows[0].id) : null;

  // 3. Unidades (idempotente por slug) -> mapa slug->id.
  const idBySlug = new Map();
  for (const unit of GENERIC_CATALOG.example_units) {
    const typeId = typeIdByName.get(unit.unit_type);
    if (!typeId) continue;
    await connection.query(
      `INSERT INTO units (name, label, slug, unit_type_id, is_active)
       SELECT ?, ?, ?, ?, 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM units WHERE slug = ?)`,
      [unit.name, unit.label, unit.slug, typeId, unit.slug]
    );
    const [rows] = await connection.query("SELECT id FROM units WHERE slug = ? LIMIT 1", [unit.slug]);
    if (rows?.[0]?.id) idBySlug.set(unit.slug, Number(rows[0].id));
  }

  // 4. Relaciones orgánicas padre->hijo (idempotente; un padre por tipo de relación).
  if (orgRelationId) {
    for (const unit of GENERIC_CATALOG.example_units) {
      if (!unit.parent) continue;
      const parentId = idBySlug.get(unit.parent);
      const childId = idBySlug.get(unit.slug);
      if (!parentId || !childId) continue;
      await connection.query(
        `INSERT INTO unit_relations (relation_type_id, parent_unit_id, child_unit_id)
         SELECT ?, ?, ? FROM DUAL WHERE NOT EXISTS (
           SELECT 1 FROM unit_relations
           WHERE relation_type_id = ? AND parent_unit_id = ? AND child_unit_id = ?
         )`,
        [orgRelationId, parentId, childId, orgRelationId, parentId, childId]
      );
    }
  }

  return idBySlug.size;
};

// Siembra idempotente de los puestos de ejemplo. Resuelve unidad por slug y cargo por código (deben existir;
// las unidades de ejemplo se siembran antes). slot_no permite repetir cargo en una unidad; head_flag (única por
// unidad) la maneja la BD. Idempotente por (unit_id, cargo_id, slot_no).
const seedExamplePositions = async (connection) => {
  const positions = GENERIC_CATALOG.example_positions || [];
  if (!positions.length) return 0;

  const slugs = [...new Set(positions.map((p) => p.unit_slug))];
  const codes = [...new Set(positions.map((p) => p.cargo_code))];
  const unitIdBySlug = new Map();
  const cargoIdByCode = new Map();
  for (const slug of slugs) {
    const [rows] = await connection.query("SELECT id FROM units WHERE slug = ? LIMIT 1", [slug]);
    if (rows?.[0]?.id) unitIdBySlug.set(slug, Number(rows[0].id));
  }
  for (const code of codes) {
    const [rows] = await connection.query("SELECT id FROM cargos WHERE code = ? LIMIT 1", [code]);
    if (rows?.[0]?.id) cargoIdByCode.set(code, Number(rows[0].id));
  }

  let seededCount = 0;
  for (const pos of positions) {
    const unitId = unitIdBySlug.get(pos.unit_slug);
    const cargoId = cargoIdByCode.get(pos.cargo_code);
    if (!unitId || !cargoId) continue;
    const positionType = ["real", "promocion", "simbolico"].includes(pos.position_type) ? pos.position_type : "real";
    const isHead = pos.is_unit_head ? 1 : 0;
    const slotNo = Number(pos.slot_no) || 1;
    const [result] = await connection.query(
      `INSERT INTO unit_positions (unit_id, cargo_id, slot_no, title, profile, position_type, is_unit_head, is_active)
       SELECT ?, ?, ?, ?, NULL, ?, ?, 1 FROM DUAL
       WHERE NOT EXISTS (
         SELECT 1 FROM unit_positions WHERE unit_id = ? AND cargo_id = ? AND slot_no = ?
       )`,
      [unitId, cargoId, slotNo, pos.title || null, positionType, isHead, unitId, cargoId, slotNo]
    );
    if (result?.affectedRows) seededCount += 1;
  }
  return seededCount;
};

// Crea un USUARIO genérico por cada puesto de ejemplo (contraseña Demo1234!), lo ocupa (position_assignments)
// y le asigna el rol EJECUTOR (GestorEjecucionProcesos → recibe/ejecuta tarjetas de trabajo) más el rol mapeado
// por su cargo si existe (cargo_role_map). Idempotente: omite puestos ya ocupados; reutiliza la persona por
// cédula/email determinista. Requiere los puestos de ejemplo sembrados antes. cédulas 90xxxxxxxx (10 díg., no
// colisionan con las cuentas demo); emails puestoN@demo.deasy.local.
const DEMO_OCCUPANT_PASSWORD = "Demo1234!";
const EXECUTOR_ROLE_NAME = "GestorEjecucionProcesos";

const seedExampleOccupants = async (connection, roleIds = new Map()) => {
  const positions = GENERIC_CATALOG.example_positions || [];
  if (!positions.length) return 0;

  const cargoNameByCode = new Map(GENERIC_CATALOG.cargos.map((c) => [c.code, c.name]));
  const roleByCargoName = new Map(GENERIC_CATALOG.cargo_role_map.map((m) => [m.cargo, m.role]));
  const passwordHash = await bcrypt.hash(DEMO_OCCUPANT_PASSWORD, 10);

  let created = 0;
  let idx = 0;
  for (const pos of positions) {
    idx += 1;
    const slot = Number(pos.slot_no) || 1;
    const [uRows] = await connection.query("SELECT id FROM units WHERE slug = ? LIMIT 1", [pos.unit_slug]);
    const unitId = uRows?.[0]?.id;
    const [cRows] = await connection.query("SELECT id FROM cargos WHERE code = ? LIMIT 1", [pos.cargo_code]);
    const cargoId = cRows?.[0]?.id;
    if (!unitId || !cargoId) continue;

    const [pRows] = await connection.query(
      "SELECT id FROM unit_positions WHERE unit_id = ? AND cargo_id = ? AND slot_no = ? LIMIT 1",
      [unitId, cargoId, slot]
    );
    const positionId = pRows?.[0]?.id;
    if (!positionId) continue;

    // Idempotencia: si el puesto ya está ocupado, no se crea otro usuario.
    const [occ] = await connection.query(
      "SELECT id FROM position_assignments WHERE position_id = ? AND is_current = 1 LIMIT 1",
      [positionId]
    );
    if (occ.length) continue;

    // Persona genérica (idempotente por cédula/email determinista).
    const cedula = `90${String(idx).padStart(8, "0")}`;
    const email = `puesto${idx}@demo.deasy.local`;
    const [exP] = await connection.query(
      "SELECT id FROM persons WHERE cedula = ? OR email = ? LIMIT 1",
      [cedula, email]
    );
    let personId = exP?.[0]?.id;
    if (!personId) {
      const cargoName = cargoNameByCode.get(pos.cargo_code) || pos.cargo_code;
      const lastName = `${pos.unit_slug}${slot > 1 ? ` ${slot}` : ""}`;
      const [insP] = await connection.query(
        `INSERT INTO persons (cedula, first_name, last_name, email, password_hash, token, status, verify_email, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 'Activo', 1, 1)`,
        [cedula, cargoName, lastName, email, passwordHash, cedula]
      );
      personId = insP.insertId;
    }

    // Ocupación del puesto.
    await connection.query(
      "INSERT INTO position_assignments (position_id, person_id, start_date, is_current) VALUES (?, ?, CURDATE(), 1)",
      [positionId, personId]
    );

    // El rol mapeado por el cargo (cargo_role_map) se DERIVA automáticamente al ocupar el puesto (trigger sobre
    // position_assignments), así que NO se asigna a mano (evitamos duplicados). Solo aseguramos a mano el rol
    // EJECUTOR (GestorEjecucionProcesos → recibe/ejecuta las tarjetas de trabajo) cuando el cargo no lo deriva por
    // sí mismo (todos salvo Docente, cuyo cargo ya mapea a GestorEjecucionProcesos).
    const mappedRole = roleByCargoName.get(cargoNameByCode.get(pos.cargo_code));
    if (mappedRole !== EXECUTOR_ROLE_NAME) {
      const execRoleId = roleIds.get(EXECUTOR_ROLE_NAME);
      if (execRoleId) {
        await connection.query(
          `INSERT IGNORE INTO role_assignments
             (role_id, unit_id, source, person_id, max_depth, start_date, is_current, assigned_at)
           VALUES (?, ?, 'manual', ?, 0, CURDATE(), 1, NOW())`,
          [execRoleId, unitId, personId]
        );
      }
    }
    created += 1;
  }
  return created;
};

// Siembra idempotente de los bloques seleccionados. Reutiliza la conexión/transacción del bootstrap y el
// mapa roleIds (name->id) ya producido por seedBaseRbacCatalog para resolver cargo_role_map.
export const seedGenericCatalog = async (connection, preconfig = {}, roleIds = new Map()) => {
  const seeded = {};
  const selectedUnitTypes = selectCatalogEntries(
    preconfig.unit_types,
    GENERIC_CATALOG.unit_types,
    (name) => name
  );
  const selectedCargos = selectCatalogEntries(
    preconfig.cargos,
    GENERIC_CATALOG.cargos,
    (cargo) => cargo.code
  );
  // Dependencia: si se piden los puestos (o los usuarios por puesto) de ejemplo, asegura también SUS cargos
  // (con su mapeo de rol) aunque el bloque "cargos" no los incluya, para que ningún puesto se omita por un
  // cargo faltante.
  if (preconfig.example_positions || preconfig.example_occupants) {
    const neededCargoCodes = new Set(GENERIC_CATALOG.example_positions.map((p) => p.cargo_code));
    const selectedCodes = new Set(selectedCargos.map((c) => c.code));
    for (const cargo of GENERIC_CATALOG.cargos) {
      if (neededCargoCodes.has(cargo.code) && !selectedCodes.has(cargo.code)) selectedCargos.push(cargo);
    }
  }
  const selectedTermTypes = selectCatalogEntries(
    preconfig.term_types,
    GENERIC_CATALOG.term_types,
    (termType) => termType.code
  );

  if (selectedUnitTypes.length > 0) {
    for (const name of selectedUnitTypes) {
      await connection.query(
        "INSERT INTO unit_types (name, is_active) SELECT ?, 1 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM unit_types WHERE name = ?)",
        [name, name]
      );
    }
    seeded.unit_types = selectedUnitTypes.length;
  }

  if (preconfig.relation_unit_types) {
    for (const r of GENERIC_CATALOG.relation_unit_types) {
      await connection.query(
        "INSERT IGNORE INTO relation_unit_types (code, name, description, is_inheritance_allowed, is_active) VALUES (?, ?, ?, ?, 1)",
        [r.code, r.name, r.description, r.inheritance]
      );
    }
    seeded.relation_unit_types = GENERIC_CATALOG.relation_unit_types.length;
  }

  if (selectedCargos.length > 0) {
    for (const c of selectedCargos) {
      await connection.query(
        "INSERT IGNORE INTO cargos (code, name, is_active) VALUES (?, ?, 1)",
        [c.code, c.name]
      );
    }
    const selectedCargoNames = new Set(selectedCargos.map((cargo) => cargo.name));
    for (const m of GENERIC_CATALOG.cargo_role_map) {
      if (!selectedCargoNames.has(m.cargo)) continue;
      const roleId = roleIds.get(m.role);
      if (!roleId) continue;
      const [cargoRows] = await connection.query("SELECT id FROM cargos WHERE name = ? LIMIT 1", [m.cargo]);
      const cargoId = cargoRows?.[0]?.id;
      if (!cargoId) continue;
      await connection.query(
        "INSERT IGNORE INTO cargo_role_map (cargo_id, role_id) VALUES (?, ?)",
        [cargoId, roleId]
      );
    }
    seeded.cargos = selectedCargos.length;
  }

  if (selectedTermTypes.length > 0) {
    for (const t of selectedTermTypes) {
      await connection.query(
        "INSERT IGNORE INTO term_types (code, name, description, is_active) VALUES (?, ?, ?, 1)",
        [t.code, t.name, t.description]
      );
    }
    seeded.term_types = selectedTermTypes.length;
  }

  // Las unidades de ejemplo se siembran si se piden directamente o si se piden los puestos/usuarios (dependencia).
  if (preconfig.example_units || preconfig.example_positions || preconfig.example_occupants) {
    seeded.example_units = await seedExampleUnits(connection);
  }

  // Los puestos se siembran si se piden directamente o si se piden los usuarios por puesto (dependencia).
  if (preconfig.example_positions || preconfig.example_occupants) {
    seeded.example_positions = await seedExamplePositions(connection);
  }

  // Usuarios genéricos por puesto (ocupación + roles) para recibir tarjetas de trabajo.
  if (preconfig.example_occupants) {
    seeded.example_occupants = await seedExampleOccupants(connection, roleIds);
  }

  return seeded;
};
