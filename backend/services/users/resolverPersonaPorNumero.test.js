import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolverPersonaPorNumero, MENSAJE_DOCUMENTO_AMBIGUO } from "./DocumentoIdentidadService.js";

const conexionCon = (filas) => {
  const vistas = [];
  return {
    vistas,
    query: async (sql, params) => {
      vistas.push({ sql, params });
      return [filas];
    }
  };
};

describe("resolverPersonaPorNumero", () => {
  it("una sola coincidencia devuelve la persona", async () => {
    const { personId, ambiguo } = await resolverPersonaPorNumero(conexionCon([{ person_id: 7 }]), "1710034065");
    assert.equal(personId, 7);
    assert.equal(ambiguo, false);
  });

  // LA REGRESIÓN QUE ESTE MÓDULO EXISTE PARA EVITAR. Seis sitios hacían `WHERE numero = ? LIMIT 1`,
  // y ante dos coincidencias devolvían el expediente, las tareas o las plantillas de OTRA persona,
  // en silencio. La unicidad es (tipo, país, número): el número solo no es único.
  it("dos personas con el mismo número NO resuelven ninguna", async () => {
    const { personId, ambiguo } = await resolverPersonaPorNumero(
      conexionCon([{ person_id: 7 }, { person_id: 9 }]),
      "AB123456"
    );
    assert.equal(personId, null, "elegir una de las dos sería acertar mal");
    assert.equal(ambiguo, true, "y el llamador tiene que poder distinguirlo de 'no existe'");
  });

  it("sin coincidencias no es ambiguo: simplemente no está", async () => {
    const { personId, ambiguo } = await resolverPersonaPorNumero(conexionCon([]), "0000000000");
    assert.equal(personId, null);
    assert.equal(ambiguo, false);
  });

  it("un número vacío no llega a consultar", async () => {
    const conexion = conexionCon([{ person_id: 1 }]);
    const { personId } = await resolverPersonaPorNumero(conexion, "   ");
    assert.equal(personId, null);
    assert.equal(conexion.vistas.length, 0, "no se va a la base a preguntar por nada");
  });

  // «AB 123456» y «AB-123456» son el mismo documento: se guarda normalizado, se busca normalizado.
  it("normaliza igual que al guardar", async () => {
    const conexion = conexionCon([{ person_id: 3 }]);
    await resolverPersonaPorNumero(conexion, " ab-123 456 ");
    assert.deepEqual(conexion.vistas[0].params, ["AB123456"]);
  });

  // `LIMIT 2` y no `LIMIT 1`: cuesta lo mismo y es lo único que permite VER la ambigüedad.
  it("pide DOS filas, que es lo que hace detectable la ambigüedad", async () => {
    const conexion = conexionCon([{ person_id: 3 }]);
    await resolverPersonaPorNumero(conexion, "1710034065");
    assert.match(conexion.vistas[0].sql, /LIMIT 2/);
    assert.match(conexion.vistas[0].sql, /DISTINCT person_id/, "dos documentos de la MISMA persona no son ambigüedad");
    assert.match(conexion.vistas[0].sql, /is_active = 1/);
  });

  it("el mensaje del caso ambiguo está en un solo sitio", () => {
    assert.match(MENSAJE_DOCUMENTO_AMBIGUO, /más de una persona/);
  });
});
