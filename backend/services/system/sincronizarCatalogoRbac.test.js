// La sincronizacion del catalogo RBAC al arrancar: que añade, que concede, y sobre todo que NO hace.
//
// POR QUE EXISTE. Sus garantias son negativas -- no devuelve un permiso quitado, no borra, no deja
// nada a medias-- y una garantia negativa se rompe en silencio: el arranque sigue en verde. La base
// es un doble en memoria CON TRANSACCIONES DE VERDAD (el rollback restaura la foto), porque la regla
// que mas cuesta ver es la 4: sin transaccion, un fallo entre crear y conceder dejaba el permiso
// creado y sin conceder PARA SIEMPRE.
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { sincronizarCatalogoRbac } from "./sincronizarCatalogoRbac.js";
import {
  ACTION_CATALOG,
  PERMISSION_CATALOG,
  RESOURCE_CATALOG,
  ROLE_CATALOG,
  ROLE_PERMISSION_MATRIX,
  permissionCode
} from "../../config/rbacCatalog.js";

// Los cuatro recursos de P8: los que una base instalada antes del 2026-09-10 no tiene.
const NUEVOS = ["datos_sensibles", "datos_pago", "catalogos", "bitacora_sensible"];

const crearBase = (tablas) => {
  let datos = structuredClone(tablas);
  let foto = null;
  let fallarEn = null;
  let siguienteId = 10_000;
  const sentencias = [];
  const estado = { confirmadas: 0, deshechas: 0, liberadas: 0 };

  const conexion = {
    async beginTransaction() { foto = structuredClone(datos); },
    async commit() { foto = null; estado.confirmadas += 1; },
    async rollback() { if (foto) datos = foto; foto = null; estado.deshechas += 1; },
    release() { estado.liberadas += 1; },
    async query(sql, params = []) {
      const s = sql.replace(/\s+/g, " ").trim();
      sentencias.push(s);
      if (fallarEn?.test(s)) throw new Error("la base se cayo a medias");
      let m;
      if (s === "SELECT COUNT(*) AS total FROM roles") return [[{ total: String(datos.roles.length) }]];
      if ((m = s.match(/^SELECT code FROM (resources|actions|permissions)$/))) {
        return [datos[m[1]].map(({ code }) => ({ code }))];
      }
      if ((m = s.match(/^SELECT id, code FROM (resources|actions|permissions)$/))) {
        return [datos[m[1]].map(({ id, code }) => ({ id, code }))];
      }
      if (s === "SELECT id, name AS code FROM roles") return [datos.roles.map(({ id, name }) => ({ id, code: name }))];
      if ((m = s.match(/^INSERT INTO (resources|actions) \(code, name, description, is_active\)/))) {
        const [code, name, description] = params;
        if (datos[m[1]].some((fila) => fila.code === code)) return [{ affectedRows: 0 }];
        datos[m[1]].push({ id: siguienteId++, code, name, description, is_active: 1 });
        return [{ affectedRows: 1 }];
      }
      if (s.startsWith("INSERT INTO permissions (resource_id, action_id, code, description, is_active)")) {
        const [resource_id, action_id, code, description] = params;
        assert.ok(resource_id && action_id, `permiso ${code} sin recurso o accion`);
        const choca = datos.permissions.some((fila) =>
          fila.code === code || (fila.resource_id === resource_id && fila.action_id === action_id));
        if (choca) return [{ affectedRows: 0 }];
        datos.permissions.push({ id: siguienteId++, resource_id, action_id, code, description, is_active: 1 });
        return [{ affectedRows: 1 }];
      }
      if (s.startsWith("INSERT INTO role_permissions (role_id, permission_id)")) {
        const [role_id, permission_id] = params;
        assert.ok(role_id && permission_id, "concesion sin rol o permiso");
        if (datos.role_permissions.some((f) => f.role_id === role_id && f.permission_id === permission_id)) {
          return [{ affectedRows: 0 }];
        }
        datos.role_permissions.push({ role_id, permission_id });
        return [{ affectedRows: 1 }];
      }
      throw new Error(`Sentencia no prevista por el doble: ${s}`);
    }
  };

  return {
    pool: { getConnection: async () => conexion },
    sentencias,
    estado,
    get datos() { return datos; },
    fallarEn(patron) { fallarEn = patron; }
  };
};

// Lo que dejaria el bootstrap de hoy: el catalogo entero y la matriz entera.
const instalacionCompleta = () => {
  const roles = ROLE_CATALOG.map((rol, i) => ({ id: i + 1, name: rol.name }));
  const resources = RESOURCE_CATALOG.map((r, i) => ({ id: 100 + i, code: r.code, name: r.name, description: r.description, is_active: 1 }));
  const actions = ACTION_CATALOG.map((a, i) => ({ id: 200 + i, code: a.code, name: a.name, description: a.description, is_active: 1 }));
  const idDe = (lista, code) => lista.find((fila) => fila.code === code).id;
  const permissions = PERMISSION_CATALOG.map((p, i) => ({
    id: 300 + i,
    resource_id: idDe(resources, p.resourceCode),
    action_id: idDe(actions, p.actionCode),
    code: p.code,
    description: p.description,
    is_active: 1
  }));
  const role_permissions = Object.entries(ROLE_PERMISSION_MATRIX).flatMap(([rol, matriz]) =>
    Object.entries(matriz).flatMap(([recurso, acciones]) => acciones.map((accion) => ({
      role_id: roles.find((r) => r.name === rol).id,
      permission_id: idDe(permissions, permissionCode(recurso, accion))
    }))));
  return { roles, resources, actions, permissions, role_permissions };
};

// Una base instalada ANTES de P8, y con un permiso que un administrador le quito a un rol a mano.
const instalacionAntigua = () => {
  const base = instalacionCompleta();
  const viejos = new Set(base.permissions.filter((p) => NUEVOS.includes(p.code.split(".")[0])).map((p) => p.id));
  base.role_permissions = base.role_permissions.filter((rp) => !viejos.has(rp.permission_id));
  base.permissions = base.permissions.filter((p) => !viejos.has(p.id));
  base.resources = base.resources.filter((r) => !NUEVOS.includes(r.code));
  const firmas = base.roles.find((r) => r.name === "GestorFirmas").id;
  const peopleRead = base.permissions.find((p) => p.code === "people.read").id;
  base.role_permissions = base.role_permissions.filter((rp) => !(rp.role_id === firmas && rp.permission_id === peopleRead));
  return base;
};

const concedidos = (datos, rol) => {
  const roleId = datos.roles.find((r) => r.name === rol).id;
  const codigos = new Map(datos.permissions.map((p) => [p.id, p.code]));
  return datos.role_permissions.filter((rp) => rp.role_id === roleId).map((rp) => codigos.get(rp.permission_id)).sort();
};

const esperadosDeLosNuevos = (rol) =>
  Object.entries(ROLE_PERMISSION_MATRIX[rol] ?? {})
    .filter(([recurso]) => NUEVOS.includes(recurso))
    .flatMap(([recurso, acciones]) => acciones.map((accion) => permissionCode(recurso, accion)))
    .sort();

describe("sincronizarCatalogoRbac", () => {
  it("sin roles no hay instalacion: no escribe nada", async () => {
    const base = crearBase({ roles: [], resources: [], actions: [], permissions: [], role_permissions: [] });
    const resultado = await sincronizarCatalogoRbac(base.pool);
    assert.equal(resultado.instalado, false);
    assert.deepEqual(base.sentencias.filter((s) => !s.startsWith("SELECT")), []);
    assert.equal(base.estado.confirmadas, 0);
    assert.equal(base.estado.liberadas, 1);
  });

  it("trae los cuatro recursos de P8 y concede sus permisos EXACTAMENTE segun la matriz", async () => {
    const base = crearBase(instalacionAntigua());
    const resultado = await sincronizarCatalogoRbac(base.pool);

    assert.deepEqual([...resultado.recursos].sort(), [...NUEVOS].sort());
    assert.deepEqual(resultado.acciones, []);
    assert.equal(resultado.permisos.length, NUEVOS.length * ACTION_CATALOG.length);
    const totalEsperado = ROLE_CATALOG.reduce((suma, rol) => suma + esperadosDeLosNuevos(rol.name).length, 0);
    assert.equal(resultado.concesiones, totalEsperado);

    for (const { name } of ROLE_CATALOG) {
      const nuevosDelRol = concedidos(base.datos, name).filter((codigo) => NUEVOS.includes(codigo.split(".")[0]));
      assert.deepEqual(nuevosDelRol, esperadosDeLosNuevos(name), name);
    }
    const talento = concedidos(base.datos, "GestorTalentoHumano");
    assert.ok(talento.includes("datos_sensibles.read") && talento.includes("datos_pago.read"));
    const auditor = concedidos(base.datos, "Auditor");
    assert.ok(auditor.includes("catalogos.read") && auditor.includes("bitacora_sensible.read"));
    assert.ok(!auditor.some((codigo) => codigo.startsWith("datos_sensibles.") || codigo.startsWith("datos_pago.")));
  });

  it("NO devuelve un permiso que ya existia y alguien quito a un rol", async () => {
    const base = crearBase(instalacionAntigua());
    await sincronizarCatalogoRbac(base.pool);
    assert.ok(!concedidos(base.datos, "GestorFirmas").includes("people.read"));
  });

  it("solo añade: ni UPDATE ni DELETE, y un permiso desactivado sigue desactivado", async () => {
    const tablas = instalacionAntigua();
    tablas.permissions.find((p) => p.code === "account.read").is_active = 0;
    tablas.resources.find((r) => r.code === "units").name = "Nombre que puso un administrador";
    const base = crearBase(tablas);
    await sincronizarCatalogoRbac(base.pool);
    assert.deepEqual(base.sentencias.filter((s) => /^(UPDATE|DELETE)\b/i.test(s)), []);
    assert.equal(base.datos.permissions.find((p) => p.code === "account.read").is_active, 0);
    assert.equal(base.datos.resources.find((r) => r.code === "units").name, "Nombre que puso un administrador");
  });

  it("es idempotente: la segunda vez no crea ni concede nada, y la base no cambia", async () => {
    const base = crearBase(instalacionAntigua());
    await sincronizarCatalogoRbac(base.pool);
    const trasLaPrimera = structuredClone(base.datos);
    const segunda = await sincronizarCatalogoRbac(base.pool);
    assert.deepEqual(
      { recursos: segunda.recursos, acciones: segunda.acciones, permisos: segunda.permisos, concesiones: segunda.concesiones },
      { recursos: [], acciones: [], permisos: [], concesiones: 0 }
    );
    assert.deepEqual(base.datos, trasLaPrimera);
    assert.deepEqual(base.sentencias.slice(-6).filter((s) => s.startsWith("INSERT")), []);
  });

  it("sobre una instalacion al dia no escribe ni una fila", async () => {
    const base = crearBase(instalacionCompleta());
    const resultado = await sincronizarCatalogoRbac(base.pool);
    assert.equal(resultado.instalado, true);
    assert.deepEqual(base.sentencias.filter((s) => !s.startsWith("SELECT")), []);
  });

  it("si falla a medias NO deja permisos creados y sin conceder, y el arranque siguiente lo completa", async () => {
    const base = crearBase(instalacionAntigua());
    const antes = structuredClone(base.datos);
    base.fallarEn(/^INSERT INTO role_permissions/);

    await assert.rejects(() => sincronizarCatalogoRbac(base.pool), /se cayo a medias/);
    assert.equal(base.estado.deshechas, 1);
    assert.equal(base.estado.confirmadas, 0);
    assert.equal(base.estado.liberadas, 1);
    assert.deepEqual(base.datos, antes, "el rollback tiene que dejar la base como estaba");

    base.fallarEn(null);
    const reintento = await sincronizarCatalogoRbac(base.pool);
    assert.equal(reintento.permisos.length, NUEVOS.length * ACTION_CATALOG.length);
    assert.ok(concedidos(base.datos, "GestorTalentoHumano").includes("datos_sensibles.read"));
  });
});
