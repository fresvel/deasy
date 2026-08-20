<template>
  <div>
    <div v-if="checking" class="text-sm text-muted">Validando la configuración…</div>
    <template v-else-if="status === 'active'">
      <div class="deasy-card flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm text-body">
        <font-awesome-icon icon="lock" class="h-4 w-4 shrink-0 text-muted" />
        <span>Configuración <strong>activa</strong> y de solo lectura. Para cambios, crea una nueva versión o retírala.</span>
      </div>
    </template>
    <template v-else-if="status === 'retired'">
      <div class="deasy-card flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm text-body">
        <font-awesome-icon icon="lock" class="h-4 w-4 shrink-0 text-muted" />
        <span>Configuración <strong>retirada</strong> y de solo lectura. Para reutilizarla, crea una nueva versión a partir de ella.</span>
      </div>
    </template>
    <template v-else>
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between gap-2">
          <span class="deasy-overline">Requisitos para activar</span>
          <AppTag :variant="tonoCobertura(coberturaEstado(completedRequirements, 3))" outlined>
            {{ completedRequirements }}/3
          </AppTag>
        </div>
        <div class="grid gap-2 sm:grid-cols-3">
          <AppAlert
            v-for="req in requirements"
            :key="req.key"
            :variant="req.done ? 'success' : 'danger'"
            class="deasy-alert--row"
          >
            <span
              class="deasy-icon-box deasy-icon-box--sm deasy-icon-box--round deasy-icon-box--solid"
              :class="req.done ? 'deasy-icon-box--success' : 'deasy-icon-box--danger'"
            >
              <font-awesome-icon :icon="req.done ? 'check' : 'times'" class="h-3.5 w-3.5" />
            </span>
            <span>{{ req.label }}</span>
          </AppAlert>
        </div>
      </div>

      <div v-if="view !== 'activate'" class="mt-3">
        <div v-if="showMenu" class="flex flex-wrap gap-2" role="group" aria-label="Resumen de activacion">
          <AdminButton variant="neutral-outline" :class="{ active: view === 'definition' }" @click="$emit('update:view', 'definition')">Configuracion</AdminButton>
          <AdminButton variant="neutral-outline" :class="{ active: view === 'rules' }" @click="$emit('update:view', 'rules')">Alcance</AdminButton>
          <AdminButton variant="neutral-outline" :class="{ active: view === 'triggers' }" @click="$emit('update:view', 'triggers')">Periodos</AdminButton>
          <AdminButton variant="neutral-outline" :class="{ active: view === 'artifacts' }" @click="$emit('update:view', 'artifacts')">Paquetes</AdminButton>
        </div>

        <div v-if="view === 'definition'" class="mt-3">
          <div class="grid gap-2 text-sm text-body md:grid-cols-2">
            <div><strong>Proceso:</strong> {{ formatCell(selectedRow?.process_id, { name: 'process_id' }, selectedRow || {}) }}</div>
            <div><strong>Variación:</strong> {{ formatCell(selectedRow?.series_id, { name: 'series_id' }, selectedRow || {}) }}</div>
            <div><strong>Version:</strong> {{ selectedRow?.definition_version || "—" }}</div>
            <div class="md:col-span-2"><strong>Nombre:</strong> {{ selectedRow?.name || "—" }}</div>
            <div class="md:col-span-2"><strong>Descripcion:</strong> {{ selectedRow?.description || "—" }}</div>
          </div>
        </div>

        <div v-else-if="view === 'rules'" class="mt-3">
          <AppDataTable
            v-if="rules.length"
            :fields="ruleTableFields"
            :rows="rules"
            :row-key="(row) => `activation-rule-${row.id}`"
            table-class="min-w-full border-separate border-spacing-0 text-sm"
            responsive-class="overflow-x-auto deasy-card"
            scroll-class=""
          >
            <template #cell="{ row, field }">
              <template v-if="field.name === 'destination'">
                {{ formatDefinitionRuleSummary(row) }}
              </template>
              <template v-else-if="field.name === 'is_active'">
                {{ Number(row.is_active) === 1 ? "Si" : "No" }}
              </template>
              <template v-else>
                {{ row[field.name] || "—" }}
              </template>
            </template>
            <template #actions="{ row }">
              <AdminTableActions
                :show-edit="false"
                :show-delete="false"
                view-title="Ver regla"
                view-label="Ver regla"
                @view="$emit('view-row', { table: 'process_target_rules', row })"
              />
            </template>
          </AppDataTable>
          <div v-else class="text-sm text-muted">Sin reglas registradas.</div>
        </div>

        <div v-else-if="view === 'triggers'" class="mt-3">
          <AppDataTable
            v-if="triggers.length"
            :fields="triggerTableFields"
            :rows="triggers"
            :row-key="(row) => `activation-trigger-${row.id}`"
            table-class="min-w-full border-separate border-spacing-0 text-sm"
            responsive-class="overflow-x-auto deasy-card"
            scroll-class=""
          >
            <template #cell="{ row, field }">
              <template v-if="field.name === 'term_type_id'">
                {{ formatCell(row.term_type_id, { name: "term_type_id" }, row) }}
              </template>
              <template v-else-if="field.name === 'is_active'">
                {{ Number(row.is_active) === 1 ? "Si" : "No" }}
              </template>
              <template v-else>
                {{ row[field.name] || "—" }}
              </template>
            </template>
            <template #actions="{ row }">
              <AdminTableActions
                :show-edit="false"
                :show-delete="false"
                view-title="Ver periodo"
                view-label="Ver periodo"
                @view="$emit('view-row', { table: 'process_definition_period_types', row })"
              />
            </template>
          </AppDataTable>
          <div v-else class="text-sm text-muted">Sin periodos registrados.</div>
        </div>

        <div v-else class="mt-3">
          <AppDataTable
            v-if="artifacts.length"
            :fields="artifactTableFields"
            :rows="artifacts"
            :row-key="(row) => `activation-artifact-${row.id}`"
            table-class="min-w-full border-separate border-spacing-0 text-sm"
            responsive-class="overflow-x-auto deasy-card"
            scroll-class=""
          >
            <template #cell="{ row, field }">
              <template v-if="field.name === 'template_artifact_id'">
                {{ formatCell(row.template_artifact_id, { name: "template_artifact_id" }, row) }}
              </template>
              <template v-else>
                {{ row[field.name] || "—" }}
              </template>
            </template>
            <template #actions="{ row }">
              <AdminTableActions
                :show-edit="false"
                :show-delete="false"
                view-title="Ver plantilla vinculada"
                view-label="Ver plantilla vinculada"
                @view="$emit('view-row', { table: 'process_definition_templates', row })"
              />
            </template>
          </AppDataTable>
          <AppEmpty v-else>Sin plantillas vinculadas.</AppEmpty>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import AppEmpty from "@/shared/components/feedback/AppEmpty.vue";
import { computed } from "vue";
import AppAlert from "@/shared/components/feedback/AppAlert.vue";
import AppTag from "@/shared/components/data/AppTag.vue";
import { tonoCobertura, coberturaEstado } from "@/shared/utils/estadoTono.js";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AppDataTable from "@/shared/components/data/AppDataTable.vue";
import AdminTableActions from "@/modules/admin/components/tables/AdminTableActions.vue";

const props = defineProps({
  checking: { type: Boolean, default: false },
  hasActiveRules: { type: Boolean, default: false },
  hasActiveTriggers: { type: Boolean, default: false },
  hasActiveArtifacts: { type: Boolean, default: false },
  view: { type: String, default: "definition" },
  selectedRow: { type: Object, default: null },
  rules: { type: Array, default: () => [] },
  triggers: { type: Array, default: () => [] },
  artifacts: { type: Array, default: () => [] },
  ruleTableFields: { type: Array, default: () => [] },
  triggerTableFields: { type: Array, default: () => [] },
  artifactTableFields: { type: Array, default: () => [] },
  formatCell: { type: Function, required: true },
  formatDefinitionRuleSummary: { type: Function, required: true },
  showMenu: { type: Boolean, default: true }
});
defineEmits(["update:view", "view-row"]);

const status = computed(() => String(props.selectedRow?.status || "").toLowerCase());
const requirements = computed(() => [
  { key: "rules", label: "Regla de alcance", done: props.hasActiveRules },
  { key: "triggers", label: "Tipo de periodo", done: props.hasActiveTriggers },
  { key: "artifacts", label: "Plantilla vinculada", done: props.hasActiveArtifacts }
]);
const completedRequirements = computed(() => requirements.value.filter((r) => r.done).length);
const allRequirementsMet = computed(() => completedRequirements.value === requirements.value.length);
</script>
