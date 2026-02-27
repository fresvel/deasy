import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_BASE = process.env.API_BASE || "http://localhost:3030/easym/v1";
const SQL_BASE = `${API_BASE}/admin/sql`;

const today = new Date();
const isoDate = (d) => d.toISOString().slice(0, 10);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const bcrypt = require(path.join(repoRoot, "backend", "node_modules", "bcrypt"));
const mysql = require(path.join(repoRoot, "backend", "node_modules", "mysql2", "promise"));
const envPath = path.join(repoRoot, "backend", ".env");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const loadEnv = async () => {
  try {
    const raw = await readFile(envPath, "utf8");
    raw.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return;
      }
      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
  } catch (error) {
    console.warn(`⚠️  No se pudo leer ${envPath}: ${error.message}`);
  }
};

const getDbConnection = async () => {
  await loadEnv();
  const {
    MARIADB_HOST,
    MARIADB_PORT,
    MARIADB_USER,
    MARIADB_PASSWORD,
    MARIADB_DATABASE
  } = process.env;

  if (!MARIADB_HOST || !MARIADB_PORT || !MARIADB_USER || !MARIADB_DATABASE) {
    throw new Error("Configuracion MariaDB incompleta para insertar datos extendidos.");
  }

  return mysql.createConnection({
    host: MARIADB_HOST,
    port: Number(MARIADB_PORT),
    user: MARIADB_USER,
    password: MARIADB_PASSWORD,
    database: MARIADB_DATABASE,
    timezone: "Z"
  });
};

const waitForApi = async (url, { retries = 12, delayMs = 1000 } = {}) => {
  let lastStatus = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok) {
        return;
      }
      lastStatus = response.status;
    } catch (error) {
      if (attempt === retries) {
        throw new Error(`API no disponible tras ${retries} intentos: ${error.message}`);
      }
    }
    await sleep(delayMs);
  }
  const statusInfo = lastStatus ? ` Último estado HTTP: ${lastStatus}.` : "";
  throw new Error(`API no disponible tras ${retries} intentos.${statusInfo}`);
};

const request = async (method, url, body) => {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${method} ${url} failed: ${response.status} ${text}`);
  }
  return response.json();
};

const post = (table, payload) => request("POST", `${SQL_BASE}/${table}`, payload);

const getList = async (table, params = {}) => {
  const search = new URLSearchParams(params);
  const url = `${SQL_BASE}/${table}?${search.toString()}`;
  return request("GET", url);
};

const ensureRelationType = async ({ code, name, is_inheritance_allowed = 1, is_active = 1 }) => {
  const existing = await getList("relation_unit_types", {
    filter_code: code,
    orderBy: "id",
    order: "asc",
    limit: 1
  });
  if (existing.length) {
    return existing[0];
  }
  return post("relation_unit_types", {
    code,
    name,
    is_inheritance_allowed,
    is_active
  });
};

const ensureTermType = async ({ code, name, description = "", is_active = 1 }) => {
  const existing = await getList("term_types", {
    filter_code: code,
    orderBy: "id",
    order: "asc",
    limit: 1
  });
  if (existing.length) {
    return existing[0];
  }
  return post("term_types", {
    code,
    name,
    description,
    is_active
  });
};

const slugify = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 120);

const makeUnitLabel = (value) => {
  const cleaned = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim();
  if (!cleaned) {
    return value.slice(0, 4).toUpperCase();
  }
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 4).toUpperCase();
  }
  const initials = words.map((word) => word[0]).join("").toUpperCase();
  return initials.slice(0, 5);
};

const unitLabelOverrides = new Map([
  ["Direccion Administrativa", "Administración"],
  ["Direccion de Docencia y Estudiantes", "Academia"],
  ["Direccion de Investigacion", "Investigación"],
  ["Direccion Financiera", "Financiero"],
  ["Jefatura de Aseguramiento de la Calidad", "Calidad"],
  ["Jefatura de Sistemas", "Sistemas"],
  ["Jefatura de Talento Humano", "Talento Humano"],
  ["Prorrectorado", "Prorrectorado"],
  ["Sede", "Sede"],
  ["SYSTEM", "System"]
]);

const resolveUnitLabel = (name) => unitLabelOverrides.get(name) || makeUnitLabel(name);

const uniqueSlug = (base, used) => {
  let slug = base;
  let counter = 1;
  while (used.has(slug)) {
    counter += 1;
    slug = `${base}-${counter}`;
  }
  used.add(slug);
  return slug;
};

const makeRng = (seedValue) => {
  let seed = 0;
  for (const char of seedValue) {
    seed = (seed * 31 + char.charCodeAt(0)) % 2147483647;
  }
  return () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
};

const makeDeterministicUuidFactory = (seedValue) => {
  let counter = 0;
  return (scope = "id") => {
    counter += 1;
    const hex = createHash("sha256")
      .update(`${seedValue}:${scope}:${counter}`)
      .digest("hex");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  };
};

const pickRoundRobin = (list, state) => {
  if (!list.length) {
    return null;
  }
  const idx = state.index % list.length;
  const value = list[idx];
  state.index += 1;
  return value;
};

const run = async () => {
  const seedValue = process.env.SEED || "seed-pucese";
  const rng = makeRng(seedValue);
  const seedUuid = makeDeterministicUuidFactory(seedValue);
  const nextSeedUuid = (scope) => seedUuid(scope);
  const plainPassword = process.env.SEED_PASSWORD || "Seed2026!";
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  console.log(`🚀 Semilla institucional en ${API_BASE}`);
  await waitForApi(`${SQL_BASE}/meta`);
  const db = await getDbConnection();
  try {

  const usedSlugs = new Set();

  const unitTypeNames = [
    "Sistema",
    "Sede",
    "Prorrectorado",
    "Direccion",
    "Coordinacion",
    "Grado",
    "Escuela",
    "Maestria",
    "Doctorado",
    "Tecnologia",
    "Jefatura"
  ];

  const relationTypes = [
    { code: "org", name: "Organica", inherit: 1 },
    { code: "acad", name: "Academica", inherit: 1 },
    { code: "adm", name: "Administrativa", inherit: 0 },
    { code: "inv", name: "Investigacion", inherit: 1 },
    { code: "vinc", name: "Vinculacion", inherit: 1 },
    { code: "soporte", name: "Soporte", inherit: 0 }
  ];

  const cargos = [
    "Prorrector",
    "Docente",
    "Investigador",
    "Coordinador",
    "Mentor",
    "Director",
    "Responsable de Calidad",
    "Responsable de COIL",
    "Responsable de Alumni",
    "Tecnico Docente",
    "Asistente Academica",
    "Jefe",
    "Responsable de Titulacion",
    "Responsable de Investigacion"
  ];

  const roles = [
    "role_prorrector",
    "role_docente",
    "role_investigador",
    "role_coordinador",
    "role_mentor",
    "role_director",
    "role_resp_calidad",
    "role_resp_coil",
    "role_resp_alumni",
    "role_tecnico_docente",
    "role_asistente_academica",
    "role_jefe",
    "role_resp_titulacion",
    "role_resp_investigacion",
    "role_admin"
  ];

  const cargoToRole = new Map([
    ["Prorrector", "role_prorrector"],
    ["Docente", "role_docente"],
    ["Investigador", "role_investigador"],
    ["Coordinador", "role_coordinador"],
    ["Mentor", "role_mentor"],
    ["Director", "role_director"],
    ["Responsable de Calidad", "role_resp_calidad"],
    ["Responsable de COIL", "role_resp_coil"],
    ["Responsable de Alumni", "role_resp_alumni"],
    ["Tecnico Docente", "role_tecnico_docente"],
    ["Asistente Academica", "role_asistente_academica"],
    ["Jefe", "role_jefe"],
    ["Responsable de Titulacion", "role_resp_titulacion"],
    ["Responsable de Investigacion", "role_resp_investigacion"]
  ]);

  const resources = [
    "unit_types",
    "relation_unit_types",
    "units",
    "unit_relations",
    "persons",
    "cargos",
    "unit_positions",
    "position_assignments",
    "vacancies",
    "vacancy_visibility",
    "aplications",
    "offers",
    "contracts",
    "contract_origins",
    "contract_origin_recruitment",
    "contract_origin_renewal",
    "roles",
    "resources",
    "actions",
    "permissions",
    "role_permissions",
    "role_assignments",
    "role_assignment_relation_types",
    "cargo_role_map",
    "processes",
    "process_versions",
    "term_types",
    "terms",
    "tasks",
    "task_assignments",
    "templates",
    "template_versions",
    "documents",
    "document_versions",
    "signature_types",
    "signature_statuses",
    "signature_request_statuses",
    "signature_flow_templates",
    "signature_flow_steps",
    "signature_flow_instances",
    "signature_requests",
    "document_signatures"
  ];

  const actions = [
    { code: "create", name: "Crear" },
    { code: "read", name: "Leer" },
    { code: "update", name: "Actualizar" },
    { code: "delete", name: "Eliminar" },
    { code: "manage", name: "Gestionar" }
  ];

  const unitTypeByName = new Map();
  for (const name of unitTypeNames) {
    const created = await post("unit_types", { name, is_active: 1 });
    unitTypeByName.set(name, created.id);
  }

  const relationTypeByCode = new Map();
  for (const rel of relationTypes) {
    const created = await ensureRelationType({
      code: rel.code,
      name: rel.name,
      is_inheritance_allowed: rel.inherit,
      is_active: 1
    });
    relationTypeByCode.set(rel.code, created.id);
  }
  const semesterType = await ensureTermType({
    code: "SEM",
    name: "Semestre",
    description: "Periodo academico semestral"
  });

  const orgRelationId = relationTypeByCode.get("org");

  const unitsByName = new Map();
  const unitsByType = new Map();

  const registerUnit = async ({ name, type, parentName = null }) => {
    const slug = uniqueSlug(slugify(name), usedSlugs);
    const created = await post("units", {
      name,
      label: resolveUnitLabel(name),
      slug,
      unit_type_id: unitTypeByName.get(type),
      is_active: 1
    });
    const unit = { ...created, name, slug, type };
    unitsByName.set(name, unit);
    if (!unitsByType.has(type)) {
      unitsByType.set(type, []);
    }
    unitsByType.get(type).push(unit);
    if (parentName) {
      const parent = unitsByName.get(parentName);
      await post("unit_relations", {
        relation_type_id: orgRelationId,
        parent_unit_id: parent.id,
        child_unit_id: unit.id
      });
    }
    return unit;
  };

  const unitSystem = await registerUnit({ name: "SYSTEM", type: "Sistema" });
  const unitSede = await registerUnit({ name: "Sede", type: "Sede" });
  const unitProrrectorado = await registerUnit({
    name: "Prorrectorado",
    type: "Prorrectorado",
    parentName: "Sede"
  });

  const unitDocencia = await registerUnit({
    name: "Direccion de Docencia y Estudiantes",
    type: "Direccion",
    parentName: "Prorrectorado"
  });
  const unitInvestigacion = await registerUnit({
    name: "Direccion de Investigacion",
    type: "Direccion",
    parentName: "Prorrectorado"
  });
  const unitFinanciera = await registerUnit({
    name: "Direccion Financiera",
    type: "Direccion",
    parentName: "Prorrectorado"
  });
  const unitAdministrativa = await registerUnit({
    name: "Direccion Administrativa",
    type: "Direccion",
    parentName: "Prorrectorado"
  });

  const unitTalentoHumano = await registerUnit({
    name: "Jefatura de Talento Humano",
    type: "Jefatura",
    parentName: "Prorrectorado"
  });
  const unitSistemas = await registerUnit({
    name: "Jefatura de Sistemas",
    type: "Jefatura",
    parentName: "Prorrectorado"
  });
  const unitAsegCalidad = await registerUnit({
    name: "Jefatura de Aseguramiento de la Calidad",
    type: "Jefatura",
    parentName: "Prorrectorado"
  });

  const unitCAE = await registerUnit({
    name: "Coordinacion de Aprendizaje y Ensenanza",
    type: "Coordinacion",
    parentName: unitDocencia.name
  });
  const unitBienestar = await registerUnit({
    name: "Coordinacion de Bienestar Estudiantil",
    type: "Coordinacion",
    parentName: unitDocencia.name
  });
  const unitBeneficios = await registerUnit({
    name: "Coordinacion de Beneficios Economicos y Becas",
    type: "Coordinacion",
    parentName: unitDocencia.name
  });

  const schools = [];
  const registerSchool = async (name) => {
    const school = await registerUnit({
      name,
      type: "Escuela",
      parentName: unitCAE.name
    });
    schools.push(school);
    return school;
  };

  const schoolSalud = await registerSchool("Escuela de Salud y Bienestar");
  const schoolTecnica = await registerSchool("Escuela de Formacion Tecnica y Tecnologica");
  const schoolHabitat = await registerSchool("Escuela de Habitat Infraestructura y Creatividad");
  const schoolDerecho = await registerSchool("Escuela de Derecho Educacion y Sociedad");
  const schoolNegocios = await registerSchool("Escuela de Negocios y Empresas");

  const gradesBySchool = new Map();
  const grades = [];
  const registerGrade = async (name, parentSchool) => {
    const grade = await registerUnit({
      name,
      type: "Grado",
      parentName: parentSchool.name
    });
    grades.push(grade);
    if (!gradesBySchool.has(parentSchool.id)) {
      gradesBySchool.set(parentSchool.id, []);
    }
    gradesBySchool.get(parentSchool.id).push(grade);
    return grade;
  };

  await registerGrade("Carrera de Diseno Grafico", schoolHabitat);
  await registerGrade("Carrera de Sistemas de Informacion", schoolHabitat);
  await registerGrade("Carrera de Ingenieria en Alimentos", schoolHabitat);
  await registerGrade("Carrera de Agroindustria", schoolHabitat);

  const unitMaestriaElectricidad = await registerUnit({
    name: "Maestria en Electricidad",
    type: "Maestria",
    parentName: schoolHabitat.name
  });

  const cargoByName = new Map();
  for (const cargo of cargos) {
    const created = await post("cargos", { name: cargo, is_active: 1 });
    cargoByName.set(cargo, created.id);
  }

  const roleByName = new Map();
  for (const role of roles) {
    const created = await post("roles", { name: role, is_active: 1 });
    roleByName.set(role, created.id);
  }

  const resourceByCode = new Map();
  for (const resource of resources) {
    const [result] = await db.query(
      "INSERT INTO resources (code, name, is_active) VALUES (?, ?, 1)",
      [resource, resource.replace(/_/g, " ")]
    );
    resourceByCode.set(resource, result.insertId);
  }

  const actionByCode = new Map();
  for (const action of actions) {
    const [result] = await db.query(
      "INSERT INTO actions (code, name, is_active) VALUES (?, ?, 1)",
      [action.code, action.name]
    );
    actionByCode.set(action.code, result.insertId);
  }

  const permissions = [];
  for (const resource of resources) {
    for (const action of actions) {
      const code = `${resource}.${action.code}`;
      const [result] = await db.query(
        "INSERT INTO permissions (resource_id, action_id, code, is_active) VALUES (?, ?, ?, 1)",
        [resourceByCode.get(resource), actionByCode.get(action.code), code]
      );
      permissions.push(result.insertId);
    }
  }

  for (const role of roles) {
    const roleId = roleByName.get(role);
    for (const permissionId of permissions) {
      await post("role_permissions", {
        role_id: roleId,
        permission_id: permissionId
      });
    }
  }

  for (const [cargo, role] of cargoToRole.entries()) {
    await post("cargo_role_map", {
      cargo_id: cargoByName.get(cargo),
      role_id: roleByName.get(role)
    });
  }

  const firstNames = [
    "Andrea",
    "Carlos",
    "Daniel",
    "Elena",
    "Fernando",
    "Gabriela",
    "Hector",
    "Isabel",
    "Jorge",
    "Karla",
    "Luis",
    "Maria",
    "Nicolas",
    "Olga",
    "Paula",
    "Ricardo",
    "Sofia",
    "Tomas",
    "Valeria",
    "William"
  ];
  const lastNames = [
    "Gomez",
    "Perez",
    "Rodriguez",
    "Lopez",
    "Garcia",
    "Torres",
    "Martinez",
    "Sanchez",
    "Diaz",
    "Vera",
    "Flores",
    "Castro",
    "Mendoza",
    "Navarro",
    "Vargas",
    "Rojas",
    "Ortega",
    "Santos",
    "Morales",
    "Reyes"
  ];

  const gradeUnits = [
    ...grades,
    ...(unitsByType.get("Tecnologia") || [])
  ];
  const maestriaUnits = unitsByType.get("Maestria") || [];

  let cedulaCounter = 0;
  const personIndexByCargo = new Map();
  const personsByCargo = new Map();
  const personById = new Map();
  const assignedByCargo = new Map();
  const docentsByUnit = new Map();
  const getPersonList = (cargoName) => personsByCargo.get(cargoName) || [];
  const getPersonIds = (cargoName) => getPersonList(cargoName).map((person) => person.id);

  const nextCedula = () => {
    cedulaCounter += 1;
    return `01020304${String(cedulaCounter).padStart(2, "0")}`;
  };

  const nextPersonIndex = (cargoName) => {
    const current = personIndexByCargo.get(cargoName) || 0;
    const next = current + 1;
    personIndexByCargo.set(cargoName, next);
    return next;
  };

  const createPerson = async (cargoName) => {
    const index = nextPersonIndex(cargoName);
    const first = firstNames[(index + cargoName.length) % firstNames.length];
    const last = lastNames[(index * 3 + cargoName.length) % lastNames.length];
    const emailSlug = slugify(cargoName).replace(/-/g, "_");
    const created = await post("persons", {
      cedula: nextCedula(),
      first_name: first,
      last_name: `${last} ${index}`,
      email: `${emailSlug}.${index}@pucese.local`,
      password_hash: passwordHash,
      status: "Activo",
      is_active: 1,
      verify_email: 1,
      verify_whatsapp: 0
    });
    if (!personsByCargo.has(cargoName)) {
      personsByCargo.set(cargoName, []);
    }
    personsByCargo.get(cargoName).push(created);
    personById.set(created.id, created);
    return created;
  };

  const createDocentsForUnit = async (unit, count) => {
    const docents = [];
    for (let i = 0; i < count; i += 1) {
      const created = await createPerson("Docente");
      docents.push(created.id);
    }
    docentsByUnit.set(unit.id, docents);
  };

  for (const unit of gradeUnits) {
    await createDocentsForUnit(unit, 4);
  }
  for (const unit of maestriaUnits) {
    await createDocentsForUnit(unit, 3);
  }

  for (const cargo of cargos) {
    if (cargo === "Docente") {
      continue;
    }
    for (let i = 0; i < 4; i += 1) {
      await createPerson(cargo);
    }
  }

  const adminPersons = [];
  for (let i = 0; i < 2; i += 1) {
    const created = await post("persons", {
      cedula: nextCedula(),
      first_name: "Admin",
      last_name: `Sistema ${i + 1}`,
      email: `admin.${i + 1}@pucese.local`,
      password_hash: passwordHash,
      status: "Activo",
      is_active: 1,
      verify_email: 1,
      verify_whatsapp: 0
    });
    adminPersons.push(created.id);
  }

  const positions = [];
  const positionsByUnit = new Map();
  const slotTracker = new Map();

  const nextSlot = (unitId, cargoId) => {
    const key = `${unitId}:${cargoId}`;
    const current = slotTracker.get(key) || 0;
    const next = current + 1;
    slotTracker.set(key, next);
    return next;
  };

  const createPosition = async ({ unitId, cargoName, positionType, title }) => {
    const cargoId = cargoByName.get(cargoName);
    const slotNo = nextSlot(unitId, cargoId);
    const created = await post("unit_positions", {
      unit_id: unitId,
      cargo_id: cargoId,
      slot_no: slotNo,
      title,
      position_type: positionType,
      is_active: 1
    });
    const record = {
      id: created.id,
      unitId,
      cargoName,
      positionType,
      title,
      cargoId
    };
    positions.push(record);
    if (!positionsByUnit.has(unitId)) {
      positionsByUnit.set(unitId, []);
    }
    positionsByUnit.get(unitId).push(record);
    return record;
  };

  const allUnits = Array.from(unitsByName.values());

  for (const unit of allUnits) {
    if (unit.type === "Sede" || unit.type === "Sistema") {
      continue;
    }
    if (unit.type === "Prorrectorado") {
      await createPosition({
        unitId: unit.id,
        cargoName: "Prorrector",
        positionType: "promocion",
        title: "Prorrector"
      });
      continue;
    }
    if (unit.type === "Direccion") {
      await createPosition({
        unitId: unit.id,
        cargoName: "Director",
        positionType: "promocion",
        title: `Director de ${unit.name}`
      });
      continue;
    }
    if (unit.type === "Coordinacion") {
      await createPosition({
        unitId: unit.id,
        cargoName: "Coordinador",
        positionType: "promocion",
        title: `Coordinador de ${unit.name}`
      });
      continue;
    }
    if (unit.type === "Jefatura") {
      await createPosition({
        unitId: unit.id,
        cargoName: "Jefe",
        positionType: "real",
        title: `Jefe de ${unit.name}`
      });
      continue;
    }
    if (unit.type === "Escuela") {
      await createPosition({
        unitId: unit.id,
        cargoName: "Director",
        positionType: "promocion",
        title: `Director de ${unit.name}`
      });
      await createPosition({
        unitId: unit.id,
        cargoName: "Responsable de Alumni",
        positionType: "simbolico",
        title: "Responsable de Alumni"
      });
      await createPosition({
        unitId: unit.id,
        cargoName: "Asistente Academica",
        positionType: "real",
        title: "Asistente Academica"
      });
      continue;
    }
    if (unit.type === "Grado" || unit.type === "Tecnologia") {
      await createPosition({
        unitId: unit.id,
        cargoName: "Coordinador",
        positionType: "promocion",
        title: `Coordinador de ${unit.name}`
      });
      for (let i = 0; i < 4; i += 1) {
        await createPosition({
          unitId: unit.id,
          cargoName: "Docente",
          positionType: "real",
          title: "Docente"
        });
      }
      for (let i = 0; i < 2; i += 1) {
        await createPosition({
          unitId: unit.id,
          cargoName: "Mentor",
          positionType: "real",
          title: "Mentor"
        });
      }
      await createPosition({
        unitId: unit.id,
        cargoName: "Mentor",
        positionType: "simbolico",
        title: "Mentor"
      });
      for (let i = 0; i < 2; i += 1) {
        await createPosition({
          unitId: unit.id,
          cargoName: "Investigador",
          positionType: "simbolico",
          title: "Investigador"
        });
      }
      await createPosition({
        unitId: unit.id,
        cargoName: "Responsable de Calidad",
        positionType: "simbolico",
        title: "Responsable de Calidad"
      });
      for (let i = 0; i < 2; i += 1) {
        await createPosition({
          unitId: unit.id,
          cargoName: "Responsable de COIL",
          positionType: "simbolico",
          title: "Responsable de COIL"
        });
      }
      await createPosition({
        unitId: unit.id,
        cargoName: "Asistente Academica",
        positionType: "real",
        title: "Asistente Academica"
      });
      for (let i = 0; i < 3; i += 1) {
        await createPosition({
          unitId: unit.id,
          cargoName: "Asistente Academica",
          positionType: "simbolico",
          title: "Asistente Academica"
        });
      }
      const respTitCount = rng() < 0.5 ? 1 : 2;
      for (let i = 0; i < respTitCount; i += 1) {
        await createPosition({
          unitId: unit.id,
          cargoName: "Responsable de Titulacion",
          positionType: "simbolico",
          title: "Responsable de Titulacion"
        });
      }
      const respInvCount = rng() < 0.5 ? 1 : 2;
      for (let i = 0; i < respInvCount; i += 1) {
        await createPosition({
          unitId: unit.id,
          cargoName: "Responsable de Investigacion",
          positionType: "simbolico",
          title: "Responsable de Investigacion"
        });
      }
    }
    if (unit.type === "Maestria") {
      for (let i = 0; i < 3; i += 1) {
        await createPosition({
          unitId: unit.id,
          cargoName: "Docente",
          positionType: "simbolico",
          title: "Docente"
        });
      }
    }
  }

  const cargoRoundRobin = new Map();

  const pickPerson = (cargoName) => {
    const list = getPersonList(cargoName);
    if (!list.length) {
      return null;
    }
    if (!cargoRoundRobin.has(cargoName)) {
      cargoRoundRobin.set(cargoName, { index: 0 });
    }
    const state = cargoRoundRobin.get(cargoName);
    const idx = state.index % list.length;
    state.index += 1;
    return list[idx].id;
  };

  const assignPosition = async (position, personId) => {
    if (!personId) {
      return;
    }
    await post("position_assignments", {
      position_id: position.id,
      person_id: personId,
      start_date: isoDate(today),
      is_current: 1
    });
    if (!assignedByCargo.has(position.cargoName)) {
      assignedByCargo.set(position.cargoName, new Set());
    }
    assignedByCargo.get(position.cargoName).add(personId);
  };

  for (const unit of allUnits) {
    const unitPositions = positionsByUnit.get(unit.id) || [];
    if (!unitPositions.length) {
      continue;
    }

    if (unit.type === "Grado" || unit.type === "Tecnologia") {
      const docents = docentsByUnit.get(unit.id) || [];
      const fallbackDocents = getPersonIds("Docente");
      const docentPool = docents.length ? docents : fallbackDocents;

      let docentIdx = 0;
      for (const pos of unitPositions.filter(
        (p) => p.cargoName === "Docente" && p.positionType === "real"
      )) {
        const personId = docentPool.length ? docentPool[docentIdx % docentPool.length] : null;
        docentIdx += 1;
        await assignPosition(pos, personId);
      }

      const coordPositions = unitPositions.filter((p) => p.cargoName === "Coordinador");
      let coordIdx = 0;
      for (const pos of coordPositions) {
        const personId = docentPool.length ? docentPool[coordIdx % docentPool.length] : null;
        coordIdx += 1;
        await assignPosition(pos, personId);
      }

      const mentorPositions = unitPositions.filter((p) => p.cargoName === "Mentor");
      for (const pos of mentorPositions) {
        await assignPosition(pos, pickPerson("Mentor"));
      }

      const asistentePositions = unitPositions.filter((p) => p.cargoName === "Asistente Academica");
      for (const pos of asistentePositions) {
        await assignPosition(pos, pickPerson("Asistente Academica"));
      }

      const remainingPositions = unitPositions.filter(
        (p) =>
          !["Docente", "Coordinador", "Mentor", "Asistente Academica"].includes(p.cargoName)
      );
      let respIdx = 0;
      for (const pos of remainingPositions) {
        if (pos.positionType === "simbolico") {
          const personId = docentPool.length ? docentPool[respIdx % docentPool.length] : null;
          respIdx += 1;
          await assignPosition(pos, personId);
        } else {
          await assignPosition(pos, pickPerson(pos.cargoName));
        }
      }
      continue;
    }

    if (unit.type === "Maestria") {
      const docents = docentsByUnit.get(unit.id) || [];
      const fallbackDocents = getPersonIds("Docente");
      const docentPool = docents.length ? docents : fallbackDocents;
      let docentIdx = 0;
      for (const pos of unitPositions) {
        const personId = docentPool.length ? docentPool[docentIdx % docentPool.length] : null;
        docentIdx += 1;
        await assignPosition(pos, personId);
      }
      continue;
    }

    for (const pos of unitPositions) {
      await assignPosition(pos, pickPerson(pos.cargoName));
    }
  }

  const roleAdminId = roleByName.get("role_admin");
  const roleAssignmentId = await post("role_assignments", {
    person_id: adminPersons[0],
    role_id: roleAdminId,
    unit_id: unitSystem.id,
    source: "manual",
    max_depth: 2,
    start_date: isoDate(today),
    is_current: 1
  });
  await post("role_assignments", {
    person_id: adminPersons[1],
    role_id: roleAdminId,
    unit_id: unitSystem.id,
    source: "manual",
    max_depth: 2,
    start_date: isoDate(today),
    is_current: 1
  });
  await db.query(
    "INSERT INTO role_assignment_relation_types (relation_type_id, role_assignment_id) VALUES (?, ?)",
    [orgRelationId, roleAssignmentId.id]
  );

  const processRecords = [];

  const createProcess = async ({ name, unit, parentId = null, cargoName }) => {
    const slug = uniqueSlug(slugify(`${name}-${unit.slug}`), usedSlugs);
    const hasDocument = rng() < 0.9 ? 1 : 0;
    const created = await post("processes", {
      name,
      slug,
      unit_ids: [unit.id],
      parent_id: parentId,
      has_document: hasDocument,
      is_active: 1,
      cargo_id: cargoByName.get(cargoName),
      version: "0.1",
      version_name: "Inicial",
      version_slug: `${slug}-v0-1`,
      version_effective_from: "2026-01-21"
    });
    const record = {
      id: created.id,
      name,
      slug,
      unit,
      parentId,
      cargoName,
      hasDocument
    };
    processRecords.push(record);
    return record;
  };

  const createChainRoot = async (name, unit, cargoName) => createProcess({ name, unit, cargoName });

  const createChainSchoolGrade = async ({ name, root, cargoSchool, cargoGrade }) => {
    for (const school of schools) {
      const schoolProc = await createProcess({
        name,
        unit: school,
        parentId: root.id,
        cargoName: cargoSchool
      });
      const schoolGrades = gradesBySchool.get(school.id) || [];
      for (const grade of schoolGrades) {
        await createProcess({
          name,
          unit: grade,
          parentId: schoolProc.id,
          cargoName: cargoGrade
        });
      }
    }
  };

  const rootHorarios = await createChainRoot("Horarios", unitCAE, "Coordinador");
  await createChainSchoolGrade({
    name: "Horarios",
    root: rootHorarios,
    cargoSchool: "Director",
    cargoGrade: "Coordinador"
  });

  const rootDistributivos = await createChainRoot("Distributivos", unitCAE, "Coordinador");
  await createChainSchoolGrade({
    name: "Distributivos",
    root: rootDistributivos,
    cargoSchool: "Director",
    cargoGrade: "Coordinador"
  });

  const rootContratacion = await createChainRoot("Contratacion Docente", unitProrrectorado, "Prorrector");
  const thProc = await createProcess({
    name: "Contratacion Docente",
    unit: unitTalentoHumano,
    parentId: rootContratacion.id,
    cargoName: "Jefe"
  });
  const finProc = await createProcess({
    name: "Contratacion Docente",
    unit: unitFinanciera,
    parentId: thProc.id,
    cargoName: "Director"
  });
  const docProc = await createProcess({
    name: "Contratacion Docente",
    unit: unitDocencia,
    parentId: finProc.id,
    cargoName: "Director"
  });
  for (const school of schools) {
    const schoolProc = await createProcess({
      name: "Contratacion Docente",
      unit: school,
      parentId: docProc.id,
      cargoName: "Director"
    });
    const schoolGrades = gradesBySchool.get(school.id) || [];
    for (const grade of schoolGrades) {
      await createProcess({
        name: "Contratacion Docente",
        unit: grade,
        parentId: schoolProc.id,
        cargoName: "Coordinador"
      });
    }
  }

  const rootInformesCAE = await createChainRoot("Informes Semestrales", unitCAE, "Coordinador");
  for (const school of schools) {
    const schoolProc = await createProcess({
      name: "Informes Semestrales",
      unit: school,
      parentId: rootInformesCAE.id,
      cargoName: "Director"
    });
    const schoolGrades = gradesBySchool.get(school.id) || [];
    for (const grade of schoolGrades) {
      const gradeProc = await createProcess({
        name: "Informes Semestrales",
        unit: grade,
        parentId: schoolProc.id,
        cargoName: "Coordinador"
      });
      await createProcess({
        name: "Informes Semestrales - Responsable de Calidad",
        unit: grade,
        parentId: gradeProc.id,
        cargoName: "Responsable de Calidad"
      });
      await createProcess({
        name: "Informes Semestrales - Responsable de COIL",
        unit: grade,
        parentId: gradeProc.id,
        cargoName: "Responsable de COIL"
      });
      await createProcess({
        name: "Informes Semestrales - Docentes",
        unit: grade,
        parentId: gradeProc.id,
        cargoName: "Docente"
      });
    }
  }

  const rootInformesInv = await createChainRoot(
    "Informes Semestrales (Investigacion)",
    unitInvestigacion,
    "Director"
  );
  for (const school of schools) {
    const schoolProc = await createProcess({
      name: "Informes Semestrales (Investigacion)",
      unit: school,
      parentId: rootInformesInv.id,
      cargoName: "Director"
    });
    const schoolGrades = gradesBySchool.get(school.id) || [];
    for (const grade of schoolGrades) {
      const gradeProc = await createProcess({
        name: "Informes Semestrales (Investigacion)",
        unit: grade,
        parentId: schoolProc.id,
        cargoName: "Coordinador"
      });
      await createProcess({
        name: "Informes Semestrales - Investigadores",
        unit: grade,
        parentId: gradeProc.id,
        cargoName: "Investigador"
      });
      await createProcess({
        name: "Informes Semestrales - Responsable de Investigacion",
        unit: grade,
        parentId: gradeProc.id,
        cargoName: "Responsable de Investigacion"
      });
    }
  }

  const rootInformesBienestar = await createChainRoot(
    "Informes Semestrales (Bienestar)",
    unitBienestar,
    "Coordinador"
  );
  for (const grade of grades) {
    const gradeProc = await createProcess({
      name: "Informes Semestrales (Bienestar)",
      unit: grade,
      parentId: rootInformesBienestar.id,
      cargoName: "Coordinador"
    });
    await createProcess({
      name: "Informes Semestrales (Bienestar) - Mentores",
      unit: grade,
      parentId: gradeProc.id,
      cargoName: "Mentor"
    });
  }

  for (const school of schools) {
    const schoolProc = await createProcess({
      name: "Silabos",
      unit: school,
      cargoName: "Director"
    });
    const schoolGrades = gradesBySchool.get(school.id) || [];
    for (const grade of schoolGrades) {
      const gradeProc = await createProcess({
        name: "Silabos",
        unit: grade,
        parentId: schoolProc.id,
        cargoName: "Coordinador"
      });
      await createProcess({
        name: "Silabos - Docentes",
        unit: grade,
        parentId: gradeProc.id,
        cargoName: "Docente"
      });
    }
  }

  for (const grade of grades) {
    const gradeProc = await createProcess({
      name: "Titulacion",
      unit: grade,
      cargoName: "Coordinador"
    });
    await createProcess({
      name: "Titulacion - Responsable",
      unit: grade,
      parentId: gradeProc.id,
      cargoName: "Responsable de Titulacion"
    });
  }

  const rootInternacionalizacion = await createChainRoot(
    "Internacionalizacion",
    unitCAE,
    "Coordinador"
  );
  for (const school of schools) {
    const schoolProc = await createProcess({
      name: "Internacionalizacion",
      unit: school,
      parentId: rootInternacionalizacion.id,
      cargoName: "Director"
    });
    const schoolGrades = gradesBySchool.get(school.id) || [];
    for (const grade of schoolGrades) {
      const gradeProc = await createProcess({
        name: "Internacionalizacion",
        unit: grade,
        parentId: schoolProc.id,
        cargoName: "Coordinador"
      });
      await createProcess({
        name: "Internacionalizacion - Responsable COIL",
        unit: grade,
        parentId: gradeProc.id,
        cargoName: "Responsable de COIL"
      });
    }
  }

  const rootAutoevaluacion = await createChainRoot("Autoevaluacion", unitAsegCalidad, "Jefe");
  for (const grade of grades) {
    const gradeProc = await createProcess({
      name: "Autoevaluacion",
      unit: grade,
      parentId: rootAutoevaluacion.id,
      cargoName: "Coordinador"
    });
    await createProcess({
      name: "Autoevaluacion - Responsable de Calidad",
      unit: grade,
      parentId: gradeProc.id,
      cargoName: "Responsable de Calidad"
    });
  }

  const rootMemo = await createChainRoot("Memorandums", unitSede, "Prorrector");
  for (const unit of allUnits) {
    if (unit.id === unitSede.id || unit.id === unitSystem.id) {
      continue;
    }
    let cargoName = "Coordinador";
    if (unit.type === "Prorrectorado") {
      cargoName = "Prorrector";
    } else if (unit.type === "Direccion" || unit.type === "Escuela") {
      cargoName = "Director";
    } else if (unit.type === "Jefatura") {
      cargoName = "Jefe";
    } else if (unit.type === "Coordinacion" || unit.type === "Grado" || unit.type === "Tecnologia") {
      cargoName = "Coordinador";
    } else if (unit.type === "Maestria") {
      cargoName = "Coordinador";
    }
    await createProcess({
      name: "Memorandums",
      unit,
      parentId: rootMemo.id,
      cargoName
    });
  }

  const templates = [];
  for (const process of processRecords.filter((p) => p.hasDocument === 1)) {
    const tplSlug = uniqueSlug(slugify(`tpl-${process.slug}`), usedSlugs);
    const template = await post("templates", {
      process_id: process.id,
      name: `Plantilla ${process.name}`,
      slug: tplSlug,
      description: "Plantilla inicial"
    });
    templates.push(template);
  }

  for (const template of templates) {
    await post("template_versions", {
      template_id: template.id,
      version: "1.0",
      mongo_ref: nextSeedUuid("template_version"),
      mongo_version: "1.0",
      is_active: 1
    });
  }

  const term = await post("terms", {
    name: "2026-S1",
    term_type_id: semesterType.id,
    start_date: "2026-04-01",
    end_date: "2026-09-15",
    is_active: 1
  });

  const taskList = await getList("tasks", {
    limit: 1,
    orderBy: "id",
    order: "asc"
  });

  let taskId = taskList?.[0]?.id ?? null;
  if (!taskId) {
    const versions = await getList("process_versions", { limit: 1, orderBy: "id", order: "asc" });
    const versionId = versions?.[0]?.id;
    if (versionId) {
      const createdTask = await post("tasks", {
        process_version_id: versionId,
        term_id: term.id,
        start_date: "2026-04-01",
        end_date: "2026-09-15",
        status: "pendiente"
      });
      taskId = createdTask.id;
    }
  }

  let documentVersionId = null;
  if (taskId) {
    const document = await post("documents", {
      task_id: taskId,
      status: "Inicial",
      comments_thread_ref: nextSeedUuid("document_thread")
    });
    const documentVersion = await post("document_versions", {
      document_id: document.id,
      version: 0.1,
      payload_mongo_id: nextSeedUuid("document_payload"),
      payload_hash: createHash("sha256")
        .update(nextSeedUuid("payload_hash"))
        .digest("hex"),
      status: "Borrador"
    });
    documentVersionId = documentVersion.id;
  }

  const signatureType = await post("signature_types", {
    code: "firma",
    name: "Firma",
    is_active: 1
  });
  const signatureStatus = await post("signature_statuses", {
    code: "pendiente",
    name: "Pendiente",
    is_active: 1
  });
  const signatureRequestStatus = await post("signature_request_statuses", {
    code: "pendiente",
    name: "Pendiente",
    is_active: 1
  });

  const [contratacionRoot] = processRecords.filter(
    (p) => p.name === "Contratacion Docente" && p.unit.id === unitProrrectorado.id
  );

  if (contratacionRoot && documentVersionId) {
    const versionRows = await getList("process_versions", {
      filter_process_id: contratacionRoot.id,
      orderBy: "id",
      order: "desc",
      limit: 1
    });
    const processVersionId = versionRows?.[0]?.id;

    if (processVersionId) {
      const template = await post("signature_flow_templates", {
        process_version_id: processVersionId,
        name: "Flujo Contratacion Docente",
        description: "Flujo base",
        is_active: 1
      });

      const stepCargos = [
        "Coordinador",
        "Director",
        "Director",
        "Director",
        "Jefe",
        "Prorrector"
      ];

      const steps = [];
      for (let i = 0; i < stepCargos.length; i += 1) {
        const step = await post("signature_flow_steps", {
          template_id: template.id,
          step_order: i + 1,
          step_type_id: signatureType.id,
          required_cargo_id: cargoByName.get(stepCargos[i]),
          selection_mode: "auto_all",
          is_required: 1
        });
        steps.push(step);
      }

      const instance = await post("signature_flow_instances", {
        template_id: template.id,
        document_version_id: documentVersionId,
        status_id: signatureRequestStatus.id
      });

      for (let i = 0; i < steps.length; i += 1) {
        const cargoName = stepCargos[i];
        const personPool = getPersonList(cargoName);
        const assignedPerson = personPool.length ? personPool[i % personPool.length].id : null;
        const requestRow = await post("signature_requests", {
          instance_id: instance.id,
          step_id: steps[i].id,
          assigned_person_id: assignedPerson,
          status_id: signatureRequestStatus.id,
          is_manual: 0
        });
        if (assignedPerson) {
          await post("document_signatures", {
            signature_request_id: requestRow.id,
            document_version_id: documentVersionId,
            signer_user_id: assignedPerson,
            signature_type_id: signatureType.id,
            signature_status_id: signatureStatus.id,
            note_short: "Pendiente"
          });
        }
      }
    }
  }

  const eligiblePositions = positions.filter((p) => p.positionType !== "simbolico");
  const shuffled = [...eligiblePositions].sort(() => rng() - 0.5);
  const vacancyCount = Math.floor(shuffled.length * 0.5);
  const openCount = Math.floor(vacancyCount * 0.5);

  const vacancies = [];
  for (let i = 0; i < vacancyCount; i += 1) {
    const position = shuffled[i];
    const status = i < openCount ? "abierta" : "cerrada";
    const relationType = position.positionType === "promocion" ? "promocion" : "dependencia";
    const vacancy = await post("vacancies", {
      position_id: position.id,
      title: `Vacante ${position.title}`,
      dedication: "TC",
      relation_type: relationType,
      status,
      opened_at: new Date().toISOString(),
      closed_at: status === "cerrada" ? new Date().toISOString() : null
    });
    vacancies.push({ ...vacancy, position });
    await post("vacancy_visibility", {
      vacancy_id: vacancy.id,
      unit_id: position.unitId
    });
  }

  if (vacancies.length) {
    const vacancy = vacancies[0];
    const applicantId = getPersonIds("Docente")[0] || adminPersons[0];
    const [applicationRes] = await db.query(
      "INSERT INTO aplications (vacancy_id, person_id, status, note) VALUES (?, ?, ?, ?)",
      [vacancy.id, applicantId, "aplicado", "Aplicacion demo"]
    );
    const applicationId = applicationRes.insertId;
    const [offerRes] = await db.query(
      "INSERT INTO offers (application_id, status) VALUES (?, ?)",
      [applicationId, "enviada"]
    );
    const offerId = offerRes.insertId;
    const contract = await post("contracts", {
      person_id: applicantId,
      position_id: vacancy.position.id,
      relation_type: "dependencia",
      dedication: "TC",
      start_date: isoDate(today),
      status: "activo"
    });
    await db.query(
      "INSERT INTO contract_origins (contract_id, origin_type) VALUES (?, ?)",
      [contract.id, "recruitment"]
    );
    await db.query(
      "INSERT INTO contract_origin_recruitment (contract_id, offer_id, vacancy_id) VALUES (?, ?, ?)",
      [contract.id, offerId, vacancy.id]
    );

    const renewalContract = await post("contracts", {
      person_id: applicantId,
      position_id: vacancy.position.id,
      relation_type: "dependencia",
      dedication: "TC",
      start_date: isoDate(today),
      end_date: isoDate(new Date(today.getTime() + 1000 * 60 * 60 * 24 * 180)),
      status: "finalizado"
    });
    await db.query(
      "INSERT INTO contract_origins (contract_id, origin_type) VALUES (?, ?)",
      [renewalContract.id, "renewal"]
    );
    await db.query(
      "INSERT INTO contract_origin_renewal (contract_id, renewed_from_contract_id) VALUES (?, ?)",
      [renewalContract.id, contract.id]
    );
  }

  console.log("✅ Semilla institucional creada.");
  console.log(`Usuarios generados por cargo: ${cargos.length} cargos x 4 personas.`);
  console.log(`Admins: ${adminPersons.length}`);
  console.log(`Password base: ${plainPassword}`);
  console.log(`Total puestos creados: ${positions.length}`);
  console.log("Asignaciones por cargo (muestra 2):");
  const rows = cargos.map((cargo) => {
    const assigned = Array.from(assignedByCargo.get(cargo) || []);
    const samples = assigned
      .map((id) => personById.get(id))
      .filter(Boolean)
      .slice(0, 2)
      .map((person) => `${person.cedula} - ${person.first_name} ${person.last_name}`);
    return {
      cargo,
      count: String(assigned.length),
      sample1: samples[0] || "-",
      sample2: samples[1] || "-"
    };
  });

  const headers = {
    cargo: "Cargo",
    count: "Asignados",
    sample1: "Ejemplo 1 (Cedula - Nombre)",
    sample2: "Ejemplo 2 (Cedula - Nombre)"
  };

  const widths = {
    cargo: Math.max(headers.cargo.length, ...rows.map((r) => r.cargo.length)),
    count: Math.max(headers.count.length, ...rows.map((r) => r.count.length)),
    sample1: Math.max(headers.sample1.length, ...rows.map((r) => r.sample1.length)),
    sample2: Math.max(headers.sample2.length, ...rows.map((r) => r.sample2.length))
  };

  const headerLine = [
    headers.cargo.padEnd(widths.cargo),
    headers.count.padEnd(widths.count),
    headers.sample1.padEnd(widths.sample1),
    headers.sample2.padEnd(widths.sample2)
  ].join(" | ");
  const sepLine = [
    "-".repeat(widths.cargo),
    "-".repeat(widths.count),
    "-".repeat(widths.sample1),
    "-".repeat(widths.sample2)
  ].join("-|-");

  console.log(headerLine);
  console.log(sepLine);
  for (const row of rows) {
    console.log(
      [
        row.cargo.padEnd(widths.cargo),
        row.count.padEnd(widths.count),
        row.sample1.padEnd(widths.sample1),
        row.sample2.padEnd(widths.sample2)
      ].join(" | ")
    );
  }
  } finally {
    await db.end();
  }
};

run().catch((error) => {
  console.error("❌ Error al sembrar datos:", error.message);
  process.exit(1);
});
