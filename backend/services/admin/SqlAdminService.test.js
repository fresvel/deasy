// Tests unitarios del gate de activación de configuraciones.
//
// `ensureDefinitionHasArtifactsForActivation` es el ÚNICO punto por el que pasan los dos caminos de
// activación (el CRUD genérico y el update guiado), así que es donde vive la invariante del 1.12:
// una configuración ACTIVA no puede llevar dentro un entregable sin publicar. Por HTTP el tercer
// guard no es alcanzable —los dos llamadores publican los borradores antes de llegar—, y por eso se
// prueba aquí: la red unitaria ve lo que char no puede.
//
// El método solo usa `connection.query`, así que el doble es una fila de agregados: exactamente lo
// que devuelve la consulta real (verificada con PREPARE contra PostgreSQL).

import test from "node:test";
import assert from "node:assert/strict";

import SqlAdminService from "./SqlAdminService.js";

// Pool inerte: el constructor solo lo guarda y se lo pasa a los sub-servicios.
const service = new SqlAdminService({ query: async () => [[]] });

const connectionWith = (row) => ({
  query: async () => [[row]],
});

const gate = (row) => service.ensureDefinitionHasArtifactsForActivation(1, connectionWith(row));

test("sin ninguna plantilla vinculada, no se puede activar", async () => {
  await assert.rejects(
    gate({ total: 0, active_total: 0, draft_total: 0, draft_names: null }),
    /al menos un paquete \(plantilla\) vinculado/
  );
});

test("con plantillas vinculadas pero ninguna activa, no se puede activar", async () => {
  await assert.rejects(
    gate({ total: 2, active_total: 0, draft_total: 0, draft_names: null }),
    /al menos una plantilla vinculada y activa/
  );
});

// El defecto 1.12: esta fila —dos vinculadas, las dos con almacenamiento listo, una todavía en
// borrador— es EXACTAMENTE la que el gate viejo dejaba pasar, porque solo miraba `is_active`.
test("con un entregable en borrador vinculado, la activacion se RECHAZA (1.12)", async () => {
  await assert.rejects(
    gate({ total: 2, active_total: 2, draft_total: 1, draft_names: "Informe de evento" }),
    /1 entregable\(s\) sin publicar \(Informe de evento\)/
  );
});

test("el mensaje del rechazo nombra TODOS los borradores que quedan", async () => {
  await assert.rejects(
    gate({ total: 3, active_total: 3, draft_total: 2, draft_names: "Acta, Informe" }),
    /2 entregable\(s\) sin publicar \(Acta, Informe\)/
  );
});

// `draft_names` es NULL cuando el LEFT JOIN a `deliverables` no resuelve el nombre. El mensaje debe
// seguir siendo legible, sin un "()" vacío colgando.
test("sin nombres resolubles, el mensaje no arrastra un parentesis vacio", async () => {
  await assert.rejects(
    gate({ total: 1, active_total: 1, draft_total: 1, draft_names: null }),
    (error) => {
      assert.match(error.message, /1 entregable\(s\) sin publicar\. Publicalos/);
      assert.doesNotMatch(error.message, /\(\)/);
      return true;
    }
  );
});

test("con todo publicado y activo, el gate deja pasar", async () => {
  await assert.doesNotReject(gate({ total: 2, active_total: 2, draft_total: 0, draft_names: null }));
});

// EL ORDEN DE LOS TRES GUARDS ES CONTRATO: el de borradores se añadió el ÚLTIMO justo para no mover
// los mensajes que ya estaban caracterizados. Una fila que viola los tres debe seguir respondiendo
// con el mensaje MÁS ANTIGUO.
test("el orden de los guards no cambia: sin vinculos gana el mensaje de siempre", async () => {
  await assert.rejects(
    gate({ total: 0, active_total: 0, draft_total: 0, draft_names: null }),
    /al menos un paquete \(plantilla\) vinculado/
  );
});

test("el orden de los guards no cambia: 'ninguna activa' gana sobre 'hay borradores'", async () => {
  await assert.rejects(
    gate({ total: 2, active_total: 0, draft_total: 2, draft_names: "Acta, Informe" }),
    /al menos una plantilla vinculada y activa/
  );
});

// Guarda de entrada preexistente: sin id no hay nada que validar y NO se consulta la base.
test("sin definitionId, el gate no consulta nada y no lanza", async () => {
  let consultas = 0;
  await service.ensureDefinitionHasArtifactsForActivation(0, {
    query: async () => {
      consultas += 1;
      return [[]];
    },
  });
  assert.equal(consultas, 0, "una definicion vacia no debe llegar a la base");
});
