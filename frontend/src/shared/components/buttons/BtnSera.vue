<template>
  <button
    type="button"
    :class="btnseraClass"
    :title="statusLabel"
    :aria-label="statusLabel"
    @click="handleClick"
  >
    <component :is="statusIcon" class="icon" />
    <span class="tooltip">{{ statusLabel }}</span>
  </button>

  <AdminModalShell
    v-if="showStatusModal"
    ref="modalRef"
    :title="modalTitle"
    labelled-by="btn-sera-status-label"
    size="md"
    dialog-class="items-center"
    content-class="profile-admin-skin"
    body-class="pb-2"
    @close="closeModal"
  >
    <div class="status-dialog-body">
      <div class="status-modal-icon" :class="statusToneClass">
        <component :is="statusIcon" class="status-modal-icon-svg" />
      </div>
      <div class="status-modal-copy">
        <strong class="status-modal-label">{{ statusLabel }}</strong>
        <p class="status-modal-message">{{ statusDescription }}</p>
      </div>
    </div>
    <template #footer>
      <AdminButton variant="secondary" data-modal-dismiss @click="closeModal">
        Cerrar
      </AdminButton>
    </template>
  </AdminModalShell>
</template>

<script setup>
import { computed, nextTick, ref } from "vue";
import { IconAlertTriangle, IconChecks, IconClock, IconRosetteDiscountCheck } from "@tabler/icons-vue";
import { Modal } from "@/shared/utils/modalController";
import AdminModalShell from "@/shared/components/modals/AppModalShell.vue";
import AdminButton from "@/shared/components/buttons/AppButton.vue";

const props = defineProps({
  type: { type: [String, Number], required: true },
  showStatusModal: { type: Boolean, default: true }
});

const emit = defineEmits(["onpress"]);

const modalRef = ref(null);
let modalInstance = null;

const statusMeta = computed(() => {
  switch (props.type) {
    case "certified":
      return {
        label: "Certificado",
        description: "El registro fue validado y certificado.",
        icon: IconRosetteDiscountCheck,
        buttonClass: "btnsera sera-certified",
        toneClass: "status-certified"
      };
    case "reviewed":
      return {
        label: "Revisado",
        description: "El registro ya fue revisado y está pendiente de la siguiente acción.",
        icon: IconChecks,
        buttonClass: "btnsera sera-review",
        toneClass: "status-reviewed"
      };
    case "denied":
      return {
        label: "Rechazado",
        description: "El registro fue observado o rechazado y requiere correcciones.",
        icon: IconAlertTriangle,
        buttonClass: "btnsera sera-denied",
        toneClass: "status-denied"
      };
    default:
      return {
        label: "Enviado",
        description: "El registro fue enviado y está pendiente de revisión.",
        icon: IconClock,
        buttonClass: "btnsera sera-send",
        toneClass: "status-pending"
      };
  }
});

const statusIcon = computed(() => statusMeta.value.icon);
const statusLabel = computed(() => statusMeta.value.label);
const statusDescription = computed(() => statusMeta.value.description);
const btnseraClass = computed(() => statusMeta.value.buttonClass);
const statusToneClass = computed(() => statusMeta.value.toneClass);
const modalTitle = computed(() => "Estado del registro");

const openModal = async () => {
  if (!props.showStatusModal) return;
  await nextTick();
  const element = modalRef.value?.el;
  if (!element) return;
  modalInstance = Modal.getOrCreateInstance(element);
  modalInstance.show();
};

const closeModal = () => {
  modalInstance?.hide();
};

const handleClick = () => {
  emit("onpress");
  openModal();
};
</script>

<style scoped>
.btnsera {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: none;
  border-radius: 9999px;
  background: transparent;
  cursor: pointer;
  transition: transform 0.2s ease, color 0.2s ease, background-color 0.2s ease;
  --tooltip-bg: var(--brand-accent);
}

.btnsera:hover {
  transform: scale(1.04);
  background: rgba(15, 23, 42, 0.04);
}

.icon {
  width: 1.25rem;
  height: 1.25rem;
  stroke-width: 2.1;
}

.sera-send {
  color: var(--brand-accent);
  --tooltip-bg: var(--brand-accent);
}

.sera-review {
  color: var(--state-success);
  --tooltip-bg: var(--state-success);
}

.sera-certified {
  color: var(--state-gold);
  --tooltip-bg: var(--state-gold);
}

.sera-denied {
  color: var(--state-danger);
  --tooltip-bg: var(--state-danger);
}

.tooltip {
  visibility: hidden;
  position: absolute;
  top: 50%;
  left: calc(100% + 8px);
  transform: translateY(-50%);
  background-color: var(--tooltip-bg);
  color: var(--brand-white);
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  font-size: 0.8rem;
  line-height: 1.2;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
  z-index: 25;
}

.btnsera:hover .tooltip {
  visibility: visible;
  opacity: 1;
}

.status-dialog-body {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.status-modal-icon {
  width: 3rem;
  height: 3rem;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.status-modal-icon-svg {
  width: 1.5rem;
  height: 1.5rem;
}

.status-modal-copy {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.status-modal-label {
  font-size: 1rem;
  color: #0f172a;
}

.status-modal-message {
  margin: 0;
  color: #475569;
  font-size: 0.92rem;
  line-height: 1.45;
}

.status-pending {
  color: var(--brand-accent);
  background: rgba(14, 165, 233, 0.12);
}

.status-reviewed {
  color: var(--state-success);
  background: rgba(34, 197, 94, 0.12);
}

.status-certified {
  color: var(--state-gold);
  background: rgba(234, 179, 8, 0.14);
}

.status-denied {
  color: var(--state-danger);
  background: rgba(239, 68, 68, 0.12);
}
</style>
