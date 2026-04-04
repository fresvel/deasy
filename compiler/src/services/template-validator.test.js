import test from "node:test";
import assert from "node:assert/strict";

import { validateCompilerPayloadTechnically } from "./template-validator.js";

const buildPayload = () => ({
  documentVersion: {
    id: 1,
    documentId: 10,
    version: 1,
  },
  artifact: {
    bucket: "deasy-templates",
  },
  sources: {
    metaObjectKey: "System/meta.yaml",
    schemaObjectKey: "System/schema.json",
  },
  renderSource: {
    objectPrefix: "System/modes/system/jinja2/src/",
    files: [
      {
        objectName: "System/modes/system/jinja2/src/main.tex.j2",
        relativePath: "main.tex.j2",
      },
    ],
  },
  payload: {
    schema: {},
    meta: {
      modes: {
        system: {
          jinja2: {
            path: "modes/system/jinja2/src",
          },
        },
        user: {
          latex: {
            path: "modes/user/latex",
          },
        },
      },
    },
    mergedPayload: {
      foo: "bar",
    },
  },
  storage: {
    canonicalBasePath: "1/PROCESOS/2/Documentos/3/v0001",
  },
  target: {
    renderEngine: "jinja2",
    outputFormat: "pdf",
  },
});

test("validateCompilerPayloadTechnically advierte pero no rechaza scripts shell en el árbol fuente", () => {
  const payload = buildPayload();
  payload.renderSource.files.push({
    objectName: "System/modes/system/jinja2/src/make.sh",
    relativePath: "make.sh",
  });

  const result = validateCompilerPayloadTechnically(payload);
  assert.equal(result.ok, true);
  assert.ok(
    result.warnings.some((item) => item.code === "render_source_shell_script_ignored")
  );
});
