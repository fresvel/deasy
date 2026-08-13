// Tests unitarios de los artefactos de plantilla.

import test from "node:test";
import assert from "node:assert/strict";

import {
  sanitizeLatexSource,
  parseAvailableFormats,
  findPreferredPdfObject,
  describeRejectedDraftArtifactFile,
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

// --- describeRejectedDraftArtifactFile: el fileFilter que faltaba (§0.4 S3) ---
//
// El caso que motiva todo esto está medido, no supuesto: antes de existir este filtro, un
// `payload.sh` enviado por el campo `pdf_file` daba 200 y acababa en `template/pdf/payload.sh`,
// donde `sendResourcesAsZip` le pone modo 0755 al empaquetarlo.

test("un .sh por el campo pdf_file se rechaza, y el motivo dice cual es el campo", () => {
  const motivo = describeRejectedDraftArtifactFile({
    fieldname: "pdf_file",
    originalname: "payload.sh",
    mimetype: "application/x-sh",
  });
  assert.match(motivo, /pdf_file/);
  assert.match(motivo, /\.pdf/);
});

test("mentir en el mimetype NO salva al .sh: manda la EXTENSION", () => {
  // Es la razón de que el gate sea la extensión: el mimetype lo declara el cliente y no influye en
  // el nombre del objeto de MinIO, que sale de `path.extname(originalname)`.
  assert.ok(describeRejectedDraftArtifactFile({
    fieldname: "pdf_file",
    originalname: "payload.sh",
    mimetype: "application/pdf",
  }));
});

test("cada campo admite solo SU formato, no el del vecino", () => {
  assert.equal(describeRejectedDraftArtifactFile({
    fieldname: "docx_file", originalname: "informe.docx",
    mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }), null);
  assert.ok(describeRejectedDraftArtifactFile({
    fieldname: "docx_file", originalname: "informe.pdf", mimetype: "application/pdf",
  }), "un PDF por el campo de Word se rechaza");
});

test("un campo desconocido se rechaza: la lista de campos es cerrada", () => {
  const motivo = describeRejectedDraftArtifactFile({
    fieldname: "avatar", originalname: "foto.png", mimetype: "image/png",
  });
  assert.match(motivo, /No se esperaba/);
});

test("el campo `source` de la re-subida de codigo solo admite ZIP", () => {
  assert.equal(describeRejectedDraftArtifactFile({
    fieldname: "source", originalname: "codigo.zip", mimetype: "application/zip",
  }), null);
  assert.ok(describeRejectedDraftArtifactFile({
    fieldname: "source", originalname: "codigo.tar.gz", mimetype: "application/gzip",
  }));
});

test("se acepta application/octet-stream, que es lo que mandan varios clientes", () => {
  assert.equal(describeRejectedDraftArtifactFile({
    fieldname: "pdf_file", originalname: "referencia.pdf", mimetype: "application/octet-stream",
  }), null);
});

test("la extension se compara sin distinguir mayusculas", () => {
  assert.equal(describeRejectedDraftArtifactFile({
    fieldname: "xlsx_file", originalname: "DATOS.XLSX",
    mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }), null);
});

test("un mimetype que no cuadra con la extension permitida tambien se rechaza", () => {
  const motivo = describeRejectedDraftArtifactFile({
    fieldname: "pptx_file", originalname: "presentacion.pptx", mimetype: "text/x-shellscript",
  });
  assert.match(motivo, /text\/x-shellscript/);
});
