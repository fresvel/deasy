// El orden importa, y por eso se prueba: la lectura se apunta ANTES de devolver, y el titular de un
// borrado se lee ANTES de borrar.
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import SqlAdminConBitacora from "./SqlAdminConBitacora.js";

const SENSIBLE = { actorId: 1, recurso: "datos_sensibles", ip: null };

describe("SqlAdminConBitacora", () => {
  it("si la bitacora falla, la lectura NO devuelve las filas", async () => {
    const editor = new SqlAdminConBitacora(
      { list: async () => [{ id: 1, person_id: 2 }] },
      { registrarLectura: async () => { throw new Error("sin bitacora"); } }
    );
    await assert.rejects(() => editor.list("documentos_identidad", {}, SENSIBLE), /sin bitacora/);
  });

  it("al borrar, el titular se lee ANTES del DELETE y la entrada lleva la fila previa", async () => {
    const orden = [];
    const editor = new SqlAdminConBitacora(
      {
        list: async () => { orden.push("list"); return [{ id: 5, person_id: 9 }]; },
        remove: async () => { orden.push("remove"); return 1; }
      },
      { registrarEscritura: async ({ fila, accion }) => { orden.push(`${accion}:${fila.person_id}`); } }
    );
    await editor.remove("documentos_identidad", { id: 5 }, SENSIBLE);
    assert.deepEqual(orden, ["list", "remove", "delete:9"]);
  });

  it("fuera de lo sensible, borrar no hace la lectura previa", async () => {
    const orden = [];
    const editor = new SqlAdminConBitacora(
      {
        list: async () => { orden.push("list"); return []; },
        remove: async () => { orden.push("remove"); return 1; }
      },
      { registrarEscritura: async () => { orden.push("bitacora"); } }
    );
    await editor.remove("persons", { id: 5 }, { ...SENSIBLE, recurso: "people" });
    assert.deepEqual(orden, ["remove"]);
  });

  it("al actualizar, las claves no cuentan como campos cambiados", async () => {
    let recibido = null;
    const editor = new SqlAdminConBitacora(
      { update: async () => ({ id: 5, person_id: 9 }) },
      { registrarEscritura: async (contexto) => { recibido = contexto; } }
    );
    await editor.update("documentos_identidad", { id: 5 }, { id: 5, numero: "X" }, SENSIBLE);
    assert.deepEqual(recibido.campos, ["numero"]);
  });
});
