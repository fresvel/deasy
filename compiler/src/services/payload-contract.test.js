import test from "node:test";
import assert from "node:assert/strict";

import { validateNormalizedCompilationPayload } from "./payload-contract.js";

const buildValidPayload = () => ({
  documentVersion: {
    id: 123,
    documentId: 77,
    version: 2,
  },
  artifact: {
    bucket: "deasy-templates",
  },
  sources: {
    metaObjectKey: "System/Templates/meta.yaml",
    schemaObjectKey: "System/Templates/schema.json",
  },
  renderSource: {
    objectPrefix: "System/Templates/modes/system/jinja2/src/",
    files: [
      {
        objectName: "System/Templates/modes/system/jinja2/src/main.tex.j2",
        relativePath: "main.tex.j2",
      },
    ],
  },
  payload: {
    mergedPayload: {
      estudiante: {
        nombre: "Ada",
      },
    },
  },
  storage: {
    canonicalBasePath: "1/PROCESOS/2/ANIOS/2026/TIPOS_PERIODO/1/PERIODOS/5/TAREAS/8/Documentos/13/v0001",
  },
  target: {
    renderEngine: "jinja2",
    outputFormat: "pdf",
  },
});

test("validateNormalizedCompilationPayload acepta un payload mínimo válido", () => {
  const result = validateNormalizedCompilationPayload(buildValidPayload());
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("validateNormalizedCompilationPayload reporta faltantes relevantes", () => {
  const payload = buildValidPayload();
  delete payload.renderSource;
  delete payload.storage.canonicalBasePath;
  payload.payload.mergedPayload = null;

  const result = validateNormalizedCompilationPayload(payload);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /renderSource/);
  assert.match(result.errors.join(" "), /storage\.canonicalBasePath/);
  assert.match(result.errors.join(" "), /payload\.mergedPayload/);
});
