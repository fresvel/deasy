// Contrato de ELIMINAR UN PUESTO.
//
// ── Por qué nace (2026-08-23) ──────────────────────────────────────────────────────────────
// `DELETE /admin/sql/units/positions/:id` llevaba MUERTO AL 100%, y el motivo es el de siempre en
// este repo: **no tenía contrato HTTP**, así que nadie ejecutaba su SQL. Empezaba con
// `DELETE rart FROM … INNER JOIN …`, sintaxis multi-tabla de MySQL que PostgreSQL rechaza, de modo
// que CUALQUIER llamada respondía `400 · syntax error at or near "rart"` — incluso la de un puesto
// inexistente. Es la regla 5 del método.
//
// Ni `check:sql-comments` ni `check:sql-aliases` podían cazarlo: no era un backtick ni un alias
// huérfano, era SINTAXIS. Lo único que lo caza es ejecutarlo, y eso es lo que hace este fichero.
//
// ── Lo que además tapaba ──────────────────────────────────────────────────────────────────
// Había un `catch` que traducía la violación de clave foránea al mensaje «desactívalo en su lugar».
// Como el error de sintaxis saltaba antes, **ese mensaje no lo vio nunca nadie**.
//
// ── Qué fija ──────────────────────────────────────────────────────────────────────────────
//  1. Un puesto inexistente responde 404 — no un error de SQL.
//  2. Un puesto CON historia responde 409 y NOMBRA qué lo bloquea, con conteos.
//  3. Y no le toca la historia: sus ocupaciones siguen ahí. Es la decisión §F-2 del diseño de
//     acceso — «un puesto no se borra si tiene historia: se desactiva».
//  4. Un puesto VIRGEN sí se borra.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { post, request } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";
import { waitForReady } from "../lib/readiness.mjs";
import { query } from "../lib/db.mjs";

before(async () => {
  await waitForReady();
});

test("borrar un puesto inexistente responde 404, no un error de SQL", async () => {
  const token = await tokenFor("admin");
  const res = await request("DELETE", "/admin/sql/units/positions/999999", { token });
  assert.equal(res.status, 404, `esperaba 404 y vino ${res.status}: ${JSON.stringify(res.body)}`);
  assert.ok(
    !/syntax error|rart/i.test(JSON.stringify(res.body)),
    "🔴 vuelve a filtrarse el error crudo de PostgreSQL al cliente",
  );
});

test("un puesto CON historia se rechaza nombrando qué lo bloquea, y NO se le toca la historia", async () => {
  const token = await tokenFor("admin");

  const [conHistoria] = await query(
    `SELECT up.id, (SELECT COUNT(*) FROM position_assignments pa WHERE pa.position_id = up.id) AS ocupaciones
       FROM unit_positions up
      WHERE EXISTS (SELECT 1 FROM position_assignments pa WHERE pa.position_id = up.id)
      ORDER BY up.id LIMIT 1`,
  );
  assert.ok(conHistoria, "la fixture debe traer algún puesto ocupado");

  const res = await request("DELETE", `/admin/sql/units/positions/${conHistoria.id}`, { token });
  assert.equal(res.status, 409, `esperaba 409 y vino ${res.status}: ${JSON.stringify(res.body)}`);

  const mensaje = String(res.body?.message || "");
  assert.match(mensaje, /ocupaci[oó]n/i, "el mensaje debe NOMBRAR qué bloquea, no decir «está referenciado»");
  assert.match(mensaje, /\d+/, "y con su conteo, que es lo único accionable");
  assert.match(mensaje, /[Dd]esactiv/, "y apuntar al camino que sí existe");

  // Lo que de verdad importa: la historia sigue entera.
  const [tras] = await query(
    "SELECT COUNT(*) AS n FROM position_assignments WHERE position_id = $1",
    [conHistoria.id],
  );
  assert.equal(
    Number(tras.n),
    Number(conHistoria.ocupaciones),
    "🔴 el borrado se llevó ocupaciones por delante: eso es justo lo que la decisión §F-2 prohíbe",
  );
  const [sigue] = await query("SELECT id FROM unit_positions WHERE id = $1", [conHistoria.id]);
  assert.ok(sigue, "y el puesto sigue existiendo");
});

test("un puesto VIRGEN sí se borra: es el caso de uso real, un puesto creado por error", async () => {
  const token = await tokenFor("admin");
  const creado = await post("/admin/sql/units/8/positions", { token, body: { cargo_id: 1, slot_no: 97 } });
  assert.equal(creado.status, 201, `no se pudo preparar el caso: ${JSON.stringify(creado.body)}`);

  const res = await request("DELETE", `/admin/sql/units/positions/${creado.body.id}`, { token });
  assert.equal(res.status, 200, `un puesto sin dependencias debe poder borrarse: ${JSON.stringify(res.body)}`);

  const [ya] = await query("SELECT id FROM unit_positions WHERE id = $1", [creado.body.id]);
  assert.ok(!ya, "y desaparece de verdad");
});
