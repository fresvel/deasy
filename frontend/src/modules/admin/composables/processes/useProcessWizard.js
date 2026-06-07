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

const newDefinitionForm = () => ({
  process_mode: "existing",
  process_id: "",
  new_process_name: "",
  series_id: "",
  series_source_type: "unit_type",
  unit_type_id: "",
  cargo_id: "",
  definition_version: "1.0.0",
  name: "",
  description: "",
  has_document: 1,
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
      processOptions.value = toRows(procRes.data).map((r) => ({ id: r.id, name: r.name || r.slug || `Proceso ${r.id}` }));
      unitTypeOptions.value = toRows(unitTypeRes.data).map((r) => ({ id: r.id, name: r.name || `Tipo ${r.id}` }));
      cargoOptions.value = toRows(cargoRes.data).map((r) => ({ id: r.id, name: r.name || `Cargo ${r.id}` }));
      const unitTypeNames = new Map(unitTypeOptions.value.map((row) => [Number(row.id), row.name]));
      const cargoNames = new Map(cargoOptions.value.map((row) => [Number(row.id), row.name]));
      seriesOptions.value = toRows(seriesRes.data)
        .filter((row) => SERIES_SOURCE_LABELS[row?.source_type] && Number(row?.is_active))
        .map((row) => {
          const unitTypeName = unitTypeNames.get(Number(row.unit_type_id)) || "";
          const cargoName = cargoNames.get(Number(row.cargo_id)) || "";
          const sourceDetail = [unitTypeName, cargoName].filter(Boolean).join(" + ");
          return {
            ...row,
            label: [
              row.code,
              sourceDetail
                ? `${SERIES_SOURCE_LABELS[row.source_type]}: ${sourceDetail}`
                : SERIES_SOURCE_LABELS[row.source_type]
            ].filter(Boolean).join(" · ")
          };
        });
    } catch {
      processOptions.value = [];
      unitTypeOptions.value = [];
      cargoOptions.value = [];
      seriesOptions.value = [];
    }
  };

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

  // Resuelve la variación existente o crea una nueva serie y devuelve su identidad persistida.
  const resolveSeries = async (form) => {
    const selectedSeriesId = Number(form.series_id);
    if (selectedSeriesId) {
      const selectedSeries = seriesOptions.value.find((row) => Number(row.id) === selectedSeriesId);
      if (!selectedSeries) {
        throw new Error("La variación seleccionada no está disponible.");
      }
      return { id: selectedSeriesId, code: selectedSeries.code };
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
      return { id: existing.id, code: existing.code };
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
      code: createdSeries.code || seriesCodePreview.value
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
    definitionForm.value = newDefinitionForm();
    await loadProcessOptions();
    if (definitionRow?.id) {
      definitionContext.value = { ...definitionRow };
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
    try {
      const form = definitionForm.value;
      const name = String(form.name || "").trim();
      if (!name) {
        throw new Error("Ingresa el nombre de la configuración.");
      }
      let processId = form.process_id ? Number(form.process_id) : null;
      if (form.process_mode === "new") {
        const processName = String(form.new_process_name || "").trim();
        if (!processName) {
          throw new Error("Ingresa el nombre del nuevo proceso.");
        }
        const slug = slugify(processName) || `proceso-${Date.now()}`;
        const processRes = await adminSqlService.create("processes", { name: processName, slug, is_active: 1 });
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
      const today = new Date().toISOString().slice(0, 10);
      const definitionRes = await adminSqlService.create("process_definition_versions", {
        process_id: Number(processId),
        series_id: Number(series.id),
        definition_version: form.definition_version || "1.0.0",
        name,
        description: form.description ? String(form.description) : null,
        has_document: Number(form.has_document) ? 1 : 0,
        status: "draft",
        effective_from: today,
      });
      const created = definitionRes?.data || {};
      definitionContext.value = {
        id: resolveCreatedId(definitionRes),
        process_id: Number(processId),
        series_id: Number(series.id),
        definition_version: form.definition_version || "1.0.0",
        name,
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
    processOptions,
    unitTypeOptions,
    cargoOptions,
    seriesOptions,
    seriesCodePreview,
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
