import { test } from "node:test";
import assert from "node:assert/strict";
import { aFormatoInternacional, numerosIguales } from "./numerosDeTelefono.js";

const EC = { numero: "0991112233", phone_code: "+593" };

test("el cero nacional se cae y el prefijo pierde el `+`", () => {
  assert.equal(aFormatoInternacional("0991112233", "+593"), "593991112233");
  assert.equal(aFormatoInternacional("991112233", "593"), "593991112233");
  // Guardado con el formato local completo: se caen TODOS los ceros iniciales, no uno.
  assert.equal(aFormatoInternacional("00991112233", "593"), "593991112233");
  // Y el prefijo escrito como marcación internacional tampoco arrastra su `00`.
  assert.equal(aFormatoInternacional("0991112233", "00593"), "593991112233");
});

// ── LA REGRESIÓN QUE TRAJO ESTE MÓDULO AQUÍ ─────────────────────────────────────────────────────
//
// Comprobado el 2026-08-30 contra el código anterior: comparaba los últimos ocho dígitos, y con esa
// regla estos dos eran el MISMO teléfono. Se podía registrar el número de otro y verificarlo desde
// una línea propia de otro país con la misma cola.
test("dos países con la misma cola NO son el mismo teléfono", () => {
  assert.equal(numerosIguales(EC, "+51991112233"), false, "Perú no es Ecuador");
  assert.equal(numerosIguales(EC, "51991112233"), false);
  // Y tampoco vale un número que simplemente TERMINE igual, con más dígitos delante.
  assert.equal(numerosIguales(EC, "1234593991112233"), false);
});

test("el mismo teléfono, escrito como lo entrega cada transporte", () => {
  // Telegram, WhatsApp y las pasarelas de SMS dan la internacional.
  assert.equal(numerosIguales(EC, "+593 99 111 2233"), true);
  assert.equal(numerosIguales(EC, "593991112233"), true);
  assert.equal(numerosIguales(EC, "00593991112233"), true);
  // Un SMS nacional desde módem propio puede traerla local, con cero o sin él.
  assert.equal(numerosIguales(EC, "0991112233"), true);
  assert.equal(numerosIguales(EC, "991112233"), true);
});

test("un teléfono sin país NO se puede verificar", () => {
  // `telefonos.pais_id` es nullable, así que el caso existe. Sin prefijo la única comparación
  // posible sería la local, que es justo la que da por bueno el número de otro país.
  assert.equal(numerosIguales({ numero: "0991112233", phone_code: null }, "0991112233"), false);
  assert.equal(numerosIguales({ numero: "0991112233" }, "593991112233"), false);
});

test("lo vacío y lo ausente se rechazan, no revientan", () => {
  assert.equal(numerosIguales(EC, ""), false);
  assert.equal(numerosIguales(EC, null), false);
  assert.equal(numerosIguales(EC, undefined), false);
  assert.equal(numerosIguales(null, "593991112233"), false);
  assert.equal(numerosIguales({ numero: "", phone_code: "593" }, "593"), false);
});
