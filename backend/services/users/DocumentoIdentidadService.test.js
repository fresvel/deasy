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

// El falso responde POR CONTENIDO de la consulta, no por orden de llamada.
//
// Antes iba por orden —un array y un contador— y eso lo hacia romperse con cualquier consulta nueva
// del servicio, aunque no tuviera nada que ver con lo que la prueba comprueba. Paso el 2026-08-29 al
// resolver el validador por pais: dos pruebas de FORMATO empezaron a fallar quejandose de la
// institucion, que no era su asunto. Un falso que se rompe por donde no mira la prueba no protege,
// estorba.
const servicioCon = ({ tipo = [], pais = [], institucion = [], documentos = [], principal = [] } = {}) => {
  const consultas = [];
  const responde = (sql) => {
    if (/FROM tipos_documento/i.test(sql)) return tipo;
    if (/FROM instituciones/i.test(sql)) return institucion;
    if (/FROM paises/i.test(sql)) return pais;
    if (/FROM documentos_identidad d\s/i.test(sql)) return documentos;
    if (/FROM documentos_identidad WHERE person_id/i.test(sql)) return principal;
    return [];
  };
  return {
    consultas,
    servicio: new DocumentoIdentidadService({
      query: async (sql, params) => {
        consultas.push({ sql, params });
        return [responde(sql)];
      }
    })
  };
};

const ECUADOR = { id: 60, iso_alpha2: "EC", name: "Ecuador" };
const INSTITUCION_EC = [{ id: 1, nombre: "Institución", pais_id: 60, pais_iso: "EC", pais_nombre: "Ecuador" }];

describe("DocumentoIdentidadService · validación por tipo", () => {
  it("una cédula con el verificador malo se RECHAZA con 400", async () => {
    const { servicio } = servicioCon({ tipo: [{ id: 1, code: "cedula_ec", name: "Cedula" }], institucion: INSTITUCION_EC, pais: [ECUADOR] });
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
    const { servicio } = servicioCon({ tipo: [{ id: 2, code: "pasaporte", name: "Pasaporte" }], pais: [ECUADOR] });
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
    const { servicio } = servicioCon({ tipo: [{ id: 2, code: "pasaporte", name: "Pasaporte" }], pais: [ECUADOR] });
    await assert.rejects(
      () => servicio.guardarPrincipal(1, { tipo: "pasaporte", pais: "ES", numero: "AB/12*3456" }),
      (error) => {
        assert.match(error.message, /letras y números/);
        return true;
      }
    );
  });

  // Lo que I2 entrega: el pais del documento nacional sale de la INSTITUCION. Antes habia un
  // `SELECT ... WHERE iso_alpha2 = 'EC'` escrito a mano, asi que un despliegue peruano habria
  // guardado las cedulas de sus usuarios como ecuatorianas.
  it("el documento nacional hereda el país de la institución, no de un 'EC' a mano", async () => {
    const { servicio, consultas } = servicioCon({
      tipo: [{ id: 1, code: "cedula_ec", name: "Cedula" }],
      institucion: [{ id: 1, nombre: "Institución", pais_id: 604, pais_iso: "PE", pais_nombre: "Perú" }],
      principal: []
    });
    // Con la institucion en Peru, un numero de 8 digitos NO se valida como cedula ecuatoriana.
    await servicio.guardarPrincipal(1, { tipo: "cedula_ec", numero: "12345678" });

    const insert = consultas.find((c) => /INSERT INTO documentos_identidad/i.test(c.sql));
    assert.ok(insert, "tiene que haber insertado el documento");
    assert.ok(insert.params.includes(604), "el país guardado es el de la institución");
    assert.ok(
      !consultas.some((c) => /iso_alpha2 = 'EC'/.test(c.sql)),
      "no puede quedar ni un SELECT con Ecuador escrito a mano"
    );
  });

  it("y con la institución en Ecuador, ese mismo número se RECHAZA", async () => {
    const { servicio } = servicioCon({
      tipo: [{ id: 1, code: "cedula_ec", name: "Cedula" }],
      institucion: INSTITUCION_EC
    });
    await assert.rejects(
      () => servicio.guardarPrincipal(1, { tipo: "cedula_ec", numero: "12345678" }),
      (error) => {
        assert.match(error.message, /10 dígitos/);
        return true;
      }
    );
  });

  it("un tipo que no está en el catálogo se rechaza", async () => {
    const { servicio } = servicioCon({ tipo: [] });
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
