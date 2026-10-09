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

// --- BLOQUE 2: LAS OCHO TABLAS DEL RECORRIDO PARTIDO NO VUELVEN ---------------------------------
//
// AQUI VIVIAN ONCE PRUEBAS, y se fueron con su sujeto en el paso 4 de la fase 4 del frente 24. Lo que
// vigilaban era real mientras las tablas lo fueran:
//
//   · BLOQUE 2 (5 x 2 tablas) · la definicion del portador de las dos cabeceras: `edicion_id`
//     nulable, su FK a `ediciones`, el `CHECK` de "exactamente un portador", que `vinculo_id` no
//     volviera, y que el `CREATE INDEX` fuera DESPUES de su tabla.
//   · BLOQUE 3 (5) · la SIMETRIA de los dos pasos: que `code` y `name` tuvieran el MISMO tipo en
//     entrega y en firma, que nacieran NULL sin DEFAULT, y que nadie indexara columnas descriptivas.
//
// Las dos cosas que esas pruebas protegian siguen protegidas, pero en otro sitio y mejor: la de "un
// solo origen" la vigila `pasos_declarados: un paso cuelga de UN origen y solo de uno` (bloque 5), y
// la de la SIMETRIA ya no hace falta porque **no hay dos tablas que simetrizar**: hay una, con una
// columna `accion`. Era una prueba que existia por la duplicacion.
//
// Lo que queda es la puerta inversa, el mismo tipo que el bloque 4: que lo retirado SIGA retirado.
// Hace falta porque un `CREATE TABLE IF NOT EXISTS` reintroducido **no rompe nada visible** —arranca,
// y la tabla vuelve a existir vacia—, y porque el camino de vuelta es facil: copiar y pegar un bloque
// de un commit viejo. Mira el SQL SIN COMENTARIOS a proposito: el epitafio de arriba nombra las ocho,
// como debe.

const OCHO_RETIRADAS = [
  "fill_flow_templates", "fill_flow_steps", "document_fill_flows", "fill_requests",
  "signature_flow_templates", "signature_flow_steps", "signature_flow_instances", "signature_requests",
];

for (const tabla of OCHO_RETIRADAS) {
  test(`${tabla} no vuelve: la sustituyeron las cuatro del recorrido unificado`, () => {
    assert.doesNotMatch(
      SIN_COMENTARIOS,
      new RegExp(`\\b${tabla}\\b`),
      `${tabla} se retiro en el paso 4 de la fase 4 del frente 24. `
        + "Si hace falta algo de ella, va en `pasos_declarados` / `participantes_declarados` "
        + "(la receta) o en `recorridos` / `turnos` (la ejecucion), con su `accion`."
    );
  });
}

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

// --- EL RECORRIDO UNIFICADO (frente 24, fase 4) --------------------------------------------------
//
// Cuatro tablas que sustituyen a ocho. Lo que aqui se pinza NO es que existan —eso lo comprueba el
// arranque— sino las cuatro reglas que no se ven leyendo el CREATE de corrido, y que son justo las
// que el diseno costo decidir.

const bloqueRecorrido = (tabla) =>
  SCHEMA.slice(SCHEMA.indexOf(`CREATE TABLE IF NOT EXISTS ${tabla} (`)).split(");")[0];

// ⚠️ `SCHEMA` viene NORMALIZADO: `sinEsquema` (:40) le quita el prefijo de dominio a cada CREATE,
// para que los once sitios que buscan una tabla por su nombre no tengan que saber donde vive. Para
// comprobar justamente eso --en que esquema NACE-- hace falta el fichero crudo.
const SCHEMA_CRUDO = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "postgres_schema.sql"),
  "utf8"
);

test("pasos_declarados: un paso cuelga de UN origen y solo de uno", () => {
  const create = bloqueRecorrido("pasos_declarados");
  assert.match(create, /num_nonnulls\(edicion_id, task_item_id\) = 1/);
  // Los dos origenes son claves ajenas de verdad, que es lo que se gana frente a un `origen_id`
  // polimorfico: la base impide apuntar a una edicion que ya no existe.
  assert.match(create, /FOREIGN KEY \(edicion_id\) REFERENCES ediciones\(id\)/);
  assert.match(create, /FOREIGN KEY \(task_item_id\) REFERENCES task_items\(id\)/);
});

test("pasos_declarados: la unicidad que NO existia, una por origen", () => {
  // Hoy hay CERO indices unicos sobre las anclas de los flujos y el codigo lo compensa con
  // `ORDER BY id DESC LIMIT 1`. Son DOS indices porque el origen son dos columnas excluyentes.
  assert.match(
    SCHEMA,
    /uq_pasos_declarados_edicion[\s\S]{0,120}\(edicion_id, accion, orden\) WHERE edicion_id IS NOT NULL/
  );
  assert.match(
    SCHEMA,
    /uq_pasos_declarados_entregable[\s\S]{0,120}\(task_item_id, accion, orden\) WHERE task_item_id IS NOT NULL/
  );
});

test("participantes_declarados: los dos vocabularios quedan cerrados, y mas estrechos", () => {
  const create = bloqueRecorrido("participantes_declarados");
  // Tres resolutores: los seis retirados ya no pueden colarse por un JSONB sin CHECK.
  assert.match(create, /resolver_type IN \('task_assignee', 'specific_person', 'cargo_in_scope'\)/);
  // Y TRES ambitos, no cinco: `unit_subtree` y `unit_type` no los produce ninguna pantalla.
  assert.match(create, /unit_scope_type IN \('unit_exact', 'context_exact', 'all_units'\)/);

  // ⚠️ SIN LA PROSA, y no es un detalle: el comentario de esa columna NOMBRA los dos ambitos que se
  // retiraron, porque explica por que se fueron. Buscarlos sobre el texto crudo hacia fallar el
  // aserto justo por estar explicado. Es la misma leccion que `check-mapa-tablas.mjs` lleva escrita
  // en su `sinProsa()`: una comprobacion que mira los comentarios castiga al que explica.
  const sinProsa = create.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  assert.doesNotMatch(sinProsa, /unit_subtree|unit_type_id/);
});

test("participantes_declarados: el hueco de firma vive aqui, no en el paso", () => {
  // Con N firmantes y un solo hueco, el firmador solo encontraba la marca del primero.
  assert.match(bloqueRecorrido("participantes_declarados"), /^\s*slot VARCHAR\(80\) NULL,/m);
  assert.doesNotMatch(bloqueRecorrido("pasos_declarados"), /\bslot\b/);
});

test("turnos: `devuelto` solo es legal en entrega, y la accion no puede mentir", () => {
  const create = bloqueRecorrido("turnos");
  // El CHECK necesita ver la accion, que vive en `recorridos`: por eso esta duplicada aqui...
  assert.match(create, /CHECK \(estado <> 'devuelto' OR accion = 'entrega'\)/);
  // ...y por eso la clave ajena es COMPUESTA. Sin ella la copia podria desincronizarse y el CHECK
  // se estaria aplicando contra una mentira.
  assert.match(create, /FOREIGN KEY \(recorrido_id, accion\) REFERENCES recorridos\(id, accion\)/);
});

test("recorridos: uno por version y accion, y con la UNIQUE que la FK compuesta necesita", () => {
  assert.match(SCHEMA, /uq_recorridos_version_accion[\s\S]{0,80}\(document_version_id, accion\)/);
  assert.match(bloqueRecorrido("recorridos"), /CONSTRAINT uq_recorridos_id_accion UNIQUE \(id, accion\)/);
});

test("las cuatro nacen en el esquema de su dominio", () => {
  for (const tabla of ["plantillas.pasos_declarados", "plantillas.participantes_declarados",
                       "tareas.recorridos", "tareas.turnos"]) {
    assert.ok(
      SCHEMA_CRUDO.includes(`CREATE TABLE IF NOT EXISTS ${tabla} (`),
      `${tabla} tiene que nacer en el esquema de su dominio`
    );
  }
});
