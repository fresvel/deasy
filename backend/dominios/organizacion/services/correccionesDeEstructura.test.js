import test from "node:test";
import assert from "node:assert/strict";
import { registrarCorreccion } from "./correccionesDeEstructura.js";

const conexion = () => {
  const consultas = [];
  return { consultas, query: async (sql, params) => { consultas.push({ sql, params }); return [{ insertId: 12 }]; } };
};

test("sin motivo, o con uno de compromiso, no hay corrección — y no se escribe nada", async () => {
  for (const motivo of [undefined, "", "   ", "error"]) {
    const c = conexion();
    await assert.rejects(registrarCorreccion(c, { tabla: "unit_vigencias", registroId: 1, actorId: 1, motivo, cambios: {} }), /necesita su motivo/);
    assert.equal(c.consultas.length, 0);
  }
});

test("sin quién, o sobre una tabla que no es de la estructura, tampoco", async () => {
  await assert.rejects(registrarCorreccion(conexion(), { tabla: "unit_vigencias", actorId: null, motivo: "un motivo suficiente", cambios: {} }), /quién la registra/);
  await assert.rejects(registrarCorreccion(conexion(), { tabla: "persons", actorId: 1, motivo: "un motivo suficiente", cambios: {} }), /no es algo que se corrija/);
});

test("lee lo que la fila decía, escribe la entrada con el antes y el después, y DESPUÉS deja la marca", async () => {
  const consultas = [];
  const c = {
    query: async (sql, params) => {
      consultas.push({ sql, params });
      if (/FOR UPDATE/.test(sql)) return [[{ fila: JSON.stringify({ id: 4, parent_process_id: 1, child_process_id: 3 }) }]];
      return [{ insertId: 12 }];
    }
  };
  const id = await registrarCorreccion(c, { tabla: "process_relations", registroId: 4, actorId: 1, motivo: "  Se registró mal el padre  ", cambios: { parent_process_id: 9 } });
  assert.equal(id, 12);
  assert.match(consultas[0].sql, /FROM process_relations t WHERE t\.id = \? FOR UPDATE/);
  assert.match(consultas[1].sql, /INSERT INTO correcciones_de_estructura/);
  assert.equal(consultas[1].params[3], "Se registró mal el padre");
  assert.deepEqual(JSON.parse(consultas[1].params[4]), { id: 4, parent_process_id: 1, child_process_id: 3 });
  assert.deepEqual(JSON.parse(consultas[1].params[5]), { id: 4, parent_process_id: 9, child_process_id: 3 });
  assert.match(consultas[2].sql, /set_config\('deasy\.correccion'/);
  assert.deepEqual(consultas[2].params, ["12"]);
});

test("corregir algo que no existe se rechaza sin escribir la entrada", async () => {
  const consultas = [];
  const c = { query: async (sql) => { consultas.push(sql); return [[]]; } };
  await assert.rejects(registrarCorreccion(c, { tabla: "unit_vigencias", registroId: 999, actorId: 1, motivo: "un motivo suficiente", cambios: {} }), /no existe/);
  assert.equal(consultas.length, 1);
});
