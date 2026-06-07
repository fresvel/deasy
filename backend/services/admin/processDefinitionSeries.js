export const PROCESS_SERIES_SOURCE_TYPES = new Set([
  "unit_type",
  "cargo",
  "unit_type_cargo",
  "default"
]);

export const MANUAL_PROCESS_SERIES_SOURCE_TYPES = new Set([
  "unit_type",
  "cargo",
  "unit_type_cargo"
]);

const slugify = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .replace(/-{2,}/g, "-");

export const resolveProcessDefinitionSeriesIdentity = async (
  candidate,
  { findUnitType, findCargo }
) => {
  const sourceType = String(candidate?.source_type || "").trim();
  if (!MANUAL_PROCESS_SERIES_SOURCE_TYPES.has(sourceType)) {
    throw new Error("Selecciona un origen de serie valido.");
  }

  const requiresUnitType = sourceType === "unit_type" || sourceType === "unit_type_cargo";
  const requiresCargo = sourceType === "cargo" || sourceType === "unit_type_cargo";
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
    const unitTypeSlug = slugify(unitType.name).slice(0, 40);
    const cargoSlug = slugify(cargo.name).slice(0, 40);
    code = `unit-type-${unitTypeId}-${unitTypeSlug}-cargo-${cargoId}-${cargoSlug}`.slice(0, 120);
  }

  return {
    source_type: sourceType,
    unit_type_id: unitTypeId,
    cargo_id: cargoId,
    code
  };
};
