import { describe, it } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import RecuperarCorreoService from "./RecuperarCorreoService.js";

const HASH = bcrypt.hashSync("Demo1234!", 10);

// El falso responde por CONTENIDO, no por orden: una consulta nueva del servicio no debe romper una
// prueba que no la mira. Es la lección de `DocumentoIdentidadService.test.js`.
const servicioCon = ({ documento = [], persona = [], pais = [], institucion = [] } = {}) => {
  const consultas = [];
  const pool = {
    query: async (sql, params) => {
      consultas.push({ sql, params });
      if (/FROM documentos_identidad/i.test(sql)) return [documento];
      if (/FROM persons/i.test(sql)) return [persona];
      if (/FROM instituciones/i.test(sql)) return [institucion];
      if (/FROM paises/i.test(sql)) return [pais];
      return [[]];
    }
  };
  return { consultas, servicio: new RecuperarCorreoService(pool) };
};

const INSTITUCION_EC = [{ id: 1, nombre: "Institución", pais_id: 60, pais_iso: "EC", pais_nombre: "Ecuador" }];

describe("RecuperarCorreoService", () => {
  it("con el documento y la contraseña correctos devuelve el correo COMPLETO", async () => {
    const { servicio } = servicioCon({
      institucion: INSTITUCION_EC,
      documento: [{ person_id: 1 }],
      persona: [{ password_hash: HASH, email: "admin@institucion.edu.ec" }]
    });
    const { email } = await servicio.recuperar({ numero: "1234567897", password: "Demo1234!" });
    // Enmascarado no serviría: no se puede iniciar sesión con `a***n@…`, y quien ya probó su
    // contraseña no gana nada con la máscara.
    assert.equal(email, "admin@institucion.edu.ec");
  });

  // LO QUE ESTE DISEÑO EXISTE PARA EVITAR: que el endpoint sea un directorio de cédulas. Si los dos
  // fallos se distinguieran, cualquiera con una cédula podría averiguar quién tiene cuenta.
  it("«no existe» y «contraseña incorrecta» dan EXACTAMENTE el mismo error", async () => {
    const noExiste = servicioCon({ institucion: INSTITUCION_EC, documento: [] });
    const claveMala = servicioCon({
      institucion: INSTITUCION_EC,
      documento: [{ person_id: 1 }],
      persona: [{ password_hash: HASH, email: "admin@institucion.edu.ec" }]
    });

    const errorA = await noExiste.servicio.recuperar({ numero: "0000000000", password: "Demo1234!" }).catch((e) => e);
    const errorB = await claveMala.servicio.recuperar({ numero: "1234567897", password: "otra" }).catch((e) => e);

    assert.equal(errorA.message, errorB.message);
    assert.equal(errorA.status, errorB.status);
    assert.equal(errorA.status, 401);
  });

  // Sin esto, el tiempo de respuesta delata lo que el mensaje calla: comparar contra un hash real
  // tarda ~60 ms y no comparar nada tarda ~0.
  it("compara la contraseña AUNQUE la persona no exista, para no delatar por tiempo", async () => {
    const { servicio } = servicioCon({ institucion: INSTITUCION_EC, documento: [] });
    const antes = process.hrtime.bigint();
    await servicio.recuperar({ numero: "0000000000", password: "loquesea" }).catch(() => {});
    const ms = Number(process.hrtime.bigint() - antes) / 1e6;
    assert.ok(ms > 20, `deberia costar lo que un bcrypt, no ${ms.toFixed(1)} ms`);
  });

  it("sin contraseña no llega a mirar la base", async () => {
    const { servicio, consultas } = servicioCon({ institucion: INSTITUCION_EC });
    await assert.rejects(() => servicio.recuperar({ numero: "1234567897" }));
    assert.equal(consultas.length, 0);
  });

  // El documento nacional no lleva país en el formulario: lo pone la institución.
  it("sin país, usa el de la institución", async () => {
    const { servicio, consultas } = servicioCon({
      institucion: INSTITUCION_EC,
      documento: [{ person_id: 1 }],
      persona: [{ password_hash: HASH, email: "a@b.c" }]
    });
    await servicio.recuperar({ numero: "1234567897", password: "Demo1234!" });
    const busqueda = consultas.find((c) => /FROM documentos_identidad/i.test(c.sql));
    assert.deepEqual(busqueda.params, ["documento_nacional", 60, "1234567897"]);
  });

  it("una persona sin correo principal no puede recuperarlo, y no se distingue del resto", async () => {
    const { servicio } = servicioCon({
      institucion: INSTITUCION_EC,
      documento: [{ person_id: 1 }],
      persona: [{ password_hash: HASH, email: null }]
    });
    await assert.rejects(
      () => servicio.recuperar({ numero: "1234567897", password: "Demo1234!" }),
      (e) => e.status === 401
    );
  });
});
