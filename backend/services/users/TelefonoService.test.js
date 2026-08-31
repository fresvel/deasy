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
