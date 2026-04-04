import fs from "fs";
import path from "path";
import yaml from "js-yaml";

import { documentCompilerPayloadService } from "./DocumentCompilerPayloadService.js";

const SERVICE_DIR = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(SERVICE_DIR, "..", "..", "..");
const PATTERNS_DIR = path.join(REPO_ROOT, "tools", "templates", "patterns");

const normalizeCode = (value) => String(value || "").trim();

const collectSchemaFieldMap = (node, fieldMap = new Map()) => {
  if (!node || typeof node !== "object") {
    return fieldMap;
  }

  if (typeof node["x-deasy-field-code"] === "string" && node["x-deasy-field-code"].trim()) {
    fieldMap.set(node["x-deasy-field-code"].trim(), {
      dataKey: typeof node["x-deasy-data-key"] === "string" ? node["x-deasy-data-key"].trim() : "",
      schema: node,
    });
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      collectSchemaFieldMap(item, fieldMap);
    }
    return fieldMap;
  }

  for (const value of Object.values(node)) {
    collectSchemaFieldMap(value, fieldMap);
  }
  return fieldMap;
};

const resolvePatternPath = (patternRef) => {
  const normalized = String(patternRef || "").trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!normalized) {
    return "";
  }
  const candidates = normalized.endsWith(".yaml")
    ? [normalized]
    : [`${normalized}.yaml`, path.posix.join(normalized, "pattern.yaml")];

  for (const candidate of candidates) {
    const absolutePath = path.join(PATTERNS_DIR, candidate);
    if (fs.existsSync(absolutePath)) {
      return absolutePath;
    }
  }
  return "";
};

const loadPatternDocument = (patternRef) => {
  const patternPath = resolvePatternPath(patternRef);
  if (!patternPath) {
    return null;
  }
  return {
    path: patternPath,
    document: yaml.load(fs.readFileSync(patternPath, "utf8")) || {},
  };
};

const pushIssue = (collection, code, message, details = {}, severity = "error") => {
  collection.push({
    code,
    message,
    severity,
    details,
  });
};

const validateRenderContract = ({ payload, errors, warnings }) => {
  const renderEngine = normalizeCode(payload?.target?.renderEngine);
  const outputFormat = normalizeCode(payload?.target?.outputFormat);
  const metaModes = payload?.payload?.meta?.modes || {};
  const systemMode = (metaModes.system || {})[renderEngine];
  const userModes = metaModes.user || {};

  if (!renderEngine) {
    pushIssue(errors, "render_engine_missing", "No se definió render_engine para la compilación.");
    return;
  }

  if (!systemMode?.path) {
    pushIssue(
      errors,
      "render_engine_unsupported",
      `El artifact no declara modes.system.${renderEngine}.path para el motor solicitado.`,
      { renderEngine }
    );
  }

  if (!outputFormat) {
    pushIssue(errors, "output_format_missing", "No se definió output_format para la compilación.");
    return;
  }

  if (outputFormat === "pdf") {
    if (!userModes?.latex?.path && !userModes?.pdf?.path) {
      pushIssue(
        errors,
        "output_format_unproducible",
        "El artifact no declara una salida user.latex ni user.pdf para producir PDF.",
        { outputFormat }
      );
    }
    if (userModes?.pdf?.path && !userModes?.latex?.path) {
      pushIssue(
        warnings,
        "pdf_without_latex_pipeline",
        "El artifact declara salida PDF directa; el alcance inicial prioriza jinja2 -> latex -> pdf.",
        { outputFormat }
      );
    }
    return;
  }

  if (!userModes?.[outputFormat]?.path) {
    pushIssue(
      errors,
      "output_format_unproducible",
      `El artifact no declara modes.user.${outputFormat}.path para la salida solicitada.`,
      { outputFormat }
    );
  }
};

const validateRenderSource = ({ payload, errors }) => {
  const renderSource = payload?.renderSource || {};
  const files = Array.isArray(renderSource.files) ? renderSource.files : [];

  if (!renderSource.objectPrefix) {
    pushIssue(errors, "render_source_missing", "No se resolvió el prefijo remoto del template fuente.");
  }

  if (!files.length) {
    pushIssue(errors, "render_source_empty", "El artifact no tiene archivos fuente para renderizar.");
    return;
  }

  const hasTemplateEntry = files.some((item) => String(item.relativePath || "").endsWith(".j2"));
  if (!hasTemplateEntry) {
    pushIssue(
      errors,
      "render_source_template_missing",
      "El árbol fuente del artifact no contiene archivos Jinja `.j2` para el pipeline inicial."
    );
  }
};

const validateFillWorkflow = ({ meta, schemaFieldMap, errors }) => {
  const steps = (((meta || {}).workflows || {}).fill || {}).steps;
  if (!Array.isArray(steps)) {
    return;
  }

  for (const step of steps) {
    const stepCode = normalizeCode(step?.code) || `step_order_${step?.order || "na"}`;
    const fieldRefs = Array.isArray(step?.field_refs) ? step.field_refs : [];
    for (const fieldRef of fieldRefs) {
      if (!schemaFieldMap.has(fieldRef)) {
        pushIssue(
          errors,
          "fill_field_ref_missing",
          `El field_ref ${fieldRef} del paso ${stepCode} no existe en schema.json.`,
          { stepCode, fieldRef }
        );
      }
    }
  }
};

const validateSignatureWorkflow = ({ meta, schemaFieldMap, errors, warnings }) => {
  const signatures = (((meta || {}).workflows || {}).signatures || {});
  if (!signatures?.required) {
    return;
  }

  const anchors = Array.isArray(signatures.anchors) ? signatures.anchors : [];
  const steps = Array.isArray(signatures.steps) ? signatures.steps : [];
  const anchorCodes = new Set(anchors.map((anchor) => normalizeCode(anchor?.code)).filter(Boolean));
  const patternRef = normalizeCode(signatures.pattern_ref);

  if (!anchors.length) {
    pushIssue(errors, "signature_anchors_missing", "El template requiere firma pero no declara anchors.");
  }

  if (!steps.length) {
    pushIssue(errors, "signature_steps_missing", "El template requiere firma pero no declara steps.");
  }

  for (const anchor of anchors) {
    const anchorCode = normalizeCode(anchor?.code);
    const placementStrategy = normalizeCode(anchor?.placement?.strategy);
    if (!anchorCode) {
      pushIssue(errors, "signature_anchor_code_missing", "Existe un anchor de firma sin code.");
      continue;
    }
    if (!placementStrategy) {
      pushIssue(
        errors,
        "signature_anchor_strategy_missing",
        `El anchor ${anchorCode} no declara placement.strategy.`,
        { anchorCode }
      );
      continue;
    }
    if (placementStrategy === "token") {
      const tokenFieldRef = normalizeCode(anchor?.placement?.token_field_ref);
      if (!tokenFieldRef) {
        pushIssue(
          errors,
          "signature_anchor_token_field_ref_missing",
          `El anchor ${anchorCode} usa strategy=token pero no declara token_field_ref.`,
          { anchorCode }
        );
      } else if (!schemaFieldMap.has(tokenFieldRef)) {
        pushIssue(
          errors,
          "signature_anchor_token_field_ref_unknown",
          `El anchor ${anchorCode} referencia ${tokenFieldRef} y ese campo no existe en schema.json.`,
          { anchorCode, fieldRef: tokenFieldRef }
        );
      }
    } else {
      pushIssue(
        warnings,
        "signature_anchor_strategy_non_token",
        `El anchor ${anchorCode} usa ${placementStrategy}; el alcance inicial prioriza estrategia por token.`,
        { anchorCode, placementStrategy }
      );
    }
  }

  for (const step of steps) {
    const stepCode = normalizeCode(step?.code) || `step_order_${step?.order || "na"}`;
    const anchorRefs = Array.isArray(step?.anchor_refs) ? step.anchor_refs : [];
    if (!anchorRefs.length) {
      pushIssue(
        errors,
        "signature_step_anchor_refs_missing",
        `El paso de firma ${stepCode} no declara anchor_refs.`,
        { stepCode }
      );
      continue;
    }
    for (const anchorRef of anchorRefs) {
      if (!anchorCodes.has(anchorRef)) {
        pushIssue(
          errors,
          "signature_step_anchor_ref_unknown",
          `El paso de firma ${stepCode} referencia el anchor ${anchorRef} que no existe.`,
          { stepCode, anchorRef }
        );
      }
    }
  }

  if (!patternRef) {
    pushIssue(
      warnings,
      "signature_pattern_ref_missing",
      "El template requiere firma pero no declara pattern_ref; se pierde validación fuerte del contrato runtime."
    );
    return;
  }

  const pattern = loadPatternDocument(patternRef);
  if (!pattern?.document) {
    pushIssue(
      errors,
      "signature_pattern_ref_invalid",
      `No se encontró el pattern_ref declarado por el template: ${patternRef}.`,
      { patternRef }
    );
    return;
  }

  const runtimeFields = ((((pattern.document || {}).pattern || {}).compiler_contract || {}).runtime_fields) || [];
  if (!runtimeFields.length) {
    pushIssue(
      errors,
      "signature_pattern_runtime_fields_missing",
      `El pattern_ref ${patternRef} no declara compiler_contract.runtime_fields.`,
      { patternRef }
    );
    return;
  }

  for (const runtimeField of runtimeFields) {
    for (const fieldRefKey of [
      "token_field_ref",
      "name_field_ref",
      "role_field_ref",
      "date_field_ref",
    ]) {
      const fieldRef = normalizeCode(runtimeField?.[fieldRefKey]);
      if (!fieldRef) {
        pushIssue(
          errors,
          "signature_pattern_runtime_field_incomplete",
          `El pattern_ref ${patternRef} tiene un runtime_field incompleto.`,
          { patternRef, fieldRefKey, slot: runtimeField?.slot || null }
        );
        continue;
      }
      if (!schemaFieldMap.has(fieldRef)) {
        pushIssue(
          errors,
          "signature_pattern_field_ref_unknown",
          `El pattern_ref ${patternRef} referencia ${fieldRef} y ese campo no existe en schema.json.`,
          { patternRef, fieldRef }
        );
      }
    }
  }
};

export class DocumentTemplateTechnicalValidatorService {
  constructor({
    payloadService = documentCompilerPayloadService,
  } = {}) {
    this.payloadService = payloadService;
  }

  async validateDocumentVersion(documentVersionId, externalConnection = null) {
    const payload = await this.payloadService.buildPayload(documentVersionId, externalConnection);
    return this.validatePayload(payload);
  }

  validatePayload(payload) {
    const errors = [];
    const warnings = [];
    const schemaFieldMap = collectSchemaFieldMap(payload?.payload?.schema || {});

    validateRenderContract({ payload, errors, warnings });
    validateRenderSource({ payload, errors });
    validateFillWorkflow({
      meta: payload?.payload?.meta,
      schemaFieldMap,
      errors,
    });
    validateSignatureWorkflow({
      meta: payload?.payload?.meta,
      schemaFieldMap,
      errors,
      warnings,
    });

    return {
      ok: errors.length === 0,
      documentVersionId: Number(payload?.documentVersion?.id || 0) || null,
      target: payload?.target || null,
      errors,
      warnings,
      payload,
    };
  }
}

export const documentTemplateTechnicalValidatorService =
  new DocumentTemplateTechnicalValidatorService();
