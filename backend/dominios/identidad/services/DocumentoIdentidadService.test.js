// El dígito verificador de la cédula ecuatoriana, y las reglas del documento.
//
// Existe porque hasta ahora NADIE validaba la cédula localmente: la única comprobación era
// `^\d{10}$` en el endpoint que consulta al registro civil, o sea con red y con token. Una cédula
// con una errata pasaba el filtro y llegaba a la base.

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { validadorPara } from "./documentosPorPais.js";

import DocumentoIdentidadService, {
  cedulaEcuatorianaValida,
  normalizarNumero,
  TIPOS_DOCUMENTO,
  TIPOS_QUE_ACREDITAN_IDENTIDAD,
} from "./DocumentoIdentidadService.js";

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
const servicioCon = ({ pais = [], institucion = [], documentos = [], principal = [] } = {}) => {
  const consultas = [];
  const responde = (sql) => {
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
    const { servicio } = servicioCon({ institucion: INSTITUCION_EC, pais: [ECUADOR] });
    await assert.rejects(
      () => servicio.guardarPrincipal(1, { tipo: "documento_nacional", numero: "1710034066" }),
      (error) => {
        assert.match(error.message, /dígito verificador/);
        assert.equal(error.status, 400);
        return true;
      }
    );
  });

  it("un pasaporte SIN país emisor se rechaza: sin él la unicidad no se sostiene", async () => {
    const { servicio } = servicioCon({ pais: [ECUADOR] });
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
    const { servicio } = servicioCon({ pais: [ECUADOR] });
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
      institucion: [{ id: 1, nombre: "Institución", pais_id: 604, pais_iso: "PE", pais_nombre: "Perú" }]
    });
    // Con la institucion en Peru, un numero de 8 digitos NO se valida como cedula ecuatoriana.
    await servicio.guardarPrincipal(1, { tipo: "documento_nacional", numero: "12345678" });

    const insert = consultas.find((c) => /INSERT INTO documentos_identidad/i.test(c.sql));
    assert.ok(insert, "tiene que haber insertado el documento");
    assert.ok(insert.params.includes(604), "el país guardado es el de la institución");
    assert.ok(
      !consultas.some((c) => /iso_alpha2 = 'EC'/.test(c.sql)),
      "no puede quedar ni un SELECT con Ecuador escrito a mano"
    );
  });

  it("y con la institución en Ecuador, ese mismo número se RECHAZA", async () => {
    const { servicio } = servicioCon({ institucion: INSTITUCION_EC });
    await assert.rejects(
      () => servicio.guardarPrincipal(1, { tipo: "documento_nacional", numero: "12345678" }),
      (error) => {
        assert.match(error.message, /10 dígitos/);
        return true;
      }
    );
  });

  it("un tipo que no está en el catálogo se rechaza", async () => {
    const { servicio } = servicioCon({});
    await assert.rejects(
      () => servicio.guardarPrincipal(1, { tipo: "carne_conducir", numero: "123456" }),
      (error) => {
        // El mensaje cambió el 2026-08-29 y a mejor: con el vocabulario cerrado en un CHECK se pueden
        // enumerar los válidos, cosa que con un catálogo vivo no tendría sentido.
        assert.match(error.message, /no existe/);
        assert.match(error.message, /documento_nacional, documento_extranjero, pasaporte/);
        assert.equal(error.status, 400);
        return true;
      }
    );
  });
});

// LA VISA NO ES UNA CEDULA, y el validador daba por hecho que si.
//
// POR QUE EXISTE. `validadorPara` eximia SOLO al pasaporte, con el razonamiento correcto -- un
// numero de pasaporte no lleva digito verificador--. Pero eso dejaba una premisa tacita: que todo lo
// demas era el documento nacional de su pais. Al entrar `visa` (frente 20, P4) la premisa dejo de
// ser cierta, y una visa ecuatoriana valida se rechazaba con "La cedula ecuatoriana tiene
// exactamente 10 digitos". Lo cazo probar por el camino real de la aplicacion, no un INSERT.
describe("la visa y el validador del pais", () => {
  // El generico admite [A-Z0-9] de 5 a 20, sin guiones -- el mismo que ya se aplica al pasaporte.
  const NUMERO_DE_VISA = "V2026000042";

  it("una visa NO pasa por el validador de cedula", () => {
    assert.equal(validadorPara({ tipoCode: "visa", paisIso: "EC" })(NUMERO_DE_VISA), null);
  });

  it("pero el documento_extranjero SI, porque ese es el nacional de otro pais", () => {
    assert.notEqual(validadorPara({ tipoCode: "documento_extranjero", paisIso: "EC" })(NUMERO_DE_VISA), null);
  });
});

// Y LA VISA TAMPOCO ES EL DOCUMENTO PRINCIPAL. Es la otra mitad de la misma premisa, y la mas cara:
// `guardarPrincipal` REESCRIBE la fila principal en su sitio, asi que dejar entrar una visa por ahi
// no anadia una visa — CONVERTIA en visa el documento de identidad de la persona, que desaparecia.
// Medido contra la base de dev el 2026-09-09: el gestor perdio su cedula con un solo PATCH.
describe("la visa no puede ser el documento principal", () => {
  it("se rechaza con 400, y el mensaje dice POR QUE", async () => {
    const { servicio, consultas } = servicioCon({ pais: [ECUADOR], institucion: INSTITUCION_EC });
    await assert.rejects(
      () => servicio.guardarPrincipal(1, { tipo: "visa", pais: "EC", numero: "V2026000042" }),
      (error) => {
        assert.match(error.message, /no acredita identidad/);
        assert.equal(error.status, 400);
        return true;
      }
    );
    // Lo que de verdad importa: que no haya llegado a TOCAR la fila que ya estaba.
    assert.ok(
      !consultas.some((c) => /UPDATE documentos_identidad/i.test(c.sql)),
      "no puede haber reescrito el documento principal existente"
    );
    assert.ok(
      !consultas.some((c) => /INSERT INTO documentos_identidad/i.test(c.sql)),
      "ni haber insertado nada"
    );
  });

  it("los otros tres SI pueden serlo", async () => {
    for (const tipo of TIPOS_QUE_ACREDITAN_IDENTIDAD) {
      assert.ok(TIPOS_DOCUMENTO.includes(tipo), `${tipo} tiene que seguir siendo un tipo valido`);
    }
    assert.deepEqual(TIPOS_QUE_ACREDITAN_IDENTIDAD, [
      "documento_nacional",
      "documento_extranjero",
      "pasaporte",
    ]);
  });
});

// EL ESCANEO DEJA RASTRO. El PDF del documento lo pueden subir y bajar el titular, AdminSistema y
// Talento Humano (lo fija la ruta). Toda subida queda en la bitacora EN SU TRANSACCION, y toda bajada
// de un TERCERO queda antes de entregarse; la del propio titular, no.
describe("el escaneo deja rastro", () => {
  const poolCon = ({ fallaSi = null } = {}) => {
    const consultas = [];
    const ejecutar = async (sql, params) => {
      consultas.push({ sql, params });
      if (fallaSi && fallaSi.test(sql)) throw new Error("bitacora caida");
      return [[]];
    };
    return {
      consultas,
      pool: {
        query: ejecutar,
        getConnection: async () => ({
          query: ejecutar,
          beginTransaction: async () => { consultas.push({ sql: "BEGIN" }); },
          commit: async () => { consultas.push({ sql: "COMMIT" }); },
          rollback: async () => { consultas.push({ sql: "ROLLBACK" }); },
          release: () => {}
        })
      }
    };
  };
  const DOCUMENTO = { id: 5, person_id: 9 };

  it("subirlo: el cambio y su entrada van en UNA transaccion", async () => {
    const { pool, consultas } = poolCon();
    await new DocumentoIdentidadService(pool).registrarEscaneoConRastro({
      documento: DOCUMENTO, referencia: "minio://documentos/9/5.pdf", actorId: 1
    });
    const orden = consultas
      .map((c) => c.sql.match(/^(BEGIN|COMMIT|ROLLBACK)$|(UPDATE documentos_identidad SET escaneo_ref)|(INSERT INTO accesos_sensibles)/))
      .filter(Boolean)
      .map((m) => m[1] ?? m[2] ?? m[3]);
    assert.deepEqual(orden, ["BEGIN", "UPDATE documentos_identidad SET escaneo_ref", "INSERT INTO accesos_sensibles", "COMMIT"]);
  });

  it("si la bitacora falla, el escaneo NO queda registrado", async () => {
    const { pool, consultas } = poolCon({ fallaSi: /INSERT INTO accesos_sensibles/ });
    await assert.rejects(
      () => new DocumentoIdentidadService(pool).registrarEscaneoConRastro({
        documento: DOCUMENTO, referencia: "minio://documentos/9/5.pdf", actorId: 1
      }),
      /bitacora caida/
    );
    assert.deepEqual(consultas.map((c) => c.sql).filter((sql) => /^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)), ["BEGIN", "ROLLBACK"]);
  });

  it("bajarlo: un tercero queda apuntado; el titular bajando lo suyo, no", async () => {
    const { pool, consultas } = poolCon();
    const servicio = new DocumentoIdentidadService(pool);
    await servicio.registrarLecturaDeEscaneo({ documento: DOCUMENTO, actorId: 9 });
    assert.equal(consultas.length, 0, "el titular no es un tercero");
    await servicio.registrarLecturaDeEscaneo({ documento: DOCUMENTO, actorId: 1, ip: "10.0.0.2" });
    assert.deepEqual(consultas[0].params, [9, 1, "datos_sensibles", "documentos_identidad", 5, "read", null, "10.0.0.2"]);
  });
});
