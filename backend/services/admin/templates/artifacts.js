// Artefactos de plantilla: parsing de meta, saneo LaTeX, marcas de sincronización y
// selección de PDF de vista previa.
//
// Extraído de SqlAdminService.js. Funciones puras (sin BD ni this). `sanitizeLatexSource`
// es la barrera anti-inyección del contenido LaTeX editable por el admin;
// `parseArtifactSyncMarker` detecta el drift entre lo materializado en BD y el artifact.

import yaml from "js-yaml";

import { normalizeBooleanFlag } from "../kernel/primitives.js";

// Marcas de procedencia que se escriben en la `description` de los flujos proyectados,
// para poder reconocerlos y detectar drift más tarde.
export const ARTIFACT_SYNC_FILL_DESCRIPTION_PREFIX = "artifact_sync_fill:";

export const ARTIFACT_SYNC_SIGNATURE_DESCRIPTION_PREFIX = "artifact_sync_signature:";

export const parseYamlDocument = (content, { filePath = "meta.yaml" } = {}) => {
  try {
    const parsed = yaml.load(content);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    throw new Error(`No se pudo interpretar ${filePath}: ${error.message}`);
  }
};

// Saneo anti-inyección del contenido LaTeX editable. Devuelve la lista de violaciones (vacía = OK).
export const sanitizeLatexSource = (relpath, text) => {
  const violations = [];
  const forbidden = [
    [/\\write18/, "shell-escape (\\write18)"],
    [/\\(directlua|latelua)\b/, "ejecución Lua (\\directlua/\\latelua)"],
    [/\\openout\b/, "\\openout (escritura de archivos)"],
    [/\\openin\b/, "\\openin (lectura de archivos)"],
    [/\\special\s*\{\s*(?:dvips:\s*)?[!`|]/, "\\special con comando"],
    [/\\ShellEscape\b/, "\\ShellEscape"],
  ];
  for (const [re, label] of forbidden) {
    if (re.test(text)) violations.push(`${relpath}: ${label}`);
  }
  // \input/\include/\includegraphics/... con pipe, ruta absoluta o que escape del árbol (..)
  const pathCmd = /\\(input|include|includegraphics|InputIfFileExists|import|subimport|usepackage)\b\s*(?:\[[^\]]*\])?\s*\{([^}]*)\}/g;
  let match;
  while ((match = pathCmd.exec(text)) !== null) {
    const target = String(match[2] || "").trim();
    if (/^[|`!]/.test(target) || target.startsWith("/") || target.includes("..") || /^[a-zA-Z]:[\\/]/.test(target)) {
      violations.push(`${relpath}: ruta no permitida en \\${match[1]}{${target}}`);
    }
  }
  return violations;
};

export const parseAvailableFormats = (value) => {
  if (!value) {
    return {};
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return {};
  }
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
};

export const buildArtifactSyncedFillDescription = ({ artifactId, templateCode, storageVersion }) =>
  `${ARTIFACT_SYNC_FILL_DESCRIPTION_PREFIX}${artifactId}:${templateCode}:${storageVersion}`;

export const buildArtifactSyncedSignatureDescription = ({ artifactId, templateCode, storageVersion }) =>
  `${ARTIFACT_SYNC_SIGNATURE_DESCRIPTION_PREFIX}${artifactId}:${templateCode}:${storageVersion}`;

// Lee la marca de procedencia "<prefix><artifactId>:<templateCode>:<storageVersion>" para detectar drift:
// si el storageVersion materializado en BD difiere del actual del artifact, la proyección está desfasada.
// templateCode puede contener ':' improbable, pero artifactId (primer token) y storageVersion (último)
// son inequívocos.
export const parseArtifactSyncMarker = (description, prefix) => {
  const raw = String(description || "");
  if (!raw.startsWith(prefix)) {
    return null;
  }
  const body = raw.slice(prefix.length);
  const firstColon = body.indexOf(":");
  const lastColon = body.lastIndexOf(":");
  if (firstColon < 0 || lastColon <= firstColon) {
    return null;
  }
  return {
    artifactId: Number(body.slice(0, firstColon)) || null,
    templateCode: body.slice(firstColon + 1, lastColon),
    storageVersion: body.slice(lastColon + 1)
  };
};

export const isArtifactFillWorkflowSyncEnabled = (workflow = {}) =>
  String(workflow?.sync_mode || "").trim() === "artifact_to_db"
  && normalizeBooleanFlag(workflow?.required, false)
  && Array.isArray(workflow?.steps)
  && workflow.steps.length > 0;

export const isArtifactSignatureWorkflowSyncEnabled = (workflow = {}) =>
  String(workflow?.sync_mode || "").trim() === "artifact_to_db"
  && normalizeBooleanFlag(workflow?.required, false)
  && Array.isArray(workflow?.steps)
  && workflow.steps.length > 0;

export const findPreferredPdfObject = (objectNames = []) => {
  const pdfCandidates = (objectNames || []).filter((name) => /\.pdf$/i.test(String(name || "")));
  if (!pdfCandidates.length) {
    return null;
  }
  const preferredMatchers = [
    /\/render\/output\/pdf\/.+\.pdf$/i,
    /\/render\/.+\.pdf$/i,
    /\/preview\/.+\.pdf$/i,
    /\.pdf$/i
  ];
  for (const matcher of preferredMatchers) {
    const match = pdfCandidates.find((name) => matcher.test(name));
    if (match) {
      return match;
    }
  }
  return pdfCandidates[0];
};

