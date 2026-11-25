// QUIEN REGISTRA UNA FILA lo escribe el sistema, no el usuario (frente 27, D-05). Dos mitades: el
// catalogo dice que columnas llevan sello, y la envoltura --el unico sitio del camino generico que
// sabe quien hace la peticion-- se lo entrega al editor.
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import SqlAdminConBitacora from "./SqlAdminConBitacora.js";
import SqlAdminService from "./SqlAdminService.js";

describe("sellos del editor", () => {
  const servicio = new SqlAdminService();

  it("un acto se sella con quien lo registra; una tabla sin marca no lleva nada", () => {
    assert.deepEqual(servicio.sellosDe("actos", { actorId: 7 }), { registrado_por_person_id: 7 });
    assert.equal(servicio.sellosDe("tipos_de_acto", { actorId: 7 }), null);
    assert.equal(servicio.sellosDe("actos", {}), null);
  });

  it("la envoltura entrega el sello al crear, tambien en una tabla que no es sensible", async () => {
    const llamadas = [];
    const falso = {
      sellosDe: (tabla, contexto) => servicio.sellosDe(tabla, contexto),
      create: async (tabla, datos, opciones) => { llamadas.push({ tabla, datos, opciones }); return { id: 1 }; }
    };
    await new SqlAdminConBitacora(falso, {}).create("actos", { numero: "R-1" }, { actorId: 7, recurso: "units" });
    assert.deepEqual(llamadas[0].opciones, { sellos: { registrado_por_person_id: 7 } });
  });

  it("lo que mande el usuario en ese campo se ignora: es de solo lectura, y solo entra por el sello", async () => {
    const consultas = [];
    const conPool = new SqlAdminService();
    conPool.pool = { query: async (sql, params) => { consultas.push({ sql, params }); return [{ insertId: 3 }]; } };
    conPool.ensurePool = () => {};
    conPool._getByKeys = async () => ({ id: 3 });
    await conPool.create(
      "actos",
      { tipo_de_acto_id: 1, numero: "R-1", asunto: "a", fecha_emision: "2026-01-01", fecha_vigencia: "2026-01-01", emisor_externo: "CES", registrado_por_person_id: 999 },
      { sellos: { registrado_por_person_id: 7 } }
    ).catch(() => {});
    const insert = consultas.find((c) => /^\s*INSERT INTO actos/i.test(c.sql));
    assert.ok(insert, "no llegó a insertar");
    const columnas = insert.sql.match(/\(([^)]+)\)/)[1].split(",").map((c) => c.trim());
    assert.equal(insert.params[columnas.indexOf("registrado_por_person_id")], 7);
  });
});
