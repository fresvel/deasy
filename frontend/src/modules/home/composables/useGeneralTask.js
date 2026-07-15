import { ref, computed } from 'vue';
import { Modal } from '@/shared/utils/modalController';
import { mapSigner } from '@/modules/home/views/homeView.helpers.js';

// Concepto "TAREA/ENVÍO ad-hoc": formulario, apertura del modal (con contexto por modo),
// validación, envío y los computeds derivados (título del modal, unidad emisora, etc.).
// Extraído de HomeView.vue en la Fase C (paso 1: consolidar la lógica antes del componente).
//
// Es el concepto MÁS entrelazado de HomeView: orquesta el flow-builder (resetFlowBuilder,
// flowEntrega/flowFirma, primaryRecipientFromFlow), la búsqueda (clearRecipientSearch), la
// recarga del menú/panel/inbox y el mensaje de acción. De ahí su gran superficie de inyección
// (16 deps): consolidarlo aquí es lo que permite que el modal quede presentacional (paso 2).
export function useGeneralTask({
  currentUserId,
  processPanelService,
  unitsPanelData,
  activeConsolidatedUnitTab,
  isRoutedProcess,
  routedCreateLabel,
  loadUserMenu,
  loadRoutedInbox,
  loadAddableDeliverables,
  setProcessActionInfo,
  refreshActiveProcessPanel,
  clearRecipientSearch,
  resetFlowBuilder,
  flowEntrega,
  flowFirma,
  primaryRecipientFromFlow,
}) {
  const generalTaskModal = ref(null);
  let generalTaskModalInstance = null;
  const generalTaskSubmitting = ref(false);
  const generalTaskError = ref('');
  const generalTaskForm = ref({
    mode: 'free',
    title: '',
    description: '',
    unitId: null,
    sourceTaskId: null,
    termName: '',
    startDate: '',
    endDate: '',
    // Emisión por modo (replicated/routed): plantilla configurada + destinatario.
    itemMode: '',
    processDefinitionTemplateId: null,
    templateName: '',
    recipientPersonId: null,
    recipientLabel: '',
  });

  const openGeneralTaskModal = (mode = 'free', context = {}) => {
    const today = new Date().toISOString().slice(0, 10);
    generalTaskError.value = '';
    clearRecipientSearch();
    generalTaskForm.value = {
      mode,
      title: '',
      description: '',
      unitId: mode === 'free'
        ? (activeConsolidatedUnitTab.value || unitsPanelData.value[0]?.id || null)
        : (context.unitId || null),
      sourceTaskId: context.sourceTaskId || null,
      termName: '',
      startDate: today,
      endDate: '',
      itemMode: context.itemMode || '',
      processDefinitionTemplateId: context.processDefinitionTemplateId || null,
      templateName: context.templateName || '',
      recipientPersonId: null,
      recipientLabel: '',
    };
    // routed / proceso por defecto (free): el usuario define el flujo al enviar. Entrega arranca con "Tú".
    const usesRuntimeFlow = mode === 'free' || context.itemMode === 'routed';
    resetFlowBuilder(usesRuntimeFlow);
    generalTaskModalInstance = Modal.getOrCreateInstance(generalTaskModal.value?.el);
    generalTaskModalInstance?.show();
  };

  const isSendFlowModal = computed(() => generalTaskForm.value.itemMode === 'routed' || generalTaskForm.value.mode === 'free');
  // Unidad emisora del alta libre: con una sola unidad se auto-usa (preseleccionada en openGeneralTaskModal) y se
  // oculta el selector; con varias se muestra para elegir en representación de cuál se emite.
  const senderUnits = computed(() => unitsPanelData.value || []);
  const showSenderUnitSelect = computed(() => senderUnits.value.length > 1);
  const senderUnitName = computed(() => {
    const id = generalTaskForm.value.unitId;
    return senderUnits.value.find((u) => String(u.id) === String(id))?.name || '';
  });
  const generalTaskModalTitle = computed(() => {
    const f = generalTaskForm.value;
    // En un proceso routed abierto, el título refleja el proceso ("Nuevo Memorandum" / "Nueva tarea").
    if ((f.itemMode === 'routed' || f.mode === 'free') && isRoutedProcess.value) return routedCreateLabel.value;
    if (f.itemMode === 'routed') return 'Enviar entregable';
    if (f.itemMode === 'replicated') return 'Agregar réplica';
    if (f.mode === 'derived') return 'Agregar entregable';
    return 'Nueva tarea';
  });

  const submitGeneralTask = async () => {
    const form = generalTaskForm.value;
    const userId = currentUserId.value;
    if (!form.title.trim()) {
      generalTaskError.value = 'Debes indicar un título.';
      return;
    }
    if (form.mode === 'free' && !form.unitId) {
      generalTaskError.value = 'Debes seleccionar una unidad.';
      return;
    }
    const usesRuntimeFlow = form.itemMode === 'routed' || form.mode === 'free';
    if (usesRuntimeFlow && !flowEntrega.value.length) {
      generalTaskError.value = 'Indica al menos quién elabora el entregable.';
      return;
    }
    const primaryRecipient = usesRuntimeFlow ? primaryRecipientFromFlow() : null;
    const hasRecipientLike = flowFirma.value.some((s) => s.signers.length)
      || flowEntrega.value.some((p) => p.kind === 'cargo'
        || (p.kind === 'person' && Number(p.person_id) !== Number(currentUserId.value)));
    if (form.itemMode === 'routed' && !hasRecipientLike) {
      generalTaskError.value = 'Un envío necesita al menos un firmante (persona o cargo) o un responsable distinto de ti.';
      return;
    }
    generalTaskSubmitting.value = true;
    generalTaskError.value = '';
    try {
      const payload = {
        mode: form.mode,
        title: form.title.trim(),
        description: form.description.trim() || null,
        unit_id: form.unitId || null,
        source_task_id: form.sourceTaskId || null,
        process_definition_template_id: form.processDefinitionTemplateId || null,
        // Destinatario principal (owner / "Para:") derivado del flujo; el flujo completo va en `flow`.
        recipient_person_id: primaryRecipient,
        flow: usesRuntimeFlow
          ? {
              entrega: flowEntrega.value.map(mapSigner),
              firma: flowFirma.value
                .filter((s) => s.signers.length)
                .map((s) => ({
                  signers: s.signers.map(mapSigner),
                  approval_mode: s.signers.length > 1 ? s.approval_mode : 'and',
                  required_min: (s.signers.length > 1 && s.approval_mode === 'at_least') ? Number(s.required_min || 1) : null,
                })),
            }
          : null,
        custom_term: {
          name: form.termName.trim() || form.title.trim(),
          start_date: form.startDate || null,
          end_date: form.endDate || null,
        },
      };
      await processPanelService.createGeneralTask(userId, payload);
      generalTaskModalInstance?.hide();
      await loadUserMenu();
      await refreshActiveProcessPanel();
      await loadAddableDeliverables();
      await loadRoutedInbox();
      const okMsg = form.itemMode === 'routed'
        ? 'Envío creado correctamente.'
        : (form.itemMode === 'replicated' ? 'Réplica agregada correctamente.' : 'Tarea creada correctamente.');
      setProcessActionInfo(okMsg, 'success');
    } catch (error) {
      generalTaskError.value =
        error?.response?.data?.message || error?.message || 'No se pudo crear la tarea.';
    } finally {
      generalTaskSubmitting.value = false;
    }
  };

  return {
    generalTaskModal,
    generalTaskForm,
    generalTaskSubmitting,
    generalTaskError,
    isSendFlowModal,
    senderUnits,
    showSenderUnitSelect,
    senderUnitName,
    generalTaskModalTitle,
    openGeneralTaskModal,
    submitGeneralTask,
  };
}
