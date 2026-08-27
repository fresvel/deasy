// El dígito verificador de la cédula ecuatoriana, y las reglas del documento.
//
// Existe porque hasta ahora NADIE validaba la cédula localmente: la única comprobación era
// `^\d{10}$` en el endpoint que consulta al registro civil, o sea con red y con token. Una cédula
// con una errata pasaba el filtro y llegaba a la base.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import DocumentoIdentidadService, { cedulaEcuatorianaValida, normalizarNumero } from "./DocumentoIdentidadService.js";

describe("cedulaEcuatorianaValida", () => {
  it("acepta cédulas reales de distintas provincias", () => {
    // Cédulas con verificador CORRECTO, de provincias distintas (17 Pichincha, 08 Esmeraldas,
    // 01 Azuay, 09 Guayas). Ojo: las de la semilla de dev NO son válidas — ver el aviso del commit.
    for (const cedula of ["1710034065", "1723456784", "0823456785", "0123456782", "0923456784"]) {
      assert.equal(cedulaEcuatorianaValida(cedula), true, `deberia aceptar ${cedula}`);
    }
  });

  it("RECHAZA una cédula con un dígito cambiado", () => {
    assert.equal(cedulaEcuatorianaValida("1710034065"), true);
    assert.equal(cedulaEcuatorianaValida("1710034066"), false, "el verificador no deberia cuadrar");
  });

  it("rechaza longitudes que no son 10, y lo no numérico", () => {
    assert.equal(cedulaEcuatorianaValida("171003406"), false);
    assert.equal(cedulaEcuatorianaValida("17100340650"), false);
    assert.equal(cedulaEcuatorianaValida("AB12345678"), false);
    assert.equal(cedulaEcuatorianaValida(""), false);
    assert.equal(cedulaEcuatorianaValida(null), false);
  });

  it("rechaza provincias imposibles", () => {
    assert.equal(cedulaEcuatorianaValida("9910034065"), false, "no existe la provincia 99");
    assert.equal(cedulaEcuatorianaValida("0010034065"), false, "no existe la provincia 00");
  });
});

describe("normalizarNumero", () => {
  it("sube a mayúsculas y quita espacios, puntos y guiones", () => {
    assert.equal(normalizarNumero("ab 123-456"), "AB123456");
    assert.equal(normalizarNumero("  ab.123456 "), "AB123456");
  });

  it("hace que las formas de escribir un mismo pasaporte colapsen en una", () => {
    assert.equal(normalizarNumero("AB 123456"), normalizarNumero("AB-123456"));
  });
});

const servicioCon = (filasPorConsulta) => {
  const consultas = [];
  let n = 0;
  return {
    consultas,
    servicio: new DocumentoIdentidadService({
      query: async (sql, params) => {
        consultas.push({ sql, params });
        const filas = filasPorConsulta[n] ?? [];
        n += 1;
        return [filas];
      }
    })
  };
};

describe("DocumentoIdentidadService · validación por tipo", () => {
  it("una cédula con el verificador malo se RECHAZA con 400", async () => {
    const { servicio } = servicioCon([[{ id: 1, code: "cedula_ec", name: "Cedula", validacion: "cedula_ec" }]]);
    await assert.rejects(
      () => servicio.guardarPrincipal(1, { tipo: "cedula_ec", numero: "1710034066" }),
      (error) => {
        assert.match(error.message, /dígito verificador/);
        assert.equal(error.status, 400);
        return true;
      }
    );
  });

  it("un pasaporte SIN país emisor se rechaza: sin él la unicidad no se sostiene", async () => {
    const { servicio } = servicioCon([[{ id: 2, code: "pasaporte", name: "Pasaporte", validacion: "alfanumerico" }]]);
    await assert.rejects(
      () => servicio.guardarPrincipal(1, { tipo: "pasaporte", numero: "AB123456" }),
      (error) => {
        assert.match(error.message, /país emisor/);
        assert.equal(error.status, 400);
        return true;
      }
    );
  });

  it("un pasaporte con caracteres raros se rechaza", async () => {
    const { servicio } = servicioCon([[{ id: 2, code: "pasaporte", name: "Pasaporte", validacion: "alfanumerico" }]]);
    await assert.rejects(
      () => servicio.guardarPrincipal(1, { tipo: "pasaporte", pais: "ES", numero: "AB/12*3456" }),
      (error) => {
        assert.match(error.message, /letras y números/);
        return true;
      }
    );
  });

  it("un tipo que no está en el catálogo se rechaza", async () => {
    const { servicio } = servicioCon([[]]);
    await assert.rejects(
      () => servicio.guardarPrincipal(1, { tipo: "carne_conducir", numero: "123456" }),
      (error) => {
        assert.match(error.message, /no está en el catálogo/);
        assert.equal(error.status, 400);
        return true;
      }
    );
  });
});
