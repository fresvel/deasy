import { test } from "node:test";
import assert from "node:assert/strict";
import { exigeVerificacionCompleta } from "./exigeVerificacionCompleta.js";

const respuesta = () => {
  const r = { codigo: null, cuerpo: null };
  r.status = (c) => { r.codigo = c; return r; };
  r.json = (b) => { r.cuerpo = b; return r; };
  return r;
};

const VERIFICADA = { emails: [{ verificado: 1 }], telefonos: [{ canales: [{ code: "whatsapp", verificado: 1 }] }] };

test("con todo verificado, pasa", async () => {
  let siguio = false;
  const res = respuesta();
  await exigeVerificacionCompleta(async () => VERIFICADA)({ user: { uid: 1 } }, res, () => { siguio = true; });
  assert.equal(siguio, true);
  assert.equal(res.codigo, null, "no debe contestar: debe dejar seguir");
});

// El cuerpo dice QUÉ falta para que el frontend lleve a la pantalla correcta sin una segunda
// petición. Un 403 a secas obligaría a preguntar otra vez.
test("a medio verificar responde 403 y DICE qué falta", async () => {
  const res = respuesta();
  let siguio = false;
  await exigeVerificacionCompleta(async () => ({ emails: [{ verificado: 1 }], telefonos: [] }))(
    { user: { uid: 1 } }, res, () => { siguio = true; }
  );
  assert.equal(siguio, false, "no puede dejar pasar");
  assert.equal(res.codigo, 403);
  assert.deepEqual(res.cuerpo.verificacion, { correo: true, telefono: false, completo: false });
});

test("sin nada verificado tampoco pasa", async () => {
  const res = respuesta();
  await exigeVerificacionCompleta(async () => ({ emails: [], telefonos: [] }))(
    { user: { uid: 1 } }, respuesta() === null ? null : res, () => {}
  );
  assert.equal(res.codigo, 403);
});

// Prefiero pagar una consulta a dejar la puerta abierta por un orden de middlewares que alguien
// cambie dentro de seis meses.
test("si nadie dejó la persona en la petición, la relee", async () => {
  let releyo = false;
  const res = respuesta();
  await exigeVerificacionCompleta(async () => { releyo = true; return VERIFICADA; })(
    { user: { uid: 7 } }, res, () => {}
  );
  assert.equal(releyo, true);
});

test("y la usa si ya está, sin releerla", async () => {
  let releyo = false;
  await exigeVerificacionCompleta(async () => { releyo = true; return null; })(
    { user: { uid: 7 }, persona: VERIFICADA }, respuesta(), () => {}
  );
  assert.equal(releyo, false);
});

// Quien llega aquí trae un token válido: que no haya persona es un estado roto NUESTRO, no un dato
// que el usuario pueda arreglar verificando algo.
test("una persona que no aparece es 401, no 403", async () => {
  const res = respuesta();
  await exigeVerificacionCompleta(async () => null)({ user: { uid: 99 } }, res, () => {});
  assert.equal(res.codigo, 401);
});
