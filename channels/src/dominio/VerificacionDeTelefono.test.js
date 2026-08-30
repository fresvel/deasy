import { describe, it } from "node:test";
import assert from "node:assert/strict";
import VerificacionDeTelefono, { MOTIVOS } from "./VerificacionDeTelefono.js";
import MensajeEntrante from "./MensajeEntrante.js";

// Un backend de mentira. Toda esta batería corre SIN RED, sin Telegram y sin un módem: la
// política es lógica pura, y es lo que el diseño manda probar antes de conectar nada real.
const deasyCon = ({ peticion = null, falla = false } = {}) => {
  const confirmaciones = [];
  return {
    confirmaciones,
    resolverLlave: async () => {
      if (falla) throw new Error("caído");
      return peticion;
    },
    confirmarVerificacion: async (datos) => confirmaciones.push(datos),
  };
};

const mensaje = (extra = {}) =>
  new MensajeEntrante({ canal: "telegram", llave: "K1", ...extra });

describe("VerificacionDeTelefono · el camino que verifica", () => {
  it("con llave buena y número que coincide, verifica y se lo cuenta al backend", async () => {
    const deasy = deasyCon({ peticion: { numero: "0991112233", personaId: 7 } });
    const resultado = await new VerificacionDeTelefono(deasy)
      .procesar(mensaje({ numeroProbado: "0991112233" }));

    assert.equal(resultado.verificado, true);
    assert.deepEqual(deasy.confirmaciones, [{ llave: "K1", numero: "0991112233", canal: "telegram" }]);
  });

  // La política NO marca nada: se lo pide al backend, que es donde están los datos.
  it("no verifica por su cuenta: sólo avisa", async () => {
    const deasy = deasyCon({ peticion: { numero: "0991112233" } });
    const politica = new VerificacionDeTelefono(deasy);
    assert.equal(typeof politica.marcarVerificado, "undefined");
    await politica.procesar(mensaje({ numeroProbado: "0991112233" }));
    assert.equal(deasy.confirmaciones.length, 1);
  });
});

describe("VerificacionDeTelefono · los rechazos, y por qué son distintos entre sí", () => {
  it("sin llave no se pregunta nada al backend", async () => {
    let preguntado = false;
    const deasy = { resolverLlave: async () => { preguntado = true; }, confirmarVerificacion: async () => {} };
    const r = await new VerificacionDeTelefono(deasy).procesar(mensaje({ llave: "   " }));
    assert.equal(r.motivo, MOTIVOS.SIN_LLAVE);
    assert.equal(preguntado, false, "un mensaje cualquiera no debe costar una consulta");
  });

  it("una llave que el backend no reconoce se rechaza", async () => {
    const deasy = deasyCon({ peticion: null });
    const r = await new VerificacionDeTelefono(deasy).procesar(mensaje({ numeroProbado: "0991112233" }));
    assert.equal(r.motivo, MOTIVOS.LLAVE_DESCONOCIDA);
    assert.equal(deasy.confirmaciones.length, 0);
  });

  // ESTE NO ES UN RECHAZO, y confundirlo rompería Telegram: su primer paso llega sin número
  // porque el bot NO lo recibe. Lo que toca entonces es pedir el contacto, no decir que no.
  it("«falta el número» devuelve el esperado, porque el canal aún tiene que pedirlo", async () => {
    const deasy = deasyCon({ peticion: { numero: "0991112233" } });
    const r = await new VerificacionDeTelefono(deasy).procesar(mensaje());
    assert.equal(r.motivo, MOTIVOS.FALTA_NUMERO);
    assert.equal(r.numeroEsperado, "0991112233", "el canal lo necesita para comparar después");
    assert.equal(deasy.confirmaciones.length, 0);
  });

  it("un número que no es el pedido se rechaza y NO se confirma nada", async () => {
    const deasy = deasyCon({ peticion: { numero: "0991112233" } });
    const r = await new VerificacionDeTelefono(deasy).procesar(mensaje({ numeroProbado: "0987654321" }));
    assert.equal(r.motivo, MOTIVOS.NUMERO_DISTINTO);
    assert.equal(deasy.confirmaciones.length, 0);
  });

  // Que el backend no conteste no es culpa del usuario. Decirle «tus datos no son correctos»
  // sería mentira, y además le haría reintentar cambiando cosas que están bien.
  it("si el backend no contesta, el motivo lo distingue de un rechazo", async () => {
    const r = await new VerificacionDeTelefono(deasyCon({ falla: true }))
      .procesar(mensaje({ numeroProbado: "0991112233" }));
    assert.equal(r.motivo, MOTIVOS.BACKEND_CAIDO);
    assert.notEqual(r.motivo, MOTIVOS.LLAVE_DESCONOCIDA);
  });

  it("se pregunta por la llave ANTES de mirar el número", async () => {
    // Si se comparara primero, se compararía contra un número que nadie ha pedido.
    const deasy = deasyCon({ peticion: null });
    const r = await new VerificacionDeTelefono(deasy).procesar(mensaje({ numeroProbado: "0000000000" }));
    assert.equal(r.motivo, MOTIVOS.LLAVE_DESCONOCIDA, "no puede rechazar por el número si la llave no vale");
  });
});

describe("mismoNumero · el mismo teléfono escrito de tres formas", () => {
  const mismo = VerificacionDeTelefono.mismoNumero;

  // El usuario lo teclea en el registro, Telegram lo devuelve con prefijo internacional y un
  // SMS lo trae en otro formato. Comparar las cadenas tal cual rechazaría verificaciones
  // legítimas, y el usuario no tendría forma de entender por qué.
  it("reconoce el mismo número con y sin prefijo de país", () => {
    assert.equal(mismo("+593 99 111 2233", "0991112233"), true);
    assert.equal(mismo("593991112233", "0991112233"), true);
    assert.equal(mismo("0991112233", "099-111-2233"), true);
  });

  it("distingue dos números distintos", () => {
    assert.equal(mismo("0991112233", "0987654321"), false);
  });

  it("un número vacío nunca coincide con nada", () => {
    assert.equal(mismo("", "0991112233"), false);
    assert.equal(mismo(null, "0991112233"), false);
    assert.equal(mismo("0991112233", undefined), false);
  });

  // Comparar menos de ocho dígitos abriría la puerta a que dos teléfonos distintos coincidan
  // por azar en la cola.
  it("no da por iguales dos números que sólo comparten el final corto", () => {
    assert.equal(mismo("0991112233", "0982233"), false);
  });
});

describe("MensajeEntrante", () => {
  it("obliga a decir de qué canal viene", () => {
    assert.throws(() => new MensajeEntrante({ llave: "K1" }), /de qué canal/);
  });

  it("un número en blanco NO cuenta como probado", () => {
    assert.equal(new MensajeEntrante({ canal: "sms", llave: "K", numeroProbado: "  " }).tieneNumero, false);
  });

  it("es inmutable: lo que el canal afirmó no se puede reescribir después", () => {
    const m = new MensajeEntrante({ canal: "sms", llave: "K", numeroProbado: "0991112233" });
    assert.throws(() => { m.numeroProbado = "otro"; });
  });
});
