// La bitacora no se escribe desde el editor de /admin, tampoco AdminSistema: `manage` de todo no
// incluye fabricar rastro. El DELETE y el UPDATE los rechaza ademas el trigger del esquema.
import { strict as assert } from "node:assert";
import { it } from "node:test";

import { getTableHooks } from "./tableHooks.js";

it("el editor rechaza con 403 el alta y la modificacion de la bitacora", async () => {
  const hooks = getTableHooks("accesos_sensibles");
  await assert.rejects(() => hooks.beforeCreate({}), (error) => error.statusCode === 403);
  await assert.rejects(() => hooks.beforeUpdate({}), (error) => error.statusCode === 403);
});
