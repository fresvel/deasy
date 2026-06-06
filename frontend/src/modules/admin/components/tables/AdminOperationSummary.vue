<template>
  <div v-if="cards.length" class="mb-6">
    <h3 class="m-0 mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Resumen de operación</h3>
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div v-for="card in cards" :key="card.key" class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p class="m-0 mb-3 text-sm font-bold text-slate-700">{{ card.title }}</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="chip in card.chips"
            :key="chip.label"
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-sky-300 hover:bg-sky-50"
            :class="{ 'opacity-50': !chip.count }"
            :title="`Abrir ${card.title.toLowerCase()}${chip.filters ? ' · ' + chip.label.toLowerCase() : ''}`"
            @click="$emit('open', card.table, chip.filters)"
          >
            <span>{{ chip.label }}</span>
            <span class="rounded bg-white px-1.5 py-0.5 font-bold text-slate-800 ring-1 ring-slate-200">{{ chip.count }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  stats: { type: Object, default: null }
});
defineEmits(["open"]);

const n = (map, key) => Number(map?.[key] || 0);

// Tarjetas derivadas de los conteos del backend. Cada chip abre su tabla; filtra por estado cuando la columna
// es texto (tasks/documents/fill_requests). Para firmas (estado por FK) y "vencidas" (derivado) abre sin filtro.
const cards = computed(() => {
  const stats = props.stats || {};
  const list = [];

  if (stats.tasks) {
    const by = stats.tasks.byStatus || {};
    list.push({
      key: "tasks",
      title: "Tareas",
      table: "tasks",
      chips: [
        { label: "Pendientes", count: n(by, "pendiente"), filters: { status: "pendiente" } },
        { label: "En proceso", count: n(by, "en_proceso"), filters: { status: "en_proceso" } },
        { label: "Vencidas", count: Number(stats.tasks.overdue || 0), filters: null }
      ]
    });
  }

  if (stats.documents) {
    const by = stats.documents.byStatus || {};
    list.push({
      key: "documents",
      title: "Documentos",
      table: "documents",
      chips: [
        { label: "En proceso", count: n(by, "En proceso"), filters: { status: "En proceso" } },
        { label: "Observado", count: n(by, "Observado"), filters: { status: "Observado" } },
        { label: "Listo para firma", count: n(by, "Listo para firma"), filters: { status: "Listo para firma" } },
        { label: "Firmado completo", count: n(by, "Firmado completo"), filters: { status: "Firmado completo" } }
      ]
    });
  }

  if (stats.deliveries) {
    const by = stats.deliveries.byStatus || {};
    list.push({
      key: "deliveries",
      title: "Entregas",
      table: "fill_requests",
      chips: [
        { label: "Pendientes", count: n(by, "pending"), filters: { status: "pending" } },
        { label: "En proceso", count: n(by, "in_progress"), filters: { status: "in_progress" } },
        { label: "Observadas", count: n(by, "returned"), filters: { status: "returned" } },
        { label: "Aprobadas", count: n(by, "approved"), filters: { status: "approved" } }
      ]
    });
  }

  if (stats.signatures) {
    const by = stats.signatures.byStatus || {};
    list.push({
      key: "signatures",
      title: "Firmas",
      table: "signature_flow_instances",
      chips: [
        { label: "Pendientes", count: n(by, "pendiente"), filters: null },
        { label: "Parciales", count: n(by, "en_progreso"), filters: null },
        { label: "Completadas", count: n(by, "completado"), filters: null }
      ]
    });
  }

  return list;
});
</script>
