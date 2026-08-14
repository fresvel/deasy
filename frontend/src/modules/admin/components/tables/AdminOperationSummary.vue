<template>
  <div v-if="cards.length" class="mb-6">
    <h3 class="m-0 mb-3 text-xs font-bold uppercase tracking-widest text-muted">Resumen de operación</h3>
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div
        v-for="card in cards"
        :key="card.key"
        class="deasy-card p-4"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" :class="card.iconWrap">
              <font-awesome-icon :icon="card.icon" />
            </span>
            <span class="truncate text-sm font-bold text-body">{{ card.title }}</span>
          </div>
          <span class="shrink-0 text-2xl font-extrabold leading-none text-strong">{{ card.total }}</span>
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

const n = (map, key) => Number(map?.[key] || 0);
const sumCounts = (...counts) => counts.reduce((total, count) => total + Number(count || 0), 0);

const cards = computed(() => {
  const stats = props.stats || {};
  const list = [];

  if (stats.tasks) {
    const by = stats.tasks.byStatus || {};
    list.push({
      key: "tasks",
      title: "Tareas",
      icon: "square-check",
      iconWrap: "bg-blue-light-100 text-info",
      total: sumCounts(n(by, "pendiente"), n(by, "en_proceso"), stats.tasks.overdue)
    });
  }

  if (stats.documents) {
    const by = stats.documents.byStatus || {};
    list.push({
      key: "documents",
      title: "Documentos",
      icon: "info-circle",
      iconWrap: "bg-brand-100 text-primary",
      total: sumCounts(
        n(by, "En proceso"),
        n(by, "Observado"),
        n(by, "Listo para firma"),
        n(by, "Firmado completo")
      )
    });
  }

  if (stats.deliveries) {
    const by = stats.deliveries.byStatus || {};
    list.push({
      key: "deliveries",
      title: "Entregas",
      icon: "check-double",
      iconWrap: "bg-amber-100 text-warning",
      total: sumCounts(n(by, "pending"), n(by, "in_progress"), n(by, "returned"), n(by, "approved"))
    });
  }

  if (stats.signatures) {
    const by = stats.signatures.byStatus || {};
    list.push({
      key: "signatures",
      title: "Firmas",
      icon: "check",
      iconWrap: "bg-emerald-100 text-success",
      total: sumCounts(n(by, "pendiente"), n(by, "en_progreso"), n(by, "completado"))
    });
  }

  return list;
});
</script>
