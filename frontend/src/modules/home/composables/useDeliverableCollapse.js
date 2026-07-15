import { ref, computed } from 'vue';

// Colapso/expansión de las tarjetas de entregable, a nivel tarjeta individual y a nivel proceso
// (todas las del proceso visible a la vez). Extraído de HomeView.vue en la Fase B del refactor.
//
// El composable POSEE el conjunto de ids colapsados y solo inyecta la lista de entregables del
// proceso visible (para el colapso "todo el proceso"). HomeView destructura lo que usa el
// template (isProcessCollapsed, toggle*) y el bundle deliverableCardHelpers (isDeliverableCollapsed).
export function useDeliverableCollapse({ filteredProcessDeliverables }) {
  const collapsedDeliverableIds = ref(new Set());

  const getDeliverableCollapseKey = (payload) =>
    String(payload?.id || payload?.document_id || payload?.task_item_id || '');

  const isDeliverableCollapsed = (payload) =>
    collapsedDeliverableIds.value.has(getDeliverableCollapseKey(payload));

  const toggleDeliverableCard = (payload) => {
    const key = getDeliverableCollapseKey(payload);
    if (!key) return;
    const next = new Set(collapsedDeliverableIds.value);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    collapsedDeliverableIds.value = next;
  };

  // Colapso a nivel proceso: todas las tarjetas del proceso visible se contraen/expanden juntas.
  const isProcessCollapsed = computed(() => {
    const items = filteredProcessDeliverables.value;
    return items.length > 0 && items.every((deliverable) => isDeliverableCollapsed(deliverable?.item));
  });

  const toggleDeliverableProcess = () => {
    const items = filteredProcessDeliverables.value;
    if (!items.length) return;

    const next = new Set(collapsedDeliverableIds.value);
    const shouldExpand = isProcessCollapsed.value;

    items.forEach((deliverable) => {
      const key = getDeliverableCollapseKey(deliverable?.item);
      if (!key) return;
      if (shouldExpand) next.delete(key);
      else next.add(key);
    });

    collapsedDeliverableIds.value = next;
  };

  return {
    isDeliverableCollapsed,
    toggleDeliverableCard,
    isProcessCollapsed,
    toggleDeliverableProcess,
  };
}
