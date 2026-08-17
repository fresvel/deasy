<script setup>
import { ref } from 'vue';
import { IconInfoCircle } from '@tabler/icons-vue';
import AppButton from '@/shared/components/buttons/AppButton.vue';

const props = defineProps({
  // Observaciones YA filtradas por fase (entrega o firma) desde el padre.
  observations: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  canAdd: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  resolvingId: { type: [Number, String, null], default: null },
  // 'review' (entrega) | 'signature' (firma): determina la fase al agregar.
  phase: { type: String, default: 'review' },
  title: { type: String, default: 'Observaciones' },
  subtitle: { type: String, default: '' },
  emptyText: { type: String, default: 'Sin observaciones registradas.' },
});

const emit = defineEmits(['add', 'resolve']);

const draft = ref('');

const kindLabel = (kind) => ({
  observation: 'Observación',
  return_reason: 'Devolución',
  rejection_reason: 'Rechazo',
  internal_note: 'Nota interna',
}[kind] || 'Observación');

/* Que CLASE de observacion es —eso es dato— y su tono. El color lo pone `deasy-dot--{tono}`:
   antes esta funcion devolvia la utilidad de fondo, o sea color viviendo en JavaScript. */
const dotClass = (observation) => {
  const tono = observation.resolved_at
    ? 'success'
    : ({
        return_reason: 'warning',
        rejection_reason: 'danger',
        internal_note: 'neutral',
        observation: 'info',
      }[observation.kind] || 'info');
  return `deasy-dot deasy-dot--${tono}`;
};
const kindTextClass = (kind) => ({
  return_reason: 'text-warning',
  rejection_reason: 'text-danger',
  internal_note: 'text-muted',
  observation: 'text-info',
}[kind] || 'text-info');

const formatObsDate = (value) => String(value || '').toString().slice(0, 16).replace('T', ' ');

const onAdd = () => {
  const message = draft.value.trim();
  if (!message || props.submitting) return;
  emit('add', { message, phase: props.phase });
  draft.value = '';
};
</script>

<template>
  <section class="deasy-card p-4">
    <div class="flex items-center gap-1.5">
      <h3 class="m-0 text-sm font-bold uppercase tracking-wider text-body">{{ title }}</h3>
      <IconInfoCircle v-if="subtitle" class="h-4 w-4 text-muted" :title="subtitle" />
    </div>

    <div v-if="loading" class="mt-4 text-sm text-muted">Cargando observaciones...</div>
    <template v-else>
      <div
        v-if="!observations.length"
        class="mt-4 rounded-2xl border border-dashed border-line bg-surface/70 p-5 text-sm font-medium text-muted"
      >
        {{ emptyText }}
      </div>
      <ul v-else class="relative mt-4 m-0 flex flex-col gap-4 list-none border-l border-line pl-4">
        <li
          v-for="observation in observations"
          :key="`obs-${observation.id}`"
          class="relative"
        >
          <span class="absolute -left-[1.42rem] top-1" :class="dotClass(observation)"></span>
          <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span class="text-xs font-bold text-body">{{ observation.author_name || 'Sistema' }}</span>
            <span class="text-theme-xs font-semibold uppercase tracking-wide" :class="kindTextClass(observation.kind)">{{ kindLabel(observation.kind) }}</span>
            <span class="text-theme-xs text-muted">{{ formatObsDate(observation.created_at) }}</span>
            <span v-if="observation.resolved_at" class="text-theme-xs font-semibold text-success">· Resuelta</span>
          </div>
          <p class="m-0 mt-1 text-sm whitespace-pre-line" :class="observation.resolved_at ? 'text-muted' : 'text-body'">{{ observation.message }}</p>
          <p v-if="observation.resolved_at" class="m-0 mt-0.5 text-theme-xs text-muted">Resuelta por {{ observation.resolved_by_name || '—' }}</p>
          <button
            v-else-if="observation.can_resolve"
            type="button"
            class="deasy-inline-action deasy-inline-action--primary mt-1"
            :disabled="resolvingId === observation.id"
            @click="emit('resolve', observation)"
          >
            {{ resolvingId === observation.id ? 'Resolviendo...' : 'Marcar resuelta' }}
          </button>
        </li>
      </ul>

      <div v-if="canAdd" class="mt-4 flex flex-col gap-2">
        <textarea
          v-model="draft"
          rows="2"
          aria-label="Escribe una observación"
          class="border px-3 py-2 text-sm"
          placeholder="Escribe una observación para el hilo..."
        ></textarea>
        <div class="flex justify-end">
          <AppButton
            variant="primary-outline"
            :disabled="!draft.trim() || submitting"
            @click="onAdd"
          >
            {{ submitting ? 'Agregando...' : 'Agregar observación' }}
          </AppButton>
        </div>
      </div>
    </template>
  </section>
</template>
