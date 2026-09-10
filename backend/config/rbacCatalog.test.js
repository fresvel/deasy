// La politica de acceso de las tablas del editor de /admin y de los recursos sensibles (frente 20, P8).
//
// POR QUE EXISTE. Tres defectos que ningun test veia, medidos el 2026-09-10:
//   1. Diecinueve tablas sin entrada en TABLE_RESOURCE_MAP caian a `process_definitions`, y
//      GestorProcesos editaba cedulas. Nadie se entero, porque una tabla olvidada no da error: da un
//      permiso.
//   2. La matriz de Auditor se calculaba sobre el catalogo ENTERO, asi que añadir un recurso sensible
//      le daba lectura sin que nadie lo decidiera.
//   3. Nada fijaba quien lee lo sensible: un `read` de mas en cualquier rol pasaba en verde.
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { SQL_TABLES } from "./sqlTables.js";
import { RESOURCE_CATALOG, ROLE_PERMISSION_MATRIX, SENSITIVE_RESOURCES, TABLE_RESOURCE_MAP } from "./rbacCatalog.js";
import { resolveTableResource } from "./rbacPolicy.js";
import { COLUMNA_TITULAR } from "../services/auth/AccesosSensiblesService.js";

const RECURSOS = RESOURCE_CATALOG.map((recurso) => recurso.code);
const ESCRITURA = ["create", "update", "delete", "manage"];
const TODAS = ["read", ...ESCRITURA];

const rolesCon = (recurso, acciones) =>
  Object.entries(ROLE_PERMISSION_MATRIX)
    .filter(([, matriz]) => (matriz[recurso] ?? []).some((accion) => acciones.includes(accion)))
    .map(([rol]) => rol)
    .sort();

describe("toda tabla del editor tiene recurso", () => {
  it("cada tabla de sqlTables.js tiene su entrada en TABLE_RESOURCE_MAP", () => {
    const sinRecurso = SQL_TABLES.map((t) => t.table).filter((t) => !Object.hasOwn(TABLE_RESOURCE_MAP, t));
    assert.deepEqual(sinRecurso, [], `sin recurso, y por tanto CERRADAS: ${sinRecurso.join(", ")}`);
  });

  it("cada recurso del mapa existe en el catalogo", () => {
    const inventados = Object.entries(TABLE_RESOURCE_MAP)
      .filter(([, recurso]) => !RECURSOS.includes(recurso))
      .map(([tabla, recurso]) => `${tabla} -> ${recurso}`);
    assert.deepEqual(inventados, []);
  });

  it("una tabla sin recurso resuelve a NULL, no a un recurso por defecto", () => {
    assert.equal(resolveTableResource("tabla_inventada"), null);
    assert.equal(resolveTableResource(""), null);
  });

  it("los nombres del prototipo no cuelan como recurso", () => {
    for (const nombre of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      assert.equal(resolveTableResource(nombre), null, nombre);
    }
  });
});

describe("los recursos sensibles", () => {
  it("son datos_sensibles y datos_pago", () => {
    assert.deepEqual([...SENSITIVE_RESOURCES].sort(), ["datos_pago", "datos_sensibles"]);
  });

  it("Auditor NO los lee, y sigue leyendo todo lo demas", () => {
    const auditor = ROLE_PERMISSION_MATRIX.Auditor;
    for (const recurso of SENSITIVE_RESOURCES) {
      assert.equal(auditor[recurso], undefined, `Auditor no puede tener ${recurso}`);
    }
    for (const recurso of RECURSOS.filter((r) => !SENSITIVE_RESOURCES.includes(r))) {
      assert.deepEqual(auditor[recurso], ["read"], `Auditor deberia leer ${recurso}`);
    }
  });

  it("los leen SOLO AdminSistema y GestorTalentoHumano", () => {
    for (const recurso of SENSITIVE_RESOURCES) {
      assert.deepEqual(rolesCon(recurso, TODAS), ["AdminSistema", "GestorTalentoHumano"], recurso);
    }
  });

  it("los escribe SOLO AdminSistema", () => {
    for (const recurso of SENSITIVE_RESOURCES) {
      assert.deepEqual(rolesCon(recurso, ESCRITURA), ["AdminSistema"], recurso);
    }
  });

  it("Usuario no tiene NINGUNO: el editor de /admin no mira de quien es la fila", () => {
    const usuario = ROLE_PERMISSION_MATRIX.Usuario;
    for (const recurso of [...SENSITIVE_RESOURCES, "bitacora_sensible", "catalogos", "people"]) {
      assert.equal(usuario[recurso], undefined, recurso);
    }
  });

  it("toda tabla sensible del editor lleva el titular que apunta la bitacora", () => {
    const configuracion = Object.fromEntries(SQL_TABLES.map((t) => [t.table, t]));
    const sensibles = Object.entries(TABLE_RESOURCE_MAP)
      .filter(([tabla, recurso]) => SENSITIVE_RESOURCES.includes(recurso) && configuracion[tabla])
      .map(([tabla]) => tabla);
    assert.ok(sensibles.includes("documentos_identidad"));
    assert.ok(sensibles.includes("persona_autoidentificacion"));
    for (const tabla of sensibles) {
      assert.ok(
        configuracion[tabla].fields.some((campo) => campo.name === COLUMNA_TITULAR),
        `${tabla} no tiene ${COLUMNA_TITULAR}: la bitacora no sabria de quien es el dato`
      );
    }
  });
});

describe("catalogos y bitacora", () => {
  it("los catalogos los leen todos los roles menos Usuario, y los escribe solo AdminSistema", () => {
    const gestores = Object.keys(ROLE_PERMISSION_MATRIX).filter((rol) => rol !== "Usuario").sort();
    assert.deepEqual(rolesCon("catalogos", ["read"]), gestores);
    assert.deepEqual(rolesCon("catalogos", ESCRITURA), ["AdminSistema"]);
  });

  it("la bitacora la leen AdminSistema y Auditor, y nadie mas", () => {
    assert.deepEqual(rolesCon("bitacora_sensible", TODAS), ["AdminSistema", "Auditor"]);
  });
});
