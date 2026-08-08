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

// Color del punto del timeline y del texto del tipo, según la clase de observación.
const dotClass = (observation) => {
  if (observation.resolved_at) return 'bg-emerald-400';
  return {
    return_reason: 'bg-amber-400',
    rejection_reason: 'bg-rose-400',
    internal_note: 'bg-slate-300',
    observation: 'bg-sky-400',
  }[observation.kind] || 'bg-sky-400';
};
const kindTextClass = (kind) => ({
  return_reason: 'text-amber-600',
  rejection_reason: 'text-rose-600',
  internal_note: 'text-slate-400',
  observation: 'text-sky-600',
}[kind] || 'text-sky-600');

const formatObsDate = (value) => String(value || '').toString().slice(0, 16).replace('T', ' ');

const onAdd = () => {
  const message = draft.value.trim();
  if (!message || props.submitting) return;
  emit('add', { message, phase: props.phase });
  draft.value = '';
};
</script>

<template>
  <section class="rounded-2xl border border-slate-200 bg-white p-4">
    <div class="flex items-center gap-1.5">
      <h3 class="m-0 text-sm font-bold uppercase tracking-wider text-slate-700">{{ title }}</h3>
      <IconInfoCircle v-if="subtitle" class="h-4 w-4 text-slate-400" :title="subtitle" />
    </div>

    <div v-if="loading" class="mt-4 text-sm text-slate-500">Cargando observaciones...</div>
    <template v-else>
      <div
        v-if="!observations.length"
        class="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-sm font-medium text-slate-500"
      >
        {{ emptyText }}
      </div>
      <ul v-else class="relative mt-4 m-0 flex flex-col gap-4 list-none border-l border-slate-200 pl-4">
        <li
          v-for="observation in observations"
          :key="`obs-${observation.id}`"
          class="relative"
        >
          <span class="absolute -left-[1.42rem] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white" :class="dotClass(observation)"></span>
          <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span class="text-xs font-bold text-slate-700">{{ observation.author_name || 'Sistema' }}</span>
            <span class="text-[11px] font-semibold uppercase tracking-wide" :class="kindTextClass(observation.kind)">{{ kindLabel(observation.kind) }}</span>
            <span class="text-[11px] text-slate-400">{{ formatObsDate(observation.created_at) }}</span>
            <span v-if="observation.resolved_at" class="text-[11px] font-semibold text-emerald-600">· Resuelta</span>
          </div>
          <p class="m-0 mt-1 text-sm whitespace-pre-line" :class="observation.resolved_at ? 'text-slate-400' : 'text-slate-700'">{{ observation.message }}</p>
          <p v-if="observation.resolved_at" class="m-0 mt-0.5 text-[11px] text-slate-400">Resuelta por {{ observation.resolved_by_name || '—' }}</p>
          <button
            v-else-if="observation.can_resolve"
            type="button"
            class="mt-1 text-xs font-semibold text-sky-600 transition hover:text-sky-700 disabled:opacity-50"
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
          class="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="Escribe una observación para el hilo..."
        ></textarea>
        <div class="flex justify-end">
          <AppButton
            variant="outlinePrimary"
            size="sm"
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
