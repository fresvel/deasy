import { computed, ref } from "vue";
import { processDefinitionAdminService } from "@/modules/admin/services/ProcessDefinitionAdminService";
import { adminSqlService } from "@/modules/admin/services/AdminSqlService";

// Pasos del wizard guiado de proceso (de la creación a la activación).
//
// CUATRO, Y ERAN CINCO (frente 25, P26). El segundo era «Alcance» y gestionaba
// `process_target_rules`, que se retiró: a quién alcanza una configuración lo dice su LÍNEA, y la
// línea se elige en el paso 1. Decía aquí que las reglas iban antes que los paquetes «porque el
// flujo de entrega depende de ellas» — y sigue siendo cierto del alcance, sólo que ya está decidido
// antes de abrir el asistente.
export const PROCESS_WIZARD_STEPS = [
  { key: "definition", label: "Configuración" },
  { key: "packages", label: "Paquetes" },
  { key: "triggers", label: "Periodos" },
  { key: "activate", label: "Activar" },
];

// AQUI VIVIA `NEW_LINEA_VALUE = "__new__"` (frente 25, P23): el valor centinela de la opcion
// «Nueva linea» del desplegable, que inyectaba CINCO campos mas en el mismo paso. Crear una
// linea tiene su propio plano, asi que no hace falta un valor que signifique «esto no es una
// linea, es un formulario».

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

// EL PASO 1 PIDE TRES COSAS, Y PEDÍA HASTA ONCE (frente 25, P23 — 2026-10-14).
//
// Declaraba 12 grupos de campo que cubrían TRES entidades —proceso, línea y configuración—: 5
// visibles en el caso común y 11 en el peor (proceso nuevo + línea nueva). Y el proceso no es un
// dato de la configuración: eso lo demostró `P22` quitando la columna. Tenerlo entre los campos que
// se rellenan decía lo contrario, y además podía CONTRADECIR a la línea elegida, porque
// `loadProcessOptions` las traía todas y nada comprobaba que la línea fuera de ese proceso.
//
// Hoy el proceso ACOTA el buscador de líneas (`filtro_process_id`) y no viaja en el formulario, y
// crear un proceso o una línea pasa a su propio plano. Lo que queda aquí son los tres datos que SON
// de la configuración: su línea, su versión y su descripción.
const newDefinitionForm = () => ({
  linea_id: "",
  definition_version: "1.0.0",
  description: "",
  source_process_definition_id: "",
});

const definitionFormFromRow = (row = {}) => ({
  ...newDefinitionForm(),
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
  // LA ACOTACIÓN POR PROCESO. No es un campo del formulario y no viaja a ninguna parte: sólo decide
  // qué líneas ofrece el buscador. Por eso vacío significa «todos los procesos» y no «falta un
  // dato»: la línea elegida ya dice de qué proceso es.
  const filtroProcessId = ref("");
  // LOS DOS PLANOS: crear un proceso y crear una línea salen del paso 1 y se abren encima.
  const procesoModalOpen = ref(false);
  const lineaModalOpen = ref(false);
  const creandoProceso = ref(false);
  const creandoLinea = ref(false);
  const procesoModalError = ref("");
  const lineaModalError = ref("");
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

  // EL BUSCADOR DE LÍNEAS, acotado por el proceso elegido.
  //
  // Antes el selector era un `<select>` con las 500 primeras líneas de TODOS los procesos y el
  // proceso iba aparte, como campo: se podía elegir el proceso A y una línea del proceso B, y el
  // contexto quedaba con un `process_id` que la línea contradecía. Aquí no cabe esa pareja: el
  // proceso filtra la lista, así que lo que no está no se puede elegir.
  //
  // El sublabel lleva el proceso aunque esté acotado, para que la elección nunca sea a ciegas.
  const lineaSuggestProvider = async (texto) => {
    const params = { q: texto || "", limit: 8, orderBy: "nombre", order: "asc" };
    if (filtroProcessId.value) {
      params.filter_process_id = Number(filtroProcessId.value);
    }
    const response = await adminSqlService.list("lineas", params);
    return toRows(response.data)
      .filter((row) => !row?.effective_to)
      .map((row) => ({
        id: row.id,
        label: row.nombre || `Línea ${row.id}`,
        sublabel: describirLinea(row),
        row
      }));
  };

  // El contexto de una línea en una frase: de qué proceso es, quién la produce y dónde.
  const describirLinea = (row) => {
    const proceso = processOptions.value.find((p) => Number(p.id) === Number(row?.process_id))?.name;
    const cargo = cargoOptions.value.find((c) => Number(c.id) === Number(row?.cargo_id))?.name;
    const scope = String(row?.unit_scope_type || "all_units");
    const donde = scope === "unit_type"
      ? `${LINEA_SCOPE_LABELS.unit_type}: ${unitTypeOptions.value.find((u) => Number(u.id) === Number(row?.unit_type_id))?.name || "?"}`
      : scope === "unit_exact"
        ? `${LINEA_SCOPE_LABELS.unit_exact}: ${unitOptions.value.find((u) => Number(u.id) === Number(row?.unit_id))?.name || "?"}`
        : LINEA_SCOPE_LABELS.all_units;
    return [proceso, cargo || "Cualquier cargo", donde].filter(Boolean).join(" · ");
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

  // EL NOMBRE DE LA LÍNEA ELEGIDA. Aquí había TRES computed —`selectedSeriesDisplayName`,
  // `seriesCodePreview` y `selectedSeriesSourceType`— que reconstruían en el navegador la misma
  // derivación que el backend hacía con `slugify(cargo.name)`. Con la línea no hay nada que
  // derivar: se eligió una, y tiene nombre.
  //
  // El `__new__` del selector se fue con el plano de «Nueva línea» (P23): una opción de un
  // desplegable que inyectaba CINCO campos más en la misma pantalla era el mayor foco de ruido del
  // paso 1, y además obligaba a que el formulario de la configuración supiera rellenar una línea.
  const selectedLineaName = computed(() => {
    const selectedLineaId = Number(definitionForm.value.linea_id);
    if (!selectedLineaId) {
      return "";
    }
    return lineaOptions.value.find((row) => Number(row.id) === selectedLineaId)?.nombre || "";
  });

  // Elegir en el buscador guarda el id Y cachea la fila, que es de donde sale el nombre que se
  // previsualiza y la etiqueta que el campo enseña.
  const elegirLinea = (option) => {
    const row = option?.row || null;
    if (row?.id && !lineaOptions.value.some((item) => Number(item.id) === Number(row.id))) {
      lineaOptions.value = [...lineaOptions.value, { ...row, displayName: row.nombre, label: row.nombre }];
    }
    definitionForm.value = { ...definitionForm.value, linea_id: row?.id ? String(row.id) : "" };
  };

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

  // La previsualización del slug se mudó al plano de «Nuevo proceso», que es donde se escribe el
  // nombre del que sale. Aquí miraba `definitionForm`, un formulario que ya no tiene esos campos.
  const slugPreviewPara = (nombre) => {
    const limpio = String(nombre || "").trim();
    return limpio ? resolveAvailableProcessSlug(limpio) : "";
  };

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
  // LA LÍNEA ELEGIDA. Era «resolver»: elegía una existente O CREABA UNA con cinco campos del mismo
  // formulario. Crear vive ahora en su propio plano (`crearLinea`), así que esto sólo mira lo que ya
  // se eligió — y eso es lo que permite que el paso 1 tenga tres campos en todos los casos.
  const resolveLinea = (form) => {
    const selectedLineaId = Number(form.linea_id);
    if (!selectedLineaId) {
      throw new Error("Busca y selecciona la línea de la configuración.");
    }
    const selected = lineaOptions.value.find((row) => Number(row.id) === selectedLineaId);
    if (!selected) {
      throw new Error("La línea seleccionada no está disponible.");
    }
    return { id: selectedLineaId, nombre: selected.nombre };
  };

  // --- LOS DOS PLANOS -----------------------------------------------------------------------------
  //
  // «+ Nuevo proceso» y «+ Nueva línea» abren un plano encima en vez de inyectar campos aquí o de
  // navegar a `/admin/procesos/procesos/processes`. Navegar NO era opción: el asistente es un modal
  // y la ruta lo destruye con el formulario a medio llenar, y no hay reanudación. Y el plano encima
  // es barato: `AppModalShell` se coloca solo al abrirse (`elevarSobreLoVisible`), así que un
  // segundo modal no declara ninguna altura ni la puede equivocar.

  const abrirProcesoModal = () => {
    procesoModalError.value = "";
    procesoModalOpen.value = true;
  };
  const cerrarProcesoModal = () => { procesoModalOpen.value = false; };

  const abrirLineaModal = () => {
    lineaModalError.value = "";
    lineaModalOpen.value = true;
  };
  const cerrarLineaModal = () => { lineaModalOpen.value = false; };

  // Crea el proceso y lo deja ACOTANDO el buscador: es lo que la persona acaba de decir que quiere
  // mirar, y la línea que cree a continuación nacerá dentro de él.
  const crearProceso = async (form) => {
    creandoProceso.value = true;
    procesoModalError.value = "";
    try {
      const nombre = String(form?.name || "").trim();
      if (!nombre) {
        throw new Error("Ingresa el nombre del nuevo proceso.");
      }
      const parentId = form?.parent_id ? Number(form.parent_id) : null;
      if (parentId && !processOptions.value.some((option) => Number(option.id) === parentId)) {
        throw new Error("Selecciona un proceso padre válido.");
      }
      const res = await adminSqlService.create("processes", {
        name: nombre,
        slug: resolveAvailableProcessSlug(nombre),
        parent_id: parentId || null,
        is_active: 1
      });
      const id = resolveCreatedId(res);
      await loadProcessOptions();
      filtroProcessId.value = id ? String(id) : "";
      procesoModalOpen.value = false;
      return id;
    } catch (error) {
      procesoModalError.value = error?.response?.data?.message || error?.message || "No se pudo crear el proceso.";
      return null;
    } finally {
      creandoProceso.value = false;
    }
  };

  // Crea la línea y la deja ELEGIDA en el buscador. Los dos ejes se piden juntos —cargo Y alcance—,
  // que es la diferencia con la serie: ésta admitía uno o el otro, así que «los Coordinadores DE
  // CARRERA» no cabía y había que partirlo entre esta pantalla y la regla de reparto.
  const crearLinea = async (form) => {
    creandoLinea.value = true;
    lineaModalError.value = "";
    try {
      const processId = Number(form?.process_id);
      if (!processId) {
        throw new Error("Selecciona el proceso al que pertenece la línea.");
      }
      const nombre = String(form?.nombre || "").trim();
      if (!nombre) {
        throw new Error("Escribe el nombre de la línea.");
      }
      const scope = String(form?.unit_scope_type || "all_units");
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
      const fila = {
        process_id: processId,
        nombre,
        cargo_id: form.cargo_id ? Number(form.cargo_id) : null,
        unit_scope_type: scope,
        unit_type_id: unitTypeId,
        unit_id: unitId,
        effective_from: new Date().toISOString().slice(0, 10)
      };
      const res = await adminSqlService.create("lineas", fila);
      const id = resolveCreatedId(res);
      if (!id) {
        throw new Error("No se pudo crear la línea.");
      }
      elegirLinea({ row: { ...fila, id } });
      lineaModalOpen.value = false;
      return id;
    } catch (error) {
      lineaModalError.value = error?.response?.data?.message || error?.message || "No se pudo crear la línea.";
      return null;
    } finally {
      creandoLinea.value = false;
    }
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
      filtroProcessId.value = definitionRow.process_id ? String(definitionRow.process_id) : "";
      currentStep.value = step || "rules";
      await refreshStepStatus();
    } else {
      definitionContext.value = null;
      currentStep.value = "definition";
      stepStatus.value = { definition: false, packages: false, rules: false, triggers: false };
      // Abrir el asistente DESDE un proceso lo deja acotando el buscador, que es lo que antes hacía
      // rellenando el campo `process_id` — con la diferencia de que esto no puede contradecir a la
      // línea: acota la lista en vez de viajar junto a ella.
      filtroProcessId.value = "";
      if (processRow?.id) {
        if (!processOptions.value.some((option) => String(option.id) === String(processRow.id))) {
          processOptions.value.push({
            id: processRow.id,
            name: processRow.name || processRow.slug || `Proceso ${processRow.id}`
          });
        }
        filtroProcessId.value = String(processRow.id);
      }
    }
    wizardOpen.value = true;
  };

  const closeWizard = () => {
    wizardOpen.value = false;
    procesoModalOpen.value = false;
    lineaModalOpen.value = false;
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
      // AQUÍ SE CREABA EL PROCESO, y era el síntoma de que el paso 1 cubría tres entidades. Crear un
      // proceso ya no es parte de crear una configuración: tiene su plano (`crearProceso`), y lo que
      // llega aquí es una LÍNEA, que es el único dato de proceso que la configuración tiene.
      const linea = resolveLinea(form);
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
      // el asistente enviaba un dato que la línea ya dice. Desde `P23` tampoco lo pide el
      // formulario, así que no hay ninguna pareja (proceso, línea) que pueda contradecirse.
      const definitionRes = await adminSqlService.create("process_definition_versions", {
        linea_id: Number(linea.id),
        definition_version: definitionVersion,
        description: form.description ? String(form.description) : null,
        status: "draft",
        effective_from: today,
        source_process_definition_id: form.source_process_definition_id ? Number(form.source_process_definition_id) : null,
      });
      const created = definitionRes?.data || {};
      // El proceso del contexto sale de LA LÍNEA cacheada, no de un campo del formulario: es el
      // mismo camino que el backend usa desde `P22`, proceso -> línea -> configuración.
      const lineaRow = lineaOptions.value.find((row) => Number(row.id) === Number(linea.id));
      definitionContext.value = {
        id: resolveCreatedId(definitionRes),
        process_id: lineaRow?.process_id ? Number(lineaRow.process_id) : null,
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
    filtroProcessId,
    procesoModalOpen,
    lineaModalOpen,
    creandoProceso,
    creandoLinea,
    procesoModalError,
    lineaModalError,
    lineaSuggestProvider,
    elegirLinea,
    selectedLineaName,
    slugPreviewPara,
    abrirProcesoModal,
    cerrarProcesoModal,
    abrirLineaModal,
    cerrarLineaModal,
    crearProceso,
    crearLinea,
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
