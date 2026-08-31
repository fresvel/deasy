// Characterization: lo que un registro NO puede darse a sí mismo (frente 15, C8).
//
// Con el teléfono verificado como condición para entrar, cualquier forma de declararse verificado
// desde el cuerpo de la petición convierte la puerta en decoración. Esta batería fija que no la hay.
//
// ⚠️ Se prueba por HTTP a propósito, y no sólo con unitarias: el agujero estaba en que el objeto del
// cuerpo llegaba INTACTO hasta la capa que escribe (`req.body.telefono` → `createUser` →
// `UserRepository` → `TelefonoService`). Una prueba de la última capa sola no habría visto que el
// camino existía.

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { post } from "../lib/http.mjs";
import { query } from "../lib/db.mjs";
import { waitForReady } from "../lib/readiness.mjs";

/** Una cédula ecuatoriana con su dígito verificador bien puesto — el validador rechaza las demás. */
const cedulaValida = (base) => {
  const coef = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  const suma = [...base].reduce((acc, d, i) => {
    const p = Number(d) * coef[i];
    return acc + (p > 9 ? p - 9 : p);
  }, 0);
  return base + ((10 - (suma % 10)) % 10);
};

const CEDULA = cedulaValida("171003406");
const CORREO = "colado.registro@ejemplo.test";

const limpiar = () => query("DELETE FROM persons WHERE id IN (SELECT person_id FROM emails WHERE direccion = $1)", [CORREO])
  .then(() => query("DELETE FROM persons WHERE first_name = $1", ["ColadoRegistro"]));

before(async () => {
  await waitForReady();
  await limpiar();
});

// ── EL ATAQUE, TAL COMO SE ENCONTRÓ EL 2026-08-31 ───────────────────────────────────────────────
//
// Bastaba mandar `verificado: true` en el cuerpo. La respuesta creaba la persona con su teléfono
// marcado como verificado SIN HABER PROBADO NADA, y con eso se cumplía la condición de entrada.
test("nadie se declara el teléfono verificado desde el cuerpo de la petición", async () => {
  const alta = await post("/users", {
    body: {
      first_name: "ColadoRegistro",
      last_name: "Prueba",
      email: CORREO,
      password: "Demo1234!",
      confirm_password: "Demo1234!",
      cedula: CEDULA,
      telefono: {
        tipo: "personal",
        numero: "987654321",
        pais_id: 60,
        canales: [{ code: "telegram", verificado: true }],
      },
    },
  });
  // 200 y no 201: es el contrato que ya tenía esta ruta, y cambiarlo aquí sería colar un cambio
  // de comportamiento dentro de un arreglo de seguridad.
  assert.equal(alta.status, 200, JSON.stringify(alta.body).slice(0, 300));

  const canales = await query(
    `SELECT c.code, tc.verificado, tc.verificado_at
       FROM telefono_canales tc
       JOIN canales_mensajeria c ON c.id = tc.canal_id
       JOIN telefonos t ON t.id = tc.telefono_id
       JOIN persons p ON p.id = t.person_id
      WHERE p.first_name = 'ColadoRegistro'`
  );

  assert.equal(canales.length, 1, "el canal SÍ se declara: lo que no se acepta es darlo por probado");
  assert.equal(canales[0].code, "telegram");
  assert.equal(Number(canales[0].verificado), 0, "declarar no es verificar");
  assert.equal(canales[0].verificado_at, null, "y sin fecha, porque no ha pasado nada que fechar");

  await limpiar();
});

// ── EL ALTA ES ATÓMICA, Y ESTO ES LO QUE LO HACE FALTA ──────────────────────────────────────────
//
// Antes la persona se insertaba y sus satélites iban después, cada uno por su cuenta. Un fallo a
// mitad dejaba la persona colgada — el propio código lo decía en un comentario. Comprobado el
// 2026-08-31: dos peticiones fallidas dejaron DOS personas, una a medias y otra vacía.
//
// Y lo que lo vuelve inaceptable con un registro de tres pasos no es la basura: es que **el teléfono
// queda ocupado**, así que el segundo intento de la misma persona falla con «ese número ya está
// registrado por otra persona» — y la otra persona es ella misma. Quien se equivoca una vez no
// puede reintentar.
test("un alta que falla no deja rastro, y el reintento funciona", async () => {
  const cuerpo = (extra = {}) => ({
    first_name: "ColadoRegistro",
    last_name: "Prueba",
    email: CORREO,
    password: "Demo1234!",
    confirm_password: "Demo1234!",
    telefono: { tipo: "personal", numero: "987654322", pais_id: 60 },
    ...extra,
  });

  // Falla POR EL DOCUMENTO, que es el último satélite: así se garantiza que la persona, el correo y
  // el teléfono YA se escribieron antes de reventar. Con el fallo en el primero no se probaría nada.
  const fallido = await post("/users", { body: cuerpo({ cedula: "1710034060" }) });
  assert.equal(fallido.status, 400, "un dígito verificador que no cuadra tiene que rechazarse");

  const restos = await query(
    "SELECT id FROM persons WHERE first_name = $1", ["ColadoRegistro"]
  );
  assert.equal(restos.length, 0, "la persona no puede quedarse creada");

  const telefonoSuelto = await query(
    "SELECT id FROM telefonos WHERE numero = $1", ["987654322"]
  );
  assert.equal(telefonoSuelto.length, 0, "y el número no puede quedarse ocupado por un alta que falló");

  // Y ahora el reintento, con el documento bien. Antes fallaba con «ese número ya está registrado».
  const bueno = await post("/users", { body: cuerpo({ cedula: CEDULA }) });
  assert.equal(bueno.status, 200, JSON.stringify(bueno.body).slice(0, 300));

  await limpiar();
});
