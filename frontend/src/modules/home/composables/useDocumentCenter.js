import { computed, ref } from "vue";

const FILTROS_VACIOS = () => ({
  query: "",
  year: "all",
  termType: "all",
  unit: "all",
  process: "all",
  status: "all"
});

/** Valores distintos de una columna, sin vacios y ordenados: alimenta un desplegable de filtro. */
const opcionesDe = (items, key) => {
  const values = new Set();
  (items || []).forEach((item) => {
    const normalized = String(item?.[key] || "").trim();
    if (normalized) values.add(normalized);
  });
  return Array.from(values).sort((a, b) => a.localeCompare(b));
};

/**
 * Datos y filtros del centro documental.
 *
 * POSEE su estado: los items, los filtros y el estado de carga son suyos, y por eso se puede montar en
 * una pagina propia. Solo recibe el `fetchDocuments(userId)` --la llamada depende del servicio-- y el
 * `userId`, que es un ref porque la pantalla lo resuelve al montar.
 *
 * HomeView sigue cargando el centro por su cuenta para los contadores del dashboard (documentos
 * accesibles, pendientes de llenado). Eso NO es duplicar: ya pasaba antes de partir la pagina --
 * loadHomeData metia loadDocumentCenterPage en su Promise.all Y la seccion lo recargaba al entrar--.
 * Cada pagina carga lo suyo y el comportamiento observable es el mismo.
 */
export function useDocumentCenter({ fetchDocuments, userId }) {
  const items = ref([]);
  const loading = ref(false);
  const error = ref("");
  const filters = ref(FILTROS_VACIOS());

  const filterYears = computed(() => opcionesDe(items.value, "term_year").sort((a, b) => Number(b) - Number(a)));
  const filterTermTypes = computed(() => opcionesDe(items.value, "term_type_name"));
  const filterUnits = computed(() => opcionesDe(items.value, "unit_label"));
  const filterProcesses = computed(() => opcionesDe(items.value, "process_name"));

  const filteredItems = computed(() => {
    const f = filters.value;
    const query = String(f.query || "").trim().toLowerCase();
    return items.value.filter((item) => {
      const matchesQuery =
        !query ||
        [item.template_artifact_name, item.definition_name, item.process_name, item.unit_label, item.term_name, item.term_type_name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesYear = f.year === "all" || String(item.term_year || "") === String(f.year);
      const matchesTermType = f.termType === "all" || String(item.term_type_name || "") === f.termType;
      const matchesUnit = f.unit === "all" || String(item.unit_label || "") === f.unit;
      const matchesProcess = f.process === "all" || String(item.process_name || "") === f.process;
      const matchesStatus = f.status === "all" || String(item.document_version_status || "") === f.status;
      return matchesQuery && matchesYear && matchesTermType && matchesUnit && matchesProcess && matchesStatus;
    });
  });

  const resetFilters = () => {
    filters.value = FILTROS_VACIOS();
  };

  const load = async () => {
    const id = userId.value;
    if (!id) return;
    loading.value = true;
    error.value = "";
    try {
      const response = await fetchDocuments(id);
      items.value = Array.isArray(response?.documents) ? response.documents : [];
    } catch (err) {
      console.error("Error al cargar el centro documental:", err);
      items.value = [];
      error.value = err?.response?.data?.message || "No se pudo cargar el centro documental.";
    } finally {
      loading.value = false;
    }
  };

  return {
    items,
    loading,
    error,
    filters,
    filteredItems,
    filterYears,
    filterTermTypes,
    filterUnits,
    filterProcesses,
    resetFilters,
    load
  };
}
