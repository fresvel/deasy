<template>
  <AdminModalShell
    ref="modalRef"
    labelled-by="draftArtifactModalLabel"
    :title="draftArtifactEditId ? 'Editar plantilla de documento' : 'Crear plantilla de documento'"
    size="xl"
    dialog-class="max-w-7xl"
    content-class="border-0 shadow"
    close-action
    @close="$emit('close')"
  >
    <div v-if="draftArtifactError" class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ draftArtifactError }}</div>
    <div class="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
      Este flujo {{ draftArtifactEditId ? "actualiza" : "crea" }} la plantilla de documento y la sube directamente a <strong>MinIO</strong>. Solo cuando la carga termine correctamente se guarda el registro en el sistema.
    </div>
    <div v-if="draftArtifactLoading" class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      Subiendo archivos a <strong>MinIO</strong>. Espera a que termine la carga para continuar.
    </div>

    <!-- Gobierno del ciclo de vida: stage + nueva versión (solo al editar) -->
    <div v-if="draftArtifactEditId" class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/50 px-4 py-3">
      <div class="flex items-center gap-3">
        <span class="text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</span>
        <span class="inline-flex items-center rounded-full bg-white px-3 py-1 text-sm font-bold capitalize" :class="stageBadgeClass">{{ draftArtifactForm.artifact_stage || 'draft' }}</span>
        <span v-if="draftArtifactForm.storage_version" class="text-xs font-medium text-slate-400">· {{ draftArtifactForm.storage_version }}</span>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <AdminButton
          v-for="next in nextStages"
          :key="next.value"
          variant="outlinePrimary"
          @click="$emit('change-stage', next.value)"
        >{{ next.label }}</AdminButton>
        <AdminButton variant="cancel" @click="$emit('new-version')">Nueva versión</AdminButton>
      </div>
    </div>

    <!-- Pestañas con indicadores de avance -->
    <div class="mt-3">
      <ProfileSubsectionTabs v-model="activeTab" :tabs="tabDescriptors" aria-label="Secciones de la plantilla" />
    </div>

    <!-- Pestaña: General -->
    <div v-show="activeTab === 'general'" class="mt-4 grid gap-3 md:grid-cols-12">
      <AdminFieldGroup label="Semilla (base)" group-class="md:col-span-6">
        <AdminSelectField
          :model-value="draftArtifactForm.template_seed_id"
          @update:model-value="updateField('template_seed_id', $event)"
        >
          <option
            v-for="row in draftArtifactSeedOptions"
            :key="row.id"
            :value="String(row.id)"
          >
            {{ row.display_name }}{{ row.seed_code === DEFAULT_SEED_CODE ? " (por defecto)" : "" }}
          </option>
        </AdminSelectField>
        <p class="m-0 mt-1 text-xs font-medium text-slate-500">Toda plantilla nace de una semilla; por defecto se usa la general.</p>
      </AdminFieldGroup>
      <AdminFieldGroup label="Version fuente" group-class="md:col-span-6">
        <AdminInputField
          :model-value="draftArtifactForm.source_version"
          placeholder="1.0.0"
          @update:model-value="updateField('source_version', $event)"
        />
      </AdminFieldGroup>
      <AdminFieldGroup label="Nombre de la plantilla" group-class="md:col-span-6">
        <AdminInputField
          :model-value="draftArtifactForm.display_name"
          placeholder="Nombre de la plantilla"
          @update:model-value="updateField('display_name', $event)"
        />
      </AdminFieldGroup>
      <AdminFieldGroup label="Descripcion" group-class="md:col-span-6">
        <AdminInputField
          :model-value="draftArtifactForm.description"
          placeholder="Descripcion breve"
          @update:model-value="updateField('description', $event)"
        />
      </AdminFieldGroup>
      <AdminFieldGroup label="Proceso destino" group-class="md:col-span-12">
        <div class="flex gap-2">
          <AdminSelectField
            class="flex-1"
            :model-value="draftArtifactForm.process_definition_id"
            @update:model-value="updateField('process_definition_id', $event)"
          >
            <option value="">{{ requireProcessLink ? 'Selecciona un proceso (obligatorio)' : 'Sin vincular (opcional)' }}</option>
            <option
              v-for="proc in processDefinitionOptions"
              :key="proc.id"
              :value="String(proc.id)"
            >
              {{ proc.label }}
            </option>
          </AdminSelectField>
          <AdminButton variant="cancel" @click="$emit('create-process')">+ Crear proceso</AdminButton>
        </div>
        <p class="mt-1 text-xs text-slate-400">La plantilla quedará vinculada a este proceso (o 'default' para tareas libres). ¿No existe? Créalo con el wizard guiado.</p>
      </AdminFieldGroup>
    </div>

    <!-- Pestaña: Formatos -->
    <div v-show="activeTab === 'formatos'" class="mt-4 grid gap-3 md:grid-cols-12">
      <div v-if="!isFormatosComplete" class="md:col-span-12 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800">
        Adjunta al menos un documento de referencia (PDF, Word, Excel o PowerPoint) para poder crear la plantilla.
      </div>
      <div class="md:col-span-3">
        <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">PDF</label>
        <PdfDropField variant="compact" title="" action-text="Arrastra o haz clic" :help-text="getDraftArtifactFileLabel('pdf')" accept=".pdf" input-id="draft-upload-pdf" @files-selected="emitDraftFiles('pdf', $event)" />
      </div>
      <div class="md:col-span-3">
        <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">Word</label>
        <PdfDropField variant="compact" title="" action-text="Arrastra o haz clic" :help-text="getDraftArtifactFileLabel('docx')" accept=".doc,.docx" input-id="draft-upload-docx" @files-selected="emitDraftFiles('docx', $event)" />
      </div>
      <div class="md:col-span-3">
        <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">Excel</label>
        <PdfDropField variant="compact" title="" action-text="Arrastra o haz clic" :help-text="getDraftArtifactFileLabel('xlsx')" accept=".xls,.xlsx" input-id="draft-upload-xlsx" @files-selected="emitDraftFiles('xlsx', $event)" />
      </div>
      <div class="md:col-span-3">
        <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">PowerPoint</label>
        <PdfDropField variant="compact" title="" action-text="Arrastra o haz clic" :help-text="getDraftArtifactFileLabel('pptx')" accept=".ppt,.pptx" input-id="draft-upload-pptx" @files-selected="emitDraftFiles('pptx', $event)" />
      </div>
      <div v-if="draftArtifactPreviewStatus !== 'idle'" class="md:col-span-12">
        <label class="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">Preview del seed</label>
        <div v-if="draftArtifactPreviewStatus === 'loading'" class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm font-medium text-slate-500">
          Cargando preview…
        </div>
        <iframe v-else-if="draftArtifactPreviewStatus === 'ready' && draftArtifactPreviewUrl" :src="draftArtifactPreviewUrl" class="min-h-105 w-full rounded-xl border border-slate-200 bg-white" title="Preview del seed"></iframe>
        <div v-else class="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm font-medium text-slate-500">
          Este seed no tiene un PDF de preview publicado.
        </div>
      </div>
    </div>

    <!-- Pestaña: Campos del formulario (schema.json) -->
    <div v-show="activeTab === 'campos'" class="mt-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h4 class="m-0 text-sm font-bold text-slate-800">Campos del formulario</h4>
          <p class="m-0 mt-0.5 text-xs font-medium text-slate-500">Definen los datos que el usuario llenará en el entregable (schema.json).</p>
        </div>
        <AdminButton variant="outlinePrimary" @click="addSchemaField">+ Añadir campo</AdminButton>
      </div>
      <div v-if="!schemaFields.length" class="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-sm font-medium text-slate-500">
        Aún no hay campos. Añade al menos uno para generar el formulario del entregable.
      </div>
      <div v-else class="mt-3 flex flex-col gap-2">
        <div v-for="(field, index) in schemaFields" :key="index" class="grid grid-cols-12 items-end gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          <div class="col-span-3">
            <label class="mb-1 block text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">Clave</label>
            <input :value="field.key" placeholder="ej. semestre" class="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400" @input="updateSchemaField(index, 'key', $event.target.value)" />
          </div>
          <div class="col-span-3">
            <label class="mb-1 block text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">Etiqueta</label>
            <input :value="field.title" placeholder="ej. Semestre" class="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400" @input="updateSchemaField(index, 'title', $event.target.value)" />
          </div>
          <div class="col-span-2">
            <label class="mb-1 block text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">Componente</label>
            <select :value="field.component" class="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400" @change="updateSchemaField(index, 'component', $event.target.value)">
              <option value="text">Texto</option>
              <option value="textarea">Área de texto</option>
              <option value="richtext">Texto enriquecido</option>
              <option value="number">Número</option>
              <option value="switch">Interruptor</option>
              <option value="date">Fecha</option>
              <option value="select">Selección</option>
              <option value="hidden">Oculto</option>
            </select>
          </div>
          <div class="col-span-2">
            <label class="mb-1 block text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">Grupo</label>
            <input :value="field.group" placeholder="general" class="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400" @input="updateSchemaField(index, 'group', $event.target.value)" />
          </div>
          <div class="col-span-1 flex items-center justify-center pb-1.5">
            <label class="inline-flex flex-col items-center gap-0.5 text-[0.6rem] font-semibold text-slate-400">
              Req.
              <input type="checkbox" :checked="field.required" class="h-4 w-4" @change="updateSchemaField(index, 'required', $event.target.checked)" />
            </label>
          </div>
          <div class="col-span-1 flex items-center justify-end pb-1">
            <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-rose-600 transition hover:border-rose-300 hover:bg-rose-50" aria-label="Eliminar campo" @click="removeSchemaField(index)">✕</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Pestaña: Flujo de ENTREGA -->
    <div v-show="activeTab === 'entrega'" class="mt-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h4 class="m-0 text-sm font-bold text-slate-800">Flujo de entrega</h4>
          <p class="m-0 mt-0.5 text-xs font-medium text-slate-500">Pasos para completar el entregable (quién llena cada parte).</p>
        </div>
        <AdminButton variant="outlinePrimary" @click="addFillStep">+ Añadir paso</AdminButton>
      </div>
      <div v-if="!fillSteps.length" class="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-center text-sm font-medium text-slate-500">
        Sin pasos de entrega.
      </div>
      <div v-else class="mt-3 flex flex-col gap-2">
        <div v-for="(step, index) in fillSteps" :key="index" class="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          <div class="grid grid-cols-12 items-end gap-2">
            <div class="col-span-1">
              <label class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">Orden</label>
              <input type="number" min="1" :value="step.order" class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400" @input="updateFillStep(index, 'order', Number($event.target.value))" />
            </div>
            <div class="col-span-4">
              <label class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">Nombre</label>
              <input :value="step.name" placeholder="ej. Entrega del docente" class="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400" @input="updateFillStep(index, 'name', $event.target.value)" />
            </div>
            <div class="col-span-3">
              <label class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">Responsable</label>
              <select :value="step.resolver_type" class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400" @change="updateFillStep(index, 'resolver_type', $event.target.value)">
                <option value="document_owner">Dueño del documento</option>
                <option value="task_assignee">Asignado de la tarea</option>
                <option value="cargo_in_scope">Cargo en ámbito</option>
                <option value="specific_person">Persona específica</option>
                <option value="position">Posición</option>
                <option value="manual_pick">Selección manual</option>
              </select>
            </div>
            <div class="col-span-2">
              <label class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">Modo</label>
              <select :value="step.selection_mode" class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400" @change="updateFillStep(index, 'selection_mode', $event.target.value)">
                <option value="auto_one">Auto (uno)</option>
                <option value="auto_all">Auto (todos)</option>
                <option value="manual">Manual</option>
              </select>
            </div>
            <div class="col-span-1 flex items-center justify-center pb-1.5">
              <label class="inline-flex flex-col items-center gap-0.5 text-[0.55rem] font-semibold text-slate-400">Rechazo
                <input type="checkbox" :checked="step.can_reject" class="h-4 w-4" @change="updateFillStep(index, 'can_reject', $event.target.checked)" />
              </label>
            </div>
            <div class="col-span-1 flex items-center justify-end pb-1">
              <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-rose-600 transition hover:border-rose-300 hover:bg-rose-50" aria-label="Eliminar paso" @click="removeFillStep(index)">✕</button>
            </div>
          </div>
          <div v-if="step.resolver_type === 'cargo_in_scope'" class="mt-2 grid grid-cols-12 gap-2">
            <div class="col-span-4">
              <label class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">Código de cargo</label>
              <input :value="step.cargo_code" placeholder="ej. responsable" class="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400" @input="updateFillStep(index, 'cargo_code', $event.target.value)" />
            </div>
            <div class="col-span-4">
              <label class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">Ámbito</label>
              <select :value="step.unit_scope_type" class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400" @change="updateFillStep(index, 'unit_scope_type', $event.target.value)">
                <option value="unit_exact">Unidad exacta</option>
                <option value="unit_subtree">Unidad y subárbol</option>
                <option value="unit_type">Tipo de unidad</option>
                <option value="all_units">Todas las unidades</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pestaña: Flujo de FIRMAS -->
    <div v-show="activeTab === 'firmas'" class="mt-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h4 class="m-0 text-sm font-bold text-slate-800">Flujo de firmas</h4>
          <p class="m-0 mt-0.5 text-xs font-medium text-slate-500">Pasos de firma electrónica y anclas por token (campo que marca la posición en el PDF).</p>
        </div>
        <div class="flex gap-2">
          <AdminButton variant="cancel" @click="addSignatureAnchor">+ Ancla</AdminButton>
          <AdminButton variant="outlinePrimary" @click="addSignatureStep">+ Añadir paso</AdminButton>
        </div>
      </div>

      <div v-if="signatureAnchors.length" class="mt-3 flex flex-col gap-2">
        <p class="m-0 text-[0.65rem] font-bold uppercase tracking-wide text-slate-400">Anclas</p>
        <div v-for="(anchor, index) in signatureAnchors" :key="`anchor-${index}`" class="grid grid-cols-12 items-end gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div class="col-span-4">
            <label class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">Código ancla</label>
            <input :value="anchor.code" placeholder="ej. firma_aprobado" class="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400" @input="updateSignatureAnchor(index, 'code', $event.target.value)" />
          </div>
          <div class="col-span-6">
            <label class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">Campo token (field code)</label>
            <input :value="anchor.token_field_ref" placeholder="ej. signatures.aprobado.token" class="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400" @input="updateSignatureAnchor(index, 'token_field_ref', $event.target.value)" />
          </div>
          <div class="col-span-2 flex items-center justify-end pb-1">
            <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-rose-600 transition hover:border-rose-300 hover:bg-rose-50" aria-label="Eliminar ancla" @click="removeSignatureAnchor(index)">✕</button>
          </div>
        </div>
      </div>

      <div v-if="!signatureSteps.length" class="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-center text-sm font-medium text-slate-500">
        Sin pasos de firma.
      </div>
      <div v-else class="mt-3 flex flex-col gap-2">
        <div v-for="(step, index) in signatureSteps" :key="`sig-${index}`" class="grid grid-cols-12 items-end gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          <div class="col-span-1">
            <label class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">Orden</label>
            <input type="number" min="1" :value="step.order" class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400" @input="updateSignatureStep(index, 'order', Number($event.target.value))" />
          </div>
          <div class="col-span-4">
            <label class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">Nombre</label>
            <input :value="step.name" placeholder="ej. Firma del director" class="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400" @input="updateSignatureStep(index, 'name', $event.target.value)" />
          </div>
          <div class="col-span-3">
            <label class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">Cargo firmante</label>
            <input :value="step.required_cargo_code" placeholder="ej. director" class="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-400" @input="updateSignatureStep(index, 'required_cargo_code', $event.target.value)" />
          </div>
          <div class="col-span-3">
            <label class="mb-1 block text-[0.6rem] font-semibold uppercase tracking-wide text-slate-400">Ancla</label>
            <select :value="(step.anchor_refs && step.anchor_refs[0]) || ''" class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-indigo-400" @change="updateSignatureStep(index, 'anchor_refs', $event.target.value ? [$event.target.value] : [])">
              <option value="">(sin ancla)</option>
              <option v-for="anchor in signatureAnchors" :key="anchor.code" :value="anchor.code">{{ anchor.code }}</option>
            </select>
          </div>
          <div class="col-span-1 flex items-center justify-end pb-1">
            <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-rose-600 transition hover:border-rose-300 hover:bg-rose-50" aria-label="Eliminar paso" @click="removeSignatureStep(index)">✕</button>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <AdminButton variant="cancel" @click="$emit('close')">Cancelar</AdminButton>
      <AdminButton v-if="!isFirstTab" variant="secondary" @click="goPrevTab">Atrás</AdminButton>
      <AdminButton v-if="!isLastTab" variant="primary" @click="goNextTab">Siguiente →</AdminButton>
      <AdminButton
        variant="outlinePrimary"
        :disabled="draftArtifactLoading || !canSubmit"
        :title="canSubmit ? '' : 'Faltan: proceso destino, documento de referencia y al menos un paso de flujo de entrega.'"
        @click="$emit('submit')"
      >
        {{ draftArtifactLoading ? "Subiendo a MinIO..." : (draftArtifactEditId ? "Guardar cambios" : "Crear plantilla") }}
      </AdminButton>
    </template>
  </AdminModalShell>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";
import axios from "axios";
import { API_ROUTES } from "@/core/config/apiConfig";
import AdminButton from "@/shared/components/buttons/AppButton.vue";
import AdminFieldGroup from "@/modules/admin/components/forms/AdminFieldGroup.vue";
import AdminInputField from "@/modules/admin/components/forms/AdminInputField.vue";
import AdminModalShell from "@/shared/components/modals/AppModalShell.vue";
import AdminSelectField from "@/modules/admin/components/forms/AdminSelectField.vue";
import PdfDropField from "@/modules/firmas/components/PdfDropField.vue";
import ProfileSubsectionTabs from "@/modules/perfil/components/ProfileSubsectionTabs.vue";

// Configuraciones de proceso destino (para vincular la plantilla).
const processDefinitionOptions = ref([]);
const loadProcessDefinitionOptions = async () => {
  try {
    const { data } = await axios.get(API_ROUTES.ADMIN_SQL_TABLE("process_definition_versions"), {
      params: { filter_status: "active", orderBy: "name", order: "asc", limit: 500 },
    });
    const rows = Array.isArray(data) ? data : (data?.rows || data?.data || []);
    processDefinitionOptions.value = rows.map((r) => ({
      id: r.id,
      label: `${r.name || r.variation_key || ("Def " + r.id)} (v${r.definition_version || "?"})`,
    }));
  } catch {
    processDefinitionOptions.value = [];
  }
};
// Toda plantilla debe pertenecer a un proceso: el vínculo es obligatorio para todos los roles.
const requireProcessLink = computed(() => true);
onMounted(loadProcessDefinitionOptions);

const props = defineProps({
  draftArtifactEditId: { type: String, default: "" },
  draftArtifactError: { type: String, default: "" },
  draftArtifactLoading: { type: Boolean, default: false },
  draftArtifactForm: { type: Object, default: () => ({}) },
  draftArtifactSeedOptions: { type: Array, default: () => [] },
  draftArtifactPreviewUrl: { type: String, default: "" },
  draftArtifactPreviewStatus: { type: String, default: "idle" },
  getDraftArtifactFileLabel: { type: Function, required: true },
  // Cuando el wizard crea un proceso desde este modal, se pasa su id para seleccionarlo y refrescar opciones.
  newProcessDefinitionId: { type: [String, Number], default: "" }
});

const emit = defineEmits(["update:form", "file-change", "drop", "close", "submit", "change-stage", "new-version", "create-process"]);
const modalRef = ref(null);

// Código de la semilla por defecto (debe coincidir con DEFAULT_TEMPLATE_SEED_CODE del backend).
const DEFAULT_SEED_CODE = "latex/informe-general";

// Al crear (sin editar), preselecciona la semilla por defecto (o la primera) en cuanto cargan las opciones,
// para no mostrar una opción "General" separada que duplique a la semilla real.
watch(
  () => [props.draftArtifactSeedOptions, props.draftArtifactEditId, props.draftArtifactForm.template_seed_id],
  () => {
    if (props.draftArtifactEditId) {
      return;
    }
    const options = props.draftArtifactSeedOptions || [];
    if (!options.length || props.draftArtifactForm.template_seed_id) {
      return;
    }
    const fallback = options.find((row) => row.seed_code === DEFAULT_SEED_CODE) || options[0];
    if (fallback?.id) {
      updateField("template_seed_id", String(fallback.id));
    }
  },
  { immediate: true, deep: true }
);

// Al volver del wizard con un proceso nuevo: recarga opciones y selecciona el creado.
watch(() => props.newProcessDefinitionId, async (id) => {
  if (!id) {
    return;
  }
  await loadProcessDefinitionOptions();
  updateField("process_definition_id", String(id));
  activeTab.value = "general";
});

// ── Pestañas ──
// Flujo guiado: semilla/base → documento de referencia → entrega → firmas → campos del documento (schema).
const TAB_KEYS = ["general", "formatos", "entrega", "firmas", "campos"];
const activeTab = ref("general");

const isGeneralComplete = computed(() => {
  const hasName = Boolean(String(props.draftArtifactForm.display_name || "").trim());
  const hasProcess = !requireProcessLink.value || Boolean(props.draftArtifactForm.process_definition_id);
  return hasName && hasProcess;
});
// Al crear se exige al menos un documento de referencia (pdf/docx/xlsx/pptx); el seed ya no basta.
// En edición se considera completo si ya hay formatos existentes en la plantilla.
const isFormatosComplete = computed(() => {
  const labels = ["pdf", "docx", "xlsx", "pptx"].map((k) => props.getDraftArtifactFileLabel(k));
  const hasUploadedDoc = labels.some((l) => l && l !== "Sin archivo");
  if (hasUploadedDoc) return true;
  return Boolean(props.draftArtifactEditId);
});
const isCamposComplete = computed(() => schemaFields.value.length > 0);
const isEntregaComplete = computed(() => fillSteps.value.length > 0);
const isFirmasComplete = computed(() => signatureSteps.value.length > 0);

// Requisitos para crear: proceso destino + documento de referencia + >=1 paso de entrega.
// (Campos y firmas son opcionales). En edición no se bloquea el guardado.
const canSubmit = computed(() => {
  if (props.draftArtifactEditId) return true;
  return isGeneralComplete.value && isFormatosComplete.value && isEntregaComplete.value;
});

const tabState = {
  general: isGeneralComplete,
  formatos: isFormatosComplete,
  campos: isCamposComplete,
  entrega: isEntregaComplete,
  firmas: isFirmasComplete,
};
const TAB_LABELS = { general: "General", formatos: "Formatos", entrega: "Entrega", firmas: "Firmas", campos: "Campos (documento)" };
const tabDescriptors = computed(() => TAB_KEYS.map((key) => ({
  key,
  label: `${TAB_LABELS[key]}${tabState[key].value ? " ✓" : ""}`,
})));

const currentTabIndex = computed(() => TAB_KEYS.indexOf(activeTab.value));
const isFirstTab = computed(() => currentTabIndex.value <= 0);
const isLastTab = computed(() => currentTabIndex.value >= TAB_KEYS.length - 1);
const goNextTab = () => {
  const next = TAB_KEYS[currentTabIndex.value + 1];
  if (next) activeTab.value = next;
};
const goPrevTab = () => {
  const prev = TAB_KEYS[currentTabIndex.value - 1];
  if (prev) activeTab.value = prev;
};
// Reinicia a la primera pestaña al cambiar entre crear/editar.
watch(() => props.draftArtifactEditId, () => { activeTab.value = "general"; });

const STAGE_TRANSITIONS = {
  draft: [{ value: "review", label: "Enviar a revisión" }, { value: "archived", label: "Archivar" }],
  review: [{ value: "approved", label: "Aprobar" }, { value: "draft", label: "Devolver a borrador" }, { value: "archived", label: "Archivar" }],
  approved: [{ value: "published", label: "Publicar" }, { value: "review", label: "Volver a revisión" }, { value: "archived", label: "Archivar" }],
  published: [{ value: "archived", label: "Archivar" }, { value: "approved", label: "Despublicar" }],
  archived: [{ value: "draft", label: "Restaurar a borrador" }],
};
const STAGE_BADGE = {
  draft: "text-slate-600", review: "text-amber-600", approved: "text-sky-600",
  published: "text-emerald-600", archived: "text-rose-500",
};
const nextStages = computed(() => STAGE_TRANSITIONS[props.draftArtifactForm.artifact_stage || "draft"] || []);
const stageBadgeClass = computed(() => STAGE_BADGE[props.draftArtifactForm.artifact_stage || "draft"] || "text-slate-600");

const updateField = (fieldName, value) => {
  emit("update:form", { ...props.draftArtifactForm, [fieldName]: value });
};

const schemaFields = computed(() => Array.isArray(props.draftArtifactForm.schema_fields) ? props.draftArtifactForm.schema_fields : []);
const commitSchemaFields = (next) => {
  emit("update:form", { ...props.draftArtifactForm, schema_fields: next });
};
const addSchemaField = () => {
  commitSchemaFields([...schemaFields.value, { key: "", title: "", component: "text", group: "general", required: false }]);
};
const updateSchemaField = (index, prop, value) => {
  commitSchemaFields(schemaFields.value.map((f, i) => (i === index ? { ...f, [prop]: value } : f)));
};
const removeSchemaField = (index) => {
  commitSchemaFields(schemaFields.value.filter((_, i) => i !== index));
};

// ── Flujo de entrega ──
const fillSteps = computed(() => props.draftArtifactForm.fill_workflow?.steps || []);
const commitFillSteps = (steps) => {
  emit("update:form", { ...props.draftArtifactForm, fill_workflow: { required: true, ...props.draftArtifactForm.fill_workflow, steps } });
};
const addFillStep = () => {
  commitFillSteps([...fillSteps.value, { order: fillSteps.value.length + 1, name: "", resolver_type: "document_owner", selection_mode: "auto_one", cargo_code: "", unit_scope_type: "unit_exact", field_refs: [], required: true, can_reject: true }]);
};
const updateFillStep = (index, prop, value) => {
  commitFillSteps(fillSteps.value.map((s, i) => (i === index ? { ...s, [prop]: value } : s)));
};
const removeFillStep = (index) => {
  commitFillSteps(fillSteps.value.filter((_, i) => i !== index));
};

// ── Flujo de firmas ──
const signatureSteps = computed(() => props.draftArtifactForm.signature_workflow?.steps || []);
const signatureAnchors = computed(() => props.draftArtifactForm.signature_workflow?.anchors || []);
const commitSignature = (patch) => {
  emit("update:form", {
    ...props.draftArtifactForm,
    signature_workflow: {
      required: true,
      anchors: signatureAnchors.value,
      steps: signatureSteps.value,
      ...props.draftArtifactForm.signature_workflow,
      ...patch,
    },
  });
};
const addSignatureStep = () => {
  commitSignature({ steps: [...signatureSteps.value, { order: signatureSteps.value.length + 1, name: "", step_type_code: "electronic", required_cargo_code: "", selection_mode: "auto_all", required_signers_min: 1, required_signers_max: 1, required: true, anchor_refs: [] }] });
};
const updateSignatureStep = (index, prop, value) => {
  commitSignature({ steps: signatureSteps.value.map((s, i) => (i === index ? { ...s, [prop]: value } : s)) });
};
const removeSignatureStep = (index) => {
  commitSignature({ steps: signatureSteps.value.filter((_, i) => i !== index) });
};
const addSignatureAnchor = () => {
  commitSignature({ anchors: [...signatureAnchors.value, { code: "", token_field_ref: "", width: 124, height: 48 }] });
};
const updateSignatureAnchor = (index, prop, value) => {
  commitSignature({ anchors: signatureAnchors.value.map((a, i) => (i === index ? { ...a, [prop]: value } : a)) });
};
const removeSignatureAnchor = (index) => {
  commitSignature({ anchors: signatureAnchors.value.filter((_, i) => i !== index) });
};

const emitDraftFiles = (type, files) => {
  emit("file-change", type, { target: { files } });
};

defineExpose({ el: modalRef });
</script>
