import { test } from "node:test";
import assert from "node:assert/strict";
import { aFormatoInternacional, numerosIguales, numeroMalGuardado, parteLocal } from "./numerosDeTelefono.js";

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
  // Telegram, WhatsApp y las pasarelas de SMS dan SIEMPRE la internacional, en una de estas formas.
  assert.equal(numerosIguales(EC, "+593 99 111 2233"), true);
  assert.equal(numerosIguales(EC, "593991112233"), true);
  assert.equal(numerosIguales(EC, "00593991112233"), true);
});

// ── LA RAMA QUE SE RETIRÓ EL 2026-08-31, Y POR QUÉ ──────────────────────────────────────────────
//
// Se aceptaba la parte local a secas por el SMS nacional desde módem propio — o sea, por `C6`, que
// está bloqueada y sin implementar. La factura de esa permisividad llegó antes que el canal: un
// teléfono guardado MAL se verificó igualmente, porque su «parte local» casaba con el internacional
// que llegaba. En cuanto se compara algo sin país, el país deja de pintar nada, que es exactamente
// el agujero de `C2b`.
test("la forma LOCAL ya no vale: sin país no hay comparación que valga", () => {
  assert.equal(numerosIguales(EC, "0991112233"), false);
  assert.equal(numerosIguales(EC, "991112233"), false);
});

// Y el caso real que lo destapó: `numero` guardado CON el prefijo dentro. Antes verificaba de
// chiripa; ahora se detecta ANTES, porque es corrupción del dato y no un intento fallido — decirle
// a alguien «ese número no es el tuyo» cuando lo es sería mentira y no le diría qué arreglar.
test("un teléfono con el prefijo metido dentro se reconoce como MAL GUARDADO", () => {
  const roto = { numero: "593991112233", phone_code: "+593" };
  assert.equal(numeroMalGuardado(roto), true);
  assert.equal(numeroMalGuardado(EC), false);
  // Y ya no cuela por la puerta de atrás.
  assert.equal(numerosIguales(roto, "593991112233"), false);
});

test("sin país o sin número, `numeroMalGuardado` no se inventa un diagnóstico", () => {
  assert.equal(numeroMalGuardado({ numero: "0991112233", phone_code: null }), false);
  assert.equal(numeroMalGuardado({ numero: "", phone_code: "+593" }), false);
  assert.equal(numeroMalGuardado(null), false);
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

// ── EL MISMO TELÉFONO NO PUEDE ENTRAR DOS VECES ─────────────────────────────────────────────────
//
// Encontrado el 2026-08-31 registrando por el navegador: `0987651100` y `987651100` quedaron como
// DOS personas distintas con el mismo número. `uq_telefonos_numero` es un índice sobre la cadena
// cruda, así que el cero de marcación nacional lo convertía en «otro número».
//
// El resto del código ya daba por hecho la forma sin cero al LEER. Lo que faltaba era escribirla
// igual, y `parteLocal` es esa forma.
test("la forma canónica quita el cero de marcación, venga como venga", () => {
  assert.equal(parteLocal("0987651100"), "987651100");
  assert.equal(parteLocal("987651100"), "987651100");
  assert.equal(parteLocal("00987651100"), "987651100");
  assert.equal(parteLocal("098 765 11 00"), "987651100");
  assert.equal(parteLocal("+593 98 765 1100"), "593987651100", "el prefijo lo separa otro paso");
});

test("dos escrituras del mismo número dan la MISMA forma canónica", () => {
  const formas = ["0987651100", "987651100", "098-765-1100", " 0987651100 "];
  const canonicas = new Set(formas.map(parteLocal));
  assert.equal(canonicas.size, 1, `el índice único las vería como ${canonicas.size} números`);
});
