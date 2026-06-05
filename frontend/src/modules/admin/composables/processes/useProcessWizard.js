import { ref } from "vue";
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

const slugify = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const newDefinitionForm = () => ({
  process_mode: "existing",
  process_id: "",
  new_process_name: "",
  series_source_type: "unit_type",
  unit_type_id: "",
  cargo_id: "",
  variation_key: "general",
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
  const creatingDefinition = ref(false);
  const wizardError = ref("");
  const stepStatus = ref({ definition: false, packages: false, rules: false, triggers: false });

  const toRows = (data) => (Array.isArray(data) ? data : data?.rows || data?.data || []);

  const loadProcessOptions = async () => {
    try {
      const [procRes, unitTypeRes, cargoRes] = await Promise.all([
        adminSqlService.list("processes", { filter_is_active: 1, orderBy: "name", order: "asc", limit: 500 }),
        adminSqlService.list("unit_types", { orderBy: "name", order: "asc", limit: 500 }),
        adminSqlService.list("cargos", { orderBy: "name", order: "asc", limit: 500 }),
      ]);
      processOptions.value = toRows(procRes.data).map((r) => ({ id: r.id, name: r.name || r.slug || `Proceso ${r.id}` }));
      unitTypeOptions.value = toRows(unitTypeRes.data).map((r) => ({ id: r.id, name: r.name || `Tipo ${r.id}` }));
      cargoOptions.value = toRows(cargoRes.data).map((r) => ({ id: r.id, name: r.name || `Cargo ${r.id}` }));
    } catch {
      processOptions.value = [];
      unitTypeOptions.value = [];
      cargoOptions.value = [];
    }
  };

  // Resuelve (reutiliza o crea) la serie del origen elegido. El modelo exige series por unit_type o cargo
  // (las legacy no son válidas para configuraciones nuevas) y deduplica por código de origen.
  const resolveSeriesId = async (form) => {
    const sourceType = form.series_source_type === "cargo" ? "cargo" : "unit_type";
    const fkKey = sourceType === "cargo" ? "cargo_id" : "unit_type_id";
    const fkId = Number(form[fkKey]);
    if (!fkId) {
      throw new Error(sourceType === "cargo" ? "Selecciona un cargo para la serie." : "Selecciona un tipo de unidad para la serie.");
    }
    const listRes = await adminSqlService.list("process_definition_series", { [`filter_${fkKey}`]: fkId, limit: 50 });
    const existing = toRows(listRes.data).find(
      (r) => String(r.source_type) === sourceType && Number(r[fkKey]) === fkId
    );
    if (existing?.id) {
      return existing.id;
    }
    const payload = sourceType === "cargo"
      ? { source_type: "cargo", cargo_id: fkId, is_active: 1 }
      : { source_type: "unit_type", unit_type_id: fkId, is_active: 1 };
    const seriesRes = await adminSqlService.create("process_definition_series", payload);
    return resolveCreatedId(seriesRes);
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

  const openWizard = async ({ definitionRow = null, step = null } = {}) => {
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
      const seriesId = await resolveSeriesId(form);
      if (!seriesId) {
        throw new Error("No se pudo resolver la serie de la configuración.");
      }
      const today = new Date().toISOString().slice(0, 10);
      const definitionRes = await adminSqlService.create("process_definition_versions", {
        process_id: Number(processId),
        series_id: Number(seriesId),
        variation_key: form.variation_key || "general",
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
        series_id: Number(seriesId),
        variation_key: form.variation_key || "general",
        definition_version: form.definition_version || "1.0.0",
        name,
        description: form.description || "",
        has_document: Number(form.has_document) ? 1 : 0,
        status: "draft",
        ...created,
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
