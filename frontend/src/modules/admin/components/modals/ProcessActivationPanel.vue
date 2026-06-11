<template>
  <div>
    <div v-if="checking" class="text-sm text-slate-500">Validando configuracion de la configuracion...</div>
    <template v-else-if="status === 'active'">
      <div class="definition-activation-warning mt-3">
        Esta configuracion ya esta <strong>activa</strong>. No se puede modificar reglas, disparadores ni
        paquetes en esta version: para introducir cambios crea una nueva version, o retirala para desactivarla.
      </div>
    </template>
    <template v-else-if="status === 'retired'">
      <div class="definition-activation-warning mt-3">
        Esta configuracion esta <strong>retirada</strong> y es de solo lectura. Para reutilizarla crea una
        nueva version a partir de ella.
      </div>
    </template>
    <template v-else>
      <p class="mb-2">Vas a activar una configuracion en borrador.</p>
      <div class="definition-activation-warning mt-3">
        Despues de activarla ya no podras modificar reglas, disparadores ni paquetes en esta misma version.
        Si ya existe una configuracion activa en esta misma serie, se retirara automaticamente.
      </div>

      <div class="definition-activation-checklist mt-3">
        <div class="definition-checklist-items">
          <div class="definition-checklist-item" :class="{ 'is-complete': hasActiveRules }">
            <font-awesome-icon :icon="hasActiveRules ? 'check' : 'times'" />
            <span>Al menos una regla activa</span>
          </div>
          <div class="definition-checklist-item" :class="{ 'is-complete': hasActiveTriggers }">
            <font-awesome-icon :icon="hasActiveTriggers ? 'check' : 'times'" />
            <span>Al menos un disparador activo</span>
          </div>
          <div class="definition-checklist-item" :class="{ 'is-complete': hasRequiredArtifacts || !requiresArtifacts }">
            <font-awesome-icon :icon="(hasRequiredArtifacts || !requiresArtifacts) ? 'check' : 'times'" />
            <span>{{ requiresArtifacts ? "Al menos un paquete vinculado" : "No requiere paquetes" }}</span>
          </div>
        </div>
      </div>

      <div v-if="view !== 'activate'" class="definition-activation-panel mt-3">
        <div v-if="showMenu" class="definition-activation-menu flex flex-wrap gap-2" role="group" aria-label="Resumen de activacion">
          <AdminButton variant="secondary" :class="{ active: view === 'definition' }" @click="$emit('update:view', 'definition')">Configuracion</AdminButton>
          <AdminButton variant="secondary" :class="{ active: view === 'rules' }" @click="$emit('update:view', 'rules')">Reglas</AdminButton>
          <AdminButton variant="secondary" :class="{ active: view === 'triggers' }" @click="$emit('update:view', 'triggers')">Disparadores</AdminButton>
          <AdminButton variant="secondary" :class="{ active: view === 'artifacts' }" @click="$emit('update:view', 'artifacts')">Paquetes</AdminButton>
        </div>

        <div v-if="view === 'definition'" class="mt-3">
          <div class="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
            <div><strong>Proceso:</strong> {{ formatCell(selectedRow?.process_id, { name: 'process_id' }, selectedRow || {}) }}</div>
            <div><strong>Variación:</strong> {{ formatCell(selectedRow?.series_id, { name: 'series_id' }, selectedRow || {}) }}</div>
            <div><strong>Version:</strong> {{ selectedRow?.definition_version || "—" }}</div>
            <div class="md:col-span-2"><strong>Nombre:</strong> {{ selectedRow?.name || "—" }}</div>
            <div class="md:col-span-2"><strong>Descripcion:</strong> {{ selectedRow?.description || "—" }}</div>
          </div>
        </div>

        <div v-else-if="view === 'rules'" class="mt-3">
          <AdminDataTable
            v-if="rules.length"
            :fields="ruleTableFields"
            :rows="rules"
            :row-key="(row) => `activation-rule-${row.id}`"
            table-class="admin-data-table min-w-full border-separate border-spacing-0 text-sm"
            responsive-class="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"
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
          </AdminDataTable>
          <div v-else class="text-sm text-slate-500">Sin reglas registradas.</div>
        </div>

        <div v-else-if="view === 'triggers'" class="mt-3">
          <AdminDataTable
            v-if="triggers.length"
            :fields="triggerTableFields"
            :rows="triggers"
            :row-key="(row) => `activation-trigger-${row.id}`"
            table-class="admin-data-table min-w-full border-separate border-spacing-0 text-sm"
            responsive-class="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"
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
                view-title="Ver disparador"
                view-label="Ver disparador"
                @view="$emit('view-row', { table: 'process_definition_triggers', row })"
              />
            </template>
          </AdminDataTable>
          <div v-else class="text-sm text-slate-500">Sin disparadores registrados.</div>
        </div>

        <div v-else class="mt-3">
          <AdminDataTable
            v-if="artifacts.length"
            :fields="artifactTableFields"
            :rows="artifacts"
            :row-key="(row) => `activation-artifact-${row.id}`"
            table-class="admin-data-table min-w-full border-separate border-spacing-0 text-sm"
            responsive-class="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"
            scroll-class=""
          >
            <template #cell="{ row, field }">
              <template v-if="field.name === 'template_artifact_id'">
                {{ formatCell(row.template_artifact_id, { name: "template_artifact_id" }, row) }}
              </template>
              <template v-else-if="field.name === 'creates_task'">
                {{ Number(row.creates_task) === 1 ? "Si" : "No" }}
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
          </AdminDataTable>
          <div v-else class="text-sm text-slate-500">Sin plantillas vinculadas.</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from "vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AdminDataTable from "@/shared/components/data/AppDataTable.vue";
import AdminTableActions from "@/modules/admin/components/tables/AdminTableActions.vue";

const props = defineProps({
  checking: { type: Boolean, default: false },
  hasActiveRules: { type: Boolean, default: false },
  hasActiveTriggers: { type: Boolean, default: false },
  hasRequiredArtifacts: { type: Boolean, default: false },
  requiresArtifacts: { type: Boolean, default: false },
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
</script>
