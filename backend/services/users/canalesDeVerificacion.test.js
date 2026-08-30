import { test } from "node:test";
import assert from "node:assert/strict";
import { canalesConfigurados, hayAlgunCanal } from "./canalesDeVerificacion.js";

test("un canal sin configurar NO aparece — ausente no es `null`", () => {
  const solo = canalesConfigurados("LLAVE", { TELEGRAM_BOT_USERNAME: "bot_deasy" });
  assert.deepEqual(Object.keys(solo), ["telegram"]);
  assert.equal(solo.telegram, "https://t.me/bot_deasy?start=LLAVE");
  // Si apareciera como `null`, la pantalla tendría que distinguir «no lo ofrecemos» de «falló».
  assert.equal("whatsapp" in solo, false);
  assert.equal("sms" in solo, false);
});

test("los tres canales, cada uno con la forma que espera su aplicación", () => {
  const todos = canalesConfigurados("LLA VE", {
    TELEGRAM_BOT_USERNAME: "bot_deasy",
    WHATSAPP_NUMERO: "593991112233",
    SMS_NUMERO: "+593991112233",
  });
  assert.equal(todos.whatsapp, "https://wa.me/593991112233?text=LLA%20VE");
  // El SMS no es un enlace: es un número al que ESCRIBE el usuario, y el texto que tiene que mandar.
  assert.deepEqual(todos.sms, { numero: "+593991112233", texto: "LLA VE" });
});

test("con cero canales, este despliegue no puede verificar teléfonos", () => {
  assert.equal(hayAlgunCanal({}), false);
  assert.equal(hayAlgunCanal({ TELEGRAM_BOT_USERNAME: "" }), false, "vacío es no configurado");
  assert.equal(hayAlgunCanal({ SMS_NUMERO: "+593991112233" }), true);
});
