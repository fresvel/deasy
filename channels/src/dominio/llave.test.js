import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { llaveDe } from "./llave.js";

describe("llaveDe · lo que puede ser una llave y lo que no", () => {
  // Una llave de verdad: 32 bytes en base64url son 43 caracteres. Las de juguete engañan.
  const REAL = "n0OYuT8lQxK-2mVzR7pWc1eJdAgHbF5sX4iL9tYoZ3U";

  it("la saca de `/start <llave>` y también de la llave pegada a secas", () => {
    assert.equal(llaveDe(`/start ${REAL}`), REAL);
    // Quien no puede pulsar el enlace la copia y la pega; rechazárselo sería gratuito.
    assert.equal(llaveDe(`  ${REAL}  `), REAL);
    assert.equal(llaveDe("/start"), null);
  });

  // ⚠️ CON `/start` NO SE EXIGE LONGITUD: quien llega así viene de un enlace nuestro. A pelo SÍ, y
  // por un motivo medido: «hola» pasa el alfabeto perfectamente, así que sin el mínimo cada saludo
  // se convertía en una consulta al backend preguntando por una llave inventada.
  it("un saludo NO es una llave, aunque sólo tenga letras", () => {
    assert.equal(llaveDe("hola"), null);
    assert.equal(llaveDe("ok"), null);
    assert.equal(llaveDe("test"), null);
    assert.equal(llaveDe("/start hola"), "hola", "con /start no hay ambigüedad");
  });

  it("lo que no puede ser una llave nuestra se descarta sin preguntar", () => {
    // El alfabeto lo impone Telegram en el payload de `start`. Consultar por algo que no cabe ahí
    // sólo produce peticiones inútiles al backend.
    assert.equal(llaveDe("hola qué tal"), null);
    assert.equal(llaveDe("/start con espacios"), null);
    assert.equal(llaveDe("a".repeat(65)), null);
    assert.equal(llaveDe(""), null);
    assert.equal(llaveDe(undefined), null);
  });
});

