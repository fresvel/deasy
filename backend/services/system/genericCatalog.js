// Catálogos GENÉRICOS reutilizables, curados a partir de la semilla de BD (pucese.seed.json).
// Solo datos institucionalmente neutros (tipos de unidad, relación, cargos y periodos), NO datos
// PUCESE-específicos (unidades reales, personas, procesos). Se ofrecen como bloques opcionales en el
// wizard de bootstrap y se siembran de forma idempotente.

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
  ]
};

// Bloques que el wizard puede ofrecer como opcionales (claves de preconfig).
export const PRECONFIG_BLOCKS = ["unit_types", "relation_unit_types", "cargos", "term_types"];

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

  return seeded;
};
