import test from "node:test";
import assert from "node:assert/strict";
import { crearClienteAlmacen } from "./clienteAlmacen.js";

test("lee el entorno que se le pasa: host, puerto y TLS salen de ALMACEN_ENDPOINT", () => {
  const plano = crearClienteAlmacen({ ALMACEN_ENDPOINT: "http://almacen.example:9100", ALMACEN_ACCESS_KEY: "a", ALMACEN_SECRET_KEY: "s" });
  assert.equal(plano.host, "almacen.example");
  assert.equal(plano.port, 9100);
  assert.equal(plano.protocol, "http:");
  const tls = crearClienteAlmacen({ ALMACEN_ENDPOINT: "https://almacen.example", ALMACEN_ACCESS_KEY: "a", ALMACEN_SECRET_KEY: "s" });
  assert.equal(tls.port, 443);
  assert.equal(tls.protocol, "https:");
});

test("ALMACEN_USE_SSL=1 fuerza TLS aunque el endpoint diga http", () => {
  const cliente = crearClienteAlmacen({ ALMACEN_ENDPOINT: "http://almacen.example:9000", ALMACEN_USE_SSL: "1", ALMACEN_ACCESS_KEY: "a", ALMACEN_SECRET_KEY: "s" });
  assert.equal(cliente.protocol, "https:");
});

test("todo cliente sale sin firma SHA-256 del cuerpo: es lo que hace que mande Content-MD5", () => {
  const cliente = crearClienteAlmacen({ ALMACEN_ENDPOINT: "http://almacen.example:9000", ALMACEN_ACCESS_KEY: "a", ALMACEN_SECRET_KEY: "s" });
  assert.equal(cliente.enableSHA256, false);
});

test("las credenciales caen a las del usuario raíz si no hay unas propias", () => {
  const cliente = crearClienteAlmacen({ ALMACEN_ENDPOINT: "http://almacen.example:9000", ALMACEN_ROOT_USER: "raiz", ALMACEN_ROOT_PASSWORD: "clave" });
  assert.equal(cliente.accessKey, "raiz");
  assert.equal(cliente.secretKey, "clave");
});
