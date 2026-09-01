import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { retirarCandadosObsoletos } from "./ClienteDeWhatsApp.js";

const temporales = [];
const perfilCon = (candados) => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "wa-sesion-"));
  temporales.push(raiz);
  const perfil = path.join(raiz, "session");
  fs.mkdirSync(perfil, { recursive: true });
  for (const [nombre, destino] of Object.entries(candados)) {
    fs.symlinkSync(destino, path.join(perfil, nombre));
  }
  return { raiz, perfil };
};

afterEach(() => {
  while (temporales.length) fs.rmSync(temporales.pop(), { recursive: true, force: true });
});

describe("ClienteDeWhatsApp · retirarCandadosObsoletos", () => {
  it("retira el candado que dejó un contenedor muerto, aunque apunte a la nada", () => {
    // Es EXACTAMENTE lo medido el 2026-09-01: un enlace a `<host>-<pid>` de un contenedor retirado.
    const { perfil } = perfilCon({ SingletonLock: "9b42716eb02a-19" });

    assert.deepEqual(retirarCandadosObsoletos(path.dirname(perfil)), ["SingletonLock"]);
    assert.equal(fs.readdirSync(perfil).length, 0, "el candado debe haber desaparecido");
  });

  it("retira los tres, porque Chromium deja tres y basta uno para bloquear el arranque", () => {
    const { perfil } = perfilCon({
      SingletonLock: "host-1",
      SingletonCookie: "1234567890",
      SingletonSocket: "/tmp/org.chromium.Chromium.xxxx/SingletonSocket",
    });

    assert.deepEqual(retirarCandadosObsoletos(path.dirname(perfil)).sort(), [
      "SingletonCookie",
      "SingletonLock",
      "SingletonSocket",
    ]);
  });

  it("no toca la SESIÓN, que es lo que no hay que perder", () => {
    const { perfil } = perfilCon({ SingletonLock: "host-1" });
    fs.writeFileSync(path.join(perfil, "Default"), "las credenciales de la sesión");

    retirarCandadosObsoletos(path.dirname(perfil));

    assert.deepEqual(fs.readdirSync(perfil), ["Default"]);
  });

  it("con un cierre limpio no hay nada que retirar y no se queja", () => {
    const { perfil } = perfilCon({});
    assert.deepEqual(retirarCandadosObsoletos(path.dirname(perfil)), []);
  });

  it("si el perfil no existe todavía, tampoco falla: es el primer arranque", () => {
    assert.deepEqual(retirarCandadosObsoletos("/no/existe/en/ningun/sitio"), []);
  });
});
