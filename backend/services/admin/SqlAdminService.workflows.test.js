// Tests unitarios de los flujos de llenado y firma.
//
// Es el corazón del contrato de firma, y su lógica es silenciosa: normaliza y
// DESCARTA sin lanzar errores. Un firmante que desaparece de un flujo legal no da
// ningún síntoma hasta que alguien no puede firmar. Estos tests fijan qué se
// conserva y qué se descarta.

import test from "node:test";
import assert from "node:assert/strict";

import {
  buildStepResolver,
  buildWorkflowsYaml,
  normalizeSignatureSigner,
  normalizeSignatureSteps,
  resolveStepCargoId,
  collectAuthoredWorkflowIssues,
} from "./SqlAdminService.workflows.js";

// --- buildStepResolver: qué campos emite según el tipo -----------------------

test("buildStepResolver usa task_assignee/auto_one por defecto", () => {
  assert.deepEqual(buildStepResolver({}), { type: "task_assignee", selection_mode: "auto_one" });
});

test("buildStepResolver para cargo en unidad exacta incluye unit_id, no unit_type_id", () => {
  const r = buildStepResolver({
    resolver_type: "cargo_in_scope",
    cargo_id: "4",
    unit_scope_type: "unit_exact",
    unit_id: "8",
    unit_type_id: "3",
  });
  assert.equal(r.type, "cargo_in_scope");
  assert.equal(r.cargo_id, 4);
  assert.equal(r.unit_id, 8);
  assert.equal(r.unit_scope_type, "unit_exact");
  assert.equal("unit_type_id" in r, false, "unit_exact no fija unit_type_id");
});

test("buildStepResolver para ancestro incluye unit_type_id y relation_type_id, no unit_id", () => {
  const r = buildStepResolver({
    resolver_type: "cargo_in_scope",
    cargo_id: 4,
    unit_scope_type: "context_ancestor_type",
    unit_id: 8,
    unit_type_id: 3,
    relation_type_id: 2,
  });
  assert.equal(r.unit_type_id, 3);
  assert.equal(r.relation_type_id, 2);
  assert.equal("unit_id" in r, false, "el ancestro no fija una unidad concreta");
});

test("buildStepResolver para persona específica solo lleva person_id", () => {
  const r = buildStepResolver({ resolver_type: "specific_person", person_id: "7" });
  assert.deepEqual(r, { type: "specific_person", selection_mode: "auto_one", person_id: 7 });
});

// --- resolveStepCargoId: id directo, o código/alias contra el catálogo -------

const cargoCodeMap = new Map([
  ["coordinador", 1],
  ["director", 4],
  ["responsable", 3],
]);

test("resolveStepCargoId prefiere el cargo_id directo", () => {
  assert.equal(resolveStepCargoId({ cargo_id: "9" }, "", cargoCodeMap), 9);
});

test("resolveStepCargoId resuelve por código contra el catálogo", () => {
  assert.equal(resolveStepCargoId({ cargo_code: "director" }, "", cargoCodeMap), 4);
});

test("resolveStepCargoId resuelve un alias antes de buscar en el catálogo", () => {
  // "director_escuela" es alias de "director" (CARGO_CODE_ALIASES).
  assert.equal(resolveStepCargoId({ cargo_code: "director_escuela" }, "", cargoCodeMap), 4);
  assert.equal(resolveStepCargoId({ cargo_code: "coordinador_carrera" }, "", cargoCodeMap), 1);
});

test("resolveStepCargoId devuelve null si el código no está en el catálogo", () => {
  assert.equal(resolveStepCargoId({ cargo_code: "inexistente" }, "", cargoCodeMap), null);
  assert.equal(resolveStepCargoId({}, "", cargoCodeMap), null);
});

// --- normalizeSignatureSigner: cómo un cargo se vuelve resoluble --------------

test("normalizeSignatureSigner resuelve el cargo requerido por alias", () => {
  const s = normalizeSignatureSigner(
    { type: "cargo_in_scope", cargo_code: "director_escuela" },
    { cargoCodeMap },
  );
  assert.equal(s.requiredCargoId, 4);
  assert.equal(s.resolverType, "cargo_in_scope");
});

test("normalizeSignatureSigner cae a valores seguros ante campos inválidos", () => {
  const s = normalizeSignatureSigner({ type: "loquesea", selection_mode: "xxx", unit_scope_type: "yyy" });
  assert.equal(s.resolverType, "cargo_in_scope");
  assert.equal(s.selectionMode, "auto_all");
  assert.equal(s.unitScopeType, "context_exact");
});

// --- normalizeSignatureSteps: los DESCARTES silenciosos ----------------------

test("normalizeSignatureSteps descarta el firmante por cargo sin cargo resoluble", () => {
  const wf = {
    steps: [
      { order: 1, signers: [{ type: "cargo_in_scope", cargo_code: "no-existe" }] },
    ],
  };
  // El único firmante no resuelve -> el paso se queda sin firmantes -> no se materializa.
  assert.deepEqual(normalizeSignatureSteps(wf, { cargoCodeMap }), []);
});

test("normalizeSignatureSteps conserva el paso si al menos un firmante resuelve", () => {
  const wf = {
    steps: [
      {
        order: 1,
        signers: [
          { type: "cargo_in_scope", cargo_code: "no-existe" },
          { type: "cargo_in_scope", cargo_code: "director" },
        ],
      },
    ],
  };
  const out = normalizeSignatureSteps(wf, { cargoCodeMap });
  assert.equal(out.length, 1);
  assert.equal(out[0].signers.length, 1, "solo sobrevive el firmante resoluble");
  assert.equal(out[0].signers[0].requiredCargoId, 4);
});

test("normalizeSignatureSteps ordena los pasos por order y espeja el firmante principal", () => {
  const wf = {
    steps: [
      { order: 2, signers: [{ type: "specific_person", person_id: 5 }] },
      { order: 1, signers: [{ type: "specific_person", person_id: 7 }] },
    ],
  };
  const out = normalizeSignatureSteps(wf);
  assert.deepEqual(out.map((s) => s.stepOrder), [1, 2]);
  assert.equal(out[0].assignedPersonId, 7, "las columnas del paso espejan el primer firmante");
});

test("normalizeSignatureSteps admite la meta antigua con un único resolver", () => {
  const wf = { steps: [{ order: 1, resolver: { type: "specific_person", person_id: 7 } }] };
  const out = normalizeSignatureSteps(wf);
  assert.equal(out.length, 1);
  assert.equal(out[0].signers[0].assignedPersonId, 7);
});

test("normalizeSignatureSteps normaliza un approval_mode inválido a 'and'", () => {
  const wf = { steps: [{ order: 1, approval_mode: "loquesea", signers: [{ type: "specific_person", person_id: 7 }] }] };
  assert.equal(normalizeSignatureSteps(wf)[0].approvalMode, "and");
});

// --- buildWorkflowsYaml: round-trip a YAML -----------------------------------

test("buildWorkflowsYaml deriva can_reject del orden del paso", () => {
  const yaml = buildWorkflowsYaml({
    fillWorkflow: { steps: [{ order: 1, name: "Entrega" }, { order: 2, name: "Revisión" }] },
  });
  // El primer paso nunca puede devolver (no hay paso anterior); el segundo sí.
  assert.match(yaml, /can_reject: false/);
  assert.match(yaml, /can_reject: true/);
});

test("buildWorkflowsYaml marca signatures.required solo si hay pasos de firma", () => {
  const sinFirmas = buildWorkflowsYaml({ signatureWorkflow: { required: true, steps: [] } });
  assert.match(sinFirmas, /required: false/, "sin pasos, la firma no es requerida");
});
