import { test } from "node:test";
import assert from "node:assert/strict";
import VencimientosDeEstructura from "./VencimientosDeEstructura.js";

const poolQueDevuelve = (filas) => {
  const llamadas = [];
  return {
    llamadas,
    async query(sql) {
      llamadas.push(sql);
      return [filas];
    },
  };
};

const registroMudo = () => {
  const lineas = { log: [], error: [] };
  return { lineas, log: (t) => lineas.log.push(t), error: (t) => lineas.error.push(t) };
};

test("una vuelta llama a la función del esquema, y sólo a ella", async () => {
  const pool = poolQueDevuelve([]);
  const tarea = new VencimientosDeEstructura({ pool, registro: registroMudo() });
  const aplicados = await tarea.unaVuelta();
  assert.deepEqual(aplicados, []);
  assert.equal(pool.llamadas.length, 1);
  assert.match(pool.llamadas[0], /aplicar_vencimientos_de_estructura\(\)/);
});

test("sin nada vencido no dice nada: una línea por vuelta diciendo «nada» deja de leerse", async () => {
  const registro = registroMudo();
  await new VencimientosDeEstructura({ pool: poolQueDevuelve([]), registro }).unaVuelta();
  assert.deepEqual(registro.lineas.log, []);
});

test("cada nodo tocado deja su línea, con cuántos efectos se aplicaron", async () => {
  const registro = registroMudo();
  const filas = [
    { clase: "unidad", nodo_id: 8, afectadas: 21 },
    { clase: "unidad", nodo_id: 9, afectadas: 3 },
  ];
  const aplicados = await new VencimientosDeEstructura({ pool: poolQueDevuelve(filas), registro }).unaVuelta();
  assert.equal(aplicados.length, 2);
  assert.equal(registro.lineas.log.length, 2);
  assert.match(registro.lineas.log[0], /unidad 8: supresión vencida aplicada \(21 efectos\)/);
});

test("un fallo de la vuelta no tumba la tarea: se registra y la siguiente vuelta sigue programada", async () => {
  const registro = registroMudo();
  const pool = { async query() { throw new Error("conexión caída"); } };
  const tarea = new VencimientosDeEstructura({ pool, registro, cadaMs: 3_600_000 });
  tarea.iniciar();
  await new Promise((resolver) => setImmediate(resolver));
  assert.ok(tarea.reloj, "el temporizador sigue vivo tras el fallo");
  assert.match(registro.lineas.error[0], /la vuelta falló: conexión caída/);
  tarea.detener();
  assert.equal(tarea.reloj, null);
});

test("iniciar dos veces no arranca dos temporizadores", () => {
  const tarea = new VencimientosDeEstructura({ pool: poolQueDevuelve([]), registro: registroMudo(), cadaMs: 3_600_000 });
  tarea.iniciar();
  const primero = tarea.reloj;
  tarea.iniciar();
  assert.equal(tarea.reloj, primero);
  tarea.detener();
});
