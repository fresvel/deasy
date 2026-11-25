import { test } from "node:test";
import assert from "node:assert/strict";
import { hayCorreoConfigurado, loQueFalta, explicacion } from "./configuracionDeCorreo.js";

const BUZON_LOCAL = { SMTP_HOST: "mailpit", SMTP_PORT: "1025", SMTP_FROM: "Deasy <no@deasy.local>" };

// Un buzón local no pide credenciales. Exigirlas rompería el único montaje que permite EJERCITAR el
// envío en desarrollo, que es justo lo que hay que probar cuando el correo se vuelve obligatorio.
test("sin usuario ni contraseña se puede enviar: el buzón local no las pide", () => {
  assert.equal(hayCorreoConfigurado(BUZON_LOCAL), true);
  assert.deepEqual(loQueFalta(BUZON_LOCAL), []);
  assert.equal(explicacion(BUZON_LOCAL), null);
});

// El fallo natural es silencioso: sin `SMTP_HOST` el transporte cae al proveedor que estaba
// cableado, sin credenciales, y revienta en tiempo de llamada muy lejos de la causa.
test("lo que falta se dice ENTERO y por su nombre", () => {
  assert.deepEqual(loQueFalta({}), ["SMTP_HOST", "SMTP_FROM"]);
  assert.deepEqual(loQueFalta({ SMTP_HOST: "smtp.institucion.edu.ec" }), ["SMTP_FROM"]);
  assert.match(explicacion({}), /SMTP_HOST, SMTP_FROM/);
  // Y dice la CONSECUENCIA, no sólo el síntoma: quien lea esto tiene que saber qué se rompe.
  assert.match(explicacion({}), /nadie puede registrarse/);
});

test("en blanco es lo mismo que ausente: un `.env` deja variables vacías con toda naturalidad", () => {
  assert.equal(hayCorreoConfigurado({ ...BUZON_LOCAL, SMTP_HOST: "   " }), false);
  assert.equal(hayCorreoConfigurado({ ...BUZON_LOCAL, SMTP_FROM: "" }), false);
});
