// Tests unitarios de los artefactos de plantilla.

import test from "node:test";
import assert from "node:assert/strict";

import {
  ARTIFACT_SYNC_FILL_DESCRIPTION_PREFIX,
  parseYamlDocument,
  sanitizeLatexSource,
  parseAvailableFormats,
  buildArtifactSyncedFillDescription,
  parseArtifactSyncMarker,
  isArtifactFillWorkflowSyncEnabled,
  findPreferredPdfObject,
} from "./artifacts.js";

// --- parseArtifactSyncMarker: detección de drift -----------------------------
// Round-trip con buildArtifactSyncedFillDescription. El templateCode puede contener
// ':', así que se parte por el PRIMER y el ÚLTIMO ':' (artifactId y storageVersion son
// inequívocos); lo de en medio es el código, ':' incluidos.

test("parseArtifactSyncMarker hace round-trip con la descripción generada", () => {
  const description = buildArtifactSyncedFillDescription({
    artifactId: 12,
    templateCode: "latex/informe",
    storageVersion: "1.2.0",
  });
  assert.deepEqual(parseArtifactSyncMarker(description, ARTIFACT_SYNC_FILL_DESCRIPTION_PREFIX), {
    artifactId: 12,
    templateCode: "latex/informe",
    storageVersion: "1.2.0",
  });
});

test("parseArtifactSyncMarker conserva un templateCode que contiene ':'", () => {
  const description = `${ARTIFACT_SYNC_FILL_DESCRIPTION_PREFIX}7:a:b:c:2.0.0`;
  assert.deepEqual(parseArtifactSyncMarker(description, ARTIFACT_SYNC_FILL_DESCRIPTION_PREFIX), {
    artifactId: 7,
    templateCode: "a:b:c",
    storageVersion: "2.0.0",
  });
});

test("parseArtifactSyncMarker devuelve null si el prefijo no coincide", () => {
  assert.equal(parseArtifactSyncMarker("otra_cosa:1:x:2", ARTIFACT_SYNC_FILL_DESCRIPTION_PREFIX), null);
  assert.equal(parseArtifactSyncMarker("", ARTIFACT_SYNC_FILL_DESCRIPTION_PREFIX), null);
  assert.equal(parseArtifactSyncMarker(null, ARTIFACT_SYNC_FILL_DESCRIPTION_PREFIX), null);
});

test("parseArtifactSyncMarker devuelve null si faltan segmentos", () => {
  // Un solo ':' no basta: se necesitan artifactId, code y storageVersion.
  assert.equal(parseArtifactSyncMarker(`${ARTIFACT_SYNC_FILL_DESCRIPTION_PREFIX}12:solo`, ARTIFACT_SYNC_FILL_DESCRIPTION_PREFIX), null);
});

test("parseArtifactSyncMarker deja artifactId en null si no es numérico", () => {
  const out = parseArtifactSyncMarker(`${ARTIFACT_SYNC_FILL_DESCRIPTION_PREFIX}abc:code:1.0.0`, ARTIFACT_SYNC_FILL_DESCRIPTION_PREFIX);
  assert.equal(out.artifactId, null);
  assert.equal(out.templateCode, "code");
});

// --- sanitizeLatexSource: barrera anti-inyección -----------------------------

test("sanitizeLatexSource detecta la ejecución de shell y de Lua", () => {
  assert.deepEqual(sanitizeLatexSource("a.tex", "texto \\write18{rm -rf /}").length, 1);
  assert.equal(sanitizeLatexSource("a.tex", "\\directlua{os.execute('x')}").length, 1);
  assert.equal(sanitizeLatexSource("a.tex", "\\ShellEscape{ls}").length, 1);
});

test("sanitizeLatexSource rechaza rutas que escapan del árbol o son absolutas", () => {
  assert.equal(sanitizeLatexSource("a.tex", "\\input{../secreto}").length, 1);
  assert.equal(sanitizeLatexSource("a.tex", "\\include{/etc/passwd}").length, 1);
  assert.equal(sanitizeLatexSource("a.tex", "\\includegraphics{|command}").length, 1);
});

test("sanitizeLatexSource permite rutas relativas dentro del árbol", () => {
  assert.deepEqual(sanitizeLatexSource("a.tex", "\\input{secciones/intro}"), []);
  assert.deepEqual(sanitizeLatexSource("a.tex", "texto normal sin comandos peligrosos"), []);
});

test("sanitizeLatexSource incluye la ruta del fichero en cada violación", () => {
  const [violation] = sanitizeLatexSource("plantilla/cuerpo.tex", "\\write18{x}");
  assert.match(violation, /^plantilla\/cuerpo\.tex:/);
});

// --- findPreferredPdfObject: orden de preferencia ----------------------------

test("findPreferredPdfObject prefiere el PDF de render/output sobre el de preview", () => {
  const names = [
    "tpl/preview/doc.pdf",
    "tpl/render/output/pdf/final.pdf",
    "tpl/otro.pdf",
  ];
  assert.equal(findPreferredPdfObject(names), "tpl/render/output/pdf/final.pdf");
});

test("findPreferredPdfObject cae a preview cuando no hay render", () => {
  assert.equal(findPreferredPdfObject(["tpl/x.pdf", "tpl/preview/p.pdf"]), "tpl/preview/p.pdf");
});

test("findPreferredPdfObject ignora los objetos que no son PDF", () => {
  assert.equal(findPreferredPdfObject(["tpl/a.docx", "tpl/b.png"]), null);
  assert.equal(findPreferredPdfObject([]), null);
});

// --- parseAvailableFormats: parsing defensivo --------------------------------

test("parseAvailableFormats acepta objetos y JSON de objeto", () => {
  assert.deepEqual(parseAvailableFormats({ pdf: "x.pdf" }), { pdf: "x.pdf" });
  assert.deepEqual(parseAvailableFormats('{"pdf":"x.pdf"}'), { pdf: "x.pdf" });
});

test("parseAvailableFormats devuelve {} ante arrays, JSON inválido o tipos raros", () => {
  assert.deepEqual(parseAvailableFormats([1, 2]), {}, "un array no es un mapa de formatos");
  assert.deepEqual(parseAvailableFormats("[1,2]"), {});
  assert.deepEqual(parseAvailableFormats("{roto"), {});
  assert.deepEqual(parseAvailableFormats(42), {});
  assert.deepEqual(parseAvailableFormats(null), {});
});

// --- parseYamlDocument -------------------------------------------------------

test("parseYamlDocument parsea un objeto y devuelve {} para escalares", () => {
  assert.deepEqual(parseYamlDocument("a: 1\nb: 2"), { a: 1, b: 2 });
  assert.deepEqual(parseYamlDocument("solo un string"), {});
});

test("parseYamlDocument lanza con la ruta del fichero ante YAML inválido", () => {
  assert.throws(
    () => parseYamlDocument("a: [\n", { filePath: "meta.yaml" }),
    (error) => error.message.includes("meta.yaml"),
  );
});

// --- isArtifactFillWorkflowSyncEnabled ---------------------------------------

test("isArtifactFillWorkflowSyncEnabled exige sync_mode, required y al menos un paso", () => {
  const ok = { sync_mode: "artifact_to_db", required: true, steps: [{ order: 1 }] };
  assert.equal(isArtifactFillWorkflowSyncEnabled(ok), true);
  assert.equal(isArtifactFillWorkflowSyncEnabled({ ...ok, steps: [] }), false, "sin pasos no sincroniza");
  assert.equal(isArtifactFillWorkflowSyncEnabled({ ...ok, required: false }), false);
  assert.equal(isArtifactFillWorkflowSyncEnabled({ ...ok, sync_mode: "otro" }), false);
  assert.equal(isArtifactFillWorkflowSyncEnabled({}), false);
});
