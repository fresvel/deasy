<template>
  <section class="flex flex-col gap-5">
    <!-- Barra de acción: propósito + botón principal. El título del proceso lo pone la cabecera de la página. -->
    <div class="overflow-hidden rounded-2xl border border-brand-100 bg-linear-to-br from-brand-50/70 via-white to-blue-light-50/50">
      <div class="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
        <div class="flex items-start gap-3.5">
          <span class="deasy-icon-box deasy-icon-box--lg deasy-icon-box--outlined">
            <IconSend class="h-6 w-6" />
          </span>
          <div class="flex min-w-0 flex-col">
            <h3 class="deasy-title deasy-title--section text-primary">Mis documentos</h3>
            <p class="m-0 mt-1 max-w-xl text-sm font-medium text-muted">{{ purpose }}</p>
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <AppButton
            variant="neutral-outline"
            icon-only
            title="Actualizar"
            aria-label="Actualizar"
            @click="$emit('refresh')"
          >
            <IconRefresh class="h-5 w-5" :class="loading ? 'animate-spin' : ''" />
          </AppButton>
          <AppButton variant="primary-outline" @click="$emit('create')">
            <span class="inline-flex items-center gap-1.5"><IconPlus class="h-4.5 w-4.5" /> {{ createLabel }}</span>
          </AppButton>
        </div>
      </div>
    </div>

    <!-- Pestañas: enviados / recibidos -->
    <div class="deasy-section-nav-group w-full">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        class="deasy-section-nav flex-1 justify-center"
        :class="{ 'deasy-section-nav--active': activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        <component :is="tab.icon" class="h-4.5 w-4.5" />
        {{ tab.label }}
        <span
          class="deasy-icon-box deasy-icon-box--sm deasy-icon-box--round"
          :class="activeTab === tab.key ? 'bg-white/25 text-white' : 'bg-surface text-muted'"
        >{{ tab.items.length }}</span>
      </button>
    </div>

    <!-- Contenido -->
    <div v-if="loading" class="rounded-2xl border border-blue-light-100 bg-blue-light-50/60 p-6 text-center text-sm font-semibold text-info animate-pulse">
      Cargando…
    </div>

    <div
      v-else-if="!activeItems.length"
      class="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-line bg-surface/50 px-6 py-12 text-center"
    >
      <span class="inline-flex h-14 w-14 items-center justify-center deasy-card text-gray-300">
        <component :is="activeTab === 'sends' ? IconSend : IconInbox" class="h-7 w-7" />
      </span>
      <p class="m-0 text-sm font-bold text-icon">{{ emptyTitle }}</p>
      <p class="m-0 max-w-sm text-xs font-medium text-muted">{{ emptyHint }}</p>
      <AppButton v-if="activeTab === 'sends'" variant="primary-soft" class="mt-1" @click="$emit('create')">
        <span class="inline-flex items-center gap-1.5"><IconPlus class="h-4 w-4" /> {{ createLabel }}</span>
      </AppButton>
    </div>

    <ul v-else class="m-0 flex list-none flex-col gap-2.5 p-0">
      <li
        v-for="item in activeItems"
        :key="item.id"
        class="deasy-card group flex items-center gap-3.5 px-4 py-3.5 transition hover:border-brand-200 hover:shadow-[0_10px_24px_rgba(79,70,229,0.08)]"
      >
        <span
          class="deasy-icon-box deasy-icon-box--lg"
          :class="activeTab === 'sends' ? 'deasy-icon-box--primary' : 'deasy-icon-box--success'"
        >
          <component :is="activeTab === 'sends' ? IconSend : IconInbox" class="h-5 w-5" />
        </span>
        <div class="flex min-w-0 flex-1 flex-col">
          <p class="m-0 truncate text-sm font-bold text-strong">{{ item.label || 'Documento sin título' }}</p>
          <p class="m-0 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium text-muted">
            <span class="inline-flex items-center gap-1">
              <IconUser class="h-3.5 w-3.5 text-muted" />
              {{ activeTab === 'sends' ? 'Para' : 'De' }}: <strong class="font-semibold text-icon">{{ personName(item) }}</strong>
            </span>
            <span class="text-gray-300">·</span>
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
import { tonoFlujo, etiquetaFlujo } from '@/shared/utils/estadoTono.js';

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

/* Estado del documento/item -> chip. Antes hacia su propio mapeo TOLERANTE con `includes()`
   sobre tres listas escritas a mano, que era la cuarta traduccion del mismo estado del repo y
   la unica que pintaba `activo` en ambar («En curso») cuando el resto del sistema lo da en
   verde. Ahora el tono sale de `tonoFlujo` y la etiqueta de `etiquetaFlujo`; el `includes()`
   sobraba porque los tres vocabularios reales estan declarados en `sqlTables.js` y los tres
   estan en el diccionario. */
const statusMeta = (item) => {
  const raw = String(item.document_status || item.status || '').trim();
  if (!raw) return { tone: 'neutral', label: 'Sin estado' };
  return { tone: tonoFlujo(raw), label: etiquetaFlujo(raw) };
};

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
};
</script>
