// Red unitaria de `publishBaseSeedAssets` — en concreto del REPARTO entre los dos destinos del almacén.
//
// POR QUÉ EXISTE. Un solo centinela gobernaba los dos destinos y solo uno lo justificaba (defecto
// 1.15). El efecto no era "no reescribir": era que **ningún cambio en `services/system/seeds/**`
// alcanzaba jamás a un entorno ya arrancado, producción incluida**. El arreglo de `49d41ce4` —que el
// ZIP de una plantilla creada por la web se pudiera renderizar— llevaba un día en el repo y estaba
// ausente de todas las pilas.
//
// Lo que se fija aquí, y que la caracterización NO puede ver: que con el artifact ya presente el
// catálogo SÍ se republica. Desde HTTP solo se observa el `content_hash` resultante; el reparto de
// claves, no.
//
// Cómo se prueba sin el almacén: `publishBaseSeedAssets` acepta sus ayudantes por parámetro con valor por
// defecto. No es una API para nadie —ningún llamador pasa nada— sino la costura mínima que permite
// observar QUÉ claves se suben, ya que `mock.module` en este Node exige un flag experimental y
// cambiar el `test:unit` global por un test sería peor negocio.

import test from "node:test";
import assert from "node:assert/strict";

import { publishBaseSeedAssets, normalizarTokenDeFirma } from "./SystemBootstrapService.js";

const FICHEROS = [
  { rel: "defaults.yaml", abs: "/seed/defaults.yaml" },
  { rel: "schema.json", abs: "/seed/schema.json" },
  { rel: "src/main.tex.j2", abs: "/seed/src/main.tex.j2" },
  { rel: "src/make.sh", abs: "/seed/src/make.sh" },
  { rel: "README.md", abs: "/seed/README.md" },
];

// `stat` resuelve => el artifact ya está publicado. Rechaza => no está.
const publicar = async ({ artifactPresente }) => {
  const subidas = [];
  const resultado = await publishBaseSeedAssets({
    ensure: async () => {},
    stat: async () => {
      if (!artifactPresente) throw new Error("NotFound");
      return { size: 1 };
    },
    put: async (_bucket, objectName) => { subidas.push(objectName); },
    existeSeedDir: () => true,
    listar: () => FICHEROS,
  });
  return {
    resultado,
    catalogo: subidas.filter((k) => k.startsWith("Seeds/")),
    artifact: subidas.filter((k) => !k.startsWith("Seeds/")),
  };
};

test("con el artifact YA presente, el catálogo Seeds/ se republica igualmente", async () => {
  // Éste es el defecto 1.15 en una línea: antes esto daba CERO subidas.
  const { catalogo } = await publicar({ artifactPresente: true });
  assert.equal(catalogo.length, FICHEROS.length, "el catálogo sube el árbol completo");
  assert.ok(
    catalogo.some((k) => k.endsWith("src/make.sh")),
    "y `make.sh` entre ellos: es lo que entra en el content_hash del paquete"
  );
});

test("con el artifact YA presente, el artifact NO se toca (respeta ediciones del admin)", async () => {
  const { artifact, resultado } = await publicar({ artifactPresente: true });
  assert.deepEqual(artifact, [], "ni una sola clave fuera de Seeds/");
  assert.equal(resultado.published, true, "publicar solo el catálogo sigue siendo éxito");
  assert.equal(resultado.artifact, false);
  assert.equal(resultado.reason, "artifact_ya_existe");
});

test("sin artifact previo se publican los DOS destinos", async () => {
  const { catalogo, artifact, resultado } = await publicar({ artifactPresente: false });
  assert.equal(catalogo.length, FICHEROS.length);
  assert.ok(artifact.length > 0, "el artifact instanciado también se sube");
  assert.deepEqual({ published: resultado.published, artifact: resultado.artifact }, { published: true, artifact: true });
});

test("el README solo vive en el catálogo, nunca en el artifact", async () => {
  // Si cayera bajo `src/` acabaría dentro del ZIP que descarga el usuario.
  const { artifact } = await publicar({ artifactPresente: false });
  assert.ok(!artifact.some((k) => k.endsWith("README.md")));
});

test("sin el seed empaquetado en disco no se sube nada y se dice por qué", async () => {
  const subidas = [];
  const resultado = await publishBaseSeedAssets({
    ensure: async () => {},
    stat: async () => { throw new Error("NotFound"); },
    put: async (_b, k) => { subidas.push(k); },
    existeSeedDir: () => false,
    listar: () => FICHEROS,
  });
  assert.deepEqual(subidas, []);
  assert.equal(resultado.published, false);
  assert.equal(resultado.reason, "seed_no_empaquetado");
});

test("un fallo del almacén NO aborta el bootstrap: es best-effort y lo reporta", async () => {
  const resultado = await publishBaseSeedAssets({
    ensure: async () => { throw new Error("almacen caido"); },
    stat: async () => { throw new Error("NotFound"); },
    put: async () => {},
    existeSeedDir: () => true,
    listar: () => FICHEROS,
  });
  assert.equal(resultado.published, false);
  assert.equal(resultado.reason, "almacen caido");
});

// --- El token de firma que se PIDE al bootstrap ---------------------------------------------------
//
// POR QUE EXISTE ESTA RED. `persons.token` es el marcador `!-token-!` que la plantilla deja como
// hueco de la firma, y el bootstrap lo SORTEABA con `crypto.randomBytes`: cada reseteo de la base de
// prueba lo cambiaba, asi que ninguna plantilla, fixture ni nota podia citarlo.
//
// La peticion del dueño fue «ponle una semilla al random». Un CSPRNG no admite semilla, y cambiarlo
// por un generador sembrado haria calculable el token del administrador REAL de cada despliegue. Lo
// que se abrio es una ENTRADA opcional: el azar sigue ahi, y es lo que ocurre cuando no se pide nada.
// Esto fija el contrato de esa entrada.

test("sin token pedido devuelve null, que es la señal de «sortealo»", () => {
  for (const vacio of [undefined, null, "", "   "]) {
    assert.equal(normalizarTokenDeFirma(vacio), null, JSON.stringify(vacio));
  }
});

test("un token pedido se devuelve tal cual, sin los espacios de alrededor", () => {
  assert.equal(normalizarTokenDeFirma("FIRMAdemo3"), "FIRMAdemo3");
  assert.equal(normalizarTokenDeFirma("  FIRMAdemo3  "), "FIRMAdemo3");
});

test("la longitud es EXACTA: ni 9 ni 11 caracteres valen", () => {
  for (const malo of ["FIRMAdemo", "FIRMAdemo33"]) {
    assert.throws(
      () => normalizarTokenDeFirma(malo),
      (error) => error.statusCode === 400 && /exactamente 10/.test(error.message),
      malo,
    );
  }
});

// El alfabeto no es decoracion: el marcador se busca como TEXTO dentro del PDF
// (`find_marker_coordinates`), y un caracter que la extraccion de texto normalice de otra forma
// --una tilde, una eñe, un guion-- deja de casar y la firma no se coloca en ningun sitio.
test("solo letras y digitos sin acentos", () => {
  for (const malo of ["FIRMAdem-3", "FIRMAdemoñ", "FIRMA demo", "FIRMAdemó3"]) {
    assert.throws(
      () => normalizarTokenDeFirma(malo),
      (error) => error.statusCode === 400 && /letras y digitos/.test(error.message),
      malo,
    );
  }
});

test("la semilla va al bucket de plantillas que se le indica, en las tres operaciones", async () => {
  // El defecto: el nombre estaba escrito a mano y en qa la aplicación lee de otro bucket.
  const vistos = new Set();
  await publishBaseSeedAssets({
    bucket: "deasy-qa-templates",
    ensure: async (bucket) => { vistos.add(bucket); },
    stat: async (bucket) => { vistos.add(bucket); throw new Error("NotFound"); },
    put: async (bucket) => { vistos.add(bucket); },
    existeSeedDir: () => true,
    listar: () => FICHEROS,
  });
  assert.deepEqual([...vistos], ["deasy-qa-templates"]);
});

test("sin indicarlo, el bucket es el de ALMACEN_TEMPLATES_BUCKET: el mismo del que leen las plantillas", async () => {
  const { ALMACEN_TEMPLATES_BUCKET } = await import("../admin/kernel/constants.js");
  let visto = null;
  await publishBaseSeedAssets({
    ensure: async (bucket) => { visto = bucket; },
    stat: async () => ({ size: 1 }),
    put: async () => {},
    existeSeedDir: () => true,
    listar: () => FICHEROS,
  });
  assert.equal(visto, ALMACEN_TEMPLATES_BUCKET);
});
