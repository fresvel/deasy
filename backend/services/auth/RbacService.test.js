// Tests unitarios del cálculo de permisos del backend (RbacService).
//
// Es la fuente de verdad de la autorización. Su ESPEJO en el frontend es
// frontend/src/core/utils/accessControl.js — misma lógica core (`res.action ||
// res.manage`), con una diferencia intencional: aquí `access.isAdmin` viene
// precomputado; allí se deriva de los roles. Si alguna de las dos deriva, su test
// falla y el de la otra no, lo que hace visible la divergencia en revisión.
//
// hasAnyRole/hasPermission/can no tocan `this.pool`, así que se instancia sin BD.

import test from "node:test";
import assert from "node:assert/strict";

import RbacService from "./RbacService.js";

const rbac = new RbacService(null);

// --- hasPermission -----------------------------------------------------------

test("hasPermission concede todo a un access con isAdmin, sin mirar la lista", () => {
  assert.equal(rbac.hasPermission({ isAdmin: true, permissions: [] }, "cualquier.cosa"), true);
});

test("hasPermission exige que el código esté en la lista de permisos", () => {
  const access = { isAdmin: false, permissions: ["users.read", "documents.update"] };
  assert.equal(rbac.hasPermission(access, "users.read"), true);
  assert.equal(rbac.hasPermission(access, "users.delete"), false);
});

test("hasPermission rechaza un código vacío", () => {
  assert.equal(rbac.hasPermission({ isAdmin: true }, ""), false);
  assert.equal(rbac.hasPermission({ isAdmin: true }, null), false);
});

test("hasPermission es seguro ante un access nulo o sin permisos", () => {
  assert.equal(rbac.hasPermission(null, "users.read"), false);
  assert.equal(rbac.hasPermission({}, "users.read"), false);
});

// --- can: la lógica core espejada con el frontend ----------------------------

test("can concede si existe el permiso exacto de la acción", () => {
  const access = { permissions: ["units.create"] };
  assert.equal(rbac.can(access, "units", "create"), true);
});

test("can concede si existe el permiso .manage del recurso", () => {
  // manage es el comodín: cubre cualquier acción sobre el recurso.
  const access = { permissions: ["units.manage"] };
  assert.equal(rbac.can(access, "units", "create"), true);
  assert.equal(rbac.can(access, "units", "delete"), true);
  assert.equal(rbac.can(access, "units", "read"), true);
});

test("can rechaza si no hay ni el permiso exacto ni el .manage", () => {
  const access = { permissions: ["units.read"] };
  assert.equal(rbac.can(access, "units", "create"), false);
});

test("can rechaza recurso o acción vacíos", () => {
  const access = { permissions: ["units.manage"] };
  assert.equal(rbac.can(access, "", "create"), false);
  assert.equal(rbac.can(access, "units", ""), false);
});

test("can concede todo a un admin vía el corto-circuito de hasPermission", () => {
  assert.equal(rbac.can({ isAdmin: true }, "loquesea", "create"), true);
});

// --- hasAnyRole --------------------------------------------------------------

test("hasAnyRole detecta la intersección de roles", () => {
  const access = { roleNames: ["Usuario", "GestorProcesos"] };
  assert.equal(rbac.hasAnyRole(access, ["GestorProcesos"]), true);
  assert.equal(rbac.hasAnyRole(access, ["AdminSistema"]), false);
});

test("hasAnyRole es seguro ante access nulo o lista vacía", () => {
  assert.equal(rbac.hasAnyRole(null, ["Usuario"]), false);
  assert.equal(rbac.hasAnyRole({ roleNames: ["Usuario"] }, []), false);
});
