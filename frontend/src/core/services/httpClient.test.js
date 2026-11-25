// @vitest-environment jsdom

// Red para el modulo que ya se cobro una suite (§6 regla 11 del plan de calidad). Fija las dos
// propiedades que antes no tenia nadie escritas: que es una INSTANCIA propia —no el singleton global de
// axios— y que la cabecera `Authorization` la pone el interceptor de esa instancia, no un efecto
// secundario global que dependa del orden de imports.
import { beforeEach, describe, expect, it } from "vitest";
import axios from "axios";

// jsdom bajo vitest 4 expone window.localStorage como un objeto vacio, sin metodos: mismo stub que usa
// `core/router/index.test.js`. Tiene que instalarse ANTES de importar el modulo, porque el interceptor
// se registra al cargarlo.
const storage = new Map();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
    clear: () => storage.clear()
  }
});

const { default: httpClient } = await import("./httpClient.js");

/** Ejecuta una peticion real por la instancia con un adaptador de mentira y devuelve el config final. */
const capturarConfig = async (config = {}) => {
  let capturado = null;
  await httpClient.request({
    url: "https://api.example.test/deasy/v1/ping",
    adapter: (cfg) => {
      capturado = cfg;
      return Promise.resolve({ data: {}, status: 200, statusText: "OK", headers: {}, config: cfg });
    },
    ...config
  });
  return capturado;
};

describe("httpClient", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("es una instancia propia, no el singleton global de axios", () => {
    expect(httpClient).not.toBe(axios);
    expect(typeof httpClient.request).toBe("function");
  });

  it("no toca el singleton global: axios a pelo no lleva el interceptor de sesion", async () => {
    window.localStorage.setItem("token", "t0ken");
    let capturado = null;
    await axios.request({
      url: "https://api.example.test/deasy/v1/ping",
      adapter: (cfg) => {
        capturado = cfg;
        return Promise.resolve({ data: {}, status: 200, statusText: "OK", headers: {}, config: cfg });
      }
    });
    expect(capturado.headers.Authorization).toBeUndefined();
  });

  it("no fija baseURL: la base ya la compone apiConfig y las URLs llegan absolutas", () => {
    expect(httpClient.defaults.baseURL).toBeUndefined();
  });

  it("anade `Bearer <token>` cuando hay token en localStorage", async () => {
    window.localStorage.setItem("token", "t0ken");
    const config = await capturarConfig();
    expect(config.headers.Authorization).toBe("Bearer t0ken");
  });

  it("no anade la cabecera cuando no hay token", async () => {
    const config = await capturarConfig();
    expect(config.headers.Authorization).toBeUndefined();
  });

  it("respeta un Authorization que ya venga en la peticion", async () => {
    window.localStorage.setItem("token", "t0ken");
    const config = await capturarConfig({ headers: { Authorization: "Bearer propio" } });
    expect(config.headers.Authorization).toBe("Bearer propio");
  });
});
