import test, { mock } from "node:test";
import assert from "node:assert/strict";

// La entrada de la bitácora la escribe el dominio `organizacion`; aquí se prueba la envoltura: qué
// deja pasar, y que la entrada se pide ANTES de escribir, dentro de la transacción del editor.
import CorreccionesDeEstructura from "./CorreccionesDeEstructura.js";

const registrarCorreccion = mock.fn(async () => 77);
const nueva = (editor) => new CorreccionesDeEstructura(editor, registrarCorreccion);

const editorFalso = () => {
  const llamadas = [];
  const correr = (op) => async (tabla, a, b, c) => {
    const opciones = op === "update" ? c : b;
    await opciones.transaccion.antes({ connection: "CONEXION" });
    llamadas.push({ op, tabla, a, b: op === "update" ? b : undefined });
    return { ok: true };
  };
  return { llamadas, update: correr("update"), create: correr("create") };
};

test("corregir una fila: anota la entrada con la conexión de la transacción y luego actualiza", async () => {
  registrarCorreccion.mock.resetCalls();
  const editor = editorFalso();
  await nueva(editor).corregir(
    { tabla: "process_relations", id: 4, cambios: { parent_process_id: 9 }, motivo: "Se registró bajo el proceso equivocado" },
    { actorId: 1 }
  );
  assert.equal(registrarCorreccion.mock.callCount(), 1);
  const [conexion, entrada] = registrarCorreccion.mock.calls[0].arguments;
  assert.equal(conexion, "CONEXION");
  assert.deepEqual(entrada, { tabla: "process_relations", registroId: 4, actorId: 1, motivo: "Se registró bajo el proceso equivocado", cambios: { parent_process_id: 9 } });
  assert.deepEqual(editor.llamadas, [{ op: "update", tabla: "process_relations", a: { id: 4 }, b: { parent_process_id: 9 } }]);
});

test("sin id es un alta que faltó registrar, y entonces sí admite la columna que dice de quién es", async () => {
  const editor = editorFalso();
  await nueva(editor).corregir(
    { tabla: "unit_vigencias", cambios: { unit_id: 3, vigente_desde: "2020-01-01", inicio_origen: "correccion" }, motivo: "La unidad existía desde 2020" },
    { actorId: 1 }
  );
  assert.equal(editor.llamadas[0].op, "create");
});

test("no deja cambiar lo que no es de una corrección, ni de quién es una fila que ya existe", async () => {
  const c = nueva(editorFalso());
  await assert.rejects(c.corregir({ tabla: "unit_vigencias", id: 4, cambios: { unit_id: 9 }, motivo: "un motivo cualquiera" }, { actorId: 1 }), /no puede cambiar: unit_id/);
  await assert.rejects(c.corregir({ tabla: "unit_relations", id: 4, cambios: { child_unit_id: 9 }, motivo: "un motivo cualquiera" }, { actorId: 1 }), /no puede cambiar: child_unit_id/);
  await assert.rejects(c.corregir({ tabla: "units", id: 4, cambios: { name: "x" }, motivo: "un motivo cualquiera" }, { actorId: 1 }), /no es algo que se corrija/);
  await assert.rejects(c.corregir({ tabla: "unit_vigencias", id: 4, cambios: {}, motivo: "un motivo cualquiera" }, { actorId: 1 }), /no cambia nada/);
});
