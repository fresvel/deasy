import { describe, it } from "node:test";
import assert from "node:assert/strict";

import Limitador from "./Limitador.js";
import { SUJETOS } from "./reglas.js";

/** Un almacén de mentira: cuenta en memoria. Aquí SÍ vale — es una prueba, no un despliegue. */
const almacenFalso = ({ falla = null } = {}) => {
  const filas = [];
  return {
    filas,
    limpiezas: 0,
    async contar(accion, sujeto) {
      if (falla === "contar") throw new Error("la base no contesta");
      return filas.filter((f) => f.accion === accion && f.sujeto === sujeto).length;
    },
    async registrar(accion, sujeto) {
      if (falla === "registrar") throw new Error("la base no contesta");
      filas.push({ accion, sujeto });
    },
    async segundosParaElSiguiente() {
      return 42;
    },
    async limpiar() {
      this.limpiezas += 1;
    },
  };
};

const REGLAS_DE_PRUEBA = {
  login: { ventanaSegundos: 900, tope: 3, sujeto: SUJETOS.CORREO_E_IP },
  validar_cedula: { ventanaSegundos: 60, tope: 2, sujeto: SUJETOS.IP },
};

describe("Limitador", () => {
  it("deja pasar mientras no se llega al tope, y frena EN el tope", async () => {
    const almacen = almacenFalso();
    const l = new Limitador(almacen, REGLAS_DE_PRUEBA);

    for (let i = 0; i < 3; i += 1) {
      assert.equal((await l.comprobar("login", "ana@x.ec|1.1.1.1")).permitido, true, `intento ${i + 1}`);
      await l.registrar("login", "ana@x.ec|1.1.1.1");
    }

    const cuarto = await l.comprobar("login", "ana@x.ec|1.1.1.1");
    assert.equal(cuarto.permitido, false, "el tope es 3: el cuarto se frena");
    assert.equal(cuarto.reintentarEn, 42);
  });

  it("los intentos de UNO no cuentan contra OTRO — es lo que evita el bloqueo ajeno", async () => {
    const almacen = almacenFalso();
    const l = new Limitador(almacen, REGLAS_DE_PRUEBA);

    for (let i = 0; i < 5; i += 1) await l.registrar("login", "victima@x.ec|9.9.9.9");

    assert.equal((await l.comprobar("login", "victima@x.ec|1.1.1.1")).permitido, true,
      "desde OTRA ip la misma cuenta sigue pudiendo entrar: si no, cualquiera bloquea a cualquiera");
    assert.equal((await l.comprobar("login", "otra@x.ec|9.9.9.9")).permitido, true,
      "desde la MISMA ip otra cuenta sigue pudiendo entrar: si no, se cae toda la facultad tras el NAT");
  });

  it("las acciones no se mezclan entre sí", async () => {
    const almacen = almacenFalso();
    const l = new Limitador(almacen, REGLAS_DE_PRUEBA);

    for (let i = 0; i < 5; i += 1) await l.registrar("validar_cedula", "1.1.1.1");

    assert.equal((await l.comprobar("login", "1.1.1.1")).permitido, true);
    assert.equal((await l.comprobar("validar_cedula", "1.1.1.1")).permitido, false);
  });

  it("una acción SIN regla no se frena nunca", async () => {
    const l = new Limitador(almacenFalso(), REGLAS_DE_PRUEBA);
    for (let i = 0; i < 100; i += 1) await l.registrar("accion_inventada", "1.1.1.1");
    assert.equal((await l.comprobar("accion_inventada", "1.1.1.1")).permitido, true);
  });

  it("sin sujeto no se frena: es mejor no proteger que castigar a todos en el mismo cubo", async () => {
    const l = new Limitador(almacenFalso(), REGLAS_DE_PRUEBA);
    assert.equal((await l.comprobar("login", "")).permitido, true);
  });

  describe("cuando la base no contesta", () => {
    it("ABRE en login: sin base tampoco se podría entrar, y el limitador no puede ser lo que rompa", async () => {
      const l = new Limitador(almacenFalso({ falla: "contar" }), REGLAS_DE_PRUEBA);
      assert.equal((await l.comprobar("login", "ana@x.ec|1.1.1.1")).permitido, true);
    });

    it("CIERRA en validar_cedula: es una comodidad y detrás hay dinero de otro", async () => {
      const l = new Limitador(almacenFalso({ falla: "contar" }), REGLAS_DE_PRUEBA);
      const r = await l.comprobar("validar_cedula", "1.1.1.1");
      assert.equal(r.permitido, false, "si no puedo contar, no llamo al servicio de pago");
      assert.ok(r.reintentarEn > 0);
    });

    it("y si falla al REGISTRAR, la petición del usuario NO se rompe", async () => {
      const l = new Limitador(almacenFalso({ falla: "registrar" }), REGLAS_DE_PRUEBA);
      await assert.doesNotReject(() => l.registrar("login", "ana@x.ec|1.1.1.1"));
    });
  });
});
