import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { describirFichero } from "./actoAdjuntos.js";

const pdf = (texto = "hola") => Buffer.from(`%PDF-1.7\n${texto}`, "latin1");

test("la ruta del fichero lleva el acto y la huella de su contenido", () => {
  const buffer = pdf();
  const sha = createHash("sha256").update(buffer).digest("hex");
  const fichero = describirFichero(12, { buffer, originalname: "Resolución 014.pdf" });
  assert.equal(fichero.file_path, `actos/12/${sha}.pdf`);
  assert.equal(fichero.sha256, sha);
  assert.equal(fichero.size_bytes, buffer.length);
  assert.equal(fichero.mime_type, "application/pdf");
  assert.equal(fichero.file_name, "Resolución 014.pdf");
});

test("dos contenidos distintos nunca comparten ruta: reemplazar no pisa el anterior", () => {
  const uno = describirFichero(12, { buffer: pdf("uno"), originalname: "a.pdf" });
  const otro = describirFichero(12, { buffer: pdf("otro"), originalname: "a.pdf" });
  assert.notEqual(uno.file_path, otro.file_path);
});

test("se rechaza lo que no es un PDF, diga lo que diga su nombre, y la falta de fichero", () => {
  assert.throws(() => describirFichero(12, { buffer: Buffer.from("PK\u0003\u0004 un zip"), originalname: "acto.pdf" }), /tiene que ser un PDF/);
  assert.throws(() => describirFichero(12, { buffer: Buffer.alloc(0), originalname: "acto.pdf" }), /Falta el fichero/);
  assert.throws(() => describirFichero(12, undefined), /Falta el fichero/);
});
