// Versionado de plantillas y modo de emisión del vínculo plantilla↔proceso.
//
// Extraído de SqlAdminService.js: son funciones puras, sin BD ni entrada/salida.
// Vivir fuera de la clase las hace testeables (ver SqlAdminService.versioning.test.js)
// y quita 25 líneas al fichero de 6851.

export const SEMANTIC_VERSION_REGEX = /^\d+\.\d+\.\d+$/;

export const STORAGE_VERSION_BUMP_LEVELS = new Set(["patch", "minor", "major"]);

// Modos de emisión válidos para el vínculo plantilla↔proceso
// (process_definition_templates.item_mode). El modo vive en el LINK, no en la
// plantilla. 'routed' no autora flujo (se define al enviar).
export const ITEM_EMISSION_MODES = ["single", "replicated", "routed"];

// Calcula la siguiente versión semver (X.Y.Z) a partir de la actual y el nivel de
// cambio elegido por el usuario al crear una nueva versión. La primera es 1.0.0.
// Un nivel desconocido se trata como "minor"; una versión ilegible reinicia en 1.0.0.
export const bumpSemanticVersion = (current, level = "minor") => {
  const safeLevel = STORAGE_VERSION_BUMP_LEVELS.has(String(level)) ? String(level) : "minor";
  const match = String(current || "").trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return "1.0.0";
  }
  let [major, minor, patch] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (safeLevel === "major") {
    major += 1; minor = 0; patch = 0;
  } else if (safeLevel === "patch") {
    patch += 1;
  } else {
    minor += 1; patch = 0;
  }
  return `${major}.${minor}.${patch}`;
};

export const normalizeItemMode = (value) => {
  const mode = String(value ?? "").trim();
  return ITEM_EMISSION_MODES.includes(mode) ? mode : "single";
};
