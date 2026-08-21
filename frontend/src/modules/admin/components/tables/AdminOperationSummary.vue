<template>
  <div v-if="cards.length" class="mb-6">
    <h3 class="deasy-overline mb-3">Resumen de operación</h3>
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div
        v-for="card in cards"
        :key="card.key"
        class="deasy-card p-4"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <span class="deasy-icon-box deasy-icon-box--md" :class="card.iconWrap">
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
      iconWrap: "deasy-icon-box--info",
      total: sumCounts(n(by, "pendiente"), n(by, "en_proceso"), stats.tasks.overdue)
    });
  }

  if (stats.documents) {
    const by = stats.documents.byStatus || {};
    list.push({
      key: "documents",
      title: "Documentos",
      icon: "info-circle",
      iconWrap: "deasy-icon-box--primary",
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
      iconWrap: "deasy-icon-box--warning",
      total: sumCounts(n(by, "pending"), n(by, "in_progress"), n(by, "returned"), n(by, "approved"))
    });
  }

  if (stats.signatures) {
    const by = stats.signatures.byStatus || {};
    list.push({
      key: "signatures",
      title: "Firmas",
      icon: "check",
      iconWrap: "deasy-icon-box--success",
      total: sumCounts(n(by, "pendiente"), n(by, "en_progreso"), n(by, "completado"))
    });
  }

  return list;
});
</script>
