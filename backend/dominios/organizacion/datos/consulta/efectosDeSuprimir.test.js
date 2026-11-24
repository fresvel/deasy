import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contarEfectosDeSuprimir, CLASES_DE_NODO } from "./efectosDeSuprimir.js";

const SCHEMA = readFileSync(new URL("../../../../database/postgres_schema.sql", import.meta.url), "utf8");
const FUENTE = readFileSync(new URL("./efectosDeSuprimir.js", import.meta.url), "utf8");

// LA ADVERTENCIA TIENE QUE DECIR LO QUE LA BASE HACE. Cada tabla que una función de supresión
// escribe tiene que tener aquí su cuenta; si la función empieza a cerrar otra cosa, esto falla.
test("cada tabla que la supresión cierra en la base tiene su cuenta en la advertencia", () => {
  for (const funcion of ["aplicar_supresion_de_unidad", "aplicar_supresion_de_puesto"]) {
    const cuerpo = SCHEMA.slice(SCHEMA.indexOf(`FUNCTION public.${funcion}(`)).split("$$ LANGUAGE plpgsql;")[0];
    const tocadas = new Set([...cuerpo.matchAll(/\b(?:UPDATE|INSERT INTO)\s+([a-z_]+)/g)].map((m) => m[1]));
    // Los turnos son la FORMA en que un entregable se queda sin responsable: se cuenta el entregable.
    tocadas.delete("task_item_tenures");
    if (funcion === "aplicar_supresion_de_puesto") tocadas.add("task_items");
    for (const tabla of tocadas) {
      assert.match(FUENTE, new RegExp(`\\b${tabla}\\b`), `${funcion} cierra ${tabla} y la advertencia no lo cuenta`);
    }
  }
});

test("devuelve sólo lo que hay, con su cifra, y nada para una clase que no existe", async () => {
  const ejecutor = { query: async (sql) => [[{ n: /role_assignments/.test(sql) ? "21" : 0 }]] };
  assert.deepEqual(await contarEfectosDeSuprimir(ejecutor, "unidad", 7), [
    { singular: "rol asignado", plural: "roles asignados", seCierra: true, n: 21 }
  ]);
  assert.deepEqual(await contarEfectosDeSuprimir(ejecutor, "otra", 7), []);
  assert.deepEqual(CLASES_DE_NODO, ["unidad", "puesto", "proceso"]);
});
