// Tests unitarios de los artefactos de plantilla.

import test from "node:test";
import assert from "node:assert/strict";

import {
  parseYamlDocument,
  sanitizeLatexSource,
  parseAvailableFormats,
  findPreferredPdfObject,
} from "./artifacts.js";

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
