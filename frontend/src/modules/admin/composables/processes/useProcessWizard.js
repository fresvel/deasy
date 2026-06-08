import { computed, ref } from "vue";
import { processDefinitionAdminService } from "@/modules/admin/services/ProcessDefinitionAdminService";
import { adminSqlService } from "@/modules/admin/services/AdminSqlService";

// Pasos del wizard guiado de proceso (de la creación a la activación).
export const PROCESS_WIZARD_STEPS = [
  { key: "definition", label: "Configuración" },
  { key: "packages", label: "Paquetes" },
  { key: "rules", label: "Reglas" },
  { key: "triggers", label: "Disparadores" },
  { key: "activate", label: "Activar" },
];

const NEW_SERIES_VALUE = "__new__";

const SERIES_SOURCE_LABELS = {
  unit_type: "Tipo de unidad",
  cargo: "Cargo",
  unit_type_cargo: "Tipo de unidad y cargo"
};

const SERIES_OPTION_PREFIXES = {
  unit_type: "Por tipo de unidad",
  cargo: "Por cargo",
  unit_type_cargo: "Por tipo de unidad y cargo"
};

const slugify = (value, maxLength = 80) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);

const buildSeriesCode = ({ sourceType, unitTypeId, unitTypeName, cargoId, cargoName }) => {
  if (sourceType === "unit_type") {
    return slugify(unitTypeName, 120);
  }
  if (sourceType === "cargo") {
    return slugify(cargoName, 120);
  }
  if (sourceType === "unit_type_cargo" && unitTypeId && cargoId) {
    const unitTypeSlug = slugify(unitTypeName, 40);
    const cargoSlug = slugify(cargoName, 40);
    return `unit-type-${unitTypeId}-${unitTypeSlug}-cargo-${cargoId}-${cargoSlug}`.slice(0, 120);
  }
  return "";
};

const capitalizeFirst = (value) => {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "";
  }
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
};

const prettifySeriesCode = (value) =>
  capitalizeFirst(String(value || "").replace(/-/g, " "));

const buildSeriesDisplayName = ({ sourceType, unitTypeName, cargoName, code } = {}) => {
  const unitTypeLabel = capitalizeFirst(unitTypeName);
  const cargoLabel = capitalizeFirst(cargoName);

  if (sourceType === "unit_type" && unitTypeLabel) {
    return unitTypeLabel;
  }
  if (sourceType === "cargo" && cargoLabel) {
    return cargoLabel;
  }
  if (sourceType === "unit_type_cargo") {
    const parts = [unitTypeLabel, cargoLabel].filter(Boolean);
    if (parts.length) {
      return parts.join(" y ");
    }
  }
  return prettifySeriesCode(code || "general");
};

const newDefinitionForm = () => ({
  process_mode: "existing",
  process_id: "",
  new_process_name: "",
  new_process_parent_id: "",
  series_id: "",
  series_source_type: "unit_type",
  unit_type_id: "",
  cargo_id: "",
  definition_version: "1.0.0",
  description: "",
  has_document: 1,
  source_process_definition_id: "",
});

const definitionFormFromRow = (row = {}) => ({
  ...newDefinitionForm(),
  process_mode: "existing",
  process_id: row.process_id ? String(row.process_id) : "",
  series_id: row.series_id ? String(row.series_id) : "",
  definition_version: row.definition_version || "1.0.0",
  description: row.description || "",
  has_document: Number(row.has_document) ? 1 : 0
});

const resolveCreatedId = (response) =>
  response?.data?.id ?? response?.data?.insertId ?? response?.data?.data?.id ?? null;

export function useProcessWizard() {
  const wizardOpen = ref(false);
  const currentStep = ref("definition");
  const definitionContext = ref(null);
  const definitionForm = ref(newDefinitionForm());
  const processOptions = ref([]);
  const unitTypeOptions = ref([]);
  const cargoOptions = ref([]);
  const seriesOptions = ref([]);
  const duplicateDefinition = ref(null);
  const creatingDefinition = ref(false);
  const wizardError = ref("");
  const stepStatus = ref({ definition: false, packages: false, rules: false, triggers: false });

  const toRows = (data) => (Array.isArray(data) ? data : data?.rows || data?.data || []);

  const loadProcessOptions = async () => {
    try {
      const [procRes, unitTypeRes, cargoRes, seriesRes] = await Promise.all([
        adminSqlService.list("processes", { filter_is_active: 1, orderBy: "name", order: "asc", limit: 500 }),
        adminSqlService.list("unit_types", { orderBy: "name", order: "asc", limit: 500 }),
        adminSqlService.list("cargos", { orderBy: "name", order: "asc", limit: 500 }),
        adminSqlService.list("process_definition_series", { filter_is_active: 1, orderBy: "code", order: "asc", limit: 500 }),
      ]);
      processOptions.value = toRows(procRes.data).map((r) => ({
        id: r.id,
        name: r.name || r.slug || `Proceso ${r.id}`,
        slug: r.slug || "",
        parent_id: r.parent_id ?? null
      }));
      unitTypeOptions.value = toRows(unitTypeRes.data).map((r) => ({ id: r.id, name: r.name || `Tipo ${r.id}` }));
      cargoOptions.value = toRows(cargoRes.data).map((r) => ({ id: r.id, name: r.name || `Cargo ${r.id}` }));
      const unitTypeNames = new Map(unitTypeOptions.value.map((row) => [Number(row.id), row.name]));
      const cargoNames = new Map(cargoOptions.value.map((row) => [Number(row.id), row.name]));
      seriesOptions.value = toRows(seriesRes.data)
        .filter((row) => SERIES_SOURCE_LABELS[row?.source_type] && Number(row?.is_active))
        .map((row) => {
          const unitTypeName = unitTypeNames.get(Number(row.unit_type_id)) || "";
          const cargoName = cargoNames.get(Number(row.cargo_id)) || "";
          const displayName = buildSeriesDisplayName({
            sourceType: row.source_type,
            unitTypeName,
            cargoName,
            code: row.code
          });
          return {
            ...row,
            displayName,
            unit_type_name: row.unit_type_name || unitTypeName,
            cargo_name: row.cargo_name || cargoName,
            label: [
              SERIES_OPTION_PREFIXES[row.source_type] || SERIES_SOURCE_LABELS[row.source_type],
              displayName
            ].filter(Boolean).join(": ")
          };
        });
    } catch {
      processOptions.value = [];
      unitTypeOptions.value = [];
      cargoOptions.value = [];
      seriesOptions.value = [];
    }
  };

  const findExistingDefinition = async ({ processId, seriesId, definitionVersion }) => {
    if (!processId || !seriesId || !definitionVersion) {
      return null;
    }
    const response = await adminSqlService.list("process_definition_versions", {
      filter_process_id: Number(processId),
      filter_series_id: Number(seriesId),
      filter_definition_version: String(definitionVersion),
      limit: 25
    });
    return toRows(response.data).find((row) => (
      Number(row.process_id) === Number(processId)
      && Number(row.series_id) === Number(seriesId)
      && String(row.definition_version || "") === String(definitionVersion || "")
    )) || null;
  };

  const selectedSeriesDisplayName = computed(() => {
    const form = definitionForm.value;
    const selectedSeriesId = Number(form.series_id);
    if (selectedSeriesId) {
      const selectedSeries = seriesOptions.value.find((row) => Number(row.id) === selectedSeriesId);
      if (!selectedSeries) {
        return "";
      }
      return selectedSeries.displayName || buildSeriesDisplayName({
        sourceType: selectedSeries.source_type,
        unitTypeName: selectedSeries.unit_type_name,
        cargoName: selectedSeries.cargo_name,
        code: selectedSeries.code
      });
    }
    if (form.series_id !== NEW_SERIES_VALUE) {
      return "";
    }
    const unitType = unitTypeOptions.value.find((row) => Number(row.id) === Number(form.unit_type_id));
    const cargo = cargoOptions.value.find((row) => Number(row.id) === Number(form.cargo_id));
    if (form.series_source_type === "unit_type" && !unitType) {
      return "";
    }
    if (form.series_source_type === "cargo" && !cargo) {
      return "";
    }
    if (form.series_source_type === "unit_type_cargo" && (!unitType || !cargo)) {
      return "";
    }
    return buildSeriesDisplayName({
      sourceType: String(form.series_source_type || ""),
      unitTypeName: unitType?.name || "",
      cargoName: cargo?.name || "",
      code: seriesCodePreview.value
    });
  });

  const seriesCodePreview = computed(() => {
    const form = definitionForm.value;
    const selectedSeriesId = Number(form.series_id);
    if (selectedSeriesId) {
      return seriesOptions.value.find((row) => Number(row.id) === selectedSeriesId)?.code || "";
    }
    if (form.series_id !== NEW_SERIES_VALUE) {
      return "";
    }
    const unitType = unitTypeOptions.value.find((row) => Number(row.id) === Number(form.unit_type_id));
    const cargo = cargoOptions.value.find((row) => Number(row.id) === Number(form.cargo_id));
    return buildSeriesCode({
      sourceType: String(form.series_source_type || ""),
      unitTypeId: Number(form.unit_type_id) || null,
      unitTypeName: unitType?.name || "",
      cargoId: Number(form.cargo_id) || null,
      cargoName: cargo?.name || ""
    });
  });

  const resolveAvailableProcessSlug = (processName) => {
    const baseSlug = slugify(processName, 170) || "proceso";
    const existingSlugs = new Set(
      processOptions.value
        .map((row) => String(row.slug || "").trim().toLowerCase())
        .filter(Boolean)
    );
    if (!existingSlugs.has(baseSlug)) {
      return baseSlug;
    }
    for (let suffix = 2; suffix < 1000; suffix += 1) {
      const candidate = `${baseSlug}-${suffix}`.slice(0, 180);
      if (!existingSlugs.has(candidate)) {
        return candidate;
      }
    }
    return `${baseSlug}-${Date.now()}`.slice(0, 180);
  };

  const processSlugPreview = computed(() => {
    const form = definitionForm.value;
    if (form.process_mode !== "new") {
      return "";
    }
    const processName = String(form.new_process_name || "").trim();
    return processName ? resolveAvailableProcessSlug(processName) : "";
  });

  const selectedProcessName = computed(() => {
    const form = definitionForm.value;
    if (form.process_mode === "new") {
      return String(form.new_process_name || "").trim();
    }
    const selectedProcess = processOptions.value.find((row) => Number(row.id) === Number(form.process_id));
    return String(selectedProcess?.name || "").trim();
  });

  const definitionNamePreview = computed(() => {
    const processName = capitalizeFirst(selectedProcessName.value);
    const seriesName = selectedSeriesDisplayName.value;
    if (!processName || !seriesName) {
      return "";
    }
    return `${processName} por ${seriesName}`.slice(0, 180);
  });

  // Resuelve la variación existente o crea una nueva serie y devuelve su identidad persistida.
  const resolveSeries = async (form) => {
    const selectedSeriesId = Number(form.series_id);
    if (selectedSeriesId) {
      const selectedSeries = seriesOptions.value.find((row) => Number(row.id) === selectedSeriesId);
      if (!selectedSeries) {
        throw new Error("La variación seleccionada no está disponible.");
      }
      return { id: selectedSeriesId, code: selectedSeries.code, displayName: selectedSeries.displayName };
    }
    if (form.series_id !== NEW_SERIES_VALUE) {
      throw new Error("Selecciona una variación existente o crea una nueva.");
    }

    const sourceType = String(form.series_source_type || "");
    const validSourceTypes = new Set(["unit_type", "cargo", "unit_type_cargo"]);
    if (!validSourceTypes.has(sourceType)) {
      throw new Error("Selecciona un origen válido para la serie.");
    }

    const requiresUnitType = sourceType !== "cargo";
    const requiresCargo = sourceType !== "unit_type";
    const unitTypeId = requiresUnitType ? Number(form.unit_type_id) : null;
    const cargoId = requiresCargo ? Number(form.cargo_id) : null;
    if (requiresUnitType && !unitTypeId) {
      throw new Error("Selecciona un tipo de unidad para la serie.");
    }
    if (requiresCargo && !cargoId) {
      throw new Error("Selecciona un cargo para la serie.");
    }

    const filters = {
      filter_source_type: sourceType,
      ...(unitTypeId ? { filter_unit_type_id: unitTypeId } : {}),
      ...(cargoId ? { filter_cargo_id: cargoId } : {}),
      limit: 50
    };
    const listRes = await adminSqlService.list("process_definition_series", filters);
    const existing = toRows(listRes.data).find(
      (row) => (
        String(row.source_type) === sourceType
        && (!requiresUnitType || Number(row.unit_type_id) === unitTypeId)
        && (!requiresCargo || Number(row.cargo_id) === cargoId)
      )
    );
    if (existing?.id) {
      return {
        id: existing.id,
        code: existing.code,
        displayName: buildSeriesDisplayName({
          sourceType: existing.source_type,
          unitTypeName: unitTypeOptions.value.find((row) => Number(row.id) === Number(existing.unit_type_id))?.name || "",
          cargoName: cargoOptions.value.find((row) => Number(row.id) === Number(existing.cargo_id))?.name || "",
          code: existing.code
        })
      };
    }
    const payload = {
      source_type: sourceType,
      unit_type_id: unitTypeId,
      cargo_id: cargoId,
      is_active: 1
    };
    const seriesRes = await adminSqlService.create("process_definition_series", payload);
    const createdSeries = seriesRes?.data || {};
    return {
      id: resolveCreatedId(seriesRes),
      code: createdSeries.code || seriesCodePreview.value,
      displayName: selectedSeriesDisplayName.value
    };
  };

  const refreshStepStatus = async () => {
    const id = definitionContext.value?.id;
    if (!id) {
      stepStatus.value = { definition: false, packages: false, rules: false, triggers: false };
      return;
    }
    try {
      const checklist = await processDefinitionAdminService.evaluateChecklist(id);
      stepStatus.value = {
        definition: true,
        packages: Boolean(checklist?.artifacts),
        rules: Boolean(checklist?.rules),
        triggers: Boolean(checklist?.triggers),
      };
    } catch {
      stepStatus.value = { definition: true, packages: false, rules: false, triggers: false };
    }
  };

  const openWizard = async ({ definitionRow = null, processRow = null, step = null } = {}) => {
    wizardError.value = "";
    duplicateDefinition.value = null;
    definitionForm.value = newDefinitionForm();
    await loadProcessOptions();
    if (definitionRow?.id) {
      definitionContext.value = { ...definitionRow };
      definitionForm.value = definitionFormFromRow(definitionRow);
      if (
        definitionRow.process_id
        && !processOptions.value.some((option) => String(option.id) === String(definitionRow.process_id))
      ) {
        processOptions.value.push({
          id: definitionRow.process_id,
          name: definitionRow.process_name || definitionRow.process_label || `Proceso ${definitionRow.process_id}`,
          slug: ""
        });
      }
      if (
        definitionRow.series_id
        && !seriesOptions.value.some((option) => String(option.id) === String(definitionRow.series_id))
      ) {
        seriesOptions.value.push({
          id: definitionRow.series_id,
          code: definitionRow.variation_key || `serie-${definitionRow.series_id}`,
          displayName: buildSeriesDisplayName({ code: definitionRow.variation_key || definitionRow.name || `Variación ${definitionRow.series_id}` }),
          label: definitionRow.variation_key || `Variación ${definitionRow.series_id}`,
          is_active: 1
        });
      }
      currentStep.value = step || "packages";
      await refreshStepStatus();
    } else {
      definitionContext.value = null;
      currentStep.value = "definition";
      stepStatus.value = { definition: false, packages: false, rules: false, triggers: false };
      if (processRow?.id) {
        if (!processOptions.value.some((option) => String(option.id) === String(processRow.id))) {
          processOptions.value.push({
            id: processRow.id,
            name: processRow.name || processRow.slug || `Proceso ${processRow.id}`
          });
        }
        definitionForm.value = {
          ...definitionForm.value,
          process_mode: "existing",
          process_id: String(processRow.id)
        };
      }
    }
    wizardOpen.value = true;
  };

  const closeWizard = () => {
    wizardOpen.value = false;
  };

  const goToStep = (key) => {
    // Los pasos posteriores a "configuración" requieren una configuración creada.
    if (key !== "definition" && !definitionContext.value?.id) {
      return;
    }
    currentStep.value = key;
  };

  const createDefinition = async () => {
    creatingDefinition.value = true;
    wizardError.value = "";
    duplicateDefinition.value = null;
    let duplicateLookupParams = null;
    try {
      const form = definitionForm.value;
      let processId = form.process_id ? Number(form.process_id) : null;
      if (form.process_mode === "new") {
        const processName = String(form.new_process_name || "").trim();
        if (!processName) {
          throw new Error("Ingresa el nombre del nuevo proceso.");
        }
        const parentId = form.new_process_parent_id ? Number(form.new_process_parent_id) : null;
        if (parentId && !processOptions.value.some((option) => Number(option.id) === parentId)) {
          throw new Error("Selecciona un proceso padre válido.");
        }
        const slug = processSlugPreview.value || resolveAvailableProcessSlug(processName);
        const processRes = await adminSqlService.create("processes", {
          name: processName,
          slug,
          parent_id: parentId || null,
          is_active: 1
        });
        processId = resolveCreatedId(processRes);
        await loadProcessOptions();
      }
      if (!processId) {
        throw new Error("Selecciona o crea un proceso.");
      }
      const series = await resolveSeries(form);
      if (!series.id) {
        throw new Error("No se pudo resolver la serie de la configuración.");
      }
      const definitionVersion = form.definition_version || "1.0.0";
      duplicateLookupParams = {
        processId,
        seriesId: series.id,
        definitionVersion
      };
      const existingDefinition = await findExistingDefinition({
        ...duplicateLookupParams
      });
      if (existingDefinition?.id) {
        duplicateDefinition.value = existingDefinition;
        wizardError.value = "Ya existe una configuración con esa variación y versión para el proceso seleccionado.";
        return null;
      }
      const today = new Date().toISOString().slice(0, 10);
      const definitionRes = await adminSqlService.create("process_definition_versions", {
        process_id: Number(processId),
        series_id: Number(series.id),
        definition_version: definitionVersion,
        description: form.description ? String(form.description) : null,
        has_document: Number(form.has_document) ? 1 : 0,
        status: "draft",
        effective_from: today,
        source_process_definition_id: form.source_process_definition_id ? Number(form.source_process_definition_id) : null,
      });
      const created = definitionRes?.data || {};
      definitionContext.value = {
        id: resolveCreatedId(definitionRes),
        process_id: Number(processId),
        series_id: Number(series.id),
        definition_version: definitionVersion,
        name: created.name || definitionNamePreview.value,
        description: form.description || "",
        has_document: Number(form.has_document) ? 1 : 0,
        status: "draft",
        ...created,
        variation_key: created.variation_key || series.code,
      };
      await refreshStepStatus();
      currentStep.value = "packages";
      return definitionContext.value;
    } catch (error) {
      wizardError.value = error?.response?.data?.message || error?.message || "No se pudo crear la configuración.";
      if (
        !duplicateDefinition.value?.id
        && duplicateLookupParams
        && String(wizardError.value || "").includes("Ya existe una configuracion")
      ) {
        try {
          duplicateDefinition.value = await findExistingDefinition(duplicateLookupParams);
        } catch {
          duplicateDefinition.value = null;
        }
      }
      return null;
    } finally {
      creatingDefinition.value = false;
    }
  };

  return {
    wizardOpen,
    currentStep,
    definitionContext,
    definitionForm,
    duplicateDefinition,
    processOptions,
    unitTypeOptions,
    cargoOptions,
    seriesOptions,
    seriesCodePreview,
    processSlugPreview,
    definitionNamePreview,
    creatingDefinition,
    wizardError,
    stepStatus,
    steps: PROCESS_WIZARD_STEPS,
    loadProcessOptions,
    refreshStepStatus,
    openWizard,
    closeWizard,
    goToStep,
    createDefinition,
  };
}
