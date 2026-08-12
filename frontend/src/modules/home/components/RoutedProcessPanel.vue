<template>
  <section class="flex flex-col gap-5">
    <!-- Barra de acción: propósito + botón principal. El título del proceso lo pone la cabecera de la página. -->
    <div class="overflow-hidden rounded-[1.75rem] border border-indigo-100 bg-linear-to-br from-indigo-50/70 via-white to-sky-50/50 shadow-sm">
      <div class="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
        <div class="flex items-start gap-3.5">
          <span class="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-indigo-100 bg-white text-indigo-600 shadow-sm">
            <IconSend class="h-6 w-6" />
          </span>
          <div class="flex min-w-0 flex-col">
            <h3 class="m-0 text-sm font-black uppercase tracking-wider text-indigo-500">Mis documentos</h3>
            <p class="m-0 mt-1 max-w-xl text-sm font-medium text-slate-500">{{ purpose }}</p>
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <button
            type="button"
            class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
            title="Actualizar"
            aria-label="Actualizar"
            @click="$emit('refresh')"
          >
            <IconRefresh class="h-5 w-5" :class="loading ? 'animate-spin' : ''" />
          </button>
          <AppButton variant="primary" @click="$emit('create')">
            <span class="inline-flex items-center gap-1.5"><IconPlus class="h-4.5 w-4.5" /> {{ createLabel }}</span>
          </AppButton>
        </div>
      </div>
    </div>

    <!-- Pestañas: enviados / recibidos -->
    <div class="flex items-center gap-1.5 rounded-2xl border border-brand-border/80 bg-white p-1.5 shadow-sm">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        class="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition"
        :class="activeTab === tab.key
          ? 'bg-indigo-600 text-white shadow-sm'
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'"
        @click="activeTab = tab.key"
      >
        <component :is="tab.icon" class="h-4.5 w-4.5" />
        {{ tab.label }}
        <span
          class="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-black"
          :class="activeTab === tab.key ? 'bg-brand-white/25 text-white' : 'bg-slate-100 text-slate-500'"
        >{{ tab.items.length }}</span>
      </button>
    </div>

    <!-- Contenido -->
    <div v-if="loading" class="rounded-2xl border border-sky-100 bg-sky-50/60 p-6 text-center text-sm font-semibold text-action-view animate-pulse">
      Cargando…
    </div>

    <div
      v-else-if="!activeItems.length"
      class="flex flex-col items-center gap-3 rounded-[1.5rem] border-2 border-dashed border-slate-200 bg-brand-surface-muted/50 px-6 py-12 text-center"
    >
      <span class="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-300">
        <component :is="activeTab === 'sends' ? IconSend : IconInbox" class="h-7 w-7" />
      </span>
      <p class="m-0 text-sm font-bold text-brand-icon">{{ emptyTitle }}</p>
      <p class="m-0 max-w-sm text-xs font-medium text-brand-text-muted">{{ emptyHint }}</p>
      <AppButton v-if="activeTab === 'sends'" variant="softPrimary" size="sm" class="mt-1" @click="$emit('create')">
        <span class="inline-flex items-center gap-1.5"><IconPlus class="h-4 w-4" /> {{ createLabel }}</span>
      </AppButton>
    </div>

    <ul v-else class="m-0 flex list-none flex-col gap-2.5 p-0">
      <li
        v-for="item in activeItems"
        :key="item.id"
        class="group flex items-center gap-3.5 rounded-2xl border border-brand-border/80 bg-white px-4 py-3.5 shadow-[0_6px_16px_rgba(15,23,42,0.04)] transition hover:border-indigo-200 hover:shadow-[0_10px_24px_rgba(79,70,229,0.08)]"
      >
        <span
          class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
          :class="activeTab === 'sends' ? 'border-indigo-100 bg-indigo-50/70 text-indigo-600' : 'border-emerald-100 bg-emerald-50/70 text-emerald-600'"
        >
          <component :is="activeTab === 'sends' ? IconSend : IconInbox" class="h-5 w-5" />
        </span>
        <div class="flex min-w-0 flex-1 flex-col">
          <p class="m-0 truncate text-sm font-bold text-slate-800">{{ item.label || 'Documento sin título' }}</p>
          <p class="m-0 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium text-slate-500">
            <span class="inline-flex items-center gap-1">
              <IconUser class="h-3.5 w-3.5 text-brand-text-muted" />
              {{ activeTab === 'sends' ? 'Para' : 'De' }}: <strong class="font-semibold text-brand-icon">{{ personName(item) }}</strong>
            </span>
            <span class="text-slate-300">·</span>
            <span>{{ formatDate(item.created_at) }}</span>
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-1.5">
          <AppTag v-if="activeTab === 'received' && receivedRole(item)" :variant="receivedRole(item).tone">{{ receivedRole(item).label }}</AppTag>
          <AppTag :variant="statusMeta(item).tone">{{ statusMeta(item).label }}</AppTag>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { IconSend, IconInbox, IconPlus, IconRefresh, IconUser } from '@tabler/icons-vue';
import AppButton from '@/shared/components/buttons/AppButton.vue';
import AppTag from '@/shared/components/data/AppTag.vue';

const props = defineProps({
  purpose: { type: String, default: 'Crea y endosa un documento a una persona. Lo recibido aparece en Recibidos y en tu Centro de firmas.' },
  createLabel: { type: String, default: 'Nuevo envío' },
  sends: { type: Array, default: () => [] },
  received: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
});

defineEmits(['create', 'refresh']);

const activeTab = ref('sends');

const tabs = computed(() => [
  { key: 'sends', label: 'Mis envíos', icon: IconSend, items: props.sends },
  { key: 'received', label: 'Recibidos', icon: IconInbox, items: props.received },
]);

const activeItems = computed(() => (activeTab.value === 'sends' ? props.sends : props.received));

const emptyTitle = computed(() => (activeTab.value === 'sends'
  ? 'Aún no has enviado nada'
  : 'No has recibido documentos'));
const emptyHint = computed(() => (activeTab.value === 'sends'
  ? `Usa “${props.createLabel}” para crear y endosar tu primer documento.`
  : 'Cuando alguien te endose un documento de este tipo, aparecerá aquí.'));

const personName = (item) => item.recipient_name || item.sender_name || 'Sin destinatario';

// Qué debe hacer el usuario con un recibido: elaborarlo, firmarlo, o solo lo recibió como destinatario.
const receivedRole = (item) => {
  if (item.needs_fill) return { tone: 'info', label: 'Elaborar' };
  if (item.needs_sign) return { tone: 'warning', label: 'Firmar' };
  if (item.is_recipient) return { tone: 'neutral', label: 'Para ti' };
  return null;
};

// Estado del documento/ítem → chip. Mapeo tolerante: éxito (firmado/completo), en curso, y neutro por defecto.
const statusMeta = (item) => {
  const raw = String(item.document_status || item.status || '').toLowerCase();
  if (['signed', 'firmado', 'completed', 'completado', 'done', 'closed', 'finalizado'].some((s) => raw.includes(s))) {
    return { tone: 'success', label: 'Completado' };
  }
  if (['pending', 'pendiente', 'in_progress', 'en_proceso', 'en curso', 'sent', 'enviado', 'active', 'activo'].some((s) => raw.includes(s))) {
    return { tone: 'warning', label: 'En curso' };
  }
  if (['draft', 'borrador'].some((s) => raw.includes(s))) {
    return { tone: 'neutral', label: 'Borrador' };
  }
  return { tone: 'neutral', label: raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Sin estado' };
};

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
};
</script>
