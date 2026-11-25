// La CONVERSION de la receta vieja a la nueva. Es lo unico de ese modulo que piensa: el resto es
// `DELETE` + `INSERT`. Y lo que se vigila es justo donde el modelo cambia de forma.
import test from "node:test";
import assert from "node:assert/strict";

import {
  participantesDeUnPasoDeEntrega,
  participantesDeUnPasoDeFirma,
  reemplazarReceta,
  resolverReceta,
} from "./recetaDelRecorrido.js";

const ctx = "prueba";

test("entrega: un paso da UN participante, y el hueco es nulo", () => {
  // El constructor de entrega es una lista plana de personas y cada una es un paso; no hay varios.
  const partes = participantesDeUnPasoDeEntrega(
    { resolverType: "task_assignee", unitScopeType: "unit_exact", unitId: 8 }, ctx
  );
  assert.equal(partes.length, 1);
  assert.deepEqual(partes[0], {
    orden: 1, resolverType: "task_assignee", personaId: null, cargoId: null,
    unitScopeType: "unit_exact", unitId: 8, slot: null,
  });
});

test("entrega: se aceptan las DOS convenciones de nombre", () => {
  // El editor entrega camelCase y el constructor de runtime snake_case: son dos escritores reales.
  const camel = participantesDeUnPasoDeEntrega(
    { resolverType: "cargo_in_scope", cargoId: 3, unitScopeType: "all_units" }, ctx
  );
  const snake = participantesDeUnPasoDeEntrega(
    { type: "cargo_in_scope", cargo_id: 3, unit_scope_type: "all_units" }, ctx
  );
  assert.deepEqual(camel, snake);
});

test("firma: el JSONB `signers` se convierte en N participantes, en orden", () => {
  const partes = participantesDeUnPasoDeFirma({
    slot: "firma_1",
    signers: [
      { type: "cargo_in_scope", cargo_id: 7, unit_scope_type: "context_exact" },
      { type: "specific_person", person_id: 42, unit_scope_type: "unit_exact", unit_id: 2 },
    ],
  }, ctx);

  assert.equal(partes.length, 2);
  assert.deepEqual(partes.map((p) => p.orden), [1, 2]);
  assert.equal(partes[0].cargoId, 7);
  assert.equal(partes[1].personaId, 42);
});

test("firma: CADA firmante recibe su propio hueco — es el fallo que esto cierra", () => {
  // Con N firmantes y un solo `slot`, el paso imprimia el token del primero y los demas no tenian
  // marca en el papel: el firmador lanzaba `Token marker not found in PDF`.
  const partes = participantesDeUnPasoDeFirma({
    slot: "firma_2",
    signers: [{ type: "specific_person", person_id: 1 }, { type: "specific_person", person_id: 2 },
              { type: "specific_person", person_id: 3 }],
  }, ctx);
  const huecos = partes.map((p) => p.slot);
  assert.deepEqual(huecos, ["firma_2", "firma_2_2", "firma_2_3"]);
  assert.equal(new Set(huecos).size, 3, "tres firmantes, tres huecos distintos");
});

test("firma: un paso LEGADO sin lista se lee como UN firmante con las columnas del paso", () => {
  const partes = participantesDeUnPasoDeFirma({
    slot: "firma_1", resolverType: "cargo_in_scope", requiredCargoId: 5,
    unitScopeType: "context_exact", signers: [],
  }, ctx);
  assert.equal(partes.length, 1);
  assert.equal(partes[0].cargoId, 5);
});

test("un valor de vocabulario retirado NO se traduce en silencio: revienta y dice cual", () => {
  // Traducirlo a algo legal seria falsear la receta. Ningun productor vivo puede emitirlos, asi que
  // si esto salta, lo que hace falta saber es QUE valor y DE DONDE viene.
  assert.throws(
    () => participantesDeUnPasoDeEntrega({ resolverType: "document_owner" }, "edicion 7, paso 1"),
    (e) => /document_owner/.test(e.message) && /edicion 7, paso 1/.test(e.message)
  );
  assert.throws(
    () => participantesDeUnPasoDeEntrega(
      { resolverType: "task_assignee", unitScopeType: "unit_subtree" }, "edicion 7, paso 1"
    ),
    (e) => /unit_subtree/.test(e.message)
  );
});

test("reemplazarReceta borra lo de ESA accion y ese origen, no lo demas", async () => {
  const consultas = [];
  const conexion = {
    async query(sql, params = []) {
      consultas.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
      return [{ insertId: 10 }];
    },
  };
  await reemplazarReceta(conexion, {
    origen: "edicion", origenId: 4, accion: "firma",
    pasos: [{ orden: 1, code: "firma_1", nombre: "Firma 1", participantes: [
      { orden: 1, resolverType: "cargo_in_scope", personaId: null, cargoId: 9,
        unitScopeType: "context_exact", unitId: null, slot: "firma_1" },
    ] }],
  });

  assert.match(consultas[0].sql, /DELETE FROM pasos_declarados WHERE edicion_id = \? AND accion = \?/);
  assert.deepEqual(consultas[0].params, [4, "firma"]);
  assert.match(consultas[1].sql, /INSERT INTO pasos_declarados \(accion, edicion_id, orden, code, nombre\)/);
  assert.match(consultas[2].sql, /INSERT INTO participantes_declarados/);
});

test("un origen desconocido no se cuela", async () => {
  await assert.rejects(
    () => reemplazarReceta({}, { origen: "loquesea", origenId: 1, accion: "firma", pasos: [] }),
    /origen desconocido/
  );
});

test("el ambito por defecto REPRODUCE el de la columna vieja, que era distinto por lado", () => {
  // `fill_flow_steps` traia DEFAULT 'unit_exact' y `signature_flow_steps` 'context_exact'. Mientras
  // las dos formas convivan, la nueva tiene que decir lo mismo: si no, la comprobacion cruzada
  // marcaria una diferencia que no lo es. Para `specific_person` el valor es inerte igualmente.
  assert.equal(
    participantesDeUnPasoDeEntrega({ type: "specific_person", person_id: 3 }, ctx)[0].unitScopeType,
    "unit_exact"
  );
  assert.equal(
    participantesDeUnPasoDeFirma({ signers: [{ type: "specific_person", person_id: 3 }] }, ctx)[0].unitScopeType,
    "context_exact"
  );
});

/* ── LA RESOLUCION POR ESCALONES ──────────────────────────────────────────────────────────────
   Vino de `services/admin/generation/queries.test.js`, que murio con su sujeto: ahi habia DOS
   funciones de resolucion --una por mitad, 44 lineas identicas de 50-- y aqui hay una para los dos
   lados.

   Lo que se vigila no es «que columna esta rellena» sino el ORDEN: si el entregable tiene receta
   propia manda, y la de la edicion NI SE PREGUNTA. La conexion falsa interpreta el SQL --por que
   origen filtra-- en vez de devolver respuestas pregrabadas: asi, cambiar la consulta tira el test. */

const ENTREGABLE = 300;
const VINCULO = 7;

const filaDePaso = ({ id = 1, orden = 1, participante = 10 }) => ({
  id, orden, code: null, nombre: null,
  participante_id: participante, participante_orden: 1,
  resolver_type: "task_assignee", persona_id: null, cargo_id: null,
  unit_scope_type: "unit_exact", unit_id: null, slot: null,
});

const conexionDeReceta = ({ delEntregable = [], deLaEdicion = [] } = {}) => {
  const consultas = [];
  return {
    consultas,
    async query(sql, params = []) {
      consultas.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
      if (/p\.task_item_id = \?/.test(sql)) return [delEntregable];
      if (/SELECT edicion_id FROM vinculos/.test(sql)) return [deLaEdicion];
      throw new Error(`consulta no reconocida: ${sql}`);
    },
  };
};

test("resolverReceta: con receta del ENTREGABLE gana esa, y no se pregunta nada mas", async () => {
  const cx = conexionDeReceta({ delEntregable: [filaDePaso({ id: 1 })], deLaEdicion: [filaDePaso({ id: 9 })] });
  const r = await resolverReceta(cx, { accion: "entrega", taskItemId: ENTREGABLE, vinculoId: VINCULO });
  assert.equal(r.origen, "entregable");
  assert.deepEqual(r.pasos.map((p) => p.id), [1]);
  assert.equal(cx.consultas.length, 1, "una consulta: el segundo escalon ni se pregunta");
});

test("resolverReceta: sin receta del entregable gana la de la EDICION que el vinculo enlaza", async () => {
  const cx = conexionDeReceta({ deLaEdicion: [filaDePaso({ id: 9 })] });
  const r = await resolverReceta(cx, { accion: "firma", taskItemId: ENTREGABLE, vinculoId: VINCULO });
  assert.equal(r.origen, "edicion");
  assert.deepEqual(r.pasos.map((p) => p.id), [9]);
  assert.equal(cx.consultas.length, 2, "dos escalones, dos consultas: ni una mas");
});

test("resolverReceta: sin vinculo solo hay primer escalon", async () => {
  // Un entregable de usuario no nace de un vinculo: no hay edicion a la que subir.
  const cx = conexionDeReceta({});
  const r = await resolverReceta(cx, { accion: "entrega", taskItemId: ENTREGABLE, vinculoId: null });
  assert.deepEqual(r, { origen: null, pasos: [] });
  assert.equal(cx.consultas.length, 1);
});

test("resolverReceta: sin receta en ninguno de los dos escalones, no hay origen", async () => {
  const cx = conexionDeReceta({});
  const r = await resolverReceta(cx, { accion: "firma", taskItemId: ENTREGABLE, vinculoId: VINCULO });
  assert.deepEqual(r, { origen: null, pasos: [] });
});

test("las filas planas se agrupan en pasos con SUS participantes, conservando los dos ordenes", async () => {
  // Es lo que sustituye al JSONB: un paso con tres firmantes llega como tres filas.
  const cx = conexionDeReceta({ delEntregable: [
    { ...filaDePaso({ id: 5, orden: 1, participante: 50 }), participante_orden: 1 },
    { ...filaDePaso({ id: 5, orden: 1, participante: 51 }), participante_orden: 2 },
    { ...filaDePaso({ id: 6, orden: 2, participante: 60 }), participante_orden: 1 },
  ] });
  const r = await resolverReceta(cx, { accion: "firma", taskItemId: ENTREGABLE, vinculoId: VINCULO });
  assert.equal(r.pasos.length, 2, "dos pasos, no tres filas");
  assert.deepEqual(r.pasos[0].participantes.map((p) => p.orden), [1, 2]);
  assert.equal(r.pasos[1].participantes.length, 1);
});
