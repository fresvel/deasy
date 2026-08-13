// Tests unitarios de los artefactos de plantilla.

import test from "node:test";
import assert from "node:assert/strict";

import {
  sanitizeLatexSource,
  parseAvailableFormats,
  findPreferredPdfObject,
  describeRejectedDraftArtifactFile,
  checkJinjaBlockBalance,
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

// --- checkJinjaBlockBalance: NO ES UN PARSER (§0.4 S4) -----------------------
//
// Sólo comprueba que lo que se abre se cierre. Los delimitadores son los REALES del proyecto
// (`[[% %]]`, comentarios `[[# #]]`), verificados en el `Environment` que arma
// `services/system/seeds/informe-general/src/make.sh`. Medido sobre los 23 ficheros del seed real:
// 24 etiquetas `[[%` y CERO falsos positivos.

test("un for sin su endfor se caza, y el motivo nombra lo que falta", () => {
  const [violacion] = checkJinjaBlockBalance("datos.tex.j2", "[[% for x in y %]]\\item [[[ x ]]]\n");
  assert.match(violacion, /^datos\.tex\.j2: bloque "for" sin cerrar \(falta "endfor"\)/);
});

test("los bloques bien cerrados no dan violaciones, anidados incluidos", () => {
  const bueno = [
    "[[% if show_firmas %]]\\showfirmastrue[[% else %]]\\showfirmasfalse[[% endif %]]",
    "[[% for lname, cfg in layout.items() %]]",
    "[[% if cfg.total %]]A[[% else %]]B[[% endif %]]",
    "[[% endfor %]]",
  ].join("\n");
  assert.deepEqual(checkJinjaBlockBalance("ok.tex.j2", bueno), []);
});

test("cerrar con la etiqueta equivocada se caza (endfor sobre un if)", () => {
  const [violacion] = checkJinjaBlockBalance("x.j2", "[[% if a %]]uno[[% endfor %]]");
  assert.match(violacion, /"endfor" cierra un bloque "if", que esperaba "endif"/);
});

test("un cierre suelto, sin nada abierto, tambien se caza", () => {
  const [violacion] = checkJinjaBlockBalance("x.j2", "texto [[% endif %]]");
  assert.match(violacion, /"endif" sin bloque abierto/);
});

test("un delimitador sin cerrar se detecta antes de mirar etiquetas", () => {
  const [violacion] = checkJinjaBlockBalance("x.j2", "[[% if a %]]uno[[% endif");
  assert.match(violacion, /falta cerrar un delimitador de bloque/);
});

test("LaTeX con llaves dobles NO es un falso positivo: las expresiones no se cuentan", () => {
  // Es la razón de que `{{ }}` se deje fuera a propósito: en LaTeX son llaves normales.
  assert.deepEqual(
    checkJinjaBlockBalance("preambulo.tex.j2", "\\newcommand{\\x}{{\\bf y}}\n\\def\\z{{a}}"),
    [],
  );
});

test("los comentarios [[# #]] no cuentan como bloques", () => {
  assert.deepEqual(checkJinjaBlockBalance("x.j2", "[[# [[% if roto %]] #]]\ntexto"), []);
});

test("`set` con `=` es una asignacion suelta; sin `=` es un bloque que hay que cerrar", () => {
  assert.deepEqual(checkJinjaBlockBalance("x.j2", "[[% set total = 3 %]]"), []);
  const [violacion] = checkJinjaBlockBalance("x.j2", "[[% set cuerpo %]]hola");
  assert.match(violacion, /bloque "set" sin cerrar/);
});

test("include/extends/import no abren bloque", () => {
  assert.deepEqual(
    checkJinjaBlockBalance("main.tex.j2", "[[% include 'Contenido/Inicio.tex' %]]\n[[% extends 'base' %]]"),
    [],
  );
});

test("el control de espacios `[[%-` y `-%]]` no despista al lector de etiquetas", () => {
  assert.deepEqual(checkJinjaBlockBalance("x.j2", "[[%- if a -%]]uno[[%- endif -%]]"), []);
});

test("un else fuera de todo bloque se caza", () => {
  const [violacion] = checkJinjaBlockBalance("x.j2", "texto [[% else %]] otro");
  assert.match(violacion, /"else" fuera de un bloque "if" o "for"/);
});

test("un fichero sin nada de Jinja no da violaciones", () => {
  assert.deepEqual(checkJinjaBlockBalance("tabla_01.tex", "\\begin{tabular}{ll}a & b\\end{tabular}"), []);
  assert.deepEqual(checkJinjaBlockBalance("vacio.j2", ""), []);
});
