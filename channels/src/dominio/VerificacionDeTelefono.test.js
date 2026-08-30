import { describe, it } from "node:test";
import assert from "node:assert/strict";
import VerificacionDeTelefono, { MOTIVOS } from "./VerificacionDeTelefono.js";
import MensajeEntrante from "./MensajeEntrante.js";

// Un backend de mentira. Toda esta batería corre SIN RED, sin Telegram y sin un módem: la política
// es lógica pura, y es lo que el diseño manda probar antes de conectar nada real.
//
// ⚠️ Desde C2b la política YA NO COMPARA NÚMEROS. Aporta el hecho que el transporte prueba —«este
// número mandó esta llave»— y el veredicto lo dicta el backend, que es el único que sabe de qué
// país es el número guardado. Por eso el doble tiene DOS palancas: si la llave vive, y si el
// backend acepta la confirmación.
const deasyCon = ({ viva = true, estado = "desconocida", confirma = true, motivo = "numero_distinto", falla = false } = {}) => {
  const confirmaciones = [];
  return {
    confirmaciones,
    estadoDeLlave: async () => {
      if (falla) throw new Error("caído");
      return viva ? { valida: true } : { valida: false, estado };
    },
    confirmarVerificacion: async (datos) => {
      confirmaciones.push(datos);
      return confirma ? { confirmado: true } : { confirmado: false, estado: motivo };
    },
  };
};

const mensaje = (extra = {}) => new MensajeEntrante({ canal: "telegram", llave: "K1", ...extra });

describe("VerificacionDeTelefono · el camino que verifica", () => {
  it("con llave viva y número, le pasa al backend LO QUE OBSERVÓ", async () => {
    const deasy = deasyCon({});
    const resultado = await new VerificacionDeTelefono(deasy)
      .procesar(mensaje({ numeroProbado: "+593 99 111 2233" }));

    assert.equal(resultado.verificado, true);
    // El número que viaja es EL QUE LLEGÓ POR EL CANAL, sin tocar. Si esta política lo normalizara
    // estaría decidiendo, y decidir es justo lo que se le quitó.
    assert.deepEqual(deasy.confirmaciones, [
      { llave: "K1", numero: "+593 99 111 2233", canal: "telegram" },
    ]);
  });

  it("no marca nada por su cuenta: sólo avisa", async () => {
    const deasy = deasyCon({});
    const politica = new VerificacionDeTelefono(deasy);
    assert.equal(typeof politica.marcarVerificado, "undefined");
    // Y ya no tiene con qué comparar: la comparación se fue al backend en C2b.
    assert.equal(typeof VerificacionDeTelefono.mismoNumero, "undefined");
    await politica.procesar(mensaje({ numeroProbado: "0991112233" }));
    assert.equal(deasy.confirmaciones.length, 1);
  });
});

describe("VerificacionDeTelefono · los rechazos, y por qué son distintos entre sí", () => {
  it("sin llave no se pregunta nada al backend", async () => {
    let preguntado = false;
    const deasy = {
      estadoDeLlave: async () => { preguntado = true; return { valida: false }; },
      confirmarVerificacion: async () => ({ confirmado: true }),
    };
    const r = await new VerificacionDeTelefono(deasy).procesar(mensaje({ llave: "   " }));
    assert.equal(r.motivo, MOTIVOS.SIN_LLAVE);
    assert.equal(preguntado, false, "un mensaje cualquiera no debe costar una consulta");
  });

  it("una llave que el backend no reconoce se rechaza sin confirmar nada", async () => {
    const deasy = deasyCon({ viva: false });
    const r = await new VerificacionDeTelefono(deasy).procesar(mensaje({ numeroProbado: "0991112233" }));
    assert.equal(r.motivo, MOTIVOS.LLAVE_DESCONOCIDA);
    assert.equal(deasy.confirmaciones.length, 0);
  });

  // Tres estados y no uno, porque son tres mensajes distintos para el usuario, y sólo los dos
  // últimos le dicen que repita SIN cambiar nada de lo que hizo.
  for (const [estado, esperado] of [
    ["desconocida", MOTIVOS.LLAVE_DESCONOCIDA],
    ["caducada", MOTIVOS.LLAVE_CADUCADA],
    ["consumida", MOTIVOS.LLAVE_CONSUMIDA],
  ]) {
    it(`la sonda dice «${estado}» y el motivo lo respeta`, async () => {
      const r = await new VerificacionDeTelefono(deasyCon({ viva: false, estado }))
        .procesar(mensaje({ numeroProbado: "0991112233" }));
      assert.equal(r.motivo, esperado);
    });
  }

  // ESTE NO ES UN RECHAZO, y confundirlo rompería Telegram: su primer paso llega sin número porque
  // el bot NO lo recibe. Lo que toca entonces es pedir el contacto, no decir que no.
  //
  // ⚠️ Y por eso la SONDA va antes: pedirle a alguien que comparta su contacto con una llave muerta
  // es hacerle entregar sus datos para nada.
  it("«falta el número» no confirma nada, y sólo se llega ahí con la llave viva", async () => {
    const deasy = deasyCon({});
    const r = await new VerificacionDeTelefono(deasy).procesar(mensaje());
    assert.equal(r.motivo, MOTIVOS.FALTA_NUMERO);
    assert.equal(deasy.confirmaciones.length, 0);
    // Se retiró `numeroEsperado`: decía «el canal lo necesita para comparar después» y ningún canal
    // lo leía nunca — y comparar ya no es cosa suya.
    assert.equal("numeroEsperado" in r, false);
  });

  // EL MOTIVO POR EL QUE EXISTE C2b. Antes esto lo decidía esta clase mirando los últimos ocho
  // dígitos, sin saber el país, y `+51 99 111 2233` valía por `+593 99 111 2233`. Ahora lo dicta el
  // backend y aquí sólo se traduce.
  it("un número que no era el pedido lo rechaza EL BACKEND, y aquí se respeta", async () => {
    const deasy = deasyCon({ confirma: false, motivo: "numero_distinto" });
    const r = await new VerificacionDeTelefono(deasy)
      .procesar(mensaje({ numeroProbado: "+51991112233" }));

    assert.equal(r.verificado, false);
    assert.equal(r.motivo, MOTIVOS.NUMERO_DISTINTO);
    // Y se le preguntó: la política NO se adelanta a juzgar.
    assert.equal(deasy.confirmaciones.length, 1);
  });

  // La carrera entre la sonda y la confirmación. No es teórica: el usuario pulsa dos veces, o
  // llegan dos mensajes casi a la vez.
  it("si la llave se consume entre la sonda y la confirmación, se rechaza — no revienta", async () => {
    const r = await new VerificacionDeTelefono(deasyCon({ confirma: false, motivo: "consumida" }))
      .procesar(mensaje({ numeroProbado: "593991112233" }));
    assert.equal(r.verificado, false);
    assert.equal(r.motivo, MOTIVOS.LLAVE_CONSUMIDA);
  });

  it("un rechazo sin motivo reconocible sigue siendo «ya usada»", async () => {
    const deasy = deasyCon({ confirma: false, motivo: "vete_a_saber" });
    const r = await new VerificacionDeTelefono(deasy)
      .procesar(mensaje({ canal: "sms", numeroProbado: "593991112233" }));
    assert.equal(r.motivo, MOTIVOS.LLAVE_CONSUMIDA);
  });
});

describe("VerificacionDeTelefono · cuando el fallo es NUESTRO", () => {
  // Decirle «tus datos no son correctos» a alguien cuyo problema es que nuestro backend no responde
  // le hace reintentar cambiando cosas que están bien.
  it("si la sonda no contesta, el motivo es que estamos caídos", async () => {
    const r = await new VerificacionDeTelefono(deasyCon({ falla: true }))
      .procesar(mensaje({ numeroProbado: "0991112233" }));
    assert.equal(r.motivo, MOTIVOS.BACKEND_CAIDO);
  });

  it("si la CONFIRMACIÓN revienta, tampoco es culpa del usuario", async () => {
    const deasy = {
      estadoDeLlave: async () => ({ valida: true }),
      confirmarVerificacion: async () => { throw new Error("caído"); },
    };
    const r = await new VerificacionDeTelefono(deasy).procesar(mensaje({ numeroProbado: "0991112233" }));
    assert.equal(r.verificado, false);
    assert.equal(r.motivo, MOTIVOS.BACKEND_CAIDO, "y NO un rechazo de la llave");
  });
});
