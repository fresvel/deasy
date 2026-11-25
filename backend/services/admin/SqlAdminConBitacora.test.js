// La bitacora de accesos sensibles en el editor de /admin: ORDEN y ATOMICIDAD.
//
// Una lectura se apunta ANTES de devolver. Una escritura se apunta EN SU MISMA TRANSACCION: si la
// entrada falla, el cambio no queda confirmado. Hasta el 2026-09-10 se apuntaba despues del commit, y
// en la pila se midieron dos cambios guardados sin entrada -- ver la cabecera del modulo--.
//
// Por eso las escrituras se prueban con el SqlAdminService y el AccesosSensiblesService DE VERDAD,
// sobre un pool falso con transacciones: lo escrito por la conexion queda PENDIENTE hasta el COMMIT
// y el ROLLBACK lo tira; lo escrito por el pool queda confirmado al instante. Un doble del servicio
// no probaria nada aqui: la atomicidad esta justo en como se cosen los dos.
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import SqlAdminConBitacora from "./SqlAdminConBitacora.js";
import SqlAdminService from "./SqlAdminService.js";
import AccesosSensiblesService from "../auth/AccesosSensiblesService.js";

const SENSIBLE = { actorId: 1, recurso: "datos_sensibles", ip: "10.0.0.1" };

// La fila tal como esta EN LA BASE: el titular es 9.
const CEDULA = {
  id: 5, person_id: 9, tipo: "documento_nacional", categoria_visa_id: null, pais_id: 1,
  numero: "1700000027", verificado: 0, verificado_at: null, emitido_el: null, expira_el: null,
  escaneo_ref: null, escaneo_subido_at: null, principal: 1, is_active: 1, created_at: null, updated_at: null
};

const esEscritura = (sql) => /^\s*(INSERT|UPDATE|DELETE)\b/i.test(sql);
const cabeza = (sql) => sql.trim().split(/\s+/).slice(0, 3).join(" ");

const crearBase = ({ bitacoraCaida = false } = {}) => {
  const confirmadas = [];
  const eventos = [];
  let pendientes = [];
  const responder = (sql) => (/^\s*SELECT/i.test(sql) ? [[{ ...CEDULA }]] : [{ affectedRows: 1, insertId: 77 }]);

  const conexion = {
    async beginTransaction() { eventos.push("BEGIN"); pendientes = []; },
    async commit() { eventos.push("COMMIT"); confirmadas.push(...pendientes); pendientes = []; },
    async rollback() { eventos.push("ROLLBACK"); pendientes = []; },
    release() { eventos.push("release"); },
    async query(sql, params) {
      eventos.push(`tx ${cabeza(sql)}`);
      if (bitacoraCaida && /INSERT INTO accesos_sensibles/.test(sql)) throw new Error("bitacora caida");
      if (esEscritura(sql)) pendientes.push({ sql, params });
      return responder(sql);
    }
  };
  // La bitacora cae por los DOS caminos: si fallara solo por la conexion, un apunte hecho por el pool
  // -- el diseño viejo-- pasaria y la prueba no distinguiria uno de otro.
  const pool = {
    async query(sql, params) {
      eventos.push(`pool ${cabeza(sql)}`);
      if (bitacoraCaida && /INSERT INTO accesos_sensibles/.test(sql)) throw new Error("bitacora caida");
      if (esEscritura(sql)) confirmadas.push({ sql, params });
      return responder(sql);
    },
    async getConnection() { return conexion; }
  };
  return { pool, eventos, confirmadas };
};

const editorSobre = (base) =>
  new SqlAdminConBitacora(new SqlAdminService(base.pool), new AccesosSensiblesService(base.pool));

const tablasConfirmadas = (base) => base.confirmadas.map(({ sql }) => cabeza(sql));

// Los parametros de `INSERT INTO accesos_sensibles`, en su orden.
const entrada = (base) => {
  const { params } = base.confirmadas.find(({ sql }) => /INSERT INTO accesos_sensibles/.test(sql));
  const [titular, actor, recurso, tabla, registro, accion, detalle, ip] = params;
  return { titular, actor, recurso, tabla, registro, accion, detalle: detalle && JSON.parse(detalle), ip };
};

describe("SqlAdminConBitacora · lectura", () => {
  it("si la bitacora falla, la lectura NO devuelve las filas", async () => {
    const editor = new SqlAdminConBitacora(
      { list: async () => [{ id: 1, person_id: 2 }] },
      { registrarLectura: async () => { throw new Error("sin bitacora"); } }
    );
    await assert.rejects(() => editor.list("documentos_identidad", {}, SENSIBLE), /sin bitacora/);
  });
});

describe("SqlAdminConBitacora · una escritura sensible y su entrada se confirman JUNTAS", () => {
  it("UPDATE: si la entrada falla, el cambio NO queda confirmado", async () => {
    const base = crearBase({ bitacoraCaida: true });
    await assert.rejects(
      () => editorSobre(base).update("documentos_identidad", { id: 5 }, { emitido_el: "2020-01-01" }, SENSIBLE),
      /bitacora caida/
    );
    assert.ok(base.eventos.includes("tx UPDATE documentos_identidad SET"), "el UPDATE tiene que ir por la transaccion");
    assert.ok(base.eventos.includes("ROLLBACK"));
    assert.ok(!base.eventos.includes("COMMIT"));
    assert.deepEqual(base.confirmadas, []);
  });

  it("UPDATE: el titular sale de la fila de la BASE aunque el cuerpo no traiga person_id", async () => {
    // El caso medido en la pila: antes respondia 400 «no trae person_id» con el cambio ya guardado.
    const base = crearBase();
    await editorSobre(base).update("documentos_identidad", { id: 5 }, { id: 5, emitido_el: "2020-01-01" }, SENSIBLE);
    assert.deepEqual(tablasConfirmadas(base), ["UPDATE documentos_identidad SET", "INSERT INTO accesos_sensibles"]);
    assert.deepEqual(entrada(base), {
      titular: 9, actor: 1, recurso: "datos_sensibles", tabla: "documentos_identidad",
      registro: 5, accion: "update", detalle: { campos: ["emitido_el"] }, ip: "10.0.0.1"
    });
  });

  it("CREATE: si la entrada falla, la fila NO queda insertada", async () => {
    const base = crearBase({ bitacoraCaida: true });
    await assert.rejects(
      () => editorSobre(base).create("documentos_identidad", { person_id: 9, tipo: "documento_nacional", numero: "1700000027" }, SENSIBLE),
      /bitacora caida/
    );
    assert.ok(base.eventos.includes("ROLLBACK"));
    assert.deepEqual(base.confirmadas, []);
  });

  it("CREATE: la entrada lleva el id que devolvio el INSERT", async () => {
    const base = crearBase();
    await editorSobre(base).create("documentos_identidad", { person_id: 9, tipo: "documento_nacional", numero: "1700000027" }, SENSIBLE);
    assert.deepEqual(tablasConfirmadas(base), ["INSERT INTO documentos_identidad", "INSERT INTO accesos_sensibles"]);
    assert.equal(entrada(base).registro, 77);
    assert.equal(entrada(base).accion, "create");
  });

  it("DELETE: el titular se lee con FOR UPDATE dentro de la transaccion, ANTES de borrar", async () => {
    const base = crearBase();
    await editorSobre(base).remove("documentos_identidad", { id: 5 }, SENSIBLE);
    const enTransaccion = base.eventos.filter((e) => e.startsWith("tx ") || e === "BEGIN" || e === "COMMIT");
    assert.deepEqual(enTransaccion, [
      "BEGIN", "tx SELECT * FROM", "tx DELETE FROM documentos_identidad", "tx INSERT INTO accesos_sensibles", "COMMIT"
    ]);
    assert.equal(entrada(base).titular, 9);
    assert.equal(entrada(base).accion, "delete");
  });

  it("DELETE: si la entrada falla, la fila NO queda borrada", async () => {
    const base = crearBase({ bitacoraCaida: true });
    await assert.rejects(() => editorSobre(base).remove("documentos_identidad", { id: 5 }, SENSIBLE), /bitacora caida/);
    assert.ok(base.eventos.includes("ROLLBACK"));
    assert.deepEqual(base.confirmadas, []);
  });
});

describe("SqlAdminConBitacora · fuera de lo sensible", () => {
  it("no abre transaccion ni apunta nada: el camino de siempre", async () => {
    const base = crearBase();
    await editorSobre(base).remove("emails", { id: 5 }, { ...SENSIBLE, recurso: "people" });
    assert.ok(!base.eventos.includes("BEGIN"));
    assert.deepEqual(tablasConfirmadas(base), ["DELETE FROM emails"]);
  });
});
