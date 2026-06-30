<script setup>
import { ref } from 'vue';
import { IconInfoCircle } from '@tabler/icons-vue';
import AppTag from '@/shared/components/data/AppTag.vue';
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
      <ul v-else class="mt-4 flex flex-col gap-2.5 m-0 p-0 list-none">
        <li
          v-for="observation in observations"
          :key="`obs-${observation.id}`"
          class="rounded-2xl border px-4 py-3"
          :class="observation.resolved_at ? 'border-slate-100 bg-slate-50/60' : 'border-slate-200 bg-white'"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="flex flex-wrap items-center gap-2">
              <AppTag variant="neutral">{{ kindLabel(observation.kind) }}</AppTag>
              <span class="text-xs font-medium text-slate-500">{{ observation.author_name || 'Sistema' }} · {{ (observation.created_at || '').toString().slice(0, 16).replace('T', ' ') }}</span>
            </div>
            <span v-if="observation.resolved_at" class="text-xs font-semibold text-emerald-600">Resuelta</span>
          </div>
          <p class="m-0 mt-2 text-sm text-slate-700 whitespace-pre-line">{{ observation.message }}</p>
          <div v-if="observation.resolved_at" class="mt-1 text-xs text-slate-400">
            Resuelta por {{ observation.resolved_by_name || '—' }}
          </div>
          <div v-else-if="observation.can_resolve" class="mt-2 flex justify-end">
            <AppButton
              variant="secondary"
              size="sm"
              :disabled="resolvingId === observation.id"
              @click="emit('resolve', observation)"
            >
              {{ resolvingId === observation.id ? 'Resolviendo...' : 'Marcar resuelta' }}
            </AppButton>
          </div>
        </li>
      </ul>

      <div v-if="canAdd" class="mt-4 flex flex-col gap-2">
        <textarea
          v-model="draft"
          rows="2"
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
