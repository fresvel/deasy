// Characterization: el registro en TRES PASOS y la puerta que lo hace obligatorio (frente 15, C8).
//
// ⚠️ **LO QUE SE PRUEBA AQUÍ ES LA PUERTA DEL BACKEND, NO LA DEL NAVEGADOR.** El guardián del router
// de Vue decide qué pantalla se pinta; quien tenga el token llama a la API y se salta el navegador
// entero. Este repositorio ya tropezó con eso y lo dejó escrito donde dolió
// (`user_controler.queries.js:486`): «El bloqueo era solo visual: la API los servía igual».
//
// Por eso todo esto va por HTTP y con el token en la mano, sin abrir un navegador.

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { get, post } from "../lib/http.mjs";
import { query } from "../lib/db.mjs";
import { waitForReady } from "../lib/readiness.mjs";

const cedulaValida = (base) => {
  const coef = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  const suma = [...base].reduce((acc, d, i) => {
    const p = Number(d) * coef[i];
    return acc + (p > 9 ? p - 9 : p);
  }, 0);
  return base + ((10 - (suma % 10)) % 10);
};

const NOMBRE = "PruebaTresPasos";
const CORREO = "prueba.tres.pasos@ejemplo.test";
const NUMERO_LOCAL = "987654399";

const limpiar = () => query("DELETE FROM persons WHERE first_name = $1", [NOMBRE]);

const registrar = () =>
  post("/users", {
    body: {
      first_name: NOMBRE,
      last_name: "Registro",
      email: CORREO,
      password: "Demo1234!",
      confirm_password: "Demo1234!",
      cedula: cedulaValida("171003406"),
      telefono: { tipo: "personal", numero: NUMERO_LOCAL, pais_id: 60, canales: ["telegram"] },
    },
  });

before(async () => {
  await waitForReady();
  await limpiar();
});

test("los tres pasos, en orden, y la puerta cediendo sólo al final", async () => {
  // ── PASO 1 ────────────────────────────────────────────────────────────────────────────────────
  const alta = await registrar();
  assert.equal(alta.status, 200, JSON.stringify(alta.body).slice(0, 300));

  // La sesión se entrega desde el paso 1: los pasos 2 y 3 necesitan saber quién está verificando, y
  // sin ella habría que inventar un segundo tipo de credencial.
  const token = alta.body.token;
  assert.equal(typeof token, "string", "el token es una cadena, no `{token, expiresIn}` anidado");
  assert.ok(token.length > 20);

  assert.deepEqual(alta.body.user.verificacion, { correo: false, telefono: false, completo: false });
  // El objeto viejo mentía por omisión: decía «whatsapp» cuando la verificación vale por cualquiera
  // de los tres canales. Se retiró, y que no vuelva.
  assert.equal("verify" in alta.body.user, false, "`verify: {email, whatsapp}` está retirado");

  const telefonoId = alta.body.user.telefonos[0].id;

  // ── LA PUERTA, CON LOS DOS PASOS PENDIENTES ───────────────────────────────────────────────────
  const cerrado = await get("/dossier", { token });
  assert.equal(cerrado.status, 403);
  // El cuerpo dice QUÉ falta, para que la pantalla lleve al paso correcto sin una segunda petición.
  assert.deepEqual(cerrado.body.verificacion, { correo: false, telefono: false, completo: false });

  // ── PASO 2 · el correo ────────────────────────────────────────────────────────────────────────
  // El código se siembra a mano porque en la base vive CIFRADO y no hay forma de leerlo. Lo que se
  // prueba es el camino de comprobación, no el de generación.
  await query(
    `INSERT INTO email_verification_codes (email_id, code_hash, expires_at)
     SELECT e.id, crypt('123456', gen_salt('bf')), now() + interval '10 minutes'
       FROM emails e JOIN persons p ON p.id = e.person_id
      WHERE p.first_name = $1 AND e.principal = 1`,
    [NOMBRE]
  ).catch(() => null);

  const malo = await post("/users/me/verificacion/correo", { token, body: { codigo: "999999" } });
  assert.equal(malo.status, 400);

  // ── LA PUERTA, DESPUÉS DEL CORREO ─────────────────────────────────────────────────────────────
  // (el código bueno se comprueba en el camino unitario; aquí interesa que la puerta CUENTE bien)
  await query(
    "UPDATE emails SET verificado = 1, verificado_at = now() WHERE person_id = (SELECT id FROM persons WHERE first_name = $1)",
    [NOMBRE]
  );

  const aMedias = await get("/dossier", { token });
  assert.equal(aMedias.status, 403, "con el correo hecho pero el teléfono no, sigue cerrada");
  assert.deepEqual(aMedias.body.verificacion, { correo: true, telefono: false, completo: false });

  // ── PASO 3 · el teléfono ──────────────────────────────────────────────────────────────────────
  const pedida = await post(`/users/me/telefonos/${telefonoId}/verificacion`, { token });
  assert.equal(pedida.status, 200, JSON.stringify(pedida.body));
  // La pantalla recibe el enlace Y el código QR ya compuestos: no sabe armar un enlace de Telegram
  // ni dibujar un QR, y no tiene por qué.
  assert.ok(pedida.body.canales?.telegram?.enlace, "el enlace, ya compuesto");
  assert.match(pedida.body.canales.telegram.qr, /^data:image\/png;base64,/, "y su QR");

  // Lo confirma el canal, que es quien prueba el número. Aquí se simula esa confirmación.
  await query(
    `INSERT INTO telefono_canales (telefono_id, canal_id, verificado, verificado_at)
     VALUES ($1, (SELECT id FROM canales_mensajeria WHERE code = 'telegram'), 1, now())
     ON CONFLICT (telefono_id, canal_id) DO UPDATE SET verificado = 1, verificado_at = now()`,
    [telefonoId]
  );

  // ── Y AHORA SÍ ────────────────────────────────────────────────────────────────────────────────
  const abierto = await get("/notifications", { token });
  assert.notEqual(abierto.status, 403, "con las dos hechas, la puerta deja pasar");

  const yo = await get("/users/me", { token });
  const usuario = yo.body.user ?? yo.body;
  assert.deepEqual(usuario.verificacion, { correo: true, telefono: true, completo: true });

  await limpiar();
});

// LA REGLA DEL DUEÑO: basta CUALQUIERA de los tres canales, y verificar uno no verifica los otros.
test("cualquiera de los tres canales abre la puerta, y sólo se marca ese", async () => {
  for (const canal of ["telegram", "whatsapp", "sms"]) {
    await limpiar();
    const alta = await registrar();
    const token = alta.body.token;
    const telefonoId = alta.body.user.telefonos[0].id;

    await query(
      "UPDATE emails SET verificado = 1 WHERE person_id = (SELECT id FROM persons WHERE first_name = $1)",
      [NOMBRE]
    );
    await query(
      `INSERT INTO telefono_canales (telefono_id, canal_id, verificado, verificado_at)
       VALUES ($1, (SELECT id FROM canales_mensajeria WHERE code = $2), 1, now())
       ON CONFLICT (telefono_id, canal_id) DO UPDATE SET verificado = 1, verificado_at = now()`,
      [telefonoId, canal]
    );

    const yo = await get("/users/me", { token });
    const usuario = yo.body.user ?? yo.body;
    assert.equal(usuario.verificacion.completo, true, `${canal} debería bastar`);

    // Y los otros dos siguen SIN verificar: probar que el número tiene Telegram no prueba que
    // tenga WhatsApp. Lo que los tres prueban por igual es que el número es tuyo.
    const otros = await query(
      `SELECT c.code, COALESCE(tc.verificado, 0) AS verificado
         FROM canales_mensajeria c
         LEFT JOIN telefono_canales tc ON tc.canal_id = c.id AND tc.telefono_id = $1
        WHERE c.is_active = 1 AND c.code <> $2`,
      [telefonoId, canal]
    );
    for (const fila of otros) {
      assert.equal(Number(fila.verificado), 0, `${canal} no puede verificar ${fila.code}`);
    }
  }
  await limpiar();
});
