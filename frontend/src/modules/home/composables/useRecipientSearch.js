import { ref } from 'vue';

// Búsqueda de destinatarios (personas) para el flujo routed, con debounce.
// Extraído de HomeView.vue en la Fase B del refactor del God Object.
//
// El composable POSEE su propio estado (query, resultados, flag de carga y el timer del
// debounce) y recibe como dependencias lo que no es suyo: el id del usuario que consulta y
// el servicio del panel. HomeView destructura los refs, así que el template y el resto del
// código siguen usando `recipientQuery`/`recipientResults`/`recipientSearching` igual que antes.
export function useRecipientSearch({ currentUserId, processPanelService }) {
  const recipientQuery = ref('');
  const recipientResults = ref([]);
  const recipientSearching = ref(false);
  let recipientSearchTimer = null;

  const searchRecipients = () => {
    const userId = currentUserId.value;
    if (recipientSearchTimer) clearTimeout(recipientSearchTimer);
    recipientSearchTimer = setTimeout(async () => {
      if (!userId) return;
      recipientSearching.value = true;
      try {
        const data = await processPanelService.searchTaskRecipients(userId, recipientQuery.value.trim());
        recipientResults.value = Array.isArray(data?.recipients) ? data.recipients : [];
      } catch {
        recipientResults.value = [];
      } finally {
        recipientSearching.value = false;
      }
    }, 250);
  };

  // Limpia el buscador (lo hacían a mano openFlowPicker y el reset del formulario).
  const clearRecipientSearch = () => {
    recipientQuery.value = '';
    recipientResults.value = [];
  };

  return {
    recipientQuery,
    recipientResults,
    recipientSearching,
    searchRecipients,
    clearRecipientSearch,
  };
}
