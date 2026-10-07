import { test } from "node:test";
import assert from "node:assert/strict";
import { canalesConfigurados, hayAlgunCanal } from "./canalesDeVerificacion.js";

test("un canal sin configurar NO aparece — ausente no es `null`", () => {
  const solo = canalesConfigurados("LLAVE", { TELEGRAM_BOT_USERNAME: "bot_deasy" });
  assert.deepEqual(Object.keys(solo), ["telegram"]);
  assert.equal(solo.telegram, "https://t.me/bot_deasy?start=LLAVE");
  // Si apareciera como `null`, la pantalla tendría que distinguir «no lo ofrecemos» de «falló».
  assert.equal("whatsapp" in solo, false);
});

test("los dos canales, cada uno con la forma que espera su aplicación", () => {
  const todos = canalesConfigurados("LLA VE", {
    TELEGRAM_BOT_USERNAME: "bot_deasy",
    WHATSAPP_NUMERO: "593991112233",
  });
  assert.deepEqual(Object.keys(todos).sort(), ["telegram", "whatsapp"]);
  assert.equal(todos.whatsapp, "https://wa.me/593991112233?text=LLA%20VE");
  // ⚠️ Telegram NO codifica y WhatsApp SÍ, y no es un descuido: el payload de `start` sólo admite
  // `[A-Za-z0-9_-]`, así que una llave nuestra nunca lleva nada que codificar. El espacio de este
  // caso no puede llegar en producción; está para fijar la diferencia entre los dos.
  assert.equal(todos.telegram, "https://t.me/bot_deasy?start=LLA VE");
});

test("con cero canales, este despliegue no puede verificar teléfonos", () => {
  assert.equal(hayAlgunCanal({}), false);
  assert.equal(hayAlgunCanal({ TELEGRAM_BOT_USERNAME: "" }), false, "vacío es no configurado");
  assert.equal(hayAlgunCanal({ WHATSAPP_NUMERO: "593991112233" }), true);
});
