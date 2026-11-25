import { test } from "node:test";
import assert from "node:assert/strict";
import { generarLlave, huellaDeLlave, MINUTOS_DE_VIDA } from "./TelefonoVerificacionService.js";

// Estas dos funciones son el núcleo: si la llave sale fuera del alfabeto de Telegram, el canal se
// rompe EN EJECUCIÓN; y si la huella deja de ser determinista, ninguna llave se puede resolver
// nunca. Ni una cosa ni la otra las ve `node --check`, y las de caracterización sólo las ejercitan
// de paso.

test("la llave cabe en un enlace de Telegram", () => {
  for (let i = 0; i < 200; i += 1) {
    const llave = generarLlave();
    // El límite es de la API de Telegram (`?start=<payload>`), no una preferencia nuestra.
    assert.ok(llave.length <= 64, `midió ${llave.length}`);
    assert.match(llave, /^[A-Za-z0-9_-]+$/, `salió del alfabeto: ${llave}`);
  }
});

test("dos llaves seguidas no se parecen", () => {
  const muchas = new Set(Array.from({ length: 500 }, generarLlave));
  assert.equal(muchas.size, 500, "una repetición en 500 significa que la fuente no es aleatoria");
});

test("la huella es determinista — y por eso se puede BUSCAR por ella", () => {
  const llave = generarLlave();
  assert.equal(huellaDeLlave(llave), huellaDeLlave(llave));
  assert.notEqual(huellaDeLlave(llave), huellaDeLlave(generarLlave()));
  // Es la diferencia con bcrypt, y el motivo de elegir SHA-256 aquí: el servicio sólo tiene la
  // llave que le llegó, y averiguar de qué teléfono es *es* la operación. Con sal no se puede.
  assert.match(huellaDeLlave(llave), /^[0-9a-f]{64}$/, "64 hex, que es lo que declara la columna");
});

test("una llave ausente no revienta ni colisiona con la cadena vacía... salvo consigo misma", () => {
  // `resolver(undefined)` tiene que poder ejecutarse: llega de un cuerpo JSON que puede venir vacío.
  assert.equal(huellaDeLlave(undefined), huellaDeLlave(null));
  assert.equal(huellaDeLlave(undefined), huellaDeLlave(""));
  // Y no encuentra nada, porque ninguna llave emitida es la cadena vacía.
  assert.notEqual(huellaDeLlave(""), huellaDeLlave(generarLlave()));
});

test("la vida de la llave es corta y está escrita en un solo sitio", () => {
  assert.equal(MINUTOS_DE_VIDA, 15);
  assert.ok(MINUTOS_DE_VIDA <= 30, "una llave que dura horas es una llave que se puede robar con calma");
});
