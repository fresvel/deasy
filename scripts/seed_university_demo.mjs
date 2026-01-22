import { randomUUID } from "node:crypto";
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const waitForApi = async (url, { retries = 10, delayMs = 1000 } = {}) => {
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

const run = async () => {
  const suffix = process.env.SEED_SUFFIX || randomUUID().slice(0, 8);
  const plainPassword = process.env.SEED_PASSWORD || "Demo1234!";
  const passwordHash = await bcrypt.hash(plainPassword, 10);
  const start = new Date(today.getFullYear(), 0, 1);
  const end = new Date(today.getFullYear(), 5, 30);

  console.log(`🚀 Semilla demo (${suffix}) en ${API_BASE}`);
  await waitForApi(`${SQL_BASE}/meta`);

  const unitTypeSystem = await post("unit_types", { name: `Sistema-${suffix}` });
  const unitTypeUniversity = await post("unit_types", { name: `Universidad-${suffix}` });
  const unitTypeFaculty = await post("unit_types", { name: `Facultad-${suffix}` });
  const unitTypeCareer = await post("unit_types", { name: `Carrera-${suffix}` });
  const unitTypeDept = await post("unit_types", { name: `Departamento-${suffix}` });

  const unitSystem = await post("units", {
    name: `SYSTEM-${suffix}`,
    label: makeUnitLabel(`SYSTEM-${suffix}`),
    slug: `system-${suffix}`,
    unit_type_id: unitTypeSystem.id
  });
  const unitUniversity = await post("units", {
    name: `PUCESE-${suffix}`,
    label: makeUnitLabel(`PUCESE-${suffix}`),
    slug: `pucese-${suffix}`,
    unit_type_id: unitTypeUniversity.id
  });
  const unitFaculty = await post("units", {
    name: `Facultad Ciencias-${suffix}`,
    label: makeUnitLabel(`Facultad Ciencias-${suffix}`),
    slug: `fac-ciencias-${suffix}`,
    unit_type_id: unitTypeFaculty.id
  });
  const unitCareerSis = await post("units", {
    name: `Ing Sistemas-${suffix}`,
    label: makeUnitLabel(`Ing Sistemas-${suffix}`),
    slug: `sis-${suffix}`,
    unit_type_id: unitTypeCareer.id
  });
  const unitCareerEnf = await post("units", {
    name: `Enfermeria-${suffix}`,
    label: makeUnitLabel(`Enfermeria-${suffix}`),
    slug: `enf-${suffix}`,
    unit_type_id: unitTypeCareer.id
  });
  const unitDeptCalidad = await post("units", {
    name: `Depto Calidad-${suffix}`,
    label: makeUnitLabel(`Depto Calidad-${suffix}`),
    slug: `calidad-${suffix}`,
    unit_type_id: unitTypeDept.id
  });

  const relationParent = await post("relation_unit_types", {
    code: `parent-${suffix}`,
    name: `Padre-${suffix}`,
    is_inheritance_allowed: 1
  });

  await post("unit_relations", {
    relation_type_id: relationParent.id,
    parent_unit_id: unitUniversity.id,
    child_unit_id: unitFaculty.id
  });
  await post("unit_relations", {
    relation_type_id: relationParent.id,
    parent_unit_id: unitFaculty.id,
    child_unit_id: unitCareerSis.id
  });
  await post("unit_relations", {
    relation_type_id: relationParent.id,
    parent_unit_id: unitFaculty.id,
    child_unit_id: unitCareerEnf.id
  });
  await post("unit_relations", {
    relation_type_id: relationParent.id,
    parent_unit_id: unitFaculty.id,
    child_unit_id: unitDeptCalidad.id
  });

  const cargoRector = await post("cargos", { name: `Rector-${suffix}` });
  const cargoDecano = await post("cargos", { name: `Decano-${suffix}` });
  const cargoCoord = await post("cargos", { name: `Coordinador-${suffix}` });
  const cargoDocente = await post("cargos", { name: `Docente-${suffix}` });
  const cargoAnalista = await post("cargos", { name: `Analista-${suffix}` });
  const cargoRespCalidad = await post("cargos", { name: `Resp Calidad-${suffix}` });
  const cargoRespEventos = await post("cargos", { name: `Resp Eventos-${suffix}` });
  const cargoRespCoil = await post("cargos", { name: `Resp COIL-${suffix}` });
  const cargoDirEscuela = await post("cargos", { name: `Director Escuela-${suffix}` });
  const cargoDirAcademico = await post("cargos", { name: `Director Academico-${suffix}` });

  const roleAdmin = await post("roles", { name: `Admin-${suffix}` });
  const roleDecano = await post("roles", { name: `RolDecano-${suffix}` });
  const roleCoord = await post("roles", { name: `RolCoord-${suffix}` });
  const roleDocente = await post("roles", { name: `RolDocente-${suffix}` });

  await post("cargo_role_map", { cargo_id: cargoDecano.id, role_id: roleDecano.id });
  await post("cargo_role_map", { cargo_id: cargoCoord.id, role_id: roleCoord.id });
  await post("cargo_role_map", { cargo_id: cargoDocente.id, role_id: roleDocente.id });

  const admin = await post("persons", {
    cedula: `010${suffix}`,
    first_name: "Admin",
    last_name: `Sistema-${suffix}`,
    email: `admin.${suffix}@demo.local`,
    password_hash: passwordHash,
    status: "Activo",
    is_active: 1
  });
  const rector = await post("persons", {
    cedula: `020${suffix}`,
    first_name: "Rector",
    last_name: `Demo-${suffix}`,
    email: `rector.${suffix}@demo.local`,
    password_hash: passwordHash,
    status: "Activo",
    is_active: 1
  });
  const decano = await post("persons", {
    cedula: `030${suffix}`,
    first_name: "Decano",
    last_name: `Ciencias-${suffix}`,
    email: `decano.${suffix}@demo.local`,
    password_hash: passwordHash,
    status: "Activo",
    is_active: 1
  });
  const coordSis = await post("persons", {
    cedula: `040${suffix}`,
    first_name: "Coord",
    last_name: `Sistemas-${suffix}`,
    email: `coord.sis.${suffix}@demo.local`,
    password_hash: passwordHash,
    status: "Activo",
    is_active: 1
  });
  const docenteA = await post("persons", {
    cedula: `050${suffix}`,
    first_name: "Docente",
    last_name: `Alpha-${suffix}`,
    email: `docente.a.${suffix}@demo.local`,
    password_hash: passwordHash,
    status: "Activo",
    is_active: 1
  });
  const docenteB = await post("persons", {
    cedula: `051${suffix}`,
    first_name: "Docente",
    last_name: `Beta-${suffix}`,
    email: `docente.b.${suffix}@demo.local`,
    password_hash: passwordHash,
    status: "Activo",
    is_active: 1
  });
  const coordEnf = await post("persons", {
    cedula: `060${suffix}`,
    first_name: "Coord",
    last_name: `Enfermeria-${suffix}`,
    email: `coord.enf.${suffix}@demo.local`,
    password_hash: passwordHash,
    status: "Activo",
    is_active: 1
  });
  const analista = await post("persons", {
    cedula: `070${suffix}`,
    first_name: "Analista",
    last_name: `Calidad-${suffix}`,
    email: `analista.${suffix}@demo.local`,
    password_hash: passwordHash,
    status: "Activo",
    is_active: 1
  });
  const docenteEnf = await post("persons", {
    cedula: `071${suffix}`,
    first_name: "Docente",
    last_name: `Enf-${suffix}`,
    email: `docente.enf.${suffix}@demo.local`,
    password_hash: passwordHash,
    status: "Activo",
    is_active: 1
  });

  await post("role_assignments", {
    person_id: admin.id,
    role_id: roleAdmin.id,
    unit_id: unitSystem.id,
    max_depth: 0,
    start_date: isoDate(today),
    is_current: 1
  });

  const assignRole = (personId, roleId, unitId) =>
    post("role_assignments", {
      person_id: personId,
      role_id: roleId,
      unit_id: unitId,
      max_depth: 0,
      start_date: isoDate(today),
      is_current: 1,
      source: "derived"
    });

  const posRector = await post("unit_positions", {
    unit_id: unitUniversity.id,
    cargo_id: cargoRector.id,
    slot_no: 1,
    title: "Rector",
    position_type: "promocion"
  });
  const posDecano = await post("unit_positions", {
    unit_id: unitFaculty.id,
    cargo_id: cargoDecano.id,
    slot_no: 1,
    title: "Decano",
    position_type: "promocion"
  });
  const posCoordSis = await post("unit_positions", {
    unit_id: unitCareerSis.id,
    cargo_id: cargoCoord.id,
    slot_no: 1,
    title: "Coordinador de Carrera",
    position_type: "promocion"
  });
  const posCoordSisVac = await post("unit_positions", {
    unit_id: unitCareerSis.id,
    cargo_id: cargoCoord.id,
    slot_no: 2,
    title: "Coordinador de Carrera (Vacante)",
    position_type: "promocion"
  });
  const posDocenteSisA = await post("unit_positions", {
    unit_id: unitCareerSis.id,
    cargo_id: cargoDocente.id,
    slot_no: 1,
    title: "Docente 1",
    position_type: "real"
  });
  const posDocenteSisB = await post("unit_positions", {
    unit_id: unitCareerSis.id,
    cargo_id: cargoDocente.id,
    slot_no: 2,
    title: "Docente 2",
    position_type: "real"
  });
  const posDocenteSisC = await post("unit_positions", {
    unit_id: unitCareerSis.id,
    cargo_id: cargoDocente.id,
    slot_no: 3,
    title: "Docente 3",
    position_type: "real"
  });
  const posDocenteSisD = await post("unit_positions", {
    unit_id: unitCareerSis.id,
    cargo_id: cargoDocente.id,
    slot_no: 4,
    title: "Docente 4",
    position_type: "real"
  });
  const posCoordEnf = await post("unit_positions", {
    unit_id: unitCareerEnf.id,
    cargo_id: cargoCoord.id,
    slot_no: 1,
    title: "Coordinador de Enfermeria",
    position_type: "promocion"
  });
  const posCoordEnfVac = await post("unit_positions", {
    unit_id: unitCareerEnf.id,
    cargo_id: cargoCoord.id,
    slot_no: 2,
    title: "Coordinador de Enfermeria (Vacante)",
    position_type: "promocion"
  });
  const posDocenteEnf = await post("unit_positions", {
    unit_id: unitCareerEnf.id,
    cargo_id: cargoDocente.id,
    slot_no: 1,
    title: "Docente Enf",
    position_type: "real"
  });
  const posDocenteEnfB = await post("unit_positions", {
    unit_id: unitCareerEnf.id,
    cargo_id: cargoDocente.id,
    slot_no: 2,
    title: "Docente Enf 2",
    position_type: "real"
  });
  const posDocenteEnfC = await post("unit_positions", {
    unit_id: unitCareerEnf.id,
    cargo_id: cargoDocente.id,
    slot_no: 3,
    title: "Docente Enf 3",
    position_type: "real"
  });
  const posAnalista = await post("unit_positions", {
    unit_id: unitDeptCalidad.id,
    cargo_id: cargoAnalista.id,
    slot_no: 1,
    title: "Analista Calidad",
    position_type: "real"
  });
  const posCoordFaculty = await post("unit_positions", {
    unit_id: unitFaculty.id,
    cargo_id: cargoCoord.id,
    slot_no: 1,
    title: "Coordinador Academico",
    position_type: "promocion"
  });
  const posAnalistaUniversity = await post("unit_positions", {
    unit_id: unitUniversity.id,
    cargo_id: cargoAnalista.id,
    slot_no: 1,
    title: "Analista Institucional",
    position_type: "real"
  });
  const posDirectorEscuela = await post("unit_positions", {
    unit_id: unitFaculty.id,
    cargo_id: cargoDirEscuela.id,
    slot_no: 1,
    title: "Director de Escuela",
    position_type: "promocion"
  });
  const posDirectorAcademico = await post("unit_positions", {
    unit_id: unitUniversity.id,
    cargo_id: cargoDirAcademico.id,
    slot_no: 1,
    title: "Director Academico",
    position_type: "promocion"
  });
  const posRespCalidad = await post("unit_positions", {
    unit_id: unitDeptCalidad.id,
    cargo_id: cargoRespCalidad.id,
    slot_no: 1,
    title: "Responsable de Calidad",
    position_type: "simbolico"
  });
  const posRespEventos = await post("unit_positions", {
    unit_id: unitUniversity.id,
    cargo_id: cargoRespEventos.id,
    slot_no: 1,
    title: "Responsable de Eventos",
    position_type: "simbolico"
  });
  const posRespCoil = await post("unit_positions", {
    unit_id: unitCareerSis.id,
    cargo_id: cargoRespCoil.id,
    slot_no: 1,
    title: "Responsable COIL",
    position_type: "simbolico"
  });

  await post("position_assignments", {
    position_id: posRector.id,
    person_id: rector.id,
    start_date: isoDate(today),
    is_current: 1
  });
  await post("position_assignments", {
    position_id: posDecano.id,
    person_id: decano.id,
    start_date: isoDate(today),
    is_current: 1
  });
  await post("position_assignments", {
    position_id: posCoordSis.id,
    person_id: coordSis.id,
    start_date: isoDate(today),
    is_current: 1
  });
  await post("position_assignments", {
    position_id: posDocenteSisA.id,
    person_id: docenteA.id,
    start_date: isoDate(today),
    is_current: 1
  });
  await post("position_assignments", {
    position_id: posDocenteSisB.id,
    person_id: docenteB.id,
    start_date: isoDate(today),
    is_current: 1
  });
  await post("position_assignments", {
    position_id: posDocenteSisC.id,
    person_id: docenteA.id,
    start_date: isoDate(today),
    is_current: 1
  });
  await post("position_assignments", {
    position_id: posDocenteSisD.id,
    person_id: docenteB.id,
    start_date: isoDate(today),
    is_current: 1
  });
  await post("position_assignments", {
    position_id: posCoordEnf.id,
    person_id: coordEnf.id,
    start_date: isoDate(today),
    is_current: 1
  });
  await post("position_assignments", {
    position_id: posDocenteEnf.id,
    person_id: docenteEnf.id,
    start_date: isoDate(today),
    is_current: 1
  });
  await post("position_assignments", {
    position_id: posDocenteEnfC.id,
    person_id: docenteEnf.id,
    start_date: isoDate(today),
    is_current: 1
  });
  await post("position_assignments", {
    position_id: posAnalista.id,
    person_id: analista.id,
    start_date: isoDate(today),
    is_current: 1
  });
  await post("position_assignments", {
    position_id: posCoordFaculty.id,
    person_id: coordSis.id,
    start_date: isoDate(today),
    is_current: 1
  });
  await post("position_assignments", {
    position_id: posDocenteEnfB.id,
    person_id: docenteA.id,
    start_date: isoDate(today),
    is_current: 1
  });
  await post("position_assignments", {
    position_id: posAnalistaUniversity.id,
    person_id: analista.id,
    start_date: isoDate(today),
    is_current: 1
  });
  await post("position_assignments", {
    position_id: posDirectorEscuela.id,
    person_id: decano.id,
    start_date: isoDate(today),
    is_current: 1
  });
  await post("position_assignments", {
    position_id: posDirectorAcademico.id,
    person_id: rector.id,
    start_date: isoDate(today),
    is_current: 1
  });
  await post("position_assignments", {
    position_id: posRespCalidad.id,
    person_id: analista.id,
    start_date: isoDate(today),
    is_current: 1
  });
  await post("position_assignments", {
    position_id: posRespEventos.id,
    person_id: rector.id,
    start_date: isoDate(today),
    is_current: 1
  });
  await post("position_assignments", {
    position_id: posRespCoil.id,
    person_id: docenteA.id,
    start_date: isoDate(today),
    is_current: 1
  });

  await assignRole(decano.id, roleDecano.id, unitFaculty.id);
  await assignRole(coordSis.id, roleCoord.id, unitCareerSis.id);
  await assignRole(coordSis.id, roleCoord.id, unitFaculty.id);
  await assignRole(coordEnf.id, roleCoord.id, unitCareerEnf.id);
  await assignRole(docenteA.id, roleDocente.id, unitCareerSis.id);
  await assignRole(docenteB.id, roleDocente.id, unitCareerSis.id);
  await assignRole(docenteA.id, roleDocente.id, unitCareerEnf.id);
  await assignRole(docenteEnf.id, roleDocente.id, unitCareerEnf.id);

  const vacancyDocente = await post("vacancies", {
    position_id: posDocenteSisB.id,
    title: `Vacante Docente-${suffix}`,
    dedication: "TC",
    relation_type: "dependencia",
    status: "abierta"
  });
  const vacancyCoordSis = await post("vacancies", {
    position_id: posCoordSisVac.id,
    title: `Vacante Coord Sist-${suffix}`,
    dedication: "TC",
    relation_type: "promocion",
    status: "abierta"
  });
  const vacancyCoordEnf = await post("vacancies", {
    position_id: posCoordEnfVac.id,
    title: `Vacante Coord Enf-${suffix}`,
    dedication: "TC",
    relation_type: "promocion",
    status: "abierta"
  });

  await post("vacancy_visibility", {
    vacancy_id: vacancyCoordSis.id,
    unit_id: unitCareerEnf.id
  });
  await post("vacancy_visibility", {
    vacancy_id: vacancyCoordEnf.id,
    unit_id: unitCareerSis.id
  });

  const procesoLogros = await post("processes", {
    name: `Informe Logros-${suffix}`,
    slug: `logros-${suffix}`,
    unit_id: unitCareerSis.id,
    has_document: 1,
    is_active: 1,
    cargo_id: cargoCoord.id,
    version: "1.0",
    version_name: "Inicial",
    version_slug: `logros-v1-${suffix}`,
    version_effective_from: isoDate(start),
    version_effective_to: isoDate(end)
  });
  const procesoTutorias = await post("processes", {
    name: `Tutorias-${suffix}`,
    slug: `tutorias-${suffix}`,
    unit_id: unitCareerSis.id,
    has_document: 1,
    is_active: 1,
    cargo_id: cargoDocente.id,
    version: "1.0",
    version_name: "Inicial",
    version_slug: `tutorias-v1-${suffix}`,
    version_effective_from: isoDate(start),
    version_effective_to: isoDate(end)
  });
  const procesoVinculacion = await post("processes", {
    name: `Vinculacion-${suffix}`,
    slug: `vinculacion-${suffix}`,
    unit_id: unitCareerSis.id,
    has_document: 1,
    is_active: 1,
    cargo_id: cargoCoord.id,
    version: "1.0",
    version_name: "Inicial",
    version_slug: `vinculacion-v1-${suffix}`,
    version_effective_from: isoDate(start),
    version_effective_to: isoDate(end)
  });
  const procesoProyecto = await post("processes", {
    name: `Proyecto Integrador-${suffix}`,
    slug: `proyecto-int-${suffix}`,
    unit_id: unitCareerSis.id,
    has_document: 1,
    is_active: 1,
    cargo_id: cargoDocente.id,
    version: "1.0",
    version_name: "Inicial",
    version_slug: `proyecto-int-v1-${suffix}`,
    version_effective_from: isoDate(start),
    version_effective_to: isoDate(end)
  });
  const procesoPracticas = await post("processes", {
    name: `Practicas Clinicas-${suffix}`,
    slug: `practicas-${suffix}`,
    unit_id: unitCareerEnf.id,
    has_document: 1,
    is_active: 1,
    cargo_id: cargoCoord.id,
    version: "1.0",
    version_name: "Inicial",
    version_slug: `practicas-v1-${suffix}`,
    version_effective_from: isoDate(start),
    version_effective_to: isoDate(end)
  });
  const procesoTutoriasEnf = await post("processes", {
    name: `Tutorias Enfermeria-${suffix}`,
    slug: `tutorias-enf-${suffix}`,
    unit_id: unitCareerEnf.id,
    has_document: 1,
    is_active: 1,
    cargo_id: cargoDocente.id,
    version: "1.0",
    version_name: "Inicial",
    version_slug: `tutorias-enf-v1-${suffix}`,
    version_effective_from: isoDate(start),
    version_effective_to: isoDate(end)
  });
  const procesoPlanificacion = await post("processes", {
    name: `Planificacion Academica-${suffix}`,
    slug: `plan-acad-${suffix}`,
    unit_id: unitFaculty.id,
    has_document: 1,
    is_active: 1,
    cargo_id: cargoCoord.id,
    version: "1.0",
    version_name: "Inicial",
    version_slug: `plan-acad-v1-${suffix}`,
    version_effective_from: isoDate(start),
    version_effective_to: isoDate(end)
  });
  const procesoConsejo = await post("processes", {
    name: `Consejo Facultad-${suffix}`,
    slug: `consejo-fac-${suffix}`,
    unit_id: unitFaculty.id,
    has_document: 1,
    is_active: 1,
    cargo_id: cargoDecano.id,
    version: "1.0",
    version_name: "Inicial",
    version_slug: `consejo-fac-v1-${suffix}`,
    version_effective_from: isoDate(start),
    version_effective_to: isoDate(end)
  });
  const procesoAuditoria = await post("processes", {
    name: `Auditoria Interna-${suffix}`,
    slug: `auditoria-${suffix}`,
    unit_id: unitDeptCalidad.id,
    has_document: 1,
    is_active: 1,
    cargo_id: cargoAnalista.id,
    version: "1.0",
    version_name: "Inicial",
    version_slug: `auditoria-v1-${suffix}`,
    version_effective_from: isoDate(start),
    version_effective_to: isoDate(end)
  });
  const procesoIndicadores = await post("processes", {
    name: `Indicadores Calidad-${suffix}`,
    slug: `indicadores-${suffix}`,
    unit_id: unitDeptCalidad.id,
    has_document: 1,
    is_active: 1,
    cargo_id: cargoAnalista.id,
    version: "1.0",
    version_name: "Inicial",
    version_slug: `indicadores-v1-${suffix}`,
    version_effective_from: isoDate(start),
    version_effective_to: isoDate(end)
  });
  const procesoPlanEstrategico = await post("processes", {
    name: `Plan Estrategico-${suffix}`,
    slug: `plan-estr-${suffix}`,
    unit_id: unitUniversity.id,
    has_document: 1,
    is_active: 1,
    cargo_id: cargoRector.id,
    version: "1.0",
    version_name: "Inicial",
    version_slug: `plan-estr-v1-${suffix}`,
    version_effective_from: isoDate(start),
    version_effective_to: isoDate(end)
  });
  await post("processes", {
    name: `Evaluacion Docente-${suffix}`,
    slug: `eval-doc-${suffix}`,
    unit_id: unitFaculty.id,
    has_document: 1,
    is_active: 1,
    cargo_id: cargoDecano.id,
    version: "1.0",
    version_name: "Inicial",
    version_slug: `evaldoc-v1-${suffix}`,
    version_effective_from: isoDate(start),
    version_effective_to: isoDate(end)
  });

  await post("templates", {
    process_id: procesoLogros.id,
    name: `Plantilla Logros-${suffix}`,
    slug: `tpl-logros-${suffix}`,
    description: "Plantilla base de logros"
  });
  await post("templates", {
    process_id: procesoTutorias.id,
    name: `Plantilla Tutorias-${suffix}`,
    slug: `tpl-tutorias-${suffix}`,
    description: "Plantilla base de tutorias"
  });
  await post("templates", {
    process_id: procesoVinculacion.id,
    name: `Plantilla Vinculacion-${suffix}`,
    slug: `tpl-vinculacion-${suffix}`,
    description: "Plantilla base de vinculacion"
  });
  await post("templates", {
    process_id: procesoProyecto.id,
    name: `Plantilla Proyecto-${suffix}`,
    slug: `tpl-proyecto-${suffix}`,
    description: "Plantilla base de proyecto integrador"
  });
  await post("templates", {
    process_id: procesoPracticas.id,
    name: `Plantilla Practicas-${suffix}`,
    slug: `tpl-practicas-${suffix}`,
    description: "Plantilla base de practicas"
  });
  await post("templates", {
    process_id: procesoTutoriasEnf.id,
    name: `Plantilla Tutorias Enf-${suffix}`,
    slug: `tpl-tutorias-enf-${suffix}`,
    description: "Plantilla base de tutorias enfermeria"
  });
  await post("templates", {
    process_id: procesoPlanificacion.id,
    name: `Plantilla Planificacion-${suffix}`,
    slug: `tpl-plan-acad-${suffix}`,
    description: "Plantilla base de planificacion"
  });
  await post("templates", {
    process_id: procesoConsejo.id,
    name: `Plantilla Consejo-${suffix}`,
    slug: `tpl-consejo-${suffix}`,
    description: "Plantilla base de consejo de facultad"
  });
  await post("templates", {
    process_id: procesoAuditoria.id,
    name: `Plantilla Auditoria-${suffix}`,
    slug: `tpl-auditoria-${suffix}`,
    description: "Plantilla base de auditoria"
  });
  await post("templates", {
    process_id: procesoIndicadores.id,
    name: `Plantilla Indicadores-${suffix}`,
    slug: `tpl-indicadores-${suffix}`,
    description: "Plantilla base de indicadores"
  });
  await post("templates", {
    process_id: procesoPlanEstrategico.id,
    name: `Plantilla Plan Estrategico-${suffix}`,
    slug: `tpl-plan-estr-${suffix}`,
    description: "Plantilla base de plan estrategico"
  });

  await post("terms", {
    name: `Periodo-${suffix}`,
    start_date: isoDate(start),
    end_date: isoDate(end),
    is_active: 1
  });

  console.log("✅ Datos demo creados.");
  console.log("Credenciales demo:");
  console.log(`Password: ${plainPassword}`);
  [
    admin,
    rector,
    decano,
    coordSis,
    docenteA,
    docenteB,
    coordEnf,
    analista,
    docenteEnf
  ].forEach((user) => {
    console.log(`- ${user.email} (cedula ${user.cedula})`);
  });
};

run().catch((error) => {
  console.error("❌ Error al sembrar datos:", error.message);
  process.exit(1);
});
