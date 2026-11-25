<template>
  <div class="flex flex-col gap-4">
    <section class="deasy-card p-4">
      <div class="flex flex-col gap-2">
        <h3 class="deasy-title deasy-title--section">Historial de responsables</h3>
        <p class="m-0 text-xs font-medium text-muted">
          Por qué este entregable cambió de manos. Los relevos por ocupación de puesto ocurren solos.
        </p>
      </div>

      <AppAlert class="mt-3" v-if="error">{{ error }}</AppAlert>

      <AppEmpty v-else-if="loading" :icon="false" class="mt-4 animate-pulse">
        Cargando historial...
      </AppEmpty>

      <AppEmpty v-else-if="!items.length" :icon="false" class="mt-4">
        Este entregable no ha cambiado de responsable.
      </AppEmpty>

      <ol v-else class="mt-4 flex flex-col gap-2">
        <li
          v-for="relevo in items"
          :key="`relevo-${relevo.id}`"
          class="deasy-card flex items-start gap-3 px-3 py-2.5"
        >
          <!-- La caja de icono es un bloque del sistema desde F3.1: `--md` son sus 36 px y `--neutral`
               su gris. Escrita a mano llegaba con `text-muted` en vez de `text-icon` — el mismo papel con
               dos tokens, que es justo lo que el bloque existe para evitar. -->
          <span class="deasy-icon-box deasy-icon-box--md deasy-icon-box--neutral shrink-0">
            <IconArrowsExchange class="h-4.5 w-4.5" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="m-0 text-sm font-semibold text-strong">
              {{ nombre(relevo.from_person_name) }}
              <span class="mx-1 text-muted">→</span>
              {{ nombre(relevo.to_person_name) }}
            </p>
            <p class="m-0 mt-0.5 flex flex-wrap items-center gap-2 text-xs font-medium text-muted">
              <span class="rounded bg-brand-50 px-1.5 py-0.5 font-semibold text-primary">
                {{ CAUSAS[relevo.trigger_kind] || relevo.trigger_kind }}
              </span>
              <span>{{ fecha(relevo.created_at) }}</span>
            </p>
          </div>
        </li>
      </ol>
    </section>
  </div>
</template>

<script setup>
import AppEmpty from "@/shared/components/feedback/AppEmpty.vue";
// Pestaña HISTORIAL del modal de detalle del entregable: contesta «¿por qué esto, que era de Juan,
// ahora es de María?» (defecto 1.10). Hasta el 2026-08-14 la bitácora `task_item_handovers` era de
// SOLO ESCRITURA — cero `SELECT` en todo el repositorio— y además solo registraba el traspaso manual;
// los relevos automáticos, que son la mayoría, no dejaban rastro.
//
// ⚠️ ES AUTOCONTENIDA A PROPÓSITO, y ahí se aparta de sus hermanas. `DeliverableAttachmentsTab`,
// `DeliverableFillTab` y `DeliverableSignatureTab` son PRESENTACIONALES: reciben todo por props y su
// lógica vive en `HomeView.vue`. Seguir ese patrón aquí habría añadido estado y una petición más a un
// componente de 5.130 líneas que el **frente 3 del plan maestro** quiere partir. Así `HomeView` solo
// paga el import y el montaje.
//
// Es de SOLO LECTURA: desde aquí no se traspasa nada. El traspaso manual vive en el espacio de admin,
// que es donde está su permiso.
import { ref, watch } from 'vue';
import { IconArrowsExchange } from '@tabler/icons-vue';
import httpClient from '@/core/services/httpClient.js';
import { API_ROUTES } from '@/core/config/apiConfig.js';
import { resolveApiErrorMessage } from '@/shared/utils/apiError.js';
import AppAlert from "@/shared/components/feedback/AppAlert.vue";

const props = defineProps({
  userId: { type: [Number, String], default: null },
  definitionId: { type: [Number, String], default: null },
  taskItemId: { type: [Number, String], default: null },
});

// El vocabulario de causas del esquema, en lenguaje de la persona que lo lee. `position_deactivated`
// no lo emite nadie todavía (no hay camino que desactive un puesto reasignando), pero se traduce
// igual: el día que exista, esta pestaña no tendrá que cambiar.
const CAUSAS = {
  occupancy_start: 'Ocupó el puesto',
  occupancy_end: 'Dejó el puesto',
  position_deactivated: 'Puesto desactivado',
  reconcile: 'Reconciliación de responsables',
  manual: 'Traspaso manual',
};

const items = ref([]);
const loading = ref(false);
const error = ref('');

// `null` es un estado legítimo, no un fallo: el primer relevo no tiene origen (nadie lo tenía antes)
// y un entregable puede quedarse sin responsable cuando alguien deja el puesto.
const nombre = (valor) => {
  const limpio = String(valor || '').trim();
  return limpio || 'Sin asignar';
};

const fecha = (valor) => {
  if (!valor) return '';
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short' });
};

const cargar = async () => {
  if (!props.userId || !props.definitionId || !props.taskItemId) {
    items.value = [];
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const { data } = await httpClient.get(
      API_ROUTES.USERS_PROCESS_DEFINITION_TASK_ITEM_HANDOVERS(props.userId, props.definitionId, props.taskItemId)
    );
    items.value = Array.isArray(data) ? data : [];
  } catch (e) {
    error.value = resolveApiErrorMessage(e, 'No se pudo cargar el historial del entregable.');
    items.value = [];
  } finally {
    loading.value = false;
  }
};

watch(() => [props.userId, props.definitionId, props.taskItemId], cargar, { immediate: true });
</script>
