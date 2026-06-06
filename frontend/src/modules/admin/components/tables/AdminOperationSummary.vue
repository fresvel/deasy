<template>
  <div v-if="cards.length" class="mb-6">
    <h3 class="m-0 mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Resumen de operación</h3>
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div
        v-for="card in cards"
        :key="card.key"
        class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
      >
        <div class="mb-3 flex items-start justify-between gap-2">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" :class="card.iconWrap">
              <font-awesome-icon :icon="card.icon" />
            </span>
            <span class="truncate text-sm font-bold text-slate-700">{{ card.title }}</span>
          </div>
          <span class="shrink-0 text-2xl font-extrabold leading-none text-slate-800">{{ card.total }}</span>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="chip in card.chips"
            :key="chip.label"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition-colors"
            :class="[chip.tone, chip.count ? '' : 'opacity-45']"
            :title="`Abrir ${card.title.toLowerCase()}${chip.filters ? ' · ' + chip.label.toLowerCase() : ''}`"
            @click="$emit('open', card.table, chip.filters)"
          >
            <span>{{ chip.label }}</span>
            <span class="font-extrabold">{{ chip.count }}</span>
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

// Tonos por semántica del estado (píldoras con anillo de color suave).
const TONE = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100",
  progress: "bg-sky-50 text-sky-700 ring-sky-200 hover:bg-sky-100",
  warn: "bg-rose-50 text-rose-700 ring-rose-200 hover:bg-rose-100",
  done: "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100",
  info: "bg-indigo-50 text-indigo-700 ring-indigo-200 hover:bg-indigo-100"
};

const sumChips = (chips) => chips.reduce((acc, chip) => acc + Number(chip.count || 0), 0);

const cards = computed(() => {
  const stats = props.stats || {};
  const list = [];

  if (stats.tasks) {
    const by = stats.tasks.byStatus || {};
    const chips = [
      { label: "Pendientes", count: n(by, "pendiente"), tone: TONE.pending, filters: { status: "pendiente" } },
      { label: "En proceso", count: n(by, "en_proceso"), tone: TONE.progress, filters: { status: "en_proceso" } },
      { label: "Vencidas", count: Number(stats.tasks.overdue || 0), tone: TONE.warn, filters: null }
    ];
    list.push({ key: "tasks", title: "Tareas", table: "tasks", icon: "square-check", iconWrap: "bg-sky-100 text-sky-600", total: sumChips(chips), chips });
  }

  if (stats.documents) {
    const by = stats.documents.byStatus || {};
    const chips = [
      { label: "En proceso", count: n(by, "En proceso"), tone: TONE.progress, filters: { status: "En proceso" } },
      { label: "Observado", count: n(by, "Observado"), tone: TONE.warn, filters: { status: "Observado" } },
      { label: "Listo para firma", count: n(by, "Listo para firma"), tone: TONE.info, filters: { status: "Listo para firma" } },
      { label: "Firmado completo", count: n(by, "Firmado completo"), tone: TONE.done, filters: { status: "Firmado completo" } }
    ];
    list.push({ key: "documents", title: "Documentos", table: "documents", icon: "info-circle", iconWrap: "bg-indigo-100 text-indigo-600", total: sumChips(chips), chips });
  }

  if (stats.deliveries) {
    const by = stats.deliveries.byStatus || {};
    const chips = [
      { label: "Pendientes", count: n(by, "pending"), tone: TONE.pending, filters: { status: "pending" } },
      { label: "En proceso", count: n(by, "in_progress"), tone: TONE.progress, filters: { status: "in_progress" } },
      { label: "Observadas", count: n(by, "returned"), tone: TONE.warn, filters: { status: "returned" } },
      { label: "Aprobadas", count: n(by, "approved"), tone: TONE.done, filters: { status: "approved" } }
    ];
    list.push({ key: "deliveries", title: "Entregas", table: "fill_requests", icon: "check-double", iconWrap: "bg-amber-100 text-amber-600", total: sumChips(chips), chips });
  }

  if (stats.signatures) {
    const by = stats.signatures.byStatus || {};
    const chips = [
      { label: "Pendientes", count: n(by, "pendiente"), tone: TONE.pending, filters: null },
      { label: "Parciales", count: n(by, "en_progreso"), tone: TONE.progress, filters: null },
      { label: "Completadas", count: n(by, "completado"), tone: TONE.done, filters: null }
    ];
    list.push({ key: "signatures", title: "Firmas", table: "signature_flow_instances", icon: "check", iconWrap: "bg-emerald-100 text-emerald-600", total: sumChips(chips), chips });
  }

  return list;
});
</script>
