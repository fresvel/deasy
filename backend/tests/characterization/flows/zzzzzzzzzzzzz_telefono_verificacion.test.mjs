// Characterization: la costura entre el backend y el microservicio `channels` (frente 15, C2).
//
// Fija DOS contratos que tienen clientes distintos:
//
//  1. `POST /users/me/telefonos/:id/verificacion` — lo llama el navegador. Devuelve los enlaces YA
//     COMPUESTOS (Telegram, WhatsApp, SMS) para que la pantalla no tenga que saber armarlos.
//  2. `POST /internal/verificacion/{estado,confirmar}` — lo llama `channels`, nunca un navegador.
//
// Lo que se protege aquí y no protege ninguna otra prueba:
//
//  - Que una llave usada diga «consumida» y NO «desconocida». Son mensajes distintos para el
//    usuario: uno le dice que pida otra, el otro que se ha equivocado de enlace. Colapsarlos es un
//    cambio silencioso, porque las dos respuestas son 404.
//  - Que un número de OTRO PAÍS con la misma cola se rechace. Es el motivo de C2b: la comparación
//    la hacía `channels`, que no sabe el país, y miraba los últimos ocho dígitos — así `+51 99 111
//    2233` valía por `+593 99 111 2233`, y se podía verificar el número de otro desde el propio.
//  - Que la sonda NO devuelva el número. Antes lo devolvía a quien trajera una llave válida.
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
import { query } from "../lib/db.mjs";

const CLAVE = { "x-deasy-servicio": process.env.INTERNAL_SERVICE_KEY ?? "" };

const estado = (llave, headers = CLAVE) =>
  post("/internal/verificacion/estado", { body: { llave }, headers });
const confirmar = (llave, numero, canal, headers = CLAVE) =>
  post("/internal/verificacion/confirmar", { body: { llave, numero, canal }, headers });

/**
 * Saca la llave del enlace que el backend compone; la llave en crudo no se devuelve nunca.
 *
 * ⚠️ Los canales viven bajo `canales` y cada uno trae `{ enlace, qr }` desde el 2026-08-31: la
 * pantalla necesita el QR porque quien se registra desde el ORDENADOR no puede pulsar un enlace que
 * abre una aplicación de móvil.
 */
const llaveDelEnlace = (cuerpo) => {
  const canales = cuerpo.canales ?? {};
  const canal = canales.telegram ?? canales.whatsapp;
  assert.ok(canal?.enlace, "sin TELEGRAM_BOT_USERNAME ni WHATSAPP_NUMERO no hay de dónde sacar la llave");
  const url = new URL(canal.enlace);
  return url.searchParams.get("start") ?? url.searchParams.get("text");
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

  const viva = await estado(llave);
  assert.equal(viva.status, 200);
  assert.deepEqual(viva.body, { estado: "valida" }, "la sonda dice si vive y NADA más");
  // El número no sale del backend. Ni el número, ni de quién es: una llave filtrada no debe servir
  // para averiguar el teléfono de nadie.
  assert.equal(viva.body.numero, undefined);
  assert.equal(viva.body.telefonoId, undefined);

  const ok = await confirmar(llave, pedida.body.numero, "telegram");
  assert.equal(ok.status, 200, JSON.stringify(ok.body));

  const repetida = await estado(llave);
  assert.equal(repetida.status, 404);
  assert.equal(repetida.body.estado, "consumida", "«ya usada» no es «no existe»");

  const otraVez = await confirmar(llave, pedida.body.numero, "telegram");
  assert.equal(otraVez.status, 409, "confirmar dos veces es un conflicto, no un éxito silencioso");
  assert.equal(otraVez.body.estado, "consumida");

  const inventada = await estado("una-llave-que-nadie-emitio");
  assert.equal(inventada.status, 404);
  assert.equal(inventada.body.estado, "desconocida");
});

// ── EL MOTIVO POR EL QUE EXISTE C2b ─────────────────────────────────────────────────────────────
//
// Comparar los últimos ocho dígitos daba por iguales `+51 99 111 2233` y `+593 99 111 2233`. Con
// eso, cualquiera registraba el número de OTRA persona y lo verificaba desde una línea propia de
// otro país con la misma cola — que es exactamente lo que la verificación existe para impedir.
//
// La comparación se mudó al backend porque es el único que sabe el país del número guardado
// (`telefonos.pais_id` -> `paises.phone_code`). Aquí se comprueba de punta a punta.
//
// ⚠️ Y este caso sólo se puede escribir porque el teléfono sembrado TIENE país. No lo tenía: el
// arranque lo creaba sin él, y con eso era imposible de verificar por definición. Se arregló en el
// mismo commit — el país sale de `instituciones`, igual que el del documento nacional.
test("un número de otro país con la misma cola NO verifica", async () => {
  const token = await tokenFor("admin");
  const pedida = await post("/users/me/telefonos/1/verificacion", { token });
  const llave = llaveDelEnlace(pedida.body);

  const gemelo = pedida.body.numero.replace(/^593/, "51");
  assert.notEqual(gemelo, pedida.body.numero, "el sosia tiene que ser otro número");

  const impostor = await confirmar(llave, `+${gemelo}`, "telegram");
  assert.equal(impostor.status, 409, JSON.stringify(impostor.body));
  assert.equal(impostor.body.estado, "numero_distinto");

  // Y la llave NO se gasta con el intento fallido: quien de verdad tiene el número sigue pudiendo.
  assert.equal((await estado(llave)).body.estado, "valida");
  assert.equal((await confirmar(llave, pedida.body.numero, "telegram")).status, 200);
});

test("el mismo número, escrito como lo entrega cada transporte", async () => {
  const token = await tokenFor("admin");

  // Telegram, WhatsApp y las pasarelas de SMS dan SIEMPRE la internacional, en una de estas formas.
  for (const escritura of ["+593 99 000 0000", "593990000000", "00593990000000"]) {
    const pedida = await post("/users/me/telefonos/1/verificacion", { token });
    const r = await confirmar(llaveDelEnlace(pedida.body), escritura, "telegram");
    assert.equal(r.status, 200, `«${escritura}» debería valer: ${JSON.stringify(r.body)}`);
  }
});

// ── LA RAMA QUE SE RETIRÓ EL 2026-08-31 ─────────────────────────────────────────────────────────
//
// Se aceptaba la parte LOCAL a secas por el SMS nacional desde módem propio — o sea, por `C6`, que
// está bloqueada y sin implementar. La factura llegó antes que el canal: probando `C3` con un
// teléfono real, un número guardado MAL —con el prefijo del país dentro de `numero`— se verificó
// igualmente, porque su «parte local» casaba con el internacional que llegaba.
//
// En cuanto se compara algo que no lleva país, el país deja de pintar nada: es el agujero de `C2b`
// por otra puerta.
test("la forma LOCAL ya no verifica: sin país no hay comparación que valga", async () => {
  const token = await tokenFor("admin");

  for (const local of ["0990000000", "990000000"]) {
    const pedida = await post("/users/me/telefonos/1/verificacion", { token });
    const r = await confirmar(llaveDelEnlace(pedida.body), local, "telegram");
    assert.equal(r.status, 409, `«${local}» no debería valer: ${JSON.stringify(r.body)}`);
    assert.equal(r.body.estado, "numero_distinto");
  }
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
  const sinClave = await estado("da-igual", {});
  assert.equal(sinClave.status, 404, "401 confirmaría la ruta; 404 no dice nada");

  const claveMala = await estado("da-igual", { "x-deasy-servicio": "no-es-la-clave" });
  assert.equal(claveMala.status, 404);
});

// LA CARRERA, DE VERDAD. Secuencialmente nunca se llega a esta rama: la segunda confirmación ya lee
// la llave como consumida y se rechaza antes de escribir. Sólo con dos peticiones a la vez importa
// que el `UPDATE` lleve `consumida_at IS NULL` y que se mire cuántas filas tocó.
//
// Y pasa de verdad: el usuario pulsa el enlace dos veces, o el canal reintenta. Sin esta guarda,
// las dos confirmarían y `telefono_canales` se escribiría dos veces por el mismo suceso.
test("dos confirmaciones simultáneas: gana UNA, y la otra pierde limpiamente", async () => {
  const token = await tokenFor("admin");
  const pedida = await post("/users/me/telefonos/1/verificacion", { token });
  const llave = llaveDelEnlace(pedida.body);

  const [a, b] = await Promise.all([
    confirmar(llave, pedida.body.numero, "telegram"),
    confirmar(llave, pedida.body.numero, "telegram"),
  ]);

  const codigos = [a.status, b.status].sort();
  assert.deepEqual(codigos, [200, 409], `salió ${JSON.stringify(codigos)}: ${JSON.stringify([a.body, b.body])}`);
  assert.equal([a, b].find((r) => r.status === 409).body.estado, "consumida");
});

// Un teléfono guardado MAL —con el prefijo del país dentro de `numero`, que guarda la parte local—
// no se puede comparar: compone `593593…`, que no es el teléfono de nadie. Hasta el 2026-08-31
// verificaba de chiripa por la rama local; al retirarla pasaría a fallar, pero fallaría AL FINAL
// del camino y diciendo «ese número no es el tuyo» — que es mentira y no dice qué arreglar.
//
// Esta prueba fija que se corta AL PEDIR LA LLAVE y que el mensaje dice qué hacer. Es la misma
// lección que el teléfono sin país: un fallo del dato no se le cuenta a nadie como un fallo suyo.
test("un teléfono con el prefijo dentro del número se corta al pedir la llave, y lo explica", async () => {
  const token = await tokenFor("admin");

  // Se fabrica la corrupción: los datos sembrados no la tienen, y sin ella el camino no se ejecuta.
  const antes = await query("SELECT numero FROM telefonos WHERE id = 1");
  const original = antes[0].numero;
  await query(
    `UPDATE telefonos
        SET numero = (SELECT replace(phone_code,'+','') FROM paises WHERE id = telefonos.pais_id) || numero
      WHERE id = 1`
  );

  try {
    const r = await post("/users/me/telefonos/1/verificacion", { token });
    assert.equal(r.status, 400, JSON.stringify(r.body));
    assert.match(r.body.message, /prefijo del país dentro/);
    assert.match(r.body.message, /parte local/, "tiene que decir qué arreglar, no sólo que está mal");
  } finally {
    await query("UPDATE telefonos SET numero = $1 WHERE id = 1", [original]);
  }
});
