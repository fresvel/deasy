<template>
  <AdminModalShell
    ref="modalRef"
    labelled-by="processDefinitionActivationModalLabel"
    title="Activar definicion"
    dialog-class="definition-activation-modal-dialog"
    close-action
    @close="$emit('cancel')"
  >
    <div v-if="checking" class="text-muted">Validando configuracion de la definicion...</div>
    <template v-else>
      <p class="mb-2">Vas a activar una definicion en borrador.</p>
      <div class="definition-activation-warning mt-3">
        Despues de activarla ya no podras modificar reglas, disparadores ni paquetes en esta misma version.
        Si ya existe una definicion activa en esta misma serie, se retirara automaticamente.
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

      <div class="definition-activation-panel mt-3">
        <div class="btn-group btn-group-sm definition-activation-menu" role="group" aria-label="Resumen de activacion">
          <AdminButton variant="secondary" :class="{ active: view === 'definition' }" @click="$emit('update:view', 'definition')">Definicion</AdminButton>
          <AdminButton variant="secondary" :class="{ active: view === 'rules' }" @click="$emit('update:view', 'rules')">Reglas</AdminButton>
          <AdminButton variant="secondary" :class="{ active: view === 'triggers' }" @click="$emit('update:view', 'triggers')">Disparadores</AdminButton>
          <AdminButton variant="secondary" :class="{ active: view === 'artifacts' }" @click="$emit('update:view', 'artifacts')">Paquetes</AdminButton>
        </div>

        <div v-if="view === 'definition'" class="mt-3">
          <div class="row g-2 small">
            <div class="col-12 col-md-6"><strong>Proceso:</strong> {{ formatCell(selectedRow?.process_id, { name: 'process_id' }, selectedRow || {}) }}</div>
            <div class="col-12 col-md-6"><strong>Serie:</strong> {{ formatCell(selectedRow?.series_id, { name: 'series_id' }, selectedRow || {}) }}</div>
            <div class="col-12 col-md-6"><strong>Version:</strong> {{ selectedRow?.definition_version || "—" }}</div>
            <div class="col-12 col-md-6"><strong>Modo:</strong> {{ selectedRow?.execution_mode || "—" }}</div>
            <div class="col-12"><strong>Nombre:</strong> {{ selectedRow?.name || "—" }}</div>
            <div class="col-12"><strong>Descripcion:</strong> {{ selectedRow?.description || "—" }}</div>
          </div>
        </div>

        <div v-else-if="view === 'rules'" class="mt-3">
          <AdminDataTable
            v-if="rules.length"
            :fields="ruleTableFields"
            :rows="rules"
            :row-key="(row) => `activation-rule-${row.id}`"
            table-class="table table-sm table-striped align-middle"
            responsive-class="table-responsive"
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
          </AdminDataTable>
          <div v-else class="text-muted small">Sin reglas registradas.</div>
        </div>

        <div v-else-if="view === 'triggers'" class="mt-3">
          <AdminDataTable
            v-if="triggers.length"
            :fields="triggerTableFields"
            :rows="triggers"
            :row-key="(row) => `activation-trigger-${row.id}`"
            table-class="table table-sm table-striped align-middle"
            responsive-class="table-responsive"
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
          </AdminDataTable>
          <div v-else class="text-muted small">Sin disparadores registrados.</div>
        </div>

        <div v-else class="mt-3">
          <AdminDataTable
            v-if="artifacts.length"
            :fields="artifactTableFields"
            :rows="artifacts"
            :row-key="(row) => `activation-artifact-${row.id}`"
            table-class="table table-sm table-striped align-middle"
            responsive-class="table-responsive"
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
          </AdminDataTable>
          <div v-else class="text-muted small">Sin paquetes vinculados.</div>
        </div>
      </div>
    </template>
    <template #footer>
      <AdminButton variant="cancel" @click="$emit('cancel')">Cancelar</AdminButton>
      <AdminButton variant="outlinePrimary" :disabled="checking || !primaryAction" @click="$emit('primary-action')">{{ primaryActionLabel }}</AdminButton>
      <AdminButton variant="success" :disabled="checking || !allRequirementsMet" @click="$emit('confirm')">Activar</AdminButton>
    </template>
  </AdminModalShell>
</template>

<script setup>
import { ref } from "vue";
import AdminButton from "@/views/admin/components/AdminButton.vue";
import AdminDataTable from "@/views/admin/components/AdminDataTable.vue";
import AdminModalShell from "@/views/admin/components/AdminModalShell.vue";

defineProps({
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
  primaryAction: { type: String, default: "" },
  primaryActionLabel: { type: String, default: "" },
  allRequirementsMet: { type: Boolean, default: false },
  formatCell: { type: Function, required: true },
  formatDefinitionRuleSummary: { type: Function, required: true }
});
defineEmits(["update:view", "cancel", "primary-action", "confirm"]);
const modalRef = ref(null);
defineExpose({ el: modalRef });
</script>
