import test from "node:test";
import assert from "node:assert/strict";

import { shouldMaterializeSourceFile } from "./source-policy.js";

test("shouldMaterializeSourceFile permite fuentes y assets válidos", () => {
  assert.equal(shouldMaterializeSourceFile("main.tex.j2"), true);
  assert.equal(shouldMaterializeSourceFile("styles/report.sty"), true);
  assert.equal(shouldMaterializeSourceFile("assets/logo.png"), true);
});

test("shouldMaterializeSourceFile ignora scripts shell y archivos no permitidos", () => {
  assert.equal(shouldMaterializeSourceFile("make.sh"), false);
  assert.equal(shouldMaterializeSourceFile("scripts/build.sh"), false);
  assert.equal(shouldMaterializeSourceFile("scripts/helper.py"), false);
  assert.equal(shouldMaterializeSourceFile(".env"), false);
});
