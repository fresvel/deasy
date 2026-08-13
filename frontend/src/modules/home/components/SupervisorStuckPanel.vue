<template>
  <!-- Solo se muestra a quien encabeza alguna unidad (is_supervisor). Si no, no renderiza nada. -->
  <section
    v-if="isSupervisor"
    class="bg-white rounded-xl shadow-elev-2 shadow-line/40 p-5 md:p-6 border border-line flex flex-col gap-4"
  >
    <div class="flex items-start justify-between gap-3">
      <div>
        <h2 class="m-0 text-base font-bold text-strong">Supervisión — entregables atascados</h2>
        <p class="m-0 mt-0.5 text-xs font-medium text-muted">
          Entregables abiertos en tus unidades (y sus dependencias) que no tienen responsable o cuyo titular ya no ocupa el puesto.
        </p>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-1 rounded-2xl border border-line px-2.5 py-1 text-xs font-semibold text-icon transition hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50"
        :disabled="loading"
        @click="load"
      >↻ Actualizar</button>
    </div>

    <div v-if="loading" class="rounded-xl border border-line bg-surface px-4 py-4 text-sm font-medium text-muted">
      Cargando…
    </div>
    <div v-else-if="error" class="deasy-alert deasy-alert--danger">
      {{ error }}
    </div>
    <div v-else-if="!items.length" class="deasy-alert deasy-alert--success">
      Sin entregables atascados. Todo asignado. ✓
    </div>

    <div v-else class="flex flex-col gap-4">
      <div v-for="group in grouped" :key="group.unit_id ?? 'sin-unidad'" class="flex flex-col gap-2">
        <h3 class="deasy-eyebrow">{{ group.unit_name || 'Sin unidad' }}</h3>
        <div
          v-for="item in group.items"
          :key="item.id"
          class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface/60 px-3 py-2.5"
        >
          <div class="flex flex-col">
            <span class="text-sm font-semibold text-body">
              {{ item.cargo_name || 'Cargo' }} · entregable #{{ item.id }}
            </span>
            <span class="text-xs font-medium text-muted">Estado: {{ item.status }}</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-semibold"
              :class="item.reason === 'sin_responsable' ? 'bg-amber-100 text-warning' : 'bg-rose-100 text-danger'"
            >{{ item.reason === 'sin_responsable' ? 'Sin responsable' : 'Titular se fue' }}</span>
            <span
              v-if="item.started"
              class="inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-[0.65rem] font-semibold text-primary"
            >Iniciado</span>
          </div>
        </div>
      </div>
      <p class="m-0 text-[0.7rem] text-muted">
        Total atascados: <span class="font-semibold text-icon">{{ items.length }}</span>. La reasignación (traspaso) se habilitará desde aquí en el siguiente paso.
      </p>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import axios from "@/core/services/httpClient";
import { API_ROUTES } from "@/core/config/apiConfig";

const isSupervisor = ref(false);
const items = ref([]);
const loading = ref(false);
const error = ref("");

const grouped = computed(() => {
  const map = new Map();
  for (const it of items.value) {
    const key = it.unit_id ?? 0;
    if (!map.has(key)) map.set(key, { unit_id: it.unit_id, unit_name: it.unit_name, items: [] });
    map.get(key).items.push(it);
  }
  return [...map.values()];
});

const load = async () => {
  loading.value = true;
  error.value = "";
  try {
    const { data } = await axios.get(API_ROUTES.TAREA_SUPERVISED_STUCK);
    isSupervisor.value = Boolean(data?.is_supervisor);
    items.value = Array.isArray(data?.items) ? data.items : [];
  } catch {
    error.value = "No se pudo cargar la supervisión.";
  } finally {
    loading.value = false;
  }
};

onMounted(load);
</script>
