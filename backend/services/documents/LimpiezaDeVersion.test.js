import assert from "node:assert/strict";
import { test } from "node:test";
import { borrarFicherosSinDueno } from "./LimpiezaDeVersion.js";

// Una conexión de mentira: a la pregunta «¿sigue en uso esta ruta?» contesta según la lista que se le dé.
const conexion = (enUso = []) => ({
  consultas: 0,
  async query(_sql, parametros) {
    this.consultas += 1;
    return [[{ en_uso: enUso.includes(parametros[0]) }]];
  }
});
const resolver = (ruta) => ({ bucket: "b", objectName: `Unidades/${ruta}` });

test("se borran los ficheros que ya nadie nombra, y no los que otra fila sigue usando", async () => {
  const borradas = [];
  const resultado = await borrarFicherosSinDueno(["a.pdf", "b.pdf", "c.pdf"], {
    connection: conexion(["b.pdf"]),
    resolver,
    borrar: async (bucket, objeto) => { borradas.push(`${bucket}/${objeto}`); }
  });
  assert.deepEqual(borradas, ["b/Unidades/a.pdf", "b/Unidades/c.pdf"]);
  assert.deepEqual(resultado, { borrados: 2, conservados: 1, fallidos: 0 });
});

test("una ruta repetida se borra una vez, y las vacías se ignoran", async () => {
  const borradas = [];
  await borrarFicherosSinDueno(["a.pdf", null, "", "a.pdf"], {
    connection: conexion(), resolver, borrar: async (_b, objeto) => { borradas.push(objeto); }
  });
  assert.deepEqual(borradas, ["Unidades/a.pdf"]);
});

test("sin rutas no se consulta la base ni se toca el almacén", async () => {
  const c = conexion();
  const resultado = await borrarFicherosSinDueno([], { connection: c, resolver, borrar: async () => { throw new Error("no debía llamarse"); } });
  assert.equal(c.consultas, 0);
  assert.deepEqual(resultado, { borrados: 0, conservados: 0, fallidos: 0 });
});

test("que un objeto no se pueda borrar no detiene a los demás, y se cuenta", async () => {
  const resultado = await borrarFicherosSinDueno(["a.pdf", "b.pdf"], {
    connection: conexion(),
    resolver,
    borrar: async (_b, objeto) => { if (objeto.endsWith("a.pdf")) throw new Error("almacén caído"); }
  });
  assert.deepEqual(resultado, { borrados: 1, conservados: 0, fallidos: 1 });
});
