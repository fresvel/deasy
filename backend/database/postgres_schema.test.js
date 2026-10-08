// Tests unitarios del ESQUEMA. Vigilan lo que `node --check`, `check:imports` y el arranque no ven:
// el SQL es una cadena de texto hasta que alguien la ejecuta.
//
// Cinco bloques:
//   0. EL CONTRATO DEL FICHERO: describe la forma, NO converge bases anteriores (`TD7-s`).
//   1. `ediciones.lifecycle_state` nace SIN PUBLICAR (defecto 1.13).
//   2. El portador `edicion_id` de las dos cabeceras de flujo (frente 0.8, sub-paso 1).
//   3. `code` y `name` en los PASOS de entrega, la simetria que le faltaba a `fill_flow_steps`
//      respecto de `signature_flow_steps` (frente 0.8, sub-paso 1-bis).
//   4. LO QUE EL FRENTE 23 RETIRO, en negativo: que no vuelva, y el catalogo que lo sustituye.
//
// --- BLOQUE 1 -------------------------------------------------------------------------------------
//
// Por que un test sobre el TEXTO del esquema y no sobre la base: el defecto no tiene disparador vivo
// —los cuatro `INSERT INTO ediciones` del repo fijan `lifecycle_state` explicitamente y el
// CRUD generico ni llega al INSERT, porque `tableHooks.ediciones.beforeCreate()` lanza
// siempre—, asi que no hay ruta HTTP que lo ejercite y ningun golden puede vigilarlo. Lo que si se
// puede romper en silencio es el PAR que hace efectivo el arreglo, y eso es lo que se fija aqui:
//
//   1. el DEFAULT de la definicion de la tabla, para bases nuevas; y
//   2. el `ALTER TABLE ... SET DEFAULT`, para las que YA existen.
//
// Hacen falta LOS DOS. `postgres_schema.sql` se reaplica en cada arranque, pero
// `CREATE TABLE IF NOT EXISTS` no toca una tabla que ya existe: sin el ALTER, cada base desplegada
// seguiria pariendo filas `published`. Y sin el DEFAULT de la definicion, el ALTER seria un parche
// que contradice el esquema que dice ser la fuente de verdad.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";


// ⚠️ SE QUITA EL ESQUEMA DEL NOMBRE AL LEER. Desde el 2026-10-04 cada tabla vive en el esquema de su
// tema, asi que el fichero dice 'CREATE TABLE IF NOT EXISTS plantillas.ediciones'. Estas
// pruebas van sobre LA FORMA de la tabla --sus columnas, sus CHECK, sus claves-- y no sobre donde
// vive; normalizar aqui, una vez, evita tocar los once sitios que la buscan por su nombre. Que cada
// tabla este en el esquema de su tema lo comprueba 'scripts/docs/check-mapa-tablas.mjs'.
const sinEsquema = (texto) => texto.replace(/CREATE TABLE IF NOT EXISTS \w+\./g, "CREATE TABLE IF NOT EXISTS ");
const SCHEMA = sinEsquema(
  fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "postgres_schema.sql"),
  "utf8"
)
);

// --- BLOQUE 0 -------------------------------------------------------------------------------------
//
// EL CONTRATO DEL FICHERO (`TD7-s`, 2026-08-24, decision del dueno). `postgres_schema.sql` DESCRIBE
// la forma y nada mas: cada columna, cada CHECK y cada clave se declara UNA sola vez, dentro de su
// `CREATE TABLE`. Una base con forma vieja no se pone al dia sola — se recrea.
//
// POR QUE ES UN TEST Y NO UNA NOTA. Antes el fichero hacia los dos trabajos, y el precio fue que la
// MISMA columna quedo declarada dos veces y en CONTRADICCION: `persons.token` decia
// `VARCHAR(10) NOT NULL UNIQUE` en su tabla y `VARCHAR(10) NULL` en su ALTER. Nadie lo vio porque
// sobre una base recien creada el ALTER es un no-op y todo sale verde. Esta puerta lo caza.
//
// Los `CREATE INDEX` / `CREATE UNIQUE INDEX` NO cuentan: un indice es siempre una sentencia aparte,
// no una segunda declaracion de la columna.
const SENTENCIAS_DE_MIGRACION = [
  [/^\s*ALTER TABLE /m, "ALTER TABLE"],
  [/ADD COLUMN IF NOT EXISTS/, "ADD COLUMN IF NOT EXISTS"],
  [/^\s*ALTER COLUMN /m, "ALTER COLUMN"],
  [/^\s*DROP COLUMN IF EXISTS/m, "DROP COLUMN IF EXISTS"],
  [/^UPDATE /m, "UPDATE de relleno"],
  [/^DO \$\$/m, "bloque DO $$"],
];

// Los comentarios se juzgan aparte: un `-- ALTER TABLE ...` dentro de una nota no ejecuta nada, pero
// tampoco puede quedarse describiendo un mecanismo que ya no existe.
const SIN_COMENTARIOS = SCHEMA.split("\n")
  .filter((linea) => !linea.trim().startsWith("--"))
  .join("\n");

for (const [patron, nombre] of SENTENCIAS_DE_MIGRACION) {
  test(`el esquema no contiene ${nombre}: describe la forma, no converge una base anterior`, () => {
    assert.doesNotMatch(
      SIN_COMENTARIOS,
      patron,
      "una columna se declara UNA vez, en su CREATE TABLE. Si hace falta cambiarla, se recrea la base"
    );
  });
}

test("persons.token se declara una sola vez", () => {
  const declaraciones = SIN_COMENTARIOS.split("\n").filter((linea) =>
    /^\s*token VARCHAR\(10\)/.test(linea)
  );
  assert.equal(declaraciones.length, 1, "estuvo declarada dos veces y en contradiccion (TD7-s)");
  assert.match(declaraciones[0], /NOT NULL UNIQUE/);
});

// Solo el bloque `CREATE TABLE ... ediciones (...)`, para no confundirlo con otras tablas.
const createTemplateArtifacts = SCHEMA.slice(
  SCHEMA.indexOf("CREATE TABLE IF NOT EXISTS ediciones")
).split(");")[0];

test("la definicion de ediciones declara lifecycle_state con DEFAULT 'draft'", () => {
  const columna = createTemplateArtifacts
    .split("\n")
    .find((linea) => linea.trim().startsWith("lifecycle_state"));
  assert.ok(columna, "la columna lifecycle_state debe existir en la definicion de la tabla");
  assert.match(columna, /NOT NULL DEFAULT 'draft'/);
});

test("el DEFAULT inseguro no vuelve por la puerta de atras", () => {
  assert.doesNotMatch(
    createTemplateArtifacts,
    /lifecycle_state[^\n]*DEFAULT 'published'/,
    "lo que nace, nace sin publicar: el default seguro es el que falla cerrado"
  );
});

// El CHECK sigue admitiendo los tres estados: bajar el default no estrecha el dominio.
test("lifecycle_state sigue admitiendo draft, published y retired", () => {
  assert.match(
    createTemplateArtifacts,
    /lifecycle_state TEXT CHECK \(lifecycle_state IN \('draft','published','retired'\)\)/
  );
});

// --- BLOQUE 2 -------------------------------------------------------------------------------------
//
// El sitio donde vivira el flujo autorado de una plantilla (frente 0.8, sub-paso 1). Hoy es un CAJON
// VACIO: nadie escribe la columna y nadie la lee, asi que NINGUN golden puede vigilarla y ninguna ruta
// HTTP la ejercita. Lo unico que se puede romper en silencio es el esquema mismo, y son dos piezas:
//
//   1. la definicion de la tabla —columna, nulabilidad y FK—, que desde `TD7-s` es la UNICA; y
//   2. el ORDEN: el `CREATE INDEX` va DESPUES de la tabla. Al reves el arranque muere con
//      «relation does not exist» (precedentes 673f1fb, 8f9f1ad, 99fc7c7, 38c2b56).
//
// Lo que aqui NO hay, a proposito, es un CHECK de "exactamente un portador": las filas de runtime
// llevan HOY `vinculo_id` y `task_item_id` a la vez (`generation/documents.js:248`
// y `:278`), asi que los tres portadores no son excluyentes y ese CHECK seria falso el dia uno.

const bloqueCreate = (tabla) =>
  SCHEMA.slice(SCHEMA.indexOf(`CREATE TABLE IF NOT EXISTS ${tabla} (`)).split(");")[0];

for (const tabla of ["fill_flow_templates", "signature_flow_templates"]) {
  const create = bloqueCreate(tabla);

  test(`${tabla}: la definicion declara edicion_id nulable`, () => {
    const columna = create.split("\n").find((linea) => linea.trim().startsWith("edicion_id"));
    assert.ok(columna, "la columna debe existir en la definicion de la tabla");
    assert.match(columna, /edicion_id INT NULL,/);
  });

  test(`${tabla}: la FK del portador apunta a ediciones(id)`, () => {
    assert.match(
      create,
      new RegExp(
        `CONSTRAINT fk_${tabla}_artifact FOREIGN KEY \\(edicion_id\\) REFERENCES ediciones\\(id\\)`
      )
    );
  });

  test(`${tabla}: vinculo_id ya no es NOT NULL en la definicion`, () => {
    const columna = create
      .split("\n")
      .find((linea) => linea.trim().startsWith("vinculo_id"));
    assert.ok(columna, "la columna del portador por vinculo debe seguir existiendo");
    assert.match(columna, /vinculo_id INT NULL,/);
    assert.doesNotMatch(
      columna,
      /NOT NULL/,
      "el vinculo deja de ser obligatorio: una cabecera puede colgar del entregable"
    );
  });

  test(`${tabla}: el indice del portador se crea DESPUES de la tabla que lo sostiene`, () => {
    const tablaPos = SCHEMA.indexOf(`CREATE TABLE IF NOT EXISTS ${tabla} (`);
    const indice = SCHEMA.indexOf(
      `CREATE INDEX IF NOT EXISTS idx_${tabla}_artifact ON ${tabla} (edicion_id);`
    );
    assert.ok(tablaPos > 0, "debe existir la definicion de la tabla");
    assert.ok(indice > 0, "debe existir el indice del portador");
    assert.ok(
      indice > tablaPos,
      "un indice es una sentencia aparte: colocarlo antes de su tabla tumba el arranque"
    );
  });
}

// --- BLOQUE 3 -------------------------------------------------------------------------------------
//
// La SIMETRIA de los pasos (frente 0.8, sub-paso 1-bis). `fill_flow_steps` y `signature_flow_steps`
// son dos tablas espejo del mismo concepto —un paso de un flujo autorado— y la de entrega habia
// perdido dos columnas por el camino: `code` y `name`. El formulario deja escribir el nombre de cada
// paso de entrega (`AdminDraftArtifactModal.vue:327`), `buildWorkflowsYaml` lo emite
// (`workflows.js:167-168`) y el editor lo lee de vuelta (`templateArtifact.js:135-136`) — pero HOY ese
// texto solo vive dentro del `meta.yaml` de MinIO. Invertir la direccion del flujo sin estas columnas
// perderia el nombre de todos los pasos de entrega; eso es lo que destapo el primer intento del
// sub-paso 3.
//
// Igual que el bloque 2, aqui es un CAJON VACIO: nadie las escribe y nadie las lee todavia, asi que
// ningun golden puede vigilarlas y ninguna ruta HTTP las ejercita. Lo unico que se puede romper en
// silencio es el esquema, y desde `TD7-s` la pieza es UNA: la definicion de la tabla. La base se
// recrea (`test:char:run` ya lo hace en cada corrida), asi que no hay una segunda forma que mantener.
//
// El tipo NO es libre: se copia el de la gemela de firma (`code VARCHAR(120)`, `name VARCHAR(180)`).
// Si alguien las declara mas cortas, el mismo paso cabria en un lado y no en el otro.

const createFillSteps = SCHEMA.slice(SCHEMA.indexOf("CREATE TABLE IF NOT EXISTS fill_flow_steps (")).split(");")[0];
const createSignatureSteps = SCHEMA.slice(
  SCHEMA.indexOf("CREATE TABLE IF NOT EXISTS signature_flow_steps (")
).split(");")[0];

const declaracion = (create, columna) =>
  (create.split("\n").find((linea) => linea.trim().startsWith(`${columna} `)) || "").trim();

for (const columna of ["code", "name"]) {
  test(`fill_flow_steps: la definicion declara ${columna} con el MISMO tipo que signature_flow_steps`, () => {
    const entrega = declaracion(createFillSteps, columna);
    const firma = declaracion(createSignatureSteps, columna);
    assert.ok(firma, `la gemela de firma debe seguir declarando ${columna}`);
    assert.ok(entrega, `fill_flow_steps debe declarar ${columna}`);
    assert.equal(entrega, firma, "mismo concepto, mismo tipo: dos tablas espejo");
  });

  test(`fill_flow_steps: ${columna} nace NULL, sin DEFAULT`, () => {
    const entrega = declaracion(createFillSteps, columna);
    // Nulable a proposito: en este sub-paso nadie escribe la columna todavia, y su gemela de firma
    // tambien la declara NULL. Mismo concepto, misma nulabilidad.
    assert.match(entrega, new RegExp(`^${columna} VARCHAR\\(\\d+\\) NULL,$`));
    assert.doesNotMatch(entrega, /DEFAULT/);
  });
}

test("fill_flow_steps: no se indexa code ni name — son descriptivas, no de busqueda", () => {
  // La decision, escrita para que no se cuele un indice por inercia: un paso se localiza por
  // (fill_flow_template_id, step_order), que ya tiene su indice unico, y nadie filtra por el nombre de
  // un paso. La gemela de firma tampoco los indexa: sus cinco indices son de clave ajena.
  const indices = SCHEMA.split("\n").filter(
    (linea) => linea.startsWith("CREATE") && linea.includes("INDEX") && linea.includes("ON fill_flow_steps (")
  );
  assert.deepEqual(indices, [
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_fill_flow_steps ON fill_flow_steps (fill_flow_template_id, step_order);",
  ]);
});

// --- BLOQUE 4: lo que el frente 23 RETIRO, y que no debe volver por inercia --------------------
//
// Aqui vivian ocho pruebas sobre `template_artifact_fields` (frente 0.4, sub-paso S6): su portador,
// el CHECK de los nueve `ui_component`, `field_order`, `field_code`, el unico por `data_key` y el
// orden de sus dos `CREATE INDEX`. La tabla se retiro en el frente 23 (F4.1) porque su unico lector
// era el codigo que la copiaba a la version siguiente, asi que sus pruebas se van con ella.
//
// Lo que queda es la puerta inversa: que lo retirado SIGA retirado. Es el mismo tipo de prueba que
// las de arriba —el SQL es texto hasta que alguien lo ejecuta— aplicada en negativo, y hace falta
// porque un `CREATE TABLE IF NOT EXISTS` reintroducido no rompe nada visible: arranca, y la tabla
// vuelve a existir vacia para copiarse a si misma.

// ⚠️ ESTAS PRUEBAS MIRAN EL SQL, NO EL FICHERO, y por eso reusan el `SIN_COMENTARIOS` del bloque 0.
// El esquema lleva, donde estaba cada cosa retirada, la explicacion de por que se fue —y esa
// explicacion NOMBRA lo retirado, como debe—. Un `doesNotMatch` sobre el texto crudo fallaria por el
// epitafio, que es justo lo que hay que conservar.

test("no vuelve `template_artifact_fields`: su unico lector era el que la copiaba", () => {
  assert.doesNotMatch(SIN_COMENTARIOS, /template_artifact_fields/);
});

test("no vuelve `ediciones.schema_object_key`: era base_object_prefix + schema.json", () => {
  // Se deriva al leer. Una columna para un valor derivable es una tercera forma de decir lo mismo.
  assert.doesNotMatch(SIN_COMENTARIOS, /schema_object_key/);
});

test("no vuelve `template_seeds`: la tabla sigue, con otro nombre y otro significado", () => {
  assert.doesNotMatch(SIN_COMENTARIOS, /template_seeds/);
});

test("`generadores_de_documento` es el catalogo, y su `tipo` es un CHECK y no texto libre", () => {
  // Era `template_seeds.seed_type VARCHAR(40)`. El catalogo nuevo no admite un tipo inventado.
  const create = SCHEMA.slice(
    SCHEMA.indexOf("CREATE TABLE IF NOT EXISTS generadores_de_documento")
  ).split(");")[0];
  assert.ok(create.includes("generadores_de_documento"), "la tabla debe existir");
  const tipos = create.match(/tipo IN \(([^)]+)\)/);
  assert.ok(tipos, "tipo debe llevar su CHECK");
  assert.deepEqual(
    tipos[1].split(",").map((v) => v.trim().replace(/'/g, "")),
    ["latex", "servicio"]
  );
});

test("`source_path` y `destino` son las dos mitades excluyentes, y las dos son NULL", () => {
  // Un generador `latex` trae paquete y no llama a nadie; uno `servicio`, al contrario. Ninguna de
  // las dos puede ser obligatoria sin romper la otra mitad del catalogo.
  const create = SCHEMA.slice(
    SCHEMA.indexOf("CREATE TABLE IF NOT EXISTS generadores_de_documento")
  ).split(");")[0];
  for (const columna of ["source_path", "destino"]) {
    const linea = create.split("\n").find((l) => l.trim().startsWith(columna));
    assert.ok(linea, `${columna} debe existir`);
    assert.doesNotMatch(linea, /NOT NULL/);
  }
});

test("quien produce el PDF lo declara la EDICION, y apunta al catalogo", () => {
  // Estaba en `catalogo_documental.template_seed_id`. Se movio, no se duplico: la columna vieja no vuelve.
  const create = SCHEMA.slice(
    SCHEMA.indexOf("CREATE TABLE IF NOT EXISTS ediciones")
  ).split(");")[0];
  assert.ok(create.split("\n").some((l) => l.trim().startsWith("generador_id")));
  assert.match(
    create,
    /CONSTRAINT fk_ediciones_generador FOREIGN KEY \(generador_id\) REFERENCES generadores_de_documento\(id\)/
  );
  assert.doesNotMatch(SIN_COMENTARIOS, /template_seed_id/);
});

test("`render_engine` NO se toca: esta en otra tabla y dice otra cosa", () => {
  // El plan del frente 23 decia que `generador_id` lo sustituia, y era falso: `render_engine` vive en
  // `document_versions` y significa «con que motor se renderizo ESTA ronda», que es un hecho de la
  // ejecucion, no una declaracion de la plantilla. Queda fuera del frente, y esta prueba lo fija.
  const create = SCHEMA.slice(
    SCHEMA.indexOf("CREATE TABLE IF NOT EXISTS document_versions")
  ).split(");")[0];
  assert.ok(create.split("\n").some((l) => l.trim().startsWith("render_engine")));
});

test("el catalogo se declara ANTES de la tabla que lo referencia", () => {
  // Precedentes `673f1fb`, `8f9f1ad`, `99fc7c7`: el fichero se reaplica en CADA arranque, y una FK
  // a una tabla que aun no existe mata el arranque en bucle.
  assert.ok(
    SCHEMA.indexOf("CREATE TABLE IF NOT EXISTS generadores_de_documento")
      < SCHEMA.indexOf("CREATE TABLE IF NOT EXISTS ediciones")
  );
});
