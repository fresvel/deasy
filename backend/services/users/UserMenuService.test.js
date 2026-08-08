import test from "node:test";
import assert from "node:assert/strict";

import { buildUserMenu } from "./UserMenuService.js";

// El servicio solo lee: se le puede dar un pool falso que despacha por el SQL que recibe.
// El orden de las comprobaciones importa — la consulta operativa lleva dentro subconsultas
// sobre `position_assignments`, así que se descarta antes que la de puestos.
const makePool = ({ org = [{ id: 1 }], positions = [], orgTree = [], rules = [], operational = [] } = {}) => ({
  async query(sql) {
    if (sql.includes("relation_unit_types WHERE code = 'org'")) return [org];
    if (sql.includes("operational.source_unit_type_id")) return [operational];
    if (sql.includes("FROM position_assignments pa")) return [positions];
    if (sql.includes("FROM unit_relations ur")) return [orgTree];
    if (sql.includes("INNER JOIN process_target_rules ptr")) return [rules];
    throw new Error(`consulta inesperada: ${sql.slice(0, 80)}`);
  },
});

const position = (overrides = {}) => ({
  position_id: 10,
  position_type: "titular",
  unit_id: 100,
  unit_name: "Escuela A",
  unit_label: "ESC-A",
  unit_type_id: 5,
  group_unit_id: null,
  group_unit_name: null,
  group_unit_label: null,
  cargo_id: 20,
  cargo_name: "Docente",
  ...overrides,
});

const rule = (overrides = {}) => ({
  process_id: 1,
  process_name: "Sílabo",
  process_slug: "silabo",
  process_definition_id: 700,
  variation_key: null,
  definition_version: 1,
  rule_id: 900,
  priority: 1,
  unit_scope_type: "unit_exact",
  unit_id: 100,
  unit_type_id: null,
  cargo_id: null,
  position_id: null,
  recipient_policy: null,
  is_routed: false,
  ...overrides,
});

const operationalRow = (overrides = {}) => ({
  process_id: 2,
  process_name: "Informe",
  process_slug: "informe",
  process_definition_id: 800,
  variation_key: null,
  definition_version: 1,
  source_position_id: null,
  source_cargo_id: null,
  source_unit_id: null,
  source_unit_type_id: null,
  ...overrides,
});

test("sin la relación 'org' lanza un error de configuración con statusCode 500", async () => {
  await assert.rejects(
    () => buildUserMenu(makePool({ org: [] }), 7),
    (error) => {
      assert.equal(error.statusCode, 500);
      assert.match(error.message, /relation_unit_types con code='org'/);
      return true;
    }
  );
});

test("sin puestos vigentes devuelve la forma corta, SIN unit_groups", async () => {
  const menu = await buildUserMenu(makePool({ positions: [] }), 7);
  assert.deepEqual(menu, { user_id: 7, units: [], consolidated: [] });
  assert.equal("unit_groups" in menu, false);
});

test("una regla unit_exact reparte el proceso al cargo de esa unidad y al consolidado", async () => {
  const menu = await buildUserMenu(
    makePool({ positions: [position()], rules: [rule()] }),
    7
  );

  assert.equal(menu.units.length, 1);
  assert.equal(menu.units[0].cargos.length, 1);
  const [proceso] = menu.units[0].cargos[0].processes;
  assert.equal(proceso.process_definition_id, 700);
  assert.equal(proceso.access_source, "process");
  assert.equal(proceso.unit_id, 100);
  assert.equal(menu.consolidated[0].processes.length, 1);
});

test("una regla unit_exact de OTRA unidad no reparte nada", async () => {
  const menu = await buildUserMenu(
    makePool({ positions: [position()], rules: [rule({ unit_id: 999 })] }),
    7
  );
  assert.deepEqual(menu.units[0].cargos[0].processes, []);
  assert.deepEqual(menu.consolidated[0].processes, []);
});

test("unit_subtree alcanza a la unidad descendiente por la relación org", async () => {
  const menu = await buildUserMenu(
    makePool({
      positions: [position({ unit_id: 102 })],
      orgTree: [
        { parent_unit_id: 100, child_unit_id: 101 },
        { parent_unit_id: 101, child_unit_id: 102 },
      ],
      rules: [rule({ unit_scope_type: "unit_subtree", unit_id: 100 })],
    }),
    7
  );
  assert.equal(menu.units[0].cargos[0].processes.length, 1);
});

test("unit_subtree no alcanza a una unidad fuera del subárbol", async () => {
  const menu = await buildUserMenu(
    makePool({
      positions: [position({ unit_id: 500 })],
      orgTree: [{ parent_unit_id: 100, child_unit_id: 101 }],
      rules: [rule({ unit_scope_type: "unit_subtree", unit_id: 100 })],
    }),
    7
  );
  assert.deepEqual(menu.units[0].cargos[0].processes, []);
});

test("un ciclo en unit_relations no cuelga el recorrido del subárbol", async () => {
  const menu = await buildUserMenu(
    makePool({
      positions: [position({ unit_id: 101 })],
      orgTree: [
        { parent_unit_id: 100, child_unit_id: 101 },
        { parent_unit_id: 101, child_unit_id: 100 },
      ],
      rules: [rule({ unit_scope_type: "unit_subtree", unit_id: 100 })],
    }),
    7
  );
  assert.equal(menu.units[0].cargos[0].processes.length, 1);
});

test("all_units reparte a cualquier puesto; unit_type solo al tipo de unidad que coincide", async () => {
  const todos = await buildUserMenu(
    makePool({ positions: [position({ unit_id: 777 })], rules: [rule({ unit_scope_type: "all_units", unit_id: null })] }),
    7
  );
  assert.equal(todos.units[0].cargos[0].processes.length, 1);

  const porTipo = await buildUserMenu(
    makePool({
      positions: [position({ unit_type_id: 5 })],
      rules: [rule({ unit_scope_type: "unit_type", unit_id: null, unit_type_id: 9 })],
    }),
    7
  );
  assert.deepEqual(porTipo.units[0].cargos[0].processes, []);
});

test("el puesto exacto manda sobre el ámbito de unidad", async () => {
  const casa = await buildUserMenu(
    makePool({ positions: [position()], rules: [rule({ position_id: 10, unit_id: 999 })] }),
    7
  );
  assert.equal(casa.units[0].cargos[0].processes.length, 1);

  const noCasa = await buildUserMenu(
    makePool({ positions: [position()], rules: [rule({ position_id: 11, unit_id: 100 })] }),
    7
  );
  assert.deepEqual(noCasa.units[0].cargos[0].processes, []);
});

test("recipient_policy='exact_position' SIN position_id no casa con nadie", async () => {
  const menu = await buildUserMenu(
    makePool({
      positions: [position()],
      rules: [rule({ recipient_policy: "exact_position", position_id: null })],
    }),
    7
  );
  assert.deepEqual(menu.units[0].cargos[0].processes, []);
});

test("una regla con cargo distinto no casa aunque la unidad coincida", async () => {
  const menu = await buildUserMenu(
    makePool({ positions: [position()], rules: [rule({ cargo_id: 99 })] }),
    7
  );
  assert.deepEqual(menu.units[0].cargos[0].processes, []);
});

test("el acceso operativo entra por cargo y se marca access_source='flow'", async () => {
  const menu = await buildUserMenu(
    makePool({
      positions: [position()],
      operational: [operationalRow({ source_cargo_id: 20 })],
    }),
    7
  );
  const [proceso] = menu.units[0].cargos[0].processes;
  assert.equal(proceso.process_definition_id, 800);
  assert.equal(proceso.access_source, "flow");
});

test("una fila operativa sin ninguna pista de origen no engancha a nadie", async () => {
  const menu = await buildUserMenu(
    makePool({ positions: [position()], operational: [operationalRow()] }),
    7
  );
  assert.deepEqual(menu.units[0].cargos[0].processes, []);
});

test("el mismo proceso por regla y por flujo aparece UNA vez, y gana el de regla", async () => {
  const menu = await buildUserMenu(
    makePool({
      positions: [position()],
      rules: [rule({ process_definition_id: 700 })],
      operational: [operationalRow({ process_definition_id: 700, source_cargo_id: 20 })],
    }),
    7
  );
  assert.equal(menu.units[0].cargos[0].processes.length, 1);
  assert.equal(menu.units[0].cargos[0].processes[0].access_source, "process");
  assert.equal(menu.consolidated[0].processes.length, 1);
});

test("los procesos y los cargos salen ordenados alfabéticamente", async () => {
  const menu = await buildUserMenu(
    makePool({
      positions: [position(), position({ position_id: 11, cargo_id: 19, cargo_name: "Coordinador" })],
      rules: [
        rule({ process_definition_id: 701, process_name: "Zeta", unit_scope_type: "all_units", unit_id: null }),
        rule({ process_definition_id: 702, process_name: "Alfa", unit_scope_type: "all_units", unit_id: null }),
      ],
    }),
    7
  );
  assert.deepEqual(menu.units[0].cargos.map((c) => c.name), ["Coordinador", "Docente"]);
  assert.deepEqual(menu.units[0].cargos[0].processes.map((p) => p.name), ["Alfa", "Zeta"]);
  assert.deepEqual(menu.consolidated.map((c) => c.name), ["Coordinador", "Docente"]);
});

test("una unidad sin grupo se agrupa consigo misma; con grupo cuelga del grupo", async () => {
  const sinGrupo = await buildUserMenu(makePool({ positions: [position()] }), 7);
  assert.equal(sinGrupo.unit_groups.length, 1);
  assert.equal(sinGrupo.unit_groups[0].id, 100);
  assert.equal(sinGrupo.unit_groups[0].name, "Escuela A");
  assert.deepEqual(sinGrupo.unit_groups[0].units.map((u) => u.id), [100]);

  const conGrupo = await buildUserMenu(
    makePool({
      positions: [position({ group_unit_id: 50, group_unit_name: "Facultad", group_unit_label: "FAC" })],
    }),
    7
  );
  assert.equal(conGrupo.unit_groups[0].id, 50);
  assert.equal(conGrupo.unit_groups[0].label, "FAC");
  assert.deepEqual(conGrupo.unit_groups[0].units.map((u) => u.id), [100]);
  assert.equal(conGrupo.units[0].group_id, 50);
});
