// Tests unitarios de los DOS gates de publicación por id: `setTemplateArtifactActive` (activar) y
// `publishTemplateArtifact` (publicar).
//
// POR QUÉ EXISTEN, y por qué no bastaba con lo que había. Estos dos gates NO los toca ningún
// characterization: `test:char:run` recorre el update guiado y la creación de borradores, pero
// nunca activa ni publica una plantilla por id. Comprobado con grep sobre
// `tests/characterization/flows/`. Hasta el sub-paso 4 del §0.8 su readiness no tenía red de
// ninguna clase, así que la mudanza del `meta.yaml` a la base se habría hecho a ciegas.
//
// Lo que fijan es lo que el sub-paso 4 cambia y lo que NO cambia:
//   · el readiness se cuenta sobre la BASE (no sobre MinIO);
//   · un error al contar SUBE, en vez de valer "0 pasos" — el defecto que motiva el sub-paso;
//   · la excepción `routed` sigue siendo la de estos dos gates: `isArtifactRoutedOnly`, es decir
//     "TODOS los vínculos son routed", que NO es la misma que la de los otros dos (ver el informe).

import test from "node:test";
import assert from "node:assert/strict";

import TemplateArtifactService from "./templateArtifact.js";

const ART_ID = 7;

// Doble de pool que responde a las tres consultas que el camino toca: los modos de los vínculos, el
// EXISTS del readiness y los UPDATE. Registra lo que ocurre para poder afirmar el orden.
const buildService = ({ itemModes = ["single"], hasSteps = 1, fallaElConteo = false, artifact = {} } = {}) => {
  const events = [];

  const responder = async (sql, params = []) => {
    const texto = String(sql).replace(/\s+/g, " ").trim();
    if (texto.includes("AS has_steps")) {
      events.push(`cuenta-pasos:${params[0]}`);
      if (fallaElConteo) throw new Error("no se pudo contar los pasos: la base no responde");
      return [[{ has_steps: hasSteps }]];
    }
    if (texto.startsWith("SELECT item_mode")) {
      events.push("consulta-modos");
      return [itemModes.map((item_mode) => ({ item_mode }))];
    }
    if (texto.startsWith("SELECT deliverable_id")) {
      return [[{ deliverable_id: 3 }]];
    }
    if (texto.startsWith("UPDATE template_artifacts SET is_active")) {
      events.push(`activa:${params[0]}`);
      return [{}];
    }
    if (texto.includes("SET lifecycle_state = 'published'")) {
      events.push("publica");
      return [{}];
    }
    events.push(`sql-no-esperado:${texto}`);
    return [[]];
  };

  const connection = {
    beginTransaction: async () => { events.push("begin"); },
    commit: async () => { events.push("commit"); },
    rollback: async () => { events.push("rollback"); },
    release: () => { events.push("release"); },
    query: responder,
  };

  const pool = { getConnection: async () => connection, query: responder };

  const service = new TemplateArtifactService(pool, {
    getByKeys: async () => ({
      id: ART_ID,
      is_active: 0,
      lifecycle_state: "draft",
      template_code: "tpl_x",
      storage_version: "1.0.0",
      ...artifact,
    }),
  });

  return { service, events };
};

// --- Activar -----------------------------------------------------------------------------------

test("activar exige el paso de entrega y lo cuenta sobre la BASE", async () => {
  const { service, events } = buildService({ hasSteps: 1 });
  const resultado = await service.setTemplateArtifactActive(ART_ID, true);

  assert.equal(resultado.is_active, 1);
  assert.equal(resultado.changed, true);
  assert.deepEqual(events, ["consulta-modos", `cuenta-pasos:${ART_ID}`, `activa:${1}`]);
});

test("activar sin ningun paso de entrega se rechaza y no toca la plantilla", async () => {
  const { service, events } = buildService({ hasSteps: 0 });

  await assert.rejects(
    () => service.setTemplateArtifactActive(ART_ID, true),
    /No se puede activar: la plantilla debe definir al menos un paso de flujo de entrega/,
  );
  assert.ok(!events.some((e) => e.startsWith("activa:")), "el UPDATE no llega a ejecutarse");
});

test("activar una plantilla routed-only no exige paso de entrega", async () => {
  // El flujo de un `routed` se define AL ENVIAR, así que no hay nada que exigirle aquí.
  const { service, events } = buildService({ itemModes: ["routed"], hasSteps: 0 });
  await service.setTemplateArtifactActive(ART_ID, true);

  assert.ok(!events.some((e) => e.startsWith("cuenta-pasos")), "ni se cuenta");
  assert.ok(events.includes("activa:1"));
});

test("con un vinculo routed y otro que no, el readiness SIGUE exigiendose", async () => {
  // `isArtifactRoutedOnly` pide que TODOS los vínculos sean routed: basta uno `single` para que la
  // plantilla tenga que traer su flujo predefinido.
  const { service } = buildService({ itemModes: ["routed", "single"], hasSteps: 0 });
  await assert.rejects(
    () => service.setTemplateArtifactActive(ART_ID, true),
    /No se puede activar/,
  );
});

test("desactivar no pasa por el readiness", async () => {
  const { service, events } = buildService({ artifact: { is_active: 1 }, hasSteps: 0 });
  const resultado = await service.setTemplateArtifactActive(ART_ID, false);

  assert.equal(resultado.is_active, 0);
  assert.ok(!events.some((e) => e.startsWith("cuenta-pasos")));
});

test("si la base falla al contar, activar propaga el error en vez de rechazar por 'sin flujo'", async () => {
  // ESTE es el motivo del sub-paso 4 del §0.8: antes se leía el `meta.yaml` de MinIO dentro de un
  // `catch {}` mudo, así que un MinIO caído se traducía en "esta plantilla no define flujo de
  // entrega" y bloqueaba la publicación con un mensaje que mentía sobre la causa.
  const { service, events } = buildService({ fallaElConteo: true });

  await assert.rejects(
    () => service.setTemplateArtifactActive(ART_ID, true),
    /la base no responde/,
  );
  assert.ok(!events.some((e) => e.startsWith("activa:")));
});

// --- Publicar ----------------------------------------------------------------------------------

test("publicar exige el paso de entrega antes de abrir la transaccion", async () => {
  const { service, events } = buildService({ hasSteps: 1 });
  const resultado = await service.publishTemplateArtifact(ART_ID);

  assert.equal(resultado.lifecycle_state, "published");
  assert.ok(events.indexOf(`cuenta-pasos:${ART_ID}`) < events.indexOf("begin"),
    "rechazar no debe costar un BEGIN/ROLLBACK");
  assert.deepEqual(events.slice(-3), ["publica", "commit", "release"]);
});

test("publicar sin paso de entrega se rechaza sin abrir transaccion", async () => {
  const { service, events } = buildService({ hasSteps: 0 });

  await assert.rejects(
    () => service.publishTemplateArtifact(ART_ID),
    /No se puede publicar: la plantilla debe definir al menos un paso de flujo de entrega/,
  );
  assert.ok(!events.includes("begin"));
  assert.ok(!events.includes("publica"));
});

test("publicar una plantilla routed-only no exige paso de entrega", async () => {
  const { service, events } = buildService({ itemModes: ["routed"], hasSteps: 0 });
  await service.publishTemplateArtifact(ART_ID);

  assert.ok(!events.some((e) => e.startsWith("cuenta-pasos")));
  assert.ok(events.includes("publica"));
});

test("si la base falla al contar, publicar propaga el error", async () => {
  const { service, events } = buildService({ fallaElConteo: true });

  await assert.rejects(() => service.publishTemplateArtifact(ART_ID), /la base no responde/);
  assert.ok(!events.includes("begin"));
});

test("una plantilla ya publicada no vuelve a pasar por el readiness", async () => {
  const { service, events } = buildService({ artifact: { lifecycle_state: "published" }, hasSteps: 0 });
  const resultado = await service.publishTemplateArtifact(ART_ID);

  assert.equal(resultado.changed, false);
  assert.deepEqual(events, []);
});
