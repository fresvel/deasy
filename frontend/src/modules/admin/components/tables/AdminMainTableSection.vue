<template>
  <section class="space-y-4">
    <!-- ⚠️ LA BARRA VIVE AQUI Y NO EN `AdminTableHeader`, y el motivo no es estetico.
         El dueño pidio **todos los botones de accion en UNA fila**. Los de la tabla —Regresar y
         Agregar— los pinta `AdminTableHeader`, pero los del filtro —Limpiar, Buscar, Mostrar
         filtros y Actualizar— viven aqui y **dos de ellos usan estado LOCAL** (`resetGenericSearch`
         y `showAdvancedFilters`, que abre el panel de filtros avanzados de este mismo fichero).
         Subirlos a la cabecera obligaria a sacar ese estado de su dueño; bajar la barra aqui, no.
         Asi que la barra la pinta esta seccion y los botones de la tabla entran por el slot
         `actions`, que `AdminTableManager` llena con `AdminTableHeader`. -->
    <AppTableToolbar :title="tableHeaderTitle">
      <!-- El buscador comparte fila con los botones: la barra lo pone a la izquierda
           (`__filtro` crece) y ellos a la derecha (`__actions` no encoge). En `/perfil` ese mismo
           sitio lo ocupan las pestañas, porque hacen lo mismo: elegir que porcion de la tabla ves. -->
      <template #filtro>
        <AdminInputField
        ref="searchInputRef"
        :model-value="searchTerm"
        placeholder="Buscar en la tabla"
        input-class="deasy-control"
        @update:model-value="$emit('update:search-term', $event)"
        @input="$emit('debounced-search')"
        />
      </template>

      <template #actions>
        <slot name="actions" />
                  <AdminButton
                    v-if="!isPositionFilterTable && !isProcessDefinitionFilterTable && !isProcessTargetRuleFilterTable && !isTemplateArtifactsTable"
                    variant="neutral-outline" icon-only
                    title="Limpiar búsqueda"
                    aria-label="Limpiar búsqueda"
                    :disabled="!searchTerm"
                    @click="resetGenericSearch"
                  ><font-awesome-icon icon="times" /></AdminButton>
                  <AdminButton
                    v-if="isPositionFilterTable"
                    variant="neutral-outline" icon-only
                    title="Limpiar filtros"
                    aria-label="Limpiar filtros"
                    :disabled="!hasUnitPositionFilters"
                    @click="$emit('clear-unit-position-inline-filters')"
                  ><font-awesome-icon icon="times" /></AdminButton>
                  <AdminButton
                    v-else-if="isProcessDefinitionFilterTable"
                    variant="neutral-outline" icon-only
                    title="Limpiar filtros"
                    aria-label="Limpiar filtros"
                    :disabled="!hasProcessDefinitionInlineFilters"
                    @click="$emit('clear-process-definition-inline-filters')"
                  ><font-awesome-icon icon="times" /></AdminButton>
                  <AdminButton
                    v-else-if="isProcessTargetRuleFilterTable"
                    variant="neutral-outline" icon-only
                    title="Limpiar filtros"
                    aria-label="Limpiar filtros"
                    :disabled="!hasProcessTargetRuleInlineFilters"
                    @click="$emit('clear-process-target-rule-inline-filters')"
                  ><font-awesome-icon icon="times" /></AdminButton>
                  <AdminButton
                    v-else-if="isTemplateArtifactsTable"
                    variant="neutral-outline" icon-only
                    title="Limpiar filtros"
                    aria-label="Limpiar filtros"
                    :disabled="!hasTemplateArtifactInlineFilters"
                    @click="$emit('clear-template-artifact-inline-filters')"
                  ><font-awesome-icon icon="times" /></AdminButton>
                  <AdminButton variant="primary-outline" icon-only title="Buscar" aria-label="Buscar" @click="$emit('fetch-rows')"><font-awesome-icon icon="search" /></AdminButton>
                  <AdminButton
                    v-if="hasExpandableFilters"
                    variant="neutral-outline"
                    icon-only
                    :title="showAdvancedFilters ? 'Ocultar filtros' : 'Mostrar filtros'"
                    :aria-label="showAdvancedFilters ? 'Ocultar filtros' : 'Mostrar filtros'"
                    @click="showAdvancedFilters = !showAdvancedFilters"
                  >
                    <font-awesome-icon :icon="showAdvancedFilters ? 'arrow-up' : 'arrow-down'" />
                  </AdminButton>
                  <!-- «Actualizar» vivia en una SEGUNDA fila (`deasy-filter-toolbar`), acompañado
                       de un `deasy-filter-summary` VACIO que era lo unico que justificaba esa
                       fila. Por eso caia debajo en vez de al lado. Sube aqui con sus hermanos:
                       los tres actuan sobre la misma tabla. -->
                  <AdminButton variant="primary-outline" icon-only title="Actualizar" aria-label="Actualizar" @click="$emit('fetch-rows')"><font-awesome-icon icon="rotate-right" /></AdminButton>
      </template>
    </AppTableToolbar>

    <div>
      <!-- ⚠️ `v-if` Y NO SIEMPRE. Desde que el buscador y los botones subieron a la barra, esta
           caja solo aloja los filtros AVANZADOS, que existen para cuatro tablas y solo cuando estan
           desplegados. En las demas quedaba **vacia: altura 0, cero hijos visibles… y su
           `margin-bottom` de 16 px intacto**, empujando la tabla hacia abajo. Medido: `/admin` daba
           la tabla en y=208 y `/perfil` en 192, con la misma barra encima. Un contenedor sin
           contenido no es inofensivo cuando trae margen. -->
      <div v-if="showAdvancedFilters && hasExpandableFilters" class="deasy-filter-shell deasy-filter-shell--embedded">
      <div class="deasy-filter-grid deasy-filter-grid--admin">

            <template v-if="showAdvancedFilters && isPositionFilterTable">
              <div class="md:col-span-4 lg:col-span-2">
                <AdminSelectField :model-value="unitPositionFilters.unit_type_id" select-class="deasy-control" :disabled="unitPositionFilterLoading" @update:model-value="updateUnitPositionFilter('unit_type_id', $event)" @change="$emit('handle-unit-position-type-change')">
                  <option value="">Tipo de unidad</option>
                  <option v-for="row in unitPositionUnitTypeOptions" :key="row.id" :value="String(row.id)">
                    {{ formatFkOptionLabel("unit_types", row) }}
                  </option>
                </AdminSelectField>
              </div>
              <div class="md:col-span-4 lg:col-span-2">
                <AdminSelectField :model-value="unitPositionFilters.unit_id" select-class="deasy-control" :disabled="!unitPositionFilters.unit_type_id || unitPositionFilterLoading" @update:model-value="updateUnitPositionFilter('unit_id', $event)" @change="$emit('handle-unit-position-unit-change')">
                  <option value="">Unidad</option>
                  <option v-for="row in unitPositionUnitOptions" :key="row.id" :value="String(row.id)">
                    {{ formatFkOptionLabel("units", row) }}
                  </option>
                </AdminSelectField>
              </div>
              <div class="md:col-span-4 lg:col-span-2">
                <AdminSelectField :model-value="unitPositionFilters.cargo_id" select-class="deasy-control" :disabled="unitPositionFilterLoading" @update:model-value="updateUnitPositionFilter('cargo_id', $event)" @change="$emit('handle-unit-position-cargo-change')">
                  <option value="">Cargo</option>
                  <option v-for="row in unitPositionCargoOptions" :key="row.id" :value="String(row.id)">
                    {{ formatFkOptionLabel("cargos", row) }}
                  </option>
                </AdminSelectField>
              </div>
            </template>

            <template v-else-if="showAdvancedFilters && isProcessDefinitionFilterTable">
              <div class="md:col-span-6 lg:col-span-2">
                <AdminSelectField :model-value="processDefinitionInlineFilters.process_id" select-class="deasy-control" @update:model-value="updateProcessDefinitionFilter('process_id', $event)" @change="$emit('fetch-rows')">
                  <option value="">Proceso</option>
                  <option v-for="row in processDefinitionProcessOptions" :key="row.id" :value="String(row.id)">
                    {{ formatFkOptionLabel("processes", row) }}
                  </option>
                </AdminSelectField>
              </div>
              <div class="md:col-span-6 lg:col-span-2">
                <AdminSelectField :model-value="processDefinitionInlineFilters.status" select-class="deasy-control" @update:model-value="updateProcessDefinitionFilter('status', $event)" @change="$emit('fetch-rows')">
                  <option value="">Estado</option>
                  <option value="draft">draft</option>
                  <option value="active">active</option>
                  <option value="retired">retired</option>
                </AdminSelectField>
              </div>
              <div class="md:col-span-12 lg:col-span-3">
                <AdminSelectField :model-value="processDefinitionInlineFilters.variation_key" select-class="deasy-control" @update:model-value="updateProcessDefinitionFilter('variation_key', $event)" @change="$emit('fetch-rows')">
                  <option value="">Variación</option>
                  <option v-for="row in processDefinitionSeriesOptions" :key="row.id" :value="String(row.code || '')">
                    {{ formatFkOptionLabel("process_definition_series", row) }}
                  </option>
                </AdminSelectField>
              </div>
            </template>

            <template v-else-if="showAdvancedFilters && isProcessTargetRuleFilterTable">
              <div class="md:col-span-6 lg:col-span-2">
                <AdminSelectField :model-value="processTargetRuleInlineFilters.definition_status" select-class="deasy-control" @update:model-value="updateProcessTargetRuleFilter('definition_status', $event)" @change="$emit('fetch-rows')">
                  <option value="">Estado</option>
                  <option value="draft">draft</option>
                  <option value="active">active</option>
                  <option value="retired">retired</option>
                </AdminSelectField>
              </div>
            </template>

            <template v-else-if="showAdvancedFilters && isTemplateArtifactsTable">
              <div class="md:col-span-6 lg:col-span-3">
                <AdminSelectField :model-value="templateArtifactInlineFilters.is_active" select-class="deasy-control" @update:model-value="updateTemplateArtifactFilter('is_active', $event)" @change="$emit('fetch-rows')">
                  <option value="">Estado</option>
                  <option value="1">Activas</option>
                  <option value="0">Inactivas</option>
                </AdminSelectField>
              </div>
            </template>

          </div>
          </div>

          <div v-if="loading" class="text-sm text-muted">Cargando datos...</div>
          <div v-else-if="error" role="alert">{{ error }}</div>
          <AppDataTable v-else :fields="tableListFields" :rows="rows" :row-key="rowKey">
            <template #cell="{ row, field }">
              <template v-if="field.name === 'available_formats'">
                <div>
                  <template v-if="getAvailableFormatSections(row[field.name]).length">
                    <div v-for="section in getAvailableFormatSections(row[field.name])" :key="section.mode" :class="{ 'is-inline': section.mode === 'reference' }">
                      <span>{{ section.label }}</span>
                      <div>
                        <AppTag v-for="entry in section.entries" :key="`${section.mode}-${entry.format}`" variant="neutral" outlined>
                          {{ entry.formatLabel }}
                        </AppTag>
                      </div>
                    </div>
                  </template>
                  <span v-else>—</span>
                </div>
              </template>
              <!-- Las TRES familias de celda con vocabulario cerrado. El orden importa: una
                   columna de estado que ademas fuera `select` caeria en la tercera rama. -->
              <template v-else-if="esColumnaDeEstado(table?.table, field.name) && row[field.name]">
                <AppTag :variant="tonoDeColumna(table?.table, field.name, row[field.name])">
                  {{ etiquetaDeColumna(table?.table, field.name, row[field.name]) }}
                </AppTag>
              </template>
              <!-- El booleano NO se filtra por valor: `false` es un dato, no una celda vacia.
                   Filtrarlo (como hacen las otras dos ramas) habria dejado en blanco todas las
                   filas inactivas, que son justo las que hay que ver. -->
              <template v-else-if="field.type === 'boolean' && row[field.name] !== null && row[field.name] !== undefined">
                <AppTag :variant="tonoDeBooleano(table?.table, field.name, row[field.name])">
                  {{ etiquetaBooleano(row[field.name]) }}
                </AppTag>
              </template>
              <!-- La clasificacion va CON CONTORNO: no tiene eje bueno/malo, y el contorno es
                   lo que la distingue de un estado cuando las dos caen en la misma fila. La
                   etiqueta sale de `formatCell`, que ya pasa por el vocabulario unico. -->
              <template v-else-if="esColumnaClasificacion(table?.table, field.name) && row[field.name]">
                <AppTag :variant="tonoClasificacion(table?.table, field.name, row[field.name])" outlined>
                  {{ formatCell(row[field.name], field, row) }}
                </AppTag>
              </template>
              <template v-else>
                {{ formatCell(row[field.name], field, row) }}
              </template>
            </template>
            <template #actions="{ row }">
              <AdminTableActions
                delete-message="Eliminar"
                :show-edit="canUpdate && isRowEditable(row)"
                :show-delete="canDelete && isRowDeletable(row)"
                @view="$emit('open-record-viewer', row)"
                @edit="$emit('open-edit', row)"
                @delete="$emit('open-delete', row)"
              >
                <template #between>
                  <AdminButton
                    v-if="canUpdate && table?.table === 'process_definition_versions'"
                    variant="primary-soft"
                    icon-only
                    title="Versionar"
                    aria-label="Versionar"
                    @click="$emit('start-process-definition-versioning', row)"
                  >
                    <font-awesome-icon icon="rotate-right" />
                  </AdminButton>
                  <AdminButton
                    v-if="canUpdate && table?.table === 'process_definition_versions' && String(row?.status || '') === 'draft'"
                    variant="success-soft"
                    icon-only
                    title="Activar"
                    aria-label="Activar"
                    @click="$emit('open-process-definition-activation-for-row', row)"
                  >
                    <font-awesome-icon icon="check" />
                  </AdminButton>
                  <AdminButton
                    v-if="canUpdate && table?.table === 'process_definition_versions' && String(row?.status || '') === 'active'"
                    variant="warning-soft"
                    icon-only
                    title="Retirar (desactivar)"
                    aria-label="Retirar (desactivar)"
                    @click="$emit('retire-process-definition', row)"
                  >
                    <font-awesome-icon icon="times-circle" />
                  </AdminButton>
                  <AdminButton
                    v-if="canUpdate && table?.table === 'terms'"
                    variant="success-soft"
                    icon-only
                    title="Lanzar procesos del periodo"
                    aria-label="Lanzar procesos del periodo"
                    @click="$emit('launch-term', row)"
                  >
                    <font-awesome-icon icon="rocket" />
                  </AdminButton>
                  <AdminButton
                    v-if="canUpdate && table?.table === 'process_definition_versions' && String(row?.status || '') === 'active'"
                    variant="success-soft"
                    icon-only
                    title="Lanzar en un periodo"
                    aria-label="Lanzar en un periodo"
                    @click="$emit('launch-definition', row)"
                  >
                    <font-awesome-icon icon="rocket" />
                  </AdminButton>
                  <AdminButton
                    v-if="canUpdate && isPersonTable"
                    variant="success-soft"
                    icon-only
                    title="Gestionar asignaciones"
                    aria-label="Gestionar asignaciones"
                    @click="$emit('open-person-assignments', row)"
                  >
                    <font-awesome-icon icon="list-check" />
                  </AdminButton>
                </template>
                <template v-if="isTemplateArtifactsTable" #edit>
                  <!-- Borrador: editar contenido. Publicada/retirada: inmutable → versionar (crea borrador). -->
                  <AdminButton
                    v-if="canUpdate && (row?.lifecycle_state || 'published') === 'draft'"
                    variant="success-soft"
                    icon-only
                    title="Editar"
                    aria-label="Editar"
                    @click="$emit('open-edit', row)"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M11.4925 2.78906H7.75349C4.67849 2.78906 2.75049 4.96606 2.75049 8.04806V16.3621C2.75049 19.4441 4.66949 21.6211 7.75349 21.6211H16.5775C19.6625 21.6211 21.5815 19.4441 21.5815 16.3621V12.3341" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                      <path fill-rule="evenodd" clip-rule="evenodd" d="M8.82812 10.921L16.3011 3.44799C17.2321 2.51799 18.7411 2.51799 19.6721 3.44799L20.8891 4.66499C21.8201 5.59599 21.8201 7.10599 20.8891 8.03599L13.3801 15.545C12.9731 15.952 12.4211 16.181 11.8451 16.181H8.09912L8.19312 12.401C8.20712 11.845 8.43412 11.315 8.82812 10.921Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                      <path d="M15.1655 4.60254L19.7315 9.16854" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </AdminButton>
                  <AdminButton
                    v-else-if="canUpdate"
                    variant="primary-soft"
                    icon-only
                    title="Versionar (crea una versión en borrador editable)"
                    aria-label="Versionar plantilla"
                    @click="$emit('version-template', row)"
                  >
                    <font-awesome-icon icon="code-branch" />
                  </AdminButton>
                </template>
              </AdminTableActions>
            </template>
          </AppDataTable>
    </div>
  </section>
</template>

<script setup>
import AppTableToolbar from "@/shared/components/layout/AppTableToolbar.vue";
import { computed, ref } from "vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AppDataTable from "@/shared/components/data/AppDataTable.vue";
import AppTag from "@/shared/components/data/AppTag.vue";
import {
  esColumnaDeEstado, tonoDeColumna, etiquetaDeColumna,
  tonoDeBooleano, etiquetaBooleano,
  esColumnaClasificacion, tonoClasificacion
} from "@/shared/utils/estadoTono.js";
import AdminInputField from "@/modules/admin/components/forms/AdminInputField.vue";
import AdminSelectField from "@/modules/admin/components/forms/AdminSelectField.vue";
import AdminTableActions from "@/modules/admin/components/tables/AdminTableActions.vue";

const props = defineProps({
  /* El nombre de la tabla, para la fila superior de la barra. */
  tableHeaderTitle: { type: String, default: "" },
  table: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: "" },
  searchTerm: { type: String, default: "" },
  isPositionFilterTable: { type: Boolean, default: false },
  isProcessDefinitionFilterTable: { type: Boolean, default: false },
  isProcessTargetRuleFilterTable: { type: Boolean, default: false },
  isTemplateArtifactsTable: { type: Boolean, default: false },
  isPersonTable: { type: Boolean, default: false },
  unitPositionFilters: { type: Object, default: () => ({}) },
  unitPositionFilterLoading: { type: Boolean, default: false },
  unitPositionUnitTypeOptions: { type: Array, default: () => [] },
  unitPositionUnitOptions: { type: Array, default: () => [] },
  unitPositionCargoOptions: { type: Array, default: () => [] },
  processDefinitionInlineFilters: { type: Object, default: () => ({}) },
  processDefinitionProcessOptions: { type: Array, default: () => [] },
  processDefinitionSeriesOptions: { type: Array, default: () => [] },
  processTargetRuleInlineFilters: { type: Object, default: () => ({}) },
  templateArtifactInlineFilters: { type: Object, default: () => ({}) },
  hasUnitPositionFilters: { type: Boolean, default: false },
  hasProcessDefinitionInlineFilters: { type: Boolean, default: false },
  hasProcessTargetRuleInlineFilters: { type: Boolean, default: false },
  hasTemplateArtifactInlineFilters: { type: Boolean, default: false },
  tableListFields: { type: Array, default: () => [] },
  rows: { type: Array, default: () => [] },
  rowKey: { type: Function, required: true },
  formatFkOptionLabel: { type: Function, required: true },
  formatCell: { type: Function, required: true },
  getAvailableFormatSections: { type: Function, required: true },
  canUpdate: { type: Boolean, default: true },
  canDelete: { type: Boolean, default: true }
});

const emit = defineEmits([
  "update:search-term",
  "update:unit-position-filters",
  "update:process-definition-inline-filters",
  "update:process-target-rule-inline-filters",
  "update:template-artifact-inline-filters",
  "debounced-search",
  "handle-unit-position-type-change",
  "handle-unit-position-unit-change",
  "handle-unit-position-cargo-change",
  "clear-unit-position-inline-filters",
  "clear-process-definition-inline-filters",
  "clear-process-target-rule-inline-filters",
  "clear-template-artifact-inline-filters",
  "fetch-rows",
  "open-record-viewer",
  "open-edit",
  "version-template",
  "open-delete",
  "start-process-definition-versioning",
  "open-process-definition-activation-for-row",
  "retire-process-definition",
  "open-person-assignments",
  "launch-term",
  "launch-definition"
]);

const searchInputRef = ref(null);

const showAdvancedFilters = ref(false);

// Las configuraciones de proceso solo se editan/eliminan en borrador: activas y retiradas son
// inmutables (las activas solo se pueden retirar; las retiradas son de solo lectura).
const isProcessDefinitionVersionsTable = computed(() => props.table?.table === "process_definition_versions");
const isRowEditable = (row) =>
  !isProcessDefinitionVersionsTable.value || String(row?.status || "").toLowerCase() === "draft";
const isRowDeletable = (row) =>
  !isProcessDefinitionVersionsTable.value || String(row?.status || "").toLowerCase() === "draft";

const searchColumnClass = computed(() => (
  props.isPositionFilterTable ? "lg:col-span-3" :
    props.isProcessDefinitionFilterTable ? "md:col-span-6 lg:col-span-2" :
      props.isProcessTargetRuleFilterTable ? "md:col-span-6 lg:col-span-3" :
        // template_artifacts: con filtros ocultos imita a la tabla de seeds (search ancho); al
        // expandir el filtro de etapa se estrecha para dar espacio.
        props.isTemplateArtifactsTable ? (showAdvancedFilters.value ? "md:col-span-6 lg:col-span-3" : "md:col-span-6") :
          "md:col-span-6"
));

const actionColumnClass = computed(() => (
  props.isPositionFilterTable ? "lg:col-span-2 lg:justify-self-end" :
    props.isProcessDefinitionFilterTable ? "lg:col-span-3 lg:justify-self-end" :
      props.isProcessTargetRuleFilterTable ? "lg:col-span-3 lg:justify-self-end" :
        props.isTemplateArtifactsTable ? (showAdvancedFilters.value ? "md:col-span-12 md:justify-self-end lg:col-span-6 lg:justify-self-end" : "md:col-span-6 md:justify-self-end") :
          "md:col-span-6 md:justify-self-end"
));
const hasExpandableFilters = computed(() =>
  props.isPositionFilterTable ||
  props.isProcessDefinitionFilterTable ||
  props.isProcessTargetRuleFilterTable ||
  props.isTemplateArtifactsTable
);

const updateUnitPositionFilter = (field, value) => emit("update:unit-position-filters", { ...props.unitPositionFilters, [field]: value });
const updateProcessDefinitionFilter = (field, value) => emit("update:process-definition-inline-filters", { ...props.processDefinitionInlineFilters, [field]: value });
const updateProcessTargetRuleFilter = (field, value) => emit("update:process-target-rule-inline-filters", { ...props.processTargetRuleInlineFilters, [field]: value });
const updateTemplateArtifactFilter = (field, value) => emit("update:template-artifact-inline-filters", { ...props.templateArtifactInlineFilters, [field]: value });
const resetGenericSearch = () => {
  emit("update:search-term", "");
  emit("fetch-rows");
};

/* `isDefinitionStatusField` murio el 2026-08-20. Habilitaba la pastilla en DOS columnas y su
   comentario daba el resto por deliberado: «el resto de columnas status siguen como texto
   plano». Lo que eso producia, medido en pantalla, es que `process_definition_versions` pintaba
   «Retirada» en pastilla y en español mientras `template_artifacts` pintaba el MISMO ciclo de
   vida en texto plano y en INGLES CRUDO.

   Que columna es un estado, y con que eje, lo dice ahora `COLUMNA_ESTADO` en `estadoTono.js`:
   sigue siendo negocio y no color, pero es la misma clase de conocimiento que los vocabularios
   y estaba partida en dos ficheros. La tabla solo pregunta. */

defineExpose({ searchInputRef });
</script>
