import { test } from "node:test";
import assert from "node:assert/strict";
import { estadoDeVerificacion, primerPasoPendiente } from "./estadoDeVerificacion.js";

const con = ({ correos = [], telefonos = [] } = {}) => ({ emails: correos, telefonos });
const canal = (code, verificado) => ({ code, verificado });

test("recién registrado: no le falta una cosa, le faltan las dos", () => {
  assert.deepEqual(estadoDeVerificacion(con()), { correo: false, telefono: false, completo: false });
  assert.equal(primerPasoPendiente(con()), "correo");
});

// LA REGLA DEL DUEÑO (2026-08-31): basta con UNO de los tres canales, y verificar uno no verifica
// los otros. Probar que un número tiene Telegram no prueba que tenga WhatsApp; lo que los tres
// prueban por igual es que el NÚMERO es tuyo, que es lo único que se pide aquí.
test("cualquiera de los tres canales verifica el teléfono", () => {
  for (const code of ["telegram", "whatsapp"]) {
    const persona = con({
      correos: [{ verificado: 1 }],
      telefonos: [{ canales: [canal(code, 1)] }],
    });
    assert.equal(estadoDeVerificacion(persona).telefono, true, `${code} debería bastar`);
    assert.equal(primerPasoPendiente(persona), null);
  }
});

test("un canal declarado pero SIN verificar no cuenta", () => {
  const persona = con({
    correos: [{ verificado: 1 }],
    telefonos: [{ canales: [canal("telegram", 0), canal("whatsapp", 0)] }],
  });
  assert.equal(estadoDeVerificacion(persona).telefono, false);
  assert.equal(primerPasoPendiente(persona), "telefono");
});

// Con varios teléfonos basta que UNO esté verificado: lo que se exige es poder alcanzar a la
// persona, no que todos sus números estén probados.
test("con varios teléfonos basta que uno lo esté", () => {
  const persona = con({
    correos: [{ verificado: 1 }],
    telefonos: [{ canales: [canal("telegram", 0)] }, { canales: [canal("whatsapp", 1)] }],
  });
  assert.equal(estadoDeVerificacion(persona).completo, true);
});

// Igual con los correos: se mira la lista entera y no sólo el principal. Si alguien verificó uno y
// después marcó otro como principal, sigue siendo cierto que probó ser dueño de una dirección suya.
test("cualquier correo verificado vale, no sólo el principal", () => {
  const persona = con({
    correos: [{ verificado: 0, principal: 1 }, { verificado: 1, principal: 0 }],
    telefonos: [{ canales: [canal("whatsapp", 1)] }],
  });
  assert.equal(estadoDeVerificacion(persona).correo, true);
});

// El orden es el del registro, y no es capricho: el correo es la LLAVE DE ACCESO desde que se retiró
// el documento. Sin él no habría a dónde volver si se pierde el teléfono.
test("el correo va primero aunque falten los dos", () => {
  const soloTelefono = con({ telefonos: [{ canales: [canal("whatsapp", 1)] }] });
  assert.equal(primerPasoPendiente(soloTelefono), "correo");
  const soloCorreo = con({ correos: [{ verificado: 1 }] });
  assert.equal(primerPasoPendiente(soloCorreo), "telefono");
});

test("una persona que no existe no revienta", () => {
  assert.deepEqual(estadoDeVerificacion(null), { correo: false, telefono: false, completo: false });
  assert.equal(primerPasoPendiente(undefined), "correo");
});
