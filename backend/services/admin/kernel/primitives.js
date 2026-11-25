// Coerciones y normalizaciones básicas compartidas por SqlAdminService y sus
// módulos hermanos.
//
// Viven aparte para que `SqlAdminService.workflows.js` pueda usarlas sin importar
// del fichero grande, lo que crearía un ciclo de imports.
//
// Baja complejidad, altísima reutilización: `normalizeNumericId` se usa 27 veces.

export const slugify = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .replace(/-{2,}/g, "-");

export const humanizeSlug = (value) => String(value || "")
  .split(/[-_/]+/)
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(" ");

// Devuelve el id solo si es un entero POSITIVO. El 0 y los negativos no son ids
// válidos, así que caen a null igual que "" o undefined.
export const normalizeNumericId = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
};

export const normalizeBooleanFlag = (value, defaultValue = false) => {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "si", "sí"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no"].includes(normalized)) {
    return false;
  }
  return defaultValue;
};
