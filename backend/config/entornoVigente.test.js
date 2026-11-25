import test from "node:test";
import assert from "node:assert/strict";
import { exigirEntornoVigente, variablesRetiradas } from "./entornoVigente.js";

test("un entorno migrado pasa sin decir nada", () => {
  assert.deepEqual(variablesRetiradas({ ALMACEN_ENDPOINT: "http://almacen:9000", PATH: "/bin" }), []);
  assert.doesNotThrow(() => exigirEntornoVigente({ ALMACEN_ENDPOINT: "http://almacen:9000" }));
});

test("una sola variable vieja corta el arranque, y el error dice a qué renombrarla", () => {
  const entorno = { ALMACEN_ENDPOINT: "x", MINIO_LEGAL_BUCKET: "deasy-legal", MINIO_ENDPOINT: "y" };
  assert.deepEqual(variablesRetiradas(entorno), ["MINIO_ENDPOINT", "MINIO_LEGAL_BUCKET"]);
  assert.throws(() => exigirEntornoVigente(entorno), (error) => {
    assert.match(error.message, /2 variable\(s\)/);
    assert.match(error.message, /MINIO_ENDPOINT -> ALMACEN_ENDPOINT/);
    assert.match(error.message, /MINIO_LEGAL_BUCKET -> ALMACEN_LEGAL_BUCKET/);
    return true;
  });
});

test("el prefijo se mira al principio del nombre, no en medio", () => {
  assert.deepEqual(variablesRetiradas({ COPIA_MINIO_VIEJA: "1", MINIOX: "2" }), []);
});
