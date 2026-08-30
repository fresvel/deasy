// Characterization: la costura entre el backend y el microservicio `channels` (frente 15, C2).
//
// Fija DOS contratos que tienen clientes distintos:
//
//  1. `POST /users/me/telefonos/:id/verificacion` — lo llama el navegador. Devuelve los enlaces YA
//     COMPUESTOS (Telegram, WhatsApp, SMS) para que la pantalla no tenga que saber armarlos.
//  2. `POST /internal/verificacion/{resolver,consumir}` — lo llama `channels`, nunca un navegador.
//
// Lo que se protege aquí y no protege ninguna otra prueba:
//
//  - Que una llave usada diga «consumida» y NO «desconocida». Son mensajes distintos para el
//    usuario: uno le dice que pida otra, el otro que se ha equivocado de enlace. Colapsarlos es un
//    cambio silencioso, porque las dos respuestas son 404.
//  - Que sin la clave compartida el backend responda 404 y no 401: un 401 CONFIRMA que la ruta
//    existe. Quien no tiene la clave no debe poder distinguir esto de una ruta inventada.
//  - Que la llave quepa en un enlace de Telegram (<= 64 caracteres, sólo `A-Za-z0-9_-`). Es un
//    límite de la API de Telegram, no una preferencia: pasarse rompe el canal en ejecución.
//
// ⚠️ La cabecera va con la MISMA clave que el entorno del backend (`INTERNAL_SERVICE_KEY`). Si en
// esta pila no está puesta, el middleware responde 503 a todo — cerrado, no abierto — y estas
// pruebas fallan diciendo exactamente eso.

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { post } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";
import { waitForReady } from "../lib/readiness.mjs";

const CLAVE = { "x-deasy-servicio": process.env.INTERNAL_SERVICE_KEY ?? "" };

const resolver = (llave, headers = CLAVE) =>
  post("/internal/verificacion/resolver", { body: { llave }, headers });
const consumir = (llave, canal, headers = CLAVE) =>
  post("/internal/verificacion/consumir", { body: { llave, canal }, headers });

/** Saca la llave del enlace que el backend compone; la llave en crudo no se devuelve nunca. */
const llaveDelEnlace = (cuerpo) => {
  const enlace = cuerpo.telegram ?? cuerpo.whatsapp;
  assert.ok(enlace, "sin TELEGRAM_BOT_USERNAME ni WHATSAPP_NUMERO no hay de dónde sacar la llave");
  return cuerpo.telegram
    ? new URL(enlace).searchParams.get("start")
    : new URL(enlace).searchParams.get("text");
};

before(async () => {
  await waitForReady();
});

// El único teléfono sembrado es del admin (`person_id = 1`), así que el circuito se prueba con su
// sesión. No es capricho: desde que `crear` exige el dueño, con otra sesión ya no se puede.
test("la llave sólo se usa una vez, y la segunda vez el motivo es OTRO", async () => {
  const token = await tokenFor("admin");

  const pedida = await post("/users/me/telefonos/1/verificacion", { token });
  assert.equal(pedida.status, 200, JSON.stringify(pedida.body));

  const llave = llaveDelEnlace(pedida.body);
  assert.ok(llave.length <= 64, `la llave mide ${llave.length}; Telegram admite 64`);
  assert.match(llave, /^[A-Za-z0-9_-]+$/, "Telegram sólo acepta A-Za-z0-9_- en el payload de start");

  const viva = await resolver(llave);
  assert.equal(viva.status, 200);
  assert.equal(viva.body.estado, "valida");
  assert.equal(typeof viva.body.numero, "string");
  // El número viaja; de quién es, NO. Una llave filtrada no debe servir para saber quién es alguien.
  assert.equal(viva.body.telefonoId, undefined, "el servicio no necesita saber de quién es");
  assert.equal(viva.body.person_id, undefined);

  assert.equal((await consumir(llave, "telegram")).status, 200);

  const repetida = await resolver(llave);
  assert.equal(repetida.status, 404);
  assert.equal(repetida.body.estado, "consumida", "«ya usada» no es «no existe»");

  const otraVez = await consumir(llave, "telegram");
  assert.equal(otraVez.status, 409, "consumir dos veces es un conflicto, no un éxito silencioso");

  const inventada = await resolver("una-llave-que-nadie-emitio");
  assert.equal(inventada.status, 404);
  assert.equal(inventada.body.estado, "desconocida");
});

test("pedir otra llave invalida la anterior", async () => {
  const token = await tokenFor("admin");

  const primera = llaveDelEnlace((await post("/users/me/telefonos/1/verificacion", { token })).body);
  const segunda = llaveDelEnlace((await post("/users/me/telefonos/1/verificacion", { token })).body);
  assert.notEqual(primera, segunda, "cada petición emite una llave nueva");

  const vieja = await resolver(primera);
  assert.equal(vieja.status, 404);
  // Borrada, no marcada: para quien la tenga es indistinguible de no haber existido nunca, que es
  // lo correcto — no llegó a usarse.
  assert.equal(vieja.body.estado, "desconocida");
  assert.equal((await resolver(segunda)).body.estado, "valida");
});

// Encontrado AL ESCRIBIR ESTAS PRUEBAS: la ruta vive bajo `/me/`, pero el servicio buscaba el
// teléfono sólo por su id. Cualquiera con sesión pedía una llave para el teléfono de OTRO y la
// respuesta le devolvía su número en formato internacional. Es el IDOR de los entregables otra vez,
// por el mismo sitio: mirar la pieza que se pide y no de quién es.
test("el teléfono de otra persona responde como si no existiera", async () => {
  const token = await tokenFor("usuario");

  // El teléfono 1 es del admin (`person_id = 1`), no de quien pide.
  const ajeno = await post("/users/me/telefonos/1/verificacion", { token });
  assert.equal(ajeno.status, 400, JSON.stringify(ajeno.body));
  assert.match(ajeno.body.message, /no existe/, "«existe pero no es tuyo» sería un oráculo");
});

test("sin la clave compartida, `/internal/` no admite ni que existe", async () => {
  const sinClave = await resolver("da-igual", {});
  assert.equal(sinClave.status, 404, "401 confirmaría la ruta; 404 no dice nada");

  const claveMala = await resolver("da-igual", { "x-deasy-servicio": "no-es-la-clave" });
  assert.equal(claveMala.status, 404);
});
