import { describe, expect, it } from "vitest";
import { canPreviewInline, getFileExtension, getFileNameFromPath } from "./filePath.js";

describe("getFileNameFromPath", () => {
  it("devuelve el ultimo segmento", () => {
    expect(getFileNameFromPath("9/PROCESOS/2/Documentos/20/v0001/informe.pdf")).toBe("informe.pdf");
  });

  it("una ruta sin barras ya es el nombre", () => {
    expect(getFileNameFromPath("informe.pdf")).toBe("informe.pdf");
  });

  it.each([[""], [null], [undefined]])("%j cae al nombre por defecto", (value) => {
    expect(getFileNameFromPath(value)).toBe("archivo");
  });

  it("una ruta que acaba en barra no tiene nombre: cae al defecto", () => {
    expect(getFileNameFromPath("carpeta/subcarpeta/")).toBe("archivo");
  });
});

describe("getFileExtension", () => {
  it.each([
    ["informe.pdf", "pdf"],
    ["a/b/informe.PDF", "pdf"],
    ["archivo.tar.gz", "gz"],
    ["documento.docx", "docx"]
  ])("%s -> %s", (path, expected) => {
    expect(getFileExtension(path)).toBe(expected);
  });

  it("sin extension devuelve cadena vacia", () => {
    expect(getFileExtension("carpeta/README")).toBe("");
  });

  it("un nombre que empieza por punto cuenta como extension, no como oculto", () => {
    // Comportamiento heredado: lastIndexOf('.') = 0, asi que ".gitignore" -> "gitignore".
    // Se caracteriza tal cual; no hay rutas asi en el dominio.
    expect(getFileExtension(".gitignore")).toBe("gitignore");
  });
});

describe("canPreviewInline", () => {
  it("solo los PDF se previsualizan", () => {
    expect(canPreviewInline("a/b/informe.pdf")).toBe(true);
    expect(canPreviewInline("a/b/informe.PDF")).toBe(true);
  });

  it.each([["informe.docx"], ["hoja.xlsx"], ["paquete.zip"], ["README"], [""]])(
    "%j no se previsualiza: se descarga",
    (path) => {
      expect(canPreviewInline(path)).toBe(false);
    }
  );
});
