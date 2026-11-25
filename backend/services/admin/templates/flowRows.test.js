// Tests unitarios de la RECETA AUTORADA de una plantilla: escribirla, preguntar si hay, leerla para
// el editor y copiarla a una versión nueva.
//
// ── DE 31 CASOS A 13, Y LO QUE SE FUE NO ERA RUIDO ──────────────────────────────────────────────
//
// Este fichero tenía 792 líneas, y la mitad vigilaba LA FORMA DE LA CABECERA. No era paranoia: el
// resolvedor buscaba `edicion_id = X AND task_item_id IS NULL AND is_active = 1`, así que una
// cabecera escrita con el portador equivocado dejaba el flujo escrito y **sin lector** — y eso no da
// error en ningún sitio, sólo un entregable que no arranca. Trece casos sobre eso.
//
// Las cabeceras se retiraron en el paso 4 de la fase 4 del frente 24, y con ellas:
//
//   · los dos escritores de pasos y sus 14 y 19 columnas (4 casos);
//   · buscar, crear, reutilizar, reactivar y desactivar una cabecera (6 casos);
//   · que la búsqueda excluyera el portador de runtime y el muerto (3 casos);
//   · y los DOS lectores de copia, que existían porque la proyección al editor pierde columnas y una
//     copia no puede perder ninguna (3 casos).
//
// Lo que NO se fue, porque no dependía de las cabeceras, está todo aquí: el gate que propaga el error
// de base en vez de traducirlo a «no define flujo», el ámbito que sólo se emite para el cargo, las
// dos banderas `required` sin columna, y que la copia arrastre la fila entera.
import test from "node:test";
import assert from "node:assert/strict";

import {
  copyAuthoredFlowToArtifact,
  hasFillStepsForArtifact,
  readAuthoredFlowForArtifact,
  replaceAuthoredFlowForArtifact,
} from "./flowRows.js";

const EDICION = 42;
const HIJA = 77;

// Doble de conexión que REGISTRA cada sentencia con sus parámetros y responde a los SELECT con lo
// que se le dé. `recetas` va por `${edicion}:${accion}` y devuelve filas PLANAS, que es lo que la
// consulta real entrega: un paso con tres participantes son tres filas.
const conexionDe = ({ recetas = {} } = {}) => {
  const calls = [];
  let nextInsertId = 900;
  return {
    calls,
    query: async (sql, params = []) => {
      const limpio = sql.replace(/\s+/g, " ").trim();
      calls.push({ sql: limpio, params });
      if (/^SELECT EXISTS/i.test(limpio)) {
        const filas = recetas[`${params[0]}:${params[1]}`] || [];
        return [[{ hay: filas.length ? 1 : 0 }]];
      }
      if (/^SELECT p\.id, p\.orden/i.test(limpio)) {
        return [recetas[`${params[0]}:${params[1]}`] || []];
      }
      if (/^INSERT INTO/i.test(limpio)) {
        nextInsertId += 1;
        return [{ insertId: nextInsertId, affectedRows: 1 }];
      }
      return [{ affectedRows: 1 }];
    },
  };
};

// Una fila plana de la receta, tal y como la devuelve `leerRecetaDeEdicion`.
const fila = (extra = {}) => ({
  id: 1, orden: 1, code: null, nombre: "Paso",
  participante_id: 10, participante_orden: 1,
  resolver_type: "task_assignee", persona_id: null, cargo_id: null,
  unit_scope_type: "unit_exact", unit_id: null, slot: null,
  ...extra,
});

// La forma que entrega `normalizeFillSteps` / `normalizeSignatureSteps`.
const fillStep = (extra = {}) => ({
  stepOrder: 1, code: "owner_fill", name: "Entrega del responsable",
  resolverType: "task_assignee", assignedPersonId: null,
  unitScopeType: "unit_exact", unitId: null, cargoId: null,
  ...extra,
});

const signatureStep = (extra = {}) => ({
  stepOrder: 1, code: "firma_1", name: "Firma 1", slot: "firma_1",
  resolverType: "cargo_in_scope", assignedPersonId: null,
  unitScopeType: "context_exact", unitId: null, requiredCargoId: 2,
  signers: [],
  ...extra,
});

// --- Escritura ----------------------------------------------------------------------------------

test("escribir la receta borra la de ESA accion y ese origen antes de insertar, y hace las dos", async () => {
  const cx = conexionDe();
  await replaceAuthoredFlowForArtifact(cx, {
    artifactId: EDICION,
    fillSteps: [fillStep()],
    signatureSteps: [signatureStep()],
  });

  const borrados = cx.calls.filter((c) => c.sql.startsWith("DELETE"));
  assert.equal(borrados.length, 2, "una por accion: la receta es una declaracion entera");
  assert.deepEqual(borrados.map((c) => c.params), [[EDICION, "entrega"], [EDICION, "firma"]]);

  // Y cada lado escribe su paso con su participante.
  const pasos = cx.calls.filter((c) => c.sql.startsWith("INSERT INTO pasos_declarados"));
  const partes = cx.calls.filter((c) => c.sql.startsWith("INSERT INTO participantes_declarados"));
  assert.equal(pasos.length, 2);
  assert.equal(partes.length, 2);
});

test("el paso lleva su ORIGEN y su ACCION, y el nombre que el autor le puso", async () => {
  const cx = conexionDe();
  await replaceAuthoredFlowForArtifact(cx, {
    artifactId: EDICION,
    fillSteps: [fillStep({ stepOrder: 2, code: "revision", name: "Revisión" })],
  });
  const paso = cx.calls.find((c) => c.sql.startsWith("INSERT INTO pasos_declarados"));
  assert.match(paso.sql, /INSERT INTO pasos_declarados \(accion, edicion_id, orden, code, nombre\)/);
  assert.deepEqual(paso.params, ["entrega", EDICION, 2, "revision", "Revisión"]);
});

test("una receta vacia de un lado solo BORRA: quitar los pasos es la forma de quitar el flujo", async () => {
  // Antes esto DESACTIVABA la cabecera sin borrarla, y «desactivada» significaba «el autor lo
  // quito». Sin cabecera, cero pasos dice exactamente lo mismo y no deja fila fantasma.
  const cx = conexionDe();
  await replaceAuthoredFlowForArtifact(cx, { artifactId: EDICION, fillSteps: [], signatureSteps: [] });
  assert.equal(cx.calls.filter((c) => c.sql.startsWith("DELETE")).length, 2);
  assert.equal(cx.calls.filter((c) => c.sql.startsWith("INSERT")).length, 0);
});

test("sin id de edicion se falla en vez de escribir una receta huerfana", async () => {
  const cx = conexionDe();
  await assert.rejects(
    () => replaceAuthoredFlowForArtifact(cx, { fillSteps: [fillStep()] }),
    /requiere el id de la edicion/
  );
  assert.equal(cx.calls.length, 0, "ni una consulta");
});

// --- El gate de publicacion ---------------------------------------------------------------------

test("el gate pregunta por los pasos de ENTREGA de esa edicion, y nada mas", async () => {
  const cx = conexionDe({ recetas: { [`${EDICION}:entrega`]: [fila()] } });
  assert.equal(await hasFillStepsForArtifact(cx, EDICION), true);
  assert.equal(cx.calls.length, 1);
  assert.deepEqual(cx.calls[0].params, [EDICION, "entrega"]);
});

test("sin pasos el gate dice que no, y sin id ni consulta a la base", async () => {
  assert.equal(await hasFillStepsForArtifact(conexionDe(), EDICION), false);
  const cx = conexionDe();
  assert.equal(await hasFillStepsForArtifact(cx, 0), false);
  assert.equal(cx.calls.length, 0);
});

test("un error de la base SUBE: no se traduce en 'no define flujo'", async () => {
  // EL CASO QUE JUSTIFICA ESTE FICHERO. Los cuatro gates de publicacion leian el `meta.yaml` de
  // MinIO envueltos en un `catch {}` mudo que convertia CUALQUIER fallo --MinIO caido, objeto
  // ausente, YAML ilegible-- en «esta plantilla no define flujo de entrega», y bloqueaba la
  // publicacion por una razon falsa. Aqui no hay catch, y este test es lo que lo mantiene.
  const cx = { query: async () => { throw new Error("se cayo la base"); } };
  await assert.rejects(() => hasFillStepsForArtifact(cx, EDICION), /se cayo la base/);
});

// --- El lector del editor -----------------------------------------------------------------------

test("un resolutor que no es por cargo vuelve SIN ambito, aunque la fila lo lleve", async () => {
  // MEDIDO con un experimento desechable sobre la base de dev: volcar la columna tal cual mueve
  // `unit_scope_type` en TODO paso cuyo resolutor no sea por cargo, porque el escritor guarda ahi su
  // valor por defecto aunque el ambito NO SIGNIFIQUE NADA para ese resolutor. `buildStepResolver`
  // solo lo emite para el cargo, y esto es su inversa.
  const cx = conexionDe({
    recetas: { [`${EDICION}:entrega`]: [fila({ resolver_type: "task_assignee", unit_scope_type: "unit_exact", unit_id: 8 })] },
  });
  const { fill } = await readAuthoredFlowForArtifact(cx, EDICION);
  assert.deepEqual(fill.steps[0].resolver, { type: "task_assignee" });
});

test("un paso por cargo vuelve con su cargo, su ambito y su unidad", async () => {
  const cx = conexionDe({
    recetas: {
      [`${EDICION}:entrega`]: [fila({
        resolver_type: "cargo_in_scope", cargo_id: 7, unit_scope_type: "unit_exact", unit_id: 8,
      })],
    },
  });
  const { fill } = await readAuthoredFlowForArtifact(cx, EDICION);
  assert.deepEqual(fill.steps[0].resolver, {
    type: "cargo_in_scope", cargo_id: 7, unit_scope_type: "unit_exact", unit_id: 8,
  });
});

test("un paso de firma con TRES firmantes vuelve con tres resolutores, y el hueco del primero", async () => {
  // Es lo que sustituye al JSONB `signers`: tres filas en vez de un array sin validar. Y el `slot`
  // del documento es el del PRIMER firmante, que por construccion es el que tenia el paso.
  const cx = conexionDe({
    recetas: {
      [`${EDICION}:firma`]: [
        fila({ id: 5, code: "firma_1", nombre: "Firma 1", participante_id: 50, participante_orden: 1,
               resolver_type: "cargo_in_scope", cargo_id: 7, unit_scope_type: "context_exact", slot: "firma_1" }),
        fila({ id: 5, code: "firma_1", nombre: "Firma 1", participante_id: 51, participante_orden: 2,
               resolver_type: "specific_person", persona_id: 31, slot: "firma_1_2" }),
        fila({ id: 5, code: "firma_1", nombre: "Firma 1", participante_id: 52, participante_orden: 3,
               resolver_type: "specific_person", persona_id: 48, slot: "firma_1_3" }),
      ],
    },
  });
  const { signatures } = await readAuthoredFlowForArtifact(cx, EDICION);
  assert.equal(signatures.steps.length, 1, "un paso, no tres");
  assert.equal(signatures.steps[0].slot, "firma_1");
  assert.deepEqual(signatures.steps[0].signers, [
    { type: "cargo_in_scope", cargo_id: 7, unit_scope_type: "context_exact" },
    { type: "specific_person", person_id: 31 },
    { type: "specific_person", person_id: 48 },
  ]);
  // El cupo se retiro y queda un valor, que SIGUE viajando porque es el contrato del editor.
  assert.equal(signatures.steps[0].approval_mode, "and");
});

test("las dos banderas 'required' se derivan sin columna: entrega SIEMPRE, firma si hay pasos", async () => {
  const conFirma = conexionDe({ recetas: { [`${EDICION}:firma`]: [fila({ slot: "firma_1" })] } });
  const r1 = await readAuthoredFlowForArtifact(conFirma, EDICION);
  assert.equal(r1.fill.required, true, "entrega siempre, incluso sin pasos");
  assert.equal(r1.signatures.required, true);

  const sinFirma = conexionDe({ recetas: { [`${EDICION}:entrega`]: [fila()] } });
  const r2 = await readAuthoredFlowForArtifact(sinFirma, EDICION);
  assert.equal(r2.fill.required, true);
  assert.equal(r2.signatures.required, false, "sin pasos de firma, el lado no esta declarado");
});

test("sin id no se consulta la base, y un error de la base SUBE", async () => {
  const cx = conexionDe();
  assert.deepEqual(await readAuthoredFlowForArtifact(cx, 0), {
    fill: { required: true, steps: [] },
    signatures: { required: false, steps: [] },
  });
  assert.equal(cx.calls.length, 0);

  const roto = { query: async () => { throw new Error("se cayo la base"); } };
  await assert.rejects(() => readAuthoredFlowForArtifact(roto, EDICION), /se cayo la base/);
});

// --- La copia al versionar ----------------------------------------------------------------------

test("versionar copia las DOS acciones a la hija, colgadas de SU edicion y fila a fila", async () => {
  const cx = conexionDe({
    recetas: {
      [`${EDICION}:entrega`]: [fila({ resolver_type: "cargo_in_scope", cargo_id: 7, unit_id: 8 })],
      [`${EDICION}:firma`]: [fila({ id: 5, code: "firma_1", slot: "firma_1", persona_id: 31, resolver_type: "specific_person" })],
    },
  });
  await copyAuthoredFlowToArtifact(cx, { sourceArtifactId: EDICION, targetArtifactId: HIJA });

  // Se lee del padre y se escribe en la HIJA: si se escribiera en el padre, la version nueva naceria
  // sin receta y publicarla responderia 400.
  assert.deepEqual(
    cx.calls.filter((c) => c.sql.startsWith("DELETE")).map((c) => c.params),
    [[HIJA, "entrega"], [HIJA, "firma"]]
  );

  // Y ARRASTRA LA FILA ENTERA. Antes esto necesitaba DOS lectores --el del editor pierde columnas y
  // una copia no puede perder ninguna--; hoy se leen filas y se escriben filas.
  const partes = cx.calls.filter((c) => c.sql.startsWith("INSERT INTO participantes_declarados"));
  assert.equal(partes.length, 2);
  assert.deepEqual(partes[0].params.slice(1), [1, "cargo_in_scope", null, 7, "unit_exact", 8, null]);
  assert.deepEqual(partes[1].params.slice(1), [1, "specific_person", 31, null, "unit_exact", null, "firma_1"]);
});

test("un padre SIN receta no le escribe a la hija ningun paso, solo limpia", async () => {
  const cx = conexionDe();
  await copyAuthoredFlowToArtifact(cx, { sourceArtifactId: EDICION, targetArtifactId: HIJA });
  assert.equal(cx.calls.filter((c) => c.sql.startsWith("INSERT")).length, 0);
});

test("copiar exige los DOS ids y no toca la base sin ellos", async () => {
  const cx = conexionDe();
  for (const args of [{ sourceArtifactId: EDICION }, { targetArtifactId: HIJA }, {}]) {
    await assert.rejects(() => copyAuthoredFlowToArtifact(cx, args), /requiere el id de origen y el de destino/);
  }
  assert.equal(cx.calls.length, 0);
});
