import { computed, ref } from "vue";
import { processDefinitionAdminService } from "@/modules/admin/services/ProcessDefinitionAdminService";
import { adminSqlService } from "@/modules/admin/services/AdminSqlService";

// Pasos del wizard guiado de proceso (de la creación a la activación).
// Orden: Reglas ANTES que Paquetes. El flujo de entrega de las plantillas (ámbitos de contexto) depende
// de las reglas objetivo del proceso, así que estas deben definirse primero.
export const PROCESS_WIZARD_STEPS = [
  { key: "definition", label: "Configuración" },
  { key: "rules", label: "Alcance" },
  { key: "packages", label: "Paquetes" },
  { key: "triggers", label: "Periodos" },
  { key: "activate", label: "Activar" },
];

export const NEW_LINEA_VALUE = "__new__";

// EL ALCANCE DE UNA LÍNEA: dónde vive la obligación. Son los mismos tres valores y los mismos
// nombres que `process_target_rules.unit_scope_type`, porque es el mismo concepto.
export const LINEA_SCOPE_LABELS = {
  all_units: "Todas las unidades",
  unit_type: "Por tipo de unidad",
  unit_exact: "Una unidad concreta"
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

const newDefinitionForm = () => ({
  process_mode: "existing",
  process_id: "",
  new_process_name: "",
  new_process_parent_id: "",
  linea_id: "",
  linea_nombre: "",
  unit_scope_type: "all_units",
  unit_type_id: "",
  unit_id: "",
  cargo_id: "",
  definition_version: "1.0.0",
  description: "",
  source_process_definition_id: "",
});

const definitionFormFromRow = (row = {}) => ({
  ...newDefinitionForm(),
  process_mode: "existing",
  process_id: row.process_id ? String(row.process_id) : "",
  linea_id: row.linea_id ? String(row.linea_id) : "",
  definition_version: row.definition_version || "1.0.0",
  description: row.description || ""
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
  const lineaOptions = ref([]);
  const unitOptions = ref([]);
  const duplicateDefinition = ref(null);
  const creatingDefinition = ref(false);
  const wizardError = ref("");
  const stepStatus = ref({ definition: false, packages: false, rules: false, triggers: false });

  const toRows = (data) => (Array.isArray(data) ? data : data?.rows || data?.data || []);

  const loadProcessOptions = async () => {
    try {
      const [procRes, unitTypeRes, cargoRes, lineaRes, unitRes] = await Promise.all([
        adminSqlService.list("processes", { filter_is_active: 1, orderBy: "name", order: "asc", limit: 500 }),
        adminSqlService.list("unit_types", { orderBy: "name", order: "asc", limit: 500 }),
        adminSqlService.list("cargos", { orderBy: "name", order: "asc", limit: 500 }),
        adminSqlService.list("lineas", { orderBy: "nombre", order: "asc", limit: 500 }),
        adminSqlService.list("units", { orderBy: "name", order: "asc", limit: 500 }),
      ]);
      processOptions.value = toRows(procRes.data).map((r) => ({
        id: r.id,
        name: r.name || r.slug || `Proceso ${r.id}`,
        slug: r.slug || "",
        parent_id: r.parent_id ?? null
      }));
      unitTypeOptions.value = toRows(unitTypeRes.data).map((r) => ({ id: r.id, name: r.name || `Tipo ${r.id}` }));
      cargoOptions.value = toRows(cargoRes.data).map((r) => ({ id: r.id, name: r.name || `Cargo ${r.id}` }));
      unitOptions.value = toRows(unitRes.data).map((r) => ({ id: r.id, name: r.name || `Unidad ${r.id}` }));
      const unitTypeNames = new Map(unitTypeOptions.value.map((row) => [Number(row.id), row.name]));
      const unitNames = new Map(unitOptions.value.map((row) => [Number(row.id), row.name]));
      const cargoNames = new Map(cargoOptions.value.map((row) => [Number(row.id), row.name]));
      // LA LÍNEA YA TIENE NOMBRE: aquí se componía uno a partir del origen de la serie
      // (`Por cargo: Docente`) porque la serie no tenía. El único añadido es el contexto —cargo y
      // alcance— para poder distinguir dos líneas del mismo proceso de un vistazo.
      lineaOptions.value = toRows(lineaRes.data)
        .filter((row) => !row?.effective_to)
        .map((row) => {
          const cargoName = cargoNames.get(Number(row.cargo_id)) || "";
          const scope = String(row.unit_scope_type || "all_units");
          const donde = scope === "unit_type"
            ? `${LINEA_SCOPE_LABELS.unit_type}: ${unitTypeNames.get(Number(row.unit_type_id)) || "?"}`
            : scope === "unit_exact"
              ? `${LINEA_SCOPE_LABELS.unit_exact}: ${unitNames.get(Number(row.unit_id)) || "?"}`
              : LINEA_SCOPE_LABELS.all_units;
          return {
            ...row,
            displayName: row.nombre || `Línea ${row.id}`,
            cargo_name: cargoName,
            label: [row.nombre, [cargoName || "Cualquier cargo", donde].join(" · ")].filter(Boolean).join(" — ")
          };
        });
    } catch {
      processOptions.value = [];
      unitTypeOptions.value = [];
      cargoOptions.value = [];
      lineaOptions.value = [];
      unitOptions.value = [];
    }
  };

  // LA IDENTIDAD DE UNA CONFIGURACIÓN ES (LÍNEA, VERSIÓN). Eran tres columnas —proceso, variación y
  // versión—, y la variación era una copia del código de la serie.
  const findExistingDefinition = async ({ lineaId, definitionVersion }) => {
    if (!lineaId || !definitionVersion) {
      return null;
    }
    const response = await adminSqlService.list("process_definition_versions", {
      filter_linea_id: Number(lineaId),
      filter_definition_version: String(definitionVersion),
      limit: 25
    });
    return toRows(response.data).find((row) => (
      Number(row.linea_id) === Number(lineaId)
      && String(row.definition_version || "") === String(definitionVersion || "")
    )) || null;
  };

  // EL NOMBRE DE LA LÍNEA. Aquí había TRES computed —`selectedSeriesDisplayName`,
  // `seriesCodePreview` y `selectedSeriesSourceType`— que reconstruían en el navegador la misma
  // derivación que el backend hacía con `slugify(cargo.name)`. Con la línea no hay nada que
  // derivar: o se eligió una, y tiene nombre, o se está escribiendo el de la nueva.
  const selectedLineaName = computed(() => {
    const form = definitionForm.value;
    const selectedLineaId = Number(form.linea_id);
    if (selectedLineaId) {
      return lineaOptions.value.find((row) => Number(row.id) === selectedLineaId)?.nombre || "";
    }
    if (form.linea_id !== NEW_LINEA_VALUE) {
      return "";
    }
    return String(form.linea_nombre || "").trim();
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

  // EL NOMBRE DE LA CONFIGURACIÓN ES SU IDENTIDAD: LA LÍNEA Y LA VERSIÓN (frente 25, P23).
  //
  // Era sólo el nombre de la línea, y así dos configuraciones de la misma línea se llamaban IGUAL:
  // la 1.0.0 y la 1.1.0 de la línea 1 decían las dos «Proceso por defecto». El nombre que servía
  // para nombrar no distinguía.
  //
  // Antes de eso se componía «<Proceso> por <Serie>», con el de la serie derivado de
  // `slugify(cargo.name)`, y le faltaba un eje: «Informe de IF por Coordinador» no distingue al de
  // Carrera del de Escuela.
  //
  // El formato lo fija `nombre_configuracion(…)` en el esquema, que es lo que el backend devuelve;
  // esto es la previsualización de lo mismo ANTES de guardar, y por eso repite el separador.
  const definitionNamePreview = computed(() => {
    const linea = selectedLineaName.value;
    const version = String(definitionForm.value.definition_version || "").trim();
    return [linea, version].filter(Boolean).join(" · ").slice(0, 180);
  });

  // Resuelve la línea elegida, o crea la nueva con sus DOS ejes y su nombre escrito.
  const resolveLinea = async (form, processId) => {
    const selectedLineaId = Number(form.linea_id);
    if (selectedLineaId) {
      const selected = lineaOptions.value.find((row) => Number(row.id) === selectedLineaId);
      if (!selected) {
        throw new Error("La línea seleccionada no está disponible.");
      }
      return { id: selectedLineaId, nombre: selected.nombre };
    }
    if (form.linea_id !== NEW_LINEA_VALUE) {
      throw new Error("Selecciona una línea existente o crea una nueva.");
    }

    const nombre = String(form.linea_nombre || "").trim();
    if (!nombre) {
      throw new Error("Escribe el nombre de la línea.");
    }
    const scope = String(form.unit_scope_type || "all_units");
    if (!LINEA_SCOPE_LABELS[scope]) {
      throw new Error("Selecciona un alcance válido para la línea.");
    }
    const unitTypeId = scope === "unit_type" ? Number(form.unit_type_id) : null;
    const unitId = scope === "unit_exact" ? Number(form.unit_id) : null;
    if (scope === "unit_type" && !unitTypeId) {
      throw new Error("Selecciona el tipo de unidad de la línea.");
    }
    if (scope === "unit_exact" && !unitId) {
      throw new Error("Selecciona la unidad de la línea.");
    }

    const today = new Date().toISOString().slice(0, 10);
    const lineaRes = await adminSqlService.create("lineas", {
      process_id: Number(processId),
      nombre,
      cargo_id: form.cargo_id ? Number(form.cargo_id) : null,
      unit_scope_type: scope,
      unit_type_id: unitTypeId,
      unit_id: unitId,
      effective_from: today
    });
    return { id: resolveCreatedId(lineaRes), nombre };
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
      // La línea de una configuración RETIRADA no viene en el listado (sólo se listan las vigentes),
      // así que se añade a mano para que el selector pueda mostrarla al reabrir el asistente.
      if (
        definitionRow.linea_id
        && !lineaOptions.value.some((option) => String(option.id) === String(definitionRow.linea_id))
      ) {
        const nombre = definitionRow.linea_nombre || definitionRow.name || `Línea ${definitionRow.linea_id}`;
        lineaOptions.value.push({
          id: definitionRow.linea_id,
          nombre,
          displayName: nombre,
          label: nombre
        });
      }
      currentStep.value = step || "rules";
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
      const linea = await resolveLinea(form, processId);
      if (!linea.id) {
        throw new Error("No se pudo resolver la línea de la configuración.");
      }
      const definitionVersion = form.definition_version || "1.0.0";
      duplicateLookupParams = {
        lineaId: linea.id,
        definitionVersion
      };
      const existingDefinition = await findExistingDefinition({
        ...duplicateLookupParams
      });
      if (existingDefinition?.id) {
        duplicateDefinition.value = existingDefinition;
        wizardError.value = "Ya existe una configuración con esa versión para la línea seleccionada.";
        return null;
      }
      const today = new Date().toISOString().slice(0, 10);
      // SIN `process_id` (frente 25, P22): la columna era una copia de `lineas.process_id`, así que
      // el asistente enviaba un dato que la línea ya dice. `processId` sigue haciendo falta aquí
      // arriba —es lo que decide de qué proceso es la LÍNEA que se crea—, pero no viaja dos veces.
      const definitionRes = await adminSqlService.create("process_definition_versions", {
        linea_id: Number(linea.id),
        definition_version: definitionVersion,
        description: form.description ? String(form.description) : null,
        status: "draft",
        effective_from: today,
        source_process_definition_id: form.source_process_definition_id ? Number(form.source_process_definition_id) : null,
      });
      const created = definitionRes?.data || {};
      definitionContext.value = {
        id: resolveCreatedId(definitionRes),
        process_id: Number(processId),
        linea_id: Number(linea.id),
        definition_version: definitionVersion,
        name: created.name || definitionNamePreview.value,
        description: form.description || "",
        status: "draft",
        ...created,
        linea_nombre: created.linea_nombre || linea.nombre,
      };
      await refreshStepStatus();
      currentStep.value = "rules";
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
    unitOptions,
    lineaOptions,
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
