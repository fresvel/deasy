export const PROCESS_SERIES_SOURCE_TYPES = new Set([
  "unit_type",
  "cargo",
  "default"
]);

export const MANUAL_PROCESS_SERIES_SOURCE_TYPES = new Set([
  "unit_type",
  "cargo",
  "default"
]);

const slugify = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .replace(/-{2,}/g, "-");

const capitalizeFirst = (value) => {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "";
  }
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
};

const prettifySeriesCode = (value) =>
  capitalizeFirst(String(value || "").replace(/-/g, " "));

export const buildProcessDefinitionSeriesDisplayName = (series = {}) => {
  const sourceType = String(series?.source_type || "").trim();
  const unitTypeName = capitalizeFirst(series?.unit_type_name || series?.unitTypeName || "");
  const cargoName = capitalizeFirst(series?.cargo_name || series?.cargoName || "");

  if (sourceType === "unit_type" && unitTypeName) {
    return unitTypeName;
  }
  if (sourceType === "cargo" && cargoName) {
    return cargoName;
  }
  return prettifySeriesCode(series?.code || "general");
};

export const buildProcessDefinitionVersionName = ({ processName, series } = {}) => {
  const normalizedProcessName = capitalizeFirst(processName);
  if (!normalizedProcessName) {
    return "";
  }
  // Sin variación (default): el nombre de la config es el nombre del proceso (lo pone el gestor);
  // no se añade "por …" porque no hay eje de variación (memos/oficios).
  if (String(series?.source_type || "").trim() === "default") {
    return normalizedProcessName.slice(0, 180);
  }
  const seriesName = buildProcessDefinitionSeriesDisplayName(series);
  if (!seriesName) {
    return "";
  }
  return `${normalizedProcessName} por ${seriesName}`.slice(0, 180);
};

export const resolveProcessDefinitionSeriesIdentity = async (
  candidate,
  { findUnitType, findCargo }
) => {
  const sourceType = String(candidate?.source_type || "").trim();
  if (!MANUAL_PROCESS_SERIES_SOURCE_TYPES.has(sourceType)) {
    throw new Error("Selecciona un origen de serie valido.");
  }

  const requiresUnitType = sourceType === "unit_type";
  const requiresCargo = sourceType === "cargo";
  const unitTypeId = requiresUnitType ? Number(candidate?.unit_type_id) : null;
  const cargoId = requiresCargo ? Number(candidate?.cargo_id) : null;

  let unitType = null;
  let cargo = null;
  if (requiresUnitType) {
    if (!unitTypeId) {
      throw new Error("La serie requiere seleccionar un tipo de unidad.");
    }
    unitType = await findUnitType(unitTypeId);
    if (!unitType) {
      throw new Error("El tipo de unidad seleccionado no existe.");
    }
  }
  if (requiresCargo) {
    if (!cargoId) {
      throw new Error("La serie requiere seleccionar un cargo.");
    }
    cargo = await findCargo(cargoId);
    if (!cargo) {
      throw new Error("El cargo seleccionado no existe.");
    }
  }

  let code = "";
  if (sourceType === "unit_type") {
    code = slugify(unitType.name).slice(0, 120);
  } else if (sourceType === "cargo") {
    code = slugify(cargo.name).slice(0, 120);
  } else {
    // default = sin variación (memos/oficios); código fijo, sin cargo/tipo.
    code = "general";
  }

  return {
    source_type: sourceType,
    unit_type_id: unitTypeId,
    cargo_id: cargoId,
    code
  };
};
