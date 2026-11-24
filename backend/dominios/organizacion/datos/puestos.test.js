import { test } from "node:test";
import assert from "node:assert/strict";
import { actualizarPuesto } from "./puestos.js";

// `actualizarPuesto` es lo unico de este modulo que no es una consulta literal: construye el SET por
// interpolacion. Lo que lo hace seguro es que las columnas salgan de una lista CERRADA del propio
// modulo y no de las claves de lo que llega. Estos tres tests fijan justo eso.
const espia = () => {
  const visto = [];
  return { visto, query: async (sql, params) => { visto.push({ sql, params }); return [[]]; } };
};

test("escribe solo las columnas que llegan, en el orden de la lista", async () => {
  const ejecutor = espia();
  const tocadas = await actualizarPuesto(ejecutor, 7, { is_unit_head: 1, title: "Decano" });
  assert.equal(tocadas, 2);
  assert.equal(ejecutor.visto.length, 1);
  assert.match(ejecutor.visto[0].sql, /^UPDATE unit_positions SET title = \?, is_unit_head = \? WHERE id = \?$/);
  assert.deepEqual(ejecutor.visto[0].params, ["Decano", 1, 7]);
});

// Desde el frente 27 un puesto no se apaga con una columna: se le pone fin a su vida, en
// `position_vigencias`. Si `is_active` volviera a la lista, este camino escribiria una columna que
// la tabla ya no tiene, y el fallo saldria en tiempo de llamada.
test("is_active ya no es editable: la vigencia tiene su propio camino", async () => {
  const ejecutor = espia();
  assert.equal(await actualizarPuesto(ejecutor, 7, { is_active: 0 }), 0);
  assert.equal(ejecutor.visto.length, 0);
});

// Sin esto, un PUT vacio ejecutaria `UPDATE unit_positions SET  WHERE id = ?`, que es un error de
// sintaxis en tiempo de llamada — el fallo que no ve ni `node --check` ni `check:imports`.
test("sin cambios no toca la base", async () => {
  const ejecutor = espia();
  assert.equal(await actualizarPuesto(ejecutor, 7, {}), 0);
  assert.equal(ejecutor.visto.length, 0);
});

// EL BORDE: una clave que no este en la lista se ignora, no se interpola. `unit_id` no es editable
// desde aqui —mover un puesto de unidad no es editarlo— y `id` menos todavia.
test("una columna que no esta en la lista no llega al SQL", async () => {
  const ejecutor = espia();
  const tocadas = await actualizarPuesto(ejecutor, 7, {
    title: "Decano",
    unit_id: 99,
    id: 1,
    "is_active = 1, slot_no": 0
  });
  assert.equal(tocadas, 1, "solo `title` es editable de las cuatro claves");
  assert.equal(ejecutor.visto[0].sql, "UPDATE unit_positions SET title = ? WHERE id = ?");
  assert.deepEqual(ejecutor.visto[0].params, ["Decano", 7]);
});
