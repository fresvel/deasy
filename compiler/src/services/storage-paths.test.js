import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCompileReportPath,
  buildCompiledWorkingPdfPath,
  buildWorkingDirectoryPrefix,
  sanitizeStorageSegment,
} from "./storage-paths.js";

test("sanitizeStorageSegment normaliza caracteres inseguros", () => {
  assert.equal(sanitizeStorageSegment(" Documento Final 2026!.pdf "), "Documento_Final_2026_.pdf");
});

test("buildWorkingDirectoryPrefix arma working/pdf canónico", () => {
  assert.equal(
    buildWorkingDirectoryPrefix({
      basePath: "1/PROCESOS/2/Documentos/3/v0001",
      extension: "PDF",
    }),
    "1/PROCESOS/2/Documentos/3/v0001/working/pdf"
  );
});

test("buildCompiledWorkingPdfPath arma el nombre fijo por documentVersionId", () => {
  assert.equal(
    buildCompiledWorkingPdfPath({
      basePath: "1/PROCESOS/2/Documentos/3/v0001",
      documentVersionId: 99,
    }),
    "1/PROCESOS/2/Documentos/3/v0001/working/pdf/document-version-99.pdf"
  );
});

test("buildCompileReportPath ubica compile_report.json junto al PDF", () => {
  assert.equal(
    buildCompileReportPath({
      basePath: "1/PROCESOS/2/Documentos/3/v0001",
    }),
    "1/PROCESOS/2/Documentos/3/v0001/working/pdf/compile_report.json"
  );
});
