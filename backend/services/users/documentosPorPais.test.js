import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validadorPara, nombreLocal, etiquetaNacional, POR_PAIS } from "./documentosPorPais.js";

describe("validadorPara", () => {
  it("una cédula ecuatoriana se valida con el dígito verificador", () => {
    const validar = validadorPara({ tipoCode: "cedula_ec", paisIso: "EC" });
    assert.equal(validar("1710034065"), null);
    assert.match(validar("1710034066"), /dígito verificador/);
  });

  // La regresión que este módulo existe para evitar: colgado del TIPO, un despliegue peruano habría
  // validado el DNI de sus usuarios con el algoritmo de la cédula ecuatoriana.
  it("un país sin regla propia cae al genérico, no al de Ecuador", () => {
    const validar = validadorPara({ tipoCode: "documento_extranjero", paisIso: "PE" });
    assert.equal(validar("12345678"), null, "8 dígitos son un DNI peruano válido y aquí no se rechaza");
    assert.match(validadorPara({ tipoCode: "documento_extranjero", paisIso: "PE" })("AB"), /entre 5 y 20/);
  });

  // Un pasaporte ecuatoriano no tiene diez dígitos. Aplicarle el validador del país lo rechazaría.
  it("el PASAPORTE es alfanumérico aunque su país tenga regla propia", () => {
    const validar = validadorPara({ tipoCode: "pasaporte", paisIso: "EC" });
    assert.equal(validar("AB123456"), null);
    assert.equal(validar("1710034066"), null, "no se le aplica el dígito verificador ecuatoriano");
  });

  it("sin país no se inventa un formato: genérico", () => {
    assert.equal(validadorPara({})("AB123456"), null);
    assert.match(validadorPara({})("AB"), /entre 5 y 20/);
  });

  it("el ISO se compara sin importar mayúsculas ni espacios", () => {
    assert.match(validadorPara({ tipoCode: "cedula_ec", paisIso: " ec " })("123"), /10 dígitos/);
  });
});

describe("nombreLocal y etiquetaNacional", () => {
  it("cada país llama a lo suyo como quiere", () => {
    assert.equal(nombreLocal("EC"), "Cédula");
    assert.equal(nombreLocal("PE"), "Documento", "sin regla, un nombre genérico y no 'Cédula'");
  });

  // «Cédula (Ecuador)» estaba escrita en una fila del catálogo hasta el 2026-08-29, y por eso un
  // despliegue peruano se la habría enseñado a sus usuarios peruanos.
  it("la etiqueta se compone del país, no se guarda", () => {
    assert.equal(etiquetaNacional("EC", "Ecuador"), "Cédula (Ecuador)");
    assert.equal(etiquetaNacional("PE", "Perú"), "Documento (Perú)");
    assert.equal(etiquetaNacional("EC", null), "Cédula", "sin nombre de país, sin paréntesis vacío");
  });
});

describe("el registro", () => {
  // La respuesta a «¿no genera una fila por país?»: no hay una entrada por país del mundo, hay una
  // por país CON REGLA. El catálogo tiene 232 países y aquí hay uno.
  it("tiene tantas entradas como reglas conocidas, no como países", () => {
    assert.equal(Object.keys(POR_PAIS).length, 1);
    assert.deepEqual(Object.keys(POR_PAIS), ["EC"]);
  });
});
