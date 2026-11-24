import test from "node:test";
import assert from "node:assert/strict";
import { planDeMovimiento } from "./planDeMovimiento.js";

const vigente = { id: 7, padreId: 1, estado: "vigente", vigente_desde: "2026-01-10" };

test("sin arista y sin regir: se abre un borrador, sin fecha", () => {
  assert.deepEqual(planDeMovimiento(null, { padreId: 3 }), [{ op: "abrir", padreId: 3, desde: null, origen: null, actoId: null }]);
});

test("sin arista pero rigiendo: la relación nueva necesita fecha y origen", () => {
  assert.throws(() => planDeMovimiento(null, { padreId: 3, hijoConVida: true }), /necesita fecha/);
  assert.deepEqual(
    planDeMovimiento(null, { padreId: 3, hijoConVida: true, desde: "2026-12-01", origen: "carga_inicial" }),
    [{ op: "abrir", padreId: 3, desde: "2026-12-01", origen: "carga_inicial", actoId: null }]
  );
});

test("un borrador y una programada se reemparejan en su sitio: nadie dependió de ellas", () => {
  for (const estado of ["borrador", "programado"]) {
    assert.deepEqual(planDeMovimiento({ id: 7, padreId: 1, estado }, { padreId: 3 }), [{ op: "reemparejar", id: 7, padreId: 3 }]);
    assert.deepEqual(planDeMovimiento({ id: 7, padreId: 1, estado }, { padreId: null }), [{ op: "borrar", id: 7 }]);
  }
});

test("una vigente no se pisa: se cierra y se abre otra el mismo día, con el mismo acto", () => {
  assert.deepEqual(
    planDeMovimiento(vigente, { padreId: 3, desde: "2026-12-01", origen: "reorganizacion", actoId: 9 }),
    [
      { op: "cerrar", id: 7, hasta: "2026-12-01", origen: "reorganizacion", actoId: 9 },
      { op: "abrir", padreId: 3, desde: "2026-12-01", origen: "reorganizacion", actoId: 9 }
    ]
  );
});

test("desvincular una vigente es sólo cerrarla", () => {
  assert.deepEqual(
    planDeMovimiento(vigente, { padreId: null, desde: "2026-12-01", origen: "carga_inicial" }),
    [{ op: "cerrar", id: 7, hasta: "2026-12-01", origen: "carga_inicial", actoId: null }]
  );
});

test("mover una vigente sin fecha, o con una fecha que no es posterior a su inicio, se rechaza", () => {
  assert.throws(() => planDeMovimiento(vigente, { padreId: 3 }), /ya rige/);
  assert.throws(() => planDeMovimiento(vigente, { padreId: 3, desde: "2026-01-10", origen: "carga_inicial" }), /posterior al 2026-01-10/);
});

test("el mismo padre no hace nada, y una arista ya terminada cuenta como ninguna", () => {
  assert.deepEqual(planDeMovimiento(vigente, { padreId: 1 }), []);
  assert.deepEqual(
    planDeMovimiento({ id: 7, padreId: 1, estado: "suprimido" }, { padreId: 1 }),
    [{ op: "abrir", padreId: 1, desde: null, origen: null, actoId: null }]
  );
});
