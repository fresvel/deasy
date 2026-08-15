<template>
<AppModalShell
  ref="shellRef"
  labelled-by="general-task-modal-title"
  :title="generalTaskModalTitle"
  size="lg"
  content-class="shadow border-0"
  body-class="pt-4"
>
  <div class="flex flex-col gap-5">
    <p class="m-0 text-sm font-medium text-muted">
      {{ generalTaskForm.itemMode === 'routed'
        ? 'Crea un envío de este entregable y elige a la persona que lo recibe y firma.'
        : (generalTaskForm.itemMode === 'replicated'
          ? 'Crea una réplica de este entregable. Hereda su flujo de entrega y firmas; solo cambia la etiqueta.'
          : (generalTaskForm.mode === 'derived'
            ? 'Agrega un entregable adicional dentro de la tarea seleccionada. Heredará su unidad de contexto.'
            : 'Crea un documento ad-hoc y endósalo a una persona (que puede ser tú). Define quién lo elabora y quién lo firma.')) }}
    </p>

    <div v-if="generalTaskForm.templateName" class="flex flex-wrap items-center gap-2">
      <AppTag :variant="generalTaskForm.itemMode === 'routed' ? 'info' : 'success'">{{ generalTaskForm.templateName }}</AppTag>
      <AppTag variant="muted">{{ generalTaskForm.itemMode === 'routed' ? 'Envío con destinatario' : 'Réplica' }}</AppTag>
    </div>

    <div v-if="generalTaskError" class="deasy-alert deasy-alert--danger">{{ generalTaskError }}</div>

    <!-- Documento -->
    <section class="flex flex-col gap-3 rounded-2xl border border-line/80 bg-white p-4">
      <div class="flex items-center gap-2">
        <span class="inline-flex h-7 w-7 items-center justify-center rounded-2xl bg-brand-50 text-primary"><IconFileDescription class="h-4 w-4" /></span>
        <h6 class="m-0 text-sm font-black uppercase tracking-wider text-body">Documento</h6>
      </div>
      <label class="flex flex-col gap-1">
        <span class="deasy-eyebrow">{{ generalTaskForm.itemMode ? 'Etiqueta *' : 'Título *' }}</span>
        <input v-model="generalTaskForm.title" type="text" maxlength="180" :placeholder="generalTaskForm.itemMode ? 'Ej. Requerimiento docente — Prof. Pérez' : 'Ej. Memorando interno, solicitud de equipo…'" class="deasy-card px-3 py-2 text-sm font-medium text-body outline-none" />
      </label>
      <label v-if="!generalTaskForm.itemMode" class="flex flex-col gap-1">
        <span class="deasy-eyebrow">Descripción</span>
        <textarea v-model="generalTaskForm.description" rows="3" maxlength="2000" placeholder="Detalle del documento…" class="deasy-card px-3 py-2 text-sm font-medium text-body outline-none"></textarea>
      </label>
    </section>

    <!-- Flujo del envío -->
    <section v-if="isSendFlowModal" class="flex flex-col gap-3 rounded-2xl border border-line/80 bg-white p-4">
      <div class="flex items-center gap-2">
        <span class="inline-flex h-7 w-7 items-center justify-center rounded-2xl bg-brand-50 text-primary"><IconSend class="h-4 w-4" /></span>
        <h6 class="m-0 text-sm font-black uppercase tracking-wider text-body">Flujo del envío</h6>
      </div>
      <p class="m-0 -mt-1 text-xs font-medium text-muted">Quién elabora el documento y quién lo firma (en orden).</p>

      <div class="rounded-xl border border-line bg-surface/60 p-3">
        <div class="flex items-center justify-between">
          <span class="deasy-eyebrow">Elabora (entrega) *</span>
          <button type="button" class="text-xs font-semibold text-primary hover:text-primary" @click="openFlowPicker('entrega')">+ Agregar</button>
        </div>
        <ul class="mt-2 flex flex-wrap gap-2 list-none m-0 p-0">
          <li v-for="(p, i) in flowEntrega" :key="`e-${i}`" class="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 text-sm font-medium text-body">
            <span class="text-[0.65rem] font-bold text-muted">{{ i + 1 }}</span>{{ p.label }}
            <button type="button" class="deasy-chip-remove" @click="removeFromEntrega(i)">×</button>
          </li>
          <li v-if="!flowEntrega.length" class="text-xs text-muted">Nadie asignado.</li>
        </ul>
      </div>

      <div class="rounded-xl border border-line bg-surface/60 p-3">
        <div class="flex items-center justify-between">
          <span class="deasy-eyebrow">Firma (pasos en orden)</span>
          <button type="button" class="text-xs font-semibold text-primary hover:text-primary" @click="openFlowPicker('firma:new')">+ Agregar paso</button>
        </div>
        <div v-for="(step, si) in flowFirma" :key="`fs-${si}`" class="mt-2 deasy-card p-2">
          <div class="flex items-center justify-between gap-2">
            <span class="text-[0.65rem] font-bold uppercase tracking-wide text-muted">Paso {{ si + 1 }}</span>
            <div class="flex items-center gap-1.5">
              <template v-if="step.signers.length > 1">
                <select v-model="step.approval_mode" aria-label="Modo de aprobación del paso" class="rounded-xl border border-line bg-white px-2 py-1 text-[0.7rem] font-semibold text-icon outline-none">
                  <option value="and">Firman todas</option>
                  <option value="or">Cualquiera</option>
                  <option value="at_least">Mínimo</option>
                </select>
                <input v-if="step.approval_mode === 'at_least'" v-model.number="step.required_min" type="number" min="1" :max="step.signers.length" aria-label="Número mínimo de firmas del paso" class="w-14 rounded-xl border border-line bg-white px-2 py-1 text-[0.7rem] text-body outline-none" />
              </template>
              <button type="button" class="deasy-inline-action deasy-inline-action--danger" @click="removeFirmaStep(si)">Quitar</button>
            </div>
          </div>
          <ul class="mt-1.5 flex flex-wrap gap-2 list-none m-0 p-0">
            <li v-for="(sg, gi) in step.signers" :key="`sg-${si}-${gi}`" class="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-sm font-medium text-body">
              {{ sg.label }}
              <button type="button" class="deasy-chip-remove" @click="removeSignerFromStep(si, gi)">×</button>
            </li>
          </ul>
          <button type="button" class="deasy-inline-action deasy-inline-action--primary mt-1.5" @click="openFlowPicker(`firma:${si}`)">+ Añadir firmante a este paso</button>
        </div>
        <p v-if="!flowFirma.length" class="m-0 mt-2 text-xs text-muted">Sin firma. Usa “+ Agregar paso” si el documento debe firmarse.</p>
      </div>

      <div v-if="flowPickerTarget" class="flex flex-col gap-2 rounded-xl border border-brand-200 bg-brand-50/40 p-3">
        <p class="m-0 text-[0.7rem] font-semibold text-primary">
          {{ flowPickerTarget === 'entrega' ? 'Quién elabora' : (flowPickerTarget === 'firma:new' ? 'Nuevo paso de firma' : 'Añadir firmante al paso') }}
        </p>
        <div class="inline-flex self-start deasy-card p-0.5 text-xs font-semibold">
          <button type="button" :class="flowPickerMode === 'person' ? 'bg-brand-600 text-white' : 'text-muted'" class="rounded-xl px-3 py-1" @click="flowPickerMode = 'person'">Persona</button>
          <button type="button" :class="flowPickerMode === 'cargo' ? 'bg-brand-600 text-white' : 'text-muted'" class="rounded-xl px-3 py-1" @click="flowPickerMode = 'cargo'">Por cargo</button>
        </div>

        <div v-if="flowPickerMode === 'person'" class="relative flex flex-col gap-1">
          <input
            v-model="recipientQuery"
            type="text"
            aria-label="Buscar persona por nombre, cédula o correo"
            placeholder="Busca por nombre, cédula o correo…"
            class="rounded-2xl border border-brand-300 bg-white px-3 py-2 text-sm font-medium text-body outline-none"
            @input="searchRecipients"
          />
          <ul v-if="recipientResults.length" class="absolute top-full left-0 right-0 z-10 mt-1 max-h-56 overflow-auto deasy-card shadow-lg list-none m-0 p-1">
            <li v-for="person in recipientResults" :key="`fp-${person.id}`">
              <button type="button" class="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-body hover:bg-blue-light-50" @click="addFlowPerson(person)">
                {{ person.full_name }}
                <span class="text-xs text-muted">· {{ person.cedula || person.email || '' }}</span>
              </button>
            </li>
          </ul>
          <p v-else-if="recipientSearching" class="m-0 text-xs text-muted">Buscando…</p>
        </div>

        <div v-else class="flex flex-col gap-2">
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <select v-model="flowCargoForm.cargoId" aria-label="Cargo" class="deasy-card px-3 py-2 text-sm font-medium text-body outline-none">
              <option :value="null" disabled>Cargo…</option>
              <option v-for="c in flowCatalog.cargos" :key="`c-${c.id}`" :value="c.id">{{ c.name }}</option>
            </select>
            <select v-model="flowCargoForm.unitId" aria-label="Unidad" class="deasy-card px-3 py-2 text-sm font-medium text-body outline-none">
              <option :value="null">Todas las unidades</option>
              <option v-for="u in flowCatalog.units" :key="`u-${u.id}`" :value="u.id">{{ u.name }}</option>
            </select>
          </div>
          <button type="button" class="self-start rounded-2xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50" :disabled="!flowCargoForm.cargoId" @click="addFlowCargo">Agregar</button>
        </div>
      </div>
    </section>

    <!-- Destino y plazo -->
    <section v-if="generalTaskForm.mode === 'free'" class="flex flex-col gap-3 rounded-2xl border border-line/80 bg-white p-4">
      <div class="flex items-center gap-2">
        <span class="inline-flex h-7 w-7 items-center justify-center rounded-2xl bg-brand-50 text-primary"><IconBuildingMonument class="h-4 w-4" /></span>
        <h6 class="m-0 text-sm font-black uppercase tracking-wider text-body">Destino y plazo</h6>
      </div>
      <div class="grid grid-cols-1 gap-3" :class="showSenderUnitSelect ? 'sm:grid-cols-2' : ''">
        <!-- Unidad emisora: solo se elige cuando el usuario pertenece a más de una. -->
        <label v-if="showSenderUnitSelect" class="flex flex-col gap-1">
          <span class="deasy-eyebrow">Unidad emisora *</span>
          <select v-model="generalTaskForm.unitId" class="deasy-card px-3 py-2 text-sm font-medium text-body outline-none">
            <option :value="null" disabled>Selecciona una unidad</option>
            <option v-for="unit in senderUnits" :key="unit.id" :value="unit.id">{{ unit.name }}</option>
          </select>
        </label>
        <label class="flex flex-col gap-1">
          <span class="deasy-eyebrow">Fecha de vencimiento <span class="font-medium normal-case tracking-normal text-gray-300">(opcional)</span></span>
          <input v-model="generalTaskForm.endDate" type="date" class="deasy-card px-3 py-2 text-sm font-medium text-body outline-none" />
        </label>
      </div>
      <p class="m-0 text-[0.7rem] font-medium text-muted">
        Se emite<template v-if="senderUnitName"> desde <strong class="font-semibold text-muted">{{ senderUnitName }}</strong></template> con fecha de hoy. Indica un vencimiento solo si debe atenderse antes de una fecha.
      </p>
    </section>
  </div>
  <template #footer>
    <AppButton variant="cancel" data-modal-dismiss>Cancelar</AppButton>
    <AppButton variant="primary" :disabled="generalTaskSubmitting || !generalTaskForm.title.trim()" @click="$emit('submit')">
      {{ generalTaskSubmitting
        ? 'Creando…'
        : (generalTaskForm.itemMode === 'routed'
          ? 'Enviar'
          : (generalTaskForm.itemMode === 'replicated'
            ? 'Agregar réplica'
            : (generalTaskForm.mode === 'derived' ? 'Crear entregable' : 'Crear tarea'))) }}
    </AppButton>
  </template>
</AppModalShell>
</template>

<script setup>
// Modal "Nueva tarea / Enviar entregable": formulario + flow-builder routed + buscador de
// destinatarios. Extraido de HomeView.vue en la Fase C (paso 2). La LOGICA vive en el composable
// useGeneralTask (paso 1); este componente es PRESENTACIONAL.
//
// El AppModalShell se queda AQUI y su ref (que controla el show/hide via Bootstrap) se recibe
// como prop `modalRef` y se enlaza con :ref, para que useGeneralTask (en HomeView) siga abriendo
// y cerrando el modal sin cambios. Los objetos reactivos (generalTaskForm, flowCargoForm, pasos
// de flowFirma) se pasan como props y sus campos se v-modelan por mutacion anidada (reactivo en
// Vue). Los dos v-model de PRIMITIVOS (recipientQuery, flowPickerMode) usan defineModel.
import AppModalShell from '@/shared/components/modals/AppModalShell.vue';
import AppButton from '@/shared/components/buttons/AppButton.vue';
import AppTag from '@/shared/components/data/AppTag.vue';
import { ref } from 'vue';
import { IconFileDescription, IconBuildingMonument, IconSend } from '@tabler/icons-vue';

const recipientQuery = defineModel('recipientQuery', { type: String, default: '' });
const flowPickerMode = defineModel('flowPickerMode', { type: String, default: 'person' });
const generalTaskForm = defineModel('generalTaskForm', { type: Object, required: true });
const flowCargoForm = defineModel('flowCargoForm', { type: Object, required: true });

defineProps({
  generalTaskModalTitle: { type: String, default: '' },
  generalTaskError: { type: String, default: '' },
  generalTaskSubmitting: { type: Boolean, default: false },
  flowEntrega: { type: Array, default: () => [] },
  flowFirma: { type: Array, default: () => [] },
  flowPickerTarget: { type: [String, null], default: null },
  flowCatalog: { type: Object, default: () => ({ units: [], cargos: [] }) },
  recipientResults: { type: Array, default: () => [] },
  recipientSearching: { type: Boolean, default: false },
  senderUnits: { type: Array, default: () => [] },
  showSenderUnitSelect: { type: Boolean, default: false },
  senderUnitName: { type: String, default: '' },
  isSendFlowModal: { type: Boolean, default: false },
  openFlowPicker: { type: Function, required: true },
  addFlowPerson: { type: Function, required: true },
  addFlowCargo: { type: Function, required: true },
  removeFromEntrega: { type: Function, required: true },
  removeFirmaStep: { type: Function, required: true },
  removeSignerFromStep: { type: Function, required: true },
  searchRecipients: { type: Function, required: true },
});

defineEmits(['submit']);

// El show/hide del modal lo gobierna useGeneralTask (en HomeView) via el `.el` del
// AppModalShell. Se expone aqui para que el padre, con ref en <GeneralTaskModal>, lo alcance.
const shellRef = ref(null);
defineExpose({ get el() { return shellRef.value?.el ?? null; } });
</script>
