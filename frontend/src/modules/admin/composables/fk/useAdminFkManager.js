import axios from "@/core/services/httpClient";
import { API_ROUTES } from "@/core/config/apiConfig";
import { buildFilterParams, dependentFieldNames } from "../../services/adminFieldRules.js";

// Esto tenía 237 líneas y era una SEGUNDA implementación de combobox, para el editor genérico.
// Llevaba dos mapas de datos (`inlineFkSuggestions`, `inlineFkLoading`), dos de control
// (`inlineFkTouched`, `inlineFkActiveField`), dos juegos de temporizadores —uno para el debounce y
// otro para cerrar el desplegable tras el blur— y la lista se dibujaba a mano en
// `AdminEditorModal`, debajo del campo.
//
// `AdminLookupField` ya hacía todo eso desde dentro cuando se le pasa un `suggestProvider`, que es
// como lo consumen los otros tres paneles del admin. Y lo hacía MEJOR en tres cosas que la versión
// paralela no tenía: navegación con teclado, el `role="combobox"` con su `aria-activedescendant`, y
// un contador de secuencia que descarta las respuestas que llegan tarde — escribir deprisa podía
// dejar en pantalla el resultado de una búsqueda anterior.
//
// Lo que queda aquí es lo único que el componente no puede saber por sí mismo: de qué tabla sale
// cada columna, y cómo se etiqueta una fila de esa tabla.
export function useAdminFkManager({ formData, fkDisplay, formFields, resolveFkTable, formatFkOptionLabel }) {
  // Un proveedor por columna, memorizado: si se construyera en la plantilla, cada render daría una
  // función nueva y el `prop` cambiaría de identidad en cada pulsación.
  const proveedores = new Map();

  const buildFkSuggestProvider = (field) => {
    const fieldName = field?.name || "";
    if (!fieldName) {
      return null;
    }
    if (!proveedores.has(fieldName)) {
      proveedores.set(fieldName, async (searchText) => {
        const tableName = resolveFkTable(fieldName);
        if (!tableName) {
          return [];
        }
        // `filterBy` acota el catálogo por otro campo del formulario: las ciudades de la provincia
        // elegida, no las de todo el mundo. Se lee EN CADA BÚSQUEDA y no al construir el proveedor,
        // porque el padre cambia mientras el formulario está abierto.
        const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE(tableName), {
          params: { q: searchText, limit: 8, ...buildFilterParams(field, formData.value) }
        });
        return (response.data || []).map((row) => ({
          id: row?.id ?? "",
          label: formatFkOptionLabel(tableName, row),
          row
        }));
      });
    }
    return proveedores.get(fieldName);
  };

  // El formulario guarda DOS cosas por columna ajena: el id, que es lo que viaja al servidor, y la
  // etiqueta, que es lo que se lee. Elegir una opción escribe las dos; vaciar el campo borra las dos.
  // Cambiar un campo padre invalida a sus hijos. Sin esto se elige Ecuador → Manabí → Portoviejo,
  // se cambia el país a España, y Portoviejo se queda puesto: el formulario enseña algo coherente y
  // manda una ciudad que no pertenece a nada.
  const vaciarDependientes = (fieldName, valores, etiquetas) => {
    for (const hijo of dependentFieldNames(fieldName, formFields?.value ?? [])) {
      valores[hijo] = "";
      etiquetas[hijo] = "";
    }
  };

  const selectFkOption = (field, option) => {
    if (!field?.name) {
      return;
    }
    const valores = { ...formData.value, [field.name]: option?.id ?? "" };
    const etiquetas = { ...fkDisplay.value, [field.name]: option?.label ?? "" };
    vaciarDependientes(field.name, valores, etiquetas);
    formData.value = valores;
    fkDisplay.value = etiquetas;
  };

  const clearFkSelection = (fieldName) => {
    if (!fieldName) {
      return;
    }
    const valores = { ...formData.value, [fieldName]: "" };
    const etiquetas = { ...fkDisplay.value, [fieldName]: "" };
    vaciarDependientes(fieldName, valores, etiquetas);
    formData.value = valores;
    fkDisplay.value = etiquetas;
  };

  return { buildFkSuggestProvider, selectFkOption, clearFkSelection };
}
