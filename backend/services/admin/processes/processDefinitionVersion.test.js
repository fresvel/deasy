// Unitarios de `cloneProcessDefinitionChildren`: LO QUE SE LEE SE ESCRIBE.
//
// Por qué existe. El clon de los vínculos copiaba `edicion_id` y `sort_order` y se dejaba
// `item_mode`, que es NOT NULL DEFAULT 'single'. Eso no da error: convierte en `single` —en silencio—
// todo entregable `routed` o `replicated` de la configuración clonada. Y como clonar es lo que hace
// la actualización guiada de plantillas, cada actualización deshacía el modo de emisión. Ocurrió de
// verdad en la base de dev con el Proceso por defecto (vínculo original `routed`, vínculo de la
// configuración ACTIVA `single`).
//
// La caracterización lo ve, pero tarde y de refilón (una clave de `zzzzzz_flow_steps_db`). Aquí se
// mide de frente, sin base de datos: se sustituye la conexión por un doble que registra cada
// sentencia, y se comprueba **columna a columna** lo que sale hacia el INSERT.
//
// LA INVARIANTE, que es lo que de verdad protege: para las tres tablas hijas, **toda columna del
// SELECT aparece en el INSERT**. Esa aserción es genérica: el día que alguien añada una columna a la
// lectura y se olvide de la escritura, este test se pone rojo aunque nadie vuelva a tocarlo.

import assert from "node:assert/strict";
import test from "node:test";
import ProcessDefinitionVersionService from "./processDefinitionVersion.js";

const SOURCE_ID = 1;
const TARGET_ID = 5;
const PROCESS_ID = 42;

// Las columnas de una sentencia, tal como las nombra el propio SQL. Se parsea en vez de mirar solo
// los parámetros a propósito: así se detecta también que alguien añada el valor al array de params
// sin añadir la columna a la lista (o al revés), que es el mismo fallo por el otro lado.
function columnsOf(sql) {
  const insert = /INSERT\s+INTO\s+\w+\s*\(([\s\S]*?)\)\s*VALUES/i.exec(sql);
  const source = insert ? insert[1] : /SELECT([\s\S]*?)\bFROM\b/i.exec(sql)?.[1] ?? "";
  return source
    .split(",")
    .map((piece) => piece.trim())
    .filter(Boolean);
}

// Empareja las columnas nombradas en el INSERT con los valores que se le pasaron.
function insertedRow({ sql, params }) {
  const columns = columnsOf(sql);
  assert.equal(
    columns.length,
    params.length,
    `el INSERT nombra ${columns.length} columnas y pasa ${params.length} valores: ${sql}`
  );
  return Object.fromEntries(columns.map((column, index) => [column, params[index]]));
}

// Doble de conexión: despacha por el texto del SQL y guarda todo lo que pasa por él.
function fakeConnection({ definition, templates = [], rules = [], periodTypes = [] }) {
  const log = { selects: {}, inserts: { templates: [], rules: [], periodTypes: [] } };
  const connection = {
    log,
    async query(sql, params) {
      const text = String(sql);
      if (/^\s*INSERT/i.test(text)) {
        if (text.includes("vinculos")) log.inserts.templates.push({ sql: text, params });
        else if (text.includes("process_target_rules")) log.inserts.rules.push({ sql: text, params });
        else if (text.includes("process_definition_period_types")) log.inserts.periodTypes.push({ sql: text, params });
        else assert.fail(`INSERT inesperado durante el clonado: ${text}`);
        return [{ affectedRows: 1 }];
      }
      if (text.includes("FROM process_definition_versions")) return [definition ? [definition] : []];
      if (text.includes("FROM vinculos")) {
        log.selects.templates = text;
        return [templates];
      }
      if (text.includes("FROM process_target_rules")) {
        log.selects.rules = text;
        return [rules];
      }
      if (text.includes("FROM process_definition_period_types")) {
        log.selects.periodTypes = text;
        return [periodTypes];
      }
      return assert.fail(`consulta inesperada durante el clonado: ${text}`);
    }
  };
  return connection;
}

const DEFINITION = { id: SOURCE_ID, process_id: PROCESS_ID, linea_id: 7, status: "active" };

// Una configuración con LOS TRES modos, para que ninguno pueda colarse por el hueco de otro.
const TEMPLATES = [
  { edicion_id: 10, sort_order: 1, item_mode: "routed" },
  { edicion_id: 20, sort_order: 2, item_mode: "replicated" },
  { edicion_id: 30, sort_order: 3, item_mode: "single" }
];

// DOS COLUMNAS, Y ERAN SIETE. Las cuatro de ámbito —`unit_scope_type`, `unit_id`, `unit_type_id`,
// `cargo_id`— eran copia de la línea y salieron con `P10` (frente 25, 2026-10-14), y con ellas
// `priority`, que sólo aparecía en un `ORDER BY`.
//
// Y el clon era justo donde la copia costaba más: arrastraba el ámbito VERBATIM, así que una
// configuración nueva nacía con el ámbito congelado en el instante del clon aunque su línea hubiera
// cambiado después. Versionar la norma dejaba el reparto en el pasado, sin avisar.
const RULES = [
  {
    position_id: null,
    recipient_policy: "all_matches"
  }
];

const PERIOD_TYPES = [{ term_type_id: 5, is_active: 1 }];

function buildService(fixture = {}) {
  const connection = fakeConnection({
    definition: DEFINITION,
    templates: TEMPLATES,
    rules: RULES,
    periodTypes: PERIOD_TYPES,
    ...fixture
  });
  const service = new ProcessDefinitionVersionService(connection, {
    getByKeys: async () => null,
    syncArtifactWorkflows: async () => {}
  });
  return { service, connection };
}

// --- El defecto que motiva el fichero -------------------------------------------------------------

test("el clon conserva el item_mode de cada vinculo (routed y replicated no caen a single)", async () => {
  const { service, connection } = buildService();

  const result = await service.cloneProcessDefinitionChildren({
    sourceDefinitionId: SOURCE_ID,
    targetDefinitionId: TARGET_ID,
    targetProcessId: PROCESS_ID,
    connection
  });

  assert.equal(result.clonedTemplates, 3);
  const cloned = connection.log.inserts.templates.map(insertedRow);
  assert.deepEqual(
    cloned.map((row) => row.item_mode),
    ["routed", "replicated", "single"],
    "clonar una configuracion NO puede convertir sus entregables en 'single'"
  );
  assert.deepEqual(
    cloned.map((row) => [row.edicion_id, row.sort_order]),
    [[10, 1], [20, 2], [30, 3]],
    "y el resto del vinculo viaja igual que antes"
  );
  for (const row of cloned) {
    assert.equal(row.process_definition_id, TARGET_ID, "el vinculo clonado cuelga de la configuracion destino");
  }
});

test("el remap de plantilla re-apunta el artifact pero NO toca el item_mode", async () => {
  const { service, connection } = buildService();

  await service.cloneProcessDefinitionChildren({
    sourceDefinitionId: SOURCE_ID,
    targetDefinitionId: TARGET_ID,
    targetProcessId: PROCESS_ID,
    // Es lo que hace la actualizacion guiada: pinear la NUEVA version de la plantilla.
    templateRemap: { 10: 99 },
    connection
  });

  const cloned = connection.log.inserts.templates.map(insertedRow);
  assert.equal(cloned[0].edicion_id, 99, "el vinculo remapeado apunta a la version nueva");
  assert.equal(cloned[0].item_mode, "routed", "y sigue siendo routed: el remap cambia la plantilla, no el modo");
  assert.equal(cloned[1].edicion_id, 20, "los no remapeados no se tocan");
});

// --- La invariante generica: todo lo que se lee se escribe ----------------------------------------

const HIJOS = [
  { nombre: "templates", tabla: "vinculos" },
  { nombre: "rules", tabla: "process_target_rules" },
  { nombre: "periodTypes", tabla: "process_definition_period_types" }
];

for (const { nombre, tabla } of HIJOS) {
  test(`clonar ${tabla}: toda columna leida acaba escrita`, async () => {
    const { service, connection } = buildService();

    await service.cloneProcessDefinitionChildren({
      sourceDefinitionId: SOURCE_ID,
      targetDefinitionId: TARGET_ID,
      targetProcessId: PROCESS_ID,
      connection
    });

    const leidas = columnsOf(connection.log.selects[nombre]);
    const escritas = new Set(columnsOf(connection.log.inserts[nombre][0].sql));
    const perdidas = leidas.filter((column) => !escritas.has(column));
    assert.deepEqual(perdidas, [], `${tabla}: columnas que se leen y no se clonan -> ${perdidas.join(", ")}`);
    assert.ok(
      escritas.has("process_definition_id"),
      `${tabla}: el clon tiene que re-apuntar la FK a la configuracion destino`
    );
  });
}

// --- Las reglas y los periodos, columna a columna --------------------------------------------------

test("las reglas de destino se clonan con su afinado, y SIN ambito", async () => {
  const { service, connection } = buildService();

  const result = await service.cloneProcessDefinitionChildren({
    sourceDefinitionId: SOURCE_ID,
    targetDefinitionId: TARGET_ID,
    targetProcessId: PROCESS_ID,
    connection
  });

  assert.equal(result.clonedRules, 1);
  const row = insertedRow(connection.log.inserts.rules[0]);
  assert.deepEqual(row, { process_definition_id: TARGET_ID, ...RULES[0] });
  // El ámbito NO viaja: lo dice la línea de la configuración destino, que es la misma. Si alguna de
  // estas claves reapareciera, el clon volvería a congelar el reparto.
  for (const muerta of ["unit_scope_type", "unit_id", "unit_type_id", "cargo_id", "priority"]) {
    assert.equal(muerta in row, false, `el clon no debe escribir ${muerta}`);
  }
});

test("los tipos de periodo se clonan enteros", async () => {
  const { service, connection } = buildService();

  const result = await service.cloneProcessDefinitionChildren({
    sourceDefinitionId: SOURCE_ID,
    targetDefinitionId: TARGET_ID,
    targetProcessId: PROCESS_ID,
    connection
  });

  assert.equal(result.clonedPeriodTypes, 1);
  assert.deepEqual(insertedRow(connection.log.inserts.periodTypes[0]), {
    process_definition_id: TARGET_ID,
    ...PERIOD_TYPES[0]
  });
});

// --- Guardas, que ya existian y no deben moverse ---------------------------------------------------

test("sin origen o sin destino no se clona nada", async () => {
  const { service, connection } = buildService();
  const result = await service.cloneProcessDefinitionChildren({
    sourceDefinitionId: 0,
    targetDefinitionId: TARGET_ID,
    connection
  });
  assert.deepEqual(result, { clonedTemplates: 0, clonedRules: 0, clonedPeriodTypes: 0 });
  assert.deepEqual(connection.log.inserts.templates, []);
});

test("no se puede clonar desde una configuracion de OTRO proceso", async () => {
  const { service, connection } = buildService();
  await assert.rejects(
    service.cloneProcessDefinitionChildren({
      sourceDefinitionId: SOURCE_ID,
      targetDefinitionId: TARGET_ID,
      targetProcessId: PROCESS_ID + 1,
      connection
    }),
    /mismo proceso/
  );
});

test("una configuracion origen inexistente falla en vez de clonar en vacio", async () => {
  const { service, connection } = buildService({ definition: null });
  await assert.rejects(
    service.cloneProcessDefinitionChildren({
      sourceDefinitionId: SOURCE_ID,
      targetDefinitionId: TARGET_ID,
      connection
    }),
    /no existe/
  );
});


// ================================================================================================
// EL GUARDIA DEL PROCESO POR DEFECTO, QUE ESTUVO APAGADO SIN QUE NADA LO DIJERA
//
// `ensureDefaultProcessSingleLinea` impone que el proceso por defecto (slug 'default') solo admita
// la linea «sin variacion»: cualquier cargo, todas las unidades. Se puede versionar, pero no tener
// otra linea por cargo o por alcance.
//
// Por que existe este bloque. El guardia recibia `(processId, linea)` y el llamador le pasaba
// `ctx.payload.process_id`. `P22` quito `process_id` del catalogo de la tabla, y `pickPayload` solo
// copia campos declarados: desde ese dia llegaba `undefined` y la primera linea del cuerpo
// --`if (!processId) return`-- lo devolvia sin comprobar nada. La regla dejo de imponerse EN
// SILENCIO, y ningun test lo cubria: este fichero no nombraba la funcion.
//
// No es un caso hipotetico: es la misma forma del fallo que mato a `P22` --un parametro que nombra
// una columna retirada-- sobreviviendo en el llamador. Y la leccion generalizable es que un guardia
// que empieza aceptando la ausencia de su dato NO AVISA cuando se queda sin el: se apaga.
//
// Hoy el proceso lo trae LA LINEA, que es quien lo sabe. Los dos primeros casos son la regla; el
// tercero es el que habria puesto esto en rojo durante las dos semanas en que no comprobaba nada.
function procesoConSlug(slug) {
  return {
    async query(sql, params) {
      const text = String(sql);
      if (text.includes("FROM processes")) {
        assert.deepEqual(params, [9], "el proceso se consulta por el id que trae la LINEA");
        return [[{ slug }]];
      }
      return assert.fail(`consulta inesperada: ${text}`);
    }
  };
}

const SIN_VARIACION = { id: 3, process_id: 9, cargo_id: null, unit_scope_type: "all_units" };

test("el proceso por defecto admite la linea sin variacion", async () => {
  const service = new ProcessDefinitionVersionService(procesoConSlug("default"));
  await service.ensureDefaultProcessSingleLinea(SIN_VARIACION);
});

test("el proceso por defecto rechaza una linea con cargo o con alcance", async () => {
  const service = new ProcessDefinitionVersionService(procesoConSlug("default"));
  await assert.rejects(
    () => service.ensureDefaultProcessSingleLinea({ ...SIN_VARIACION, cargo_id: 4 }),
    /solo admite la linea/
  );
  await assert.rejects(
    () => service.ensureDefaultProcessSingleLinea({ ...SIN_VARIACION, unit_scope_type: "unit_type" }),
    /solo admite la linea/
  );
});

test("cualquier OTRO proceso admite las lineas que quiera", async () => {
  const service = new ProcessDefinitionVersionService(procesoConSlug("informe-gestion-docente"));
  await service.ensureDefaultProcessSingleLinea({ ...SIN_VARIACION, cargo_id: 4, unit_scope_type: "unit_type" });
});

// EL CASO QUE ESTABA EN SILENCIO. Una linea sin proceso no es «no compruebes»: es un dato que falta,
// y el guardia tiene que decirlo en vez de dejar pasar la fila.
test("una linea sin proceso NO desactiva el guardia: lo hace fallar", async () => {
  const service = new ProcessDefinitionVersionService({
    async query() {
      return assert.fail("no se debe consultar el proceso si la linea no dice cual es");
    }
  });
  await assert.rejects(
    () => service.ensureDefaultProcessSingleLinea({ id: 3, cargo_id: 4, unit_scope_type: "unit_type" }),
    /no dice de que proceso es/
  );
});
