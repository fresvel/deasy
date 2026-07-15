import { ref } from 'vue';

// Constructor del FLUJO routed: define, al enviar, quién ELABORA (entrega) y quién FIRMA (pasos
// en orden, cada uno con 1..N firmantes y modo de aprobación). Un firmante/responsable es una
// persona concreta o un cargo con ámbito de unidad.
// Extraído de HomeView.vue en la Fase B del refactor del God Object.
//
// El composable POSEE su estado (los 6 refs del builder) y solo inyecta 3 deps: la limpieza del
// buscador de destinatarios (de useRecipientSearch), el id del usuario y el servicio del panel.
// HomeView destructura los refs, asi que el template y submitGeneralTask/openGeneralTaskModal
// los siguen usando igual.
export function useFlowBuilder({ clearRecipientSearch, currentUserId, processPanelService }) {
  const flowEntrega = ref([]);
  const flowFirma = ref([]);
  const flowPickerTarget = ref(null); // 'entrega' | 'firma:new' | 'firma:<idx>' | null
  const flowPickerMode = ref('person'); // 'person' | 'cargo'
  const flowCatalog = ref({ units: [], cargos: [] });
  const flowCargoForm = ref({ cargoId: null, unitId: null });

  const openFlowPicker = (target) => {
    flowPickerTarget.value = flowPickerTarget.value === target ? null : target;
    flowPickerMode.value = 'person';
    flowCargoForm.value = { cargoId: null, unitId: null };
    clearRecipientSearch();
  };

  const sameSigner = (a, b) => a.kind === b.kind
    && Number(a.person_id || 0) === Number(b.person_id || 0)
    && Number(a.cargo_id || 0) === Number(b.cargo_id || 0)
    && Number(a.unit_id || 0) === Number(b.unit_id || 0);

  // Enruta un firmante/responsable al destino activo.
  const pushSigner = (signer) => {
    const t = flowPickerTarget.value;
    if (t === 'entrega') {
      if (!flowEntrega.value.some((p) => sameSigner(p, signer))) flowEntrega.value.push(signer);
    } else if (t === 'firma:new') {
      flowFirma.value.push({ signers: [signer], approval_mode: 'and', required_min: 1 });
    } else if (typeof t === 'string' && t.startsWith('firma:')) {
      const step = flowFirma.value[Number(t.split(':')[1])];
      if (step && !step.signers.some((p) => sameSigner(p, signer))) step.signers.push(signer);
    }
    openFlowPicker(t); // cierra y resetea
  };

  const addFlowPerson = (person) => {
    pushSigner({
      kind: 'person',
      person_id: person.id,
      cargo_id: null,
      unit_id: null,
      label: person.full_name || `${person.first_name || ''} ${person.last_name || ''}`.trim(),
    });
  };

  const addFlowCargo = () => {
    const f = flowCargoForm.value;
    if (!f.cargoId) return;
    const cargoName = flowCatalog.value.cargos.find((c) => Number(c.id) === Number(f.cargoId))?.name || 'Cargo';
    const unitName = f.unitId ? flowCatalog.value.units.find((u) => Number(u.id) === Number(f.unitId))?.name : null;
    pushSigner({
      kind: 'cargo',
      person_id: null,
      cargo_id: Number(f.cargoId),
      unit_id: f.unitId ? Number(f.unitId) : null,
      label: `${cargoName}${unitName ? ` · ${unitName}` : ' · todas las unidades'}`,
    });
  };

  const removeFromEntrega = (idx) => { flowEntrega.value.splice(idx, 1); };
  const removeFirmaStep = (idx) => { flowFirma.value.splice(idx, 1); };
  const removeSignerFromStep = (stepIdx, signerIdx) => {
    const step = flowFirma.value[stepIdx];
    if (!step) return;
    step.signers.splice(signerIdx, 1);
    if (!step.signers.length) flowFirma.value.splice(stepIdx, 1);
  };

  // Destinatario principal ("Para:"/owner): 1er firmante persona, o 1er responsable de entrega ≠ tú.
  const primaryRecipientFromFlow = () => {
    const firstFirma = flowFirma.value.flatMap((s) => s.signers).find((x) => x.kind === 'person')?.person_id || null;
    const entregaDelegate = flowEntrega.value
      .find((p) => p.kind === 'person' && Number(p.person_id) !== Number(currentUserId.value))?.person_id || null;
    return firstFirma || entregaDelegate || null;
  };

  // Catálogo de cargos/unidades para el modo "por cargo". Cacheado: no recarga si ya está.
  const loadFlowCatalog = async () => {
    const userId = currentUserId.value;
    if (!userId || (flowCatalog.value.cargos?.length && flowCatalog.value.units?.length)) return;
    try {
      const data = await processPanelService.listFlowCatalog(userId);
      flowCatalog.value = { units: data?.units || [], cargos: data?.cargos || [] };
    } catch {
      flowCatalog.value = { units: [], cargos: [] };
    }
  };

  // Reinicia el builder al abrir el modal de envío. routed/free arranca con "Tú" en entrega y
  // carga el catálogo; el resto arranca vacío.
  const resetFlowBuilder = (usesRuntimeFlow) => {
    flowEntrega.value = usesRuntimeFlow
      ? [{ kind: 'person', person_id: currentUserId.value, label: 'Tú (autor)' }]
      : [];
    flowFirma.value = [];
    flowPickerTarget.value = null;
    flowPickerMode.value = 'person';
    flowCargoForm.value = { cargoId: null, unitId: null };
    if (usesRuntimeFlow) loadFlowCatalog();
  };

  return {
    flowEntrega,
    flowFirma,
    flowPickerTarget,
    flowPickerMode,
    flowCatalog,
    flowCargoForm,
    openFlowPicker,
    addFlowPerson,
    addFlowCargo,
    removeFromEntrega,
    removeFirmaStep,
    removeSignerFromStep,
    primaryRecipientFromFlow,
    loadFlowCatalog,
    resetFlowBuilder,
  };
}
