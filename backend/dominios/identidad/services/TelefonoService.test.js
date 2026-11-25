import { test } from "node:test";
import assert from "node:assert/strict";
import TelefonoService from "./TelefonoService.js";

// Una conexión de mentira. Responde a las dos consultas que `sincronizarCanales` hace de lectura y
// APUNTA las escrituras, que es lo que se quiere mirar.
const conexionFalsa = ({ yaExiste = null } = {}) => {
  const escrituras = [];
  return {
    escrituras,
    query: async (sql, params = []) => {
      if (/FROM canales_mensajeria/.test(sql)) return [[{ id: 7 }]];
      if (/FROM telefono_canales/.test(sql)) return [yaExiste ? [yaExiste] : []];
      escrituras.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
      return [{ affectedRows: 1 }];
    },
  };
};

// ── EL AGUJERO QUE CERRÓ ESTA PRUEBA ────────────────────────────────────────────────────────────
//
// Hasta el 2026-08-31 esta función leía `canal.verificado` del objeto que le llegaba, y ese objeto
// viene del CUERPO DE LA PETICIÓN. Comprobado con una petición real: registrarse mandando
// `"canales": [{ "code": "telegram", "verificado": true }]` dejaba el canal verificado sin probar
// nada. Con el teléfono obligatorio eso no es un dato sucio: es la puerta abierta, porque la
// condición para entrar se cumple poniendo `true` en un JSON.
test("declarar un canal NO lo verifica, aunque la petición lo pida", async () => {
  const conexion = conexionFalsa();
  await new TelefonoService(conexion).sincronizarCanales(
    1,
    [{ code: "telegram", verificado: true }],
    conexion
  );

  const insercion = conexion.escrituras.find((e) => /INSERT INTO telefono_canales/.test(e.sql));
  assert.ok(insercion, "tiene que crear la fila del canal");
  assert.match(insercion.sql, /VALUES \(\?, \?, 0, NULL\)/, "nace SIN verificar y sin fecha");
  // Y `verificado` no viaja como parámetro: no hay forma de colarlo.
  assert.deepEqual(insercion.params, [1, 7]);
});

// El canal declarado sí se crea: lo que se retiró es la verificación, no la declaración. Decir «este
// número tiene Telegram» sigue siendo un dato útil — sólo que ahora es una afirmación del usuario y
// no una prueba.
test("el canal se declara igual: lo que se retiró es darlo por probado", async () => {
  const conexion = conexionFalsa();
  await new TelefonoService(conexion).sincronizarCanales(1, ["whatsapp"], conexion);
  assert.ok(conexion.escrituras.some((e) => /INSERT INTO telefono_canales/.test(e.sql)));
});

// Re-guardar el formulario no puede DESVERIFICAR lo que ya se probó: haber comprobado que el número
// tiene WhatsApp sigue siendo cierto. Y tampoco puede ASCENDER, que es la mitad que se quitó.
test("un canal ya verificado ni se asciende ni se degrada al volver a guardar", async () => {
  const conexion = conexionFalsa({ yaExiste: { id: 33, verificado: 1 } });
  await new TelefonoService(conexion).sincronizarCanales(
    1,
    [{ code: "telegram", verificado: true }],
    conexion
  );

  const tocaronLaFila = conexion.escrituras.filter((e) =>
    /UPDATE telefono_canales SET verificado/.test(e.sql)
  );
  assert.equal(tocaronLaFila.length, 0, "no se toca: ni para subirlo ni para bajarlo");
});

// ── LO QUE SE PROBÓ EL 2026-10-04 ───────────────────────────────────────────────────────────────
//
// Cambiar el número reutiliza la MISMA fila (mismo id), así que todo lo que colgaba de ella pasa a
// hablar de un número que nadie ha probado. Medido sobre la pila B antes del arreglo: tras cambiar
// el número, `telegram` y `whatsapp` seguían en `verificado = 1` y la llave pendiente seguía viva.
// Y «¿está verificado este teléfono?» se responde con «¿tiene algún canal verificado?», así que el
// número nuevo respondía que sí.
//
// Estaba invalidado en UN llamador —el controller de verificación— y no en los otros dos que
// cambian un número (`UserRepository.updateUser` y el bootstrap). Ahora vive aquí, que es por donde
// pasan los tres.
const conexionDeGuardado = ({ numero = "991234567", paisId = 1 } = {}) => {
  const escrituras = [];
  return {
    escrituras,
    query: async (sql, params = []) => {
      // El dueño ajeno: nadie más tiene el número.
      if (/person_id <> \?/.test(sql)) return [[]];
      // El principal que ya existe, con lo que hace falta para saber si cambia.
      if (/principal = 1/.test(sql)) return [[{ id: 1, numero, pais_id: paisId }]];
      escrituras.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
      return [{ affectedRows: 1 }];
    },
  };
};

test("cambiar el número tira la verificación por canal y las llaves pendientes", async () => {
  const conexion = conexionDeGuardado({ numero: "991234567" });
  await new TelefonoService(conexion).guardarPrincipal(
    5,
    { tipo: "personal", numero: "0998887777", pais_id: 1 },
    conexion
  );

  const canales = conexion.escrituras.find((e) => /UPDATE telefono_canales SET verificado = 0/.test(e.sql));
  assert.ok(canales, "la prueba del canal deja de valer: el número ya no es el que se verificó");
  assert.deepEqual(canales.params, [1]);

  const llaves = conexion.escrituras.find((e) => /DELETE FROM telefono_verification_keys/.test(e.sql));
  assert.ok(llaves, "la llave pendiente se emitió contra el número anterior");
  assert.match(llaves.sql, /consumida_at IS NULL/, "sólo las pendientes: una gastada es historia");
});

// Y la declaración del canal SOBREVIVE. Declarar no es verificar --lo dice la prueba de arriba--,
// así que lo que deja de ser verdad es la prueba, no el «este número tiene WhatsApp».
test("al cambiar el número el canal se desverifica, no se borra", async () => {
  const conexion = conexionDeGuardado();
  await new TelefonoService(conexion).guardarPrincipal(
    5,
    { tipo: "personal", numero: "0998887777", pais_id: 1 },
    conexion
  );
  assert.equal(
    conexion.escrituras.filter((e) => /DELETE FROM telefono_canales/.test(e.sql)).length,
    0
  );
});

// ⚠️ Y re-guardar el MISMO número no puede desverificar nada. Importa porque la comparación es
// contra la forma CANÓNICA: `0991234567` y `991234567` son el mismo teléfono --el cero de marcación
// nacional no se guarda-- y comparar contra lo que llega en crudo haría que guardar el formulario
// sin tocarlo tirase la verificación.
test("re-guardar el mismo número no desverifica nada, ni con el cero nacional delante", async () => {
  const conexion = conexionDeGuardado({ numero: "991234567" });
  await new TelefonoService(conexion).guardarPrincipal(
    5,
    { tipo: "personal", numero: "0991234567", pais_id: 1 },
    conexion
  );

  assert.equal(conexion.escrituras.filter((e) => /telefono_canales/.test(e.sql)).length, 0);
  assert.equal(
    conexion.escrituras.filter((e) => /telefono_verification_keys/.test(e.sql)).length,
    0
  );
});

// El país es parte del número: el mismo local con otro prefijo es otro teléfono.
test("cambiar sólo el país también invalida", async () => {
  const conexion = conexionDeGuardado({ numero: "991234567", paisId: 1 });
  await new TelefonoService(conexion).guardarPrincipal(
    5,
    { tipo: "personal", numero: "0991234567", pais_id: 57 },
    conexion
  );
  assert.ok(conexion.escrituras.some((e) => /UPDATE telefono_canales SET verificado = 0/.test(e.sql)));
});
