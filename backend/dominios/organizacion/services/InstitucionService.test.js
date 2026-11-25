import { test } from "node:test";
import assert from "node:assert/strict";
import InstitucionService from "./InstitucionService.js";

const poolCon = (filas) => ({ query: async () => [filas] });

const FILA = {
  id: 1,
  nombre: "Institución",
  pais_id: 60,
  pais_iso: "EC",
  pais_nombre: "Ecuador"
};

test("devuelve la institución con su país ya resuelto", async () => {
  const servicio = new InstitucionService(poolCon([FILA]));
  assert.deepEqual(await servicio.actual(), FILA);
});

test("paisActual es lo que casi todo el mundo quiere de aquí", async () => {
  const servicio = new InstitucionService(poolCon([FILA]));
  assert.deepEqual(await servicio.paisActual(), { id: 60, iso: "EC", nombre: "Ecuador" });
});

// Sin institución no hay país, y sin país no hay validador de documento. Fallar aquí es un minuto;
// dejar que el sistema siga con un país inventado es una tarde de "por qué rechaza este número".
test("sin ninguna institución falla, y el mensaje dice cómo se arregla", async () => {
  const servicio = new InstitucionService(poolCon([]));
  await assert.rejects(() => servicio.actual(), (error) => {
    assert.match(error.message, /No hay ninguna institución configurada/);
    assert.match(error.message, /\/setup/, "el mensaje tiene que decir por dónde se arregla");
    assert.equal(error.status, 500, "es un fallo de configuración del servidor, no del cliente");
    return true;
  });
});

// La regla que hace que `actual()` signifique algo: con dos, elegir "la primera" daría un país
// equivocado y con él un validador equivocado, en silencio.
test("con dos instituciones activas falla en vez de elegir la primera", async () => {
  const servicio = new InstitucionService(poolCon([FILA, { ...FILA, id: 2, pais_iso: "PE" }]));
  await assert.rejects(() => servicio.actual(), (error) => {
    assert.match(error.message, /Hay 2 instituciones activas/);
    return true;
  });
});

test("el SELECT filtra por activas y ordena, para que el fallo sea determinista", async () => {
  let sqlVisto = "";
  const servicio = new InstitucionService({
    query: async (sql) => {
      sqlVisto = sql;
      return [[FILA]];
    }
  });
  await servicio.actual();
  assert.match(sqlVisto, /INNER JOIN paises/, "el país se resuelve en la misma consulta");
  assert.match(sqlVisto, /i\.is_active = 1/, "una institución retirada no cuenta");
  assert.match(sqlVisto, /ORDER BY i\.id ASC/);
});
