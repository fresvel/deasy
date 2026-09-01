import { test } from "node:test";
import assert from "node:assert/strict";
import { leerConfiguracion } from "./config.js";

const COMPLETO = {
  DEASY_API_URL: "http://backend:3030/deasy/v1",
  INTERNAL_SERVICE_KEY: "secreta",
  TELEGRAM_BOT_TOKEN: "123:AA",
};

test("con todo puesto, devuelve lo que las piezas esperan", () => {
  const c = leerConfiguracion(COMPLETO);
  assert.deepEqual(c.deasy, { base: COMPLETO.DEASY_API_URL, clave: "secreta" });
  assert.equal(c.telegram, "123:AA");
});

// Un servicio que arranca sin token y muere cuando alguien intenta verificarse le echa la culpa al
// usuario de un fallo de despliegue.
test("lo que falta se dice AL ARRANCAR, y se dice todo junto", () => {
  assert.throws(() => leerConfiguracion({ TELEGRAM_BOT_TOKEN: "123:AA" }),
    /DEASY_API_URL.*INTERNAL_SERVICE_KEY/);
});

test("sin ningún canal no arranca: no tendría nada que hacer", () => {
  assert.throws(() => leerConfiguracion({ ...COMPLETO, TELEGRAM_BOT_TOKEN: "" }), /ningún canal/);
  // Y en blanco es lo mismo que ausente: `.env` deja variables vacías con toda naturalidad.
  assert.throws(() => leerConfiguracion({ ...COMPLETO, INTERNAL_SERVICE_KEY: "   " }),
    /INTERNAL_SERVICE_KEY/);
});

// Un despliegue con Telegram y sin WhatsApp es legítimo --es el de hoy-- y al revés también. Lo que
// no vale es ninguno de los dos.
test("basta con UNO de los canales", () => {
  const soloWhatsApp = leerConfiguracion({ ...COMPLETO, TELEGRAM_BOT_TOKEN: "", WHATSAPP_NUMERO: "593987650000" });
  assert.equal(soloWhatsApp.whatsapp, "593987650000");
  assert.equal(soloWhatsApp.telegram, "");

  const soloTelegram = leerConfiguracion(COMPLETO);
  assert.equal(soloTelegram.whatsapp, "", "sin número, no se monta WhatsApp");
});

// ⚠️ WhatsApp NO lleva credenciales en el entorno: la sesión se vincula escaneando un QR. Lo que se
// declara es la intención de tenerlo.
test("WhatsApp no pide credenciales, sólo su número", () => {
  const c = leerConfiguracion({ ...COMPLETO, WHATSAPP_NUMERO: "593987650000" });
  assert.equal(c.whatsapp, "593987650000");
});
