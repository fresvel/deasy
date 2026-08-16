<template>
  <button
    type="button"
    :class="btnseraClass"
    :title="statusLabel"
    :aria-label="statusLabel"
    @click="handleClick"
  >
    <component :is="statusIcon" class="btnsera__icon" />
    <span class="btnsera__tooltip">{{ statusLabel }}</span>
  </button>

  <AppModalShell
    v-if="showStatusModal"
    ref="modalRef"
    :title="modalTitle"
    labelled-by="btn-sera-status-label"
    size="md"
    dialog-class="items-center"
    content-class="deasy-dialog-panel--plain"
    body-class="pb-2"
    @close="closeModal"
  >
    <div class="btnsera-status__body">
      <div class="btnsera-status__icon" :class="statusToneClass">
        <component :is="statusIcon" class="btnsera-status__icon-svg" />
      </div>
      <div class="btnsera-status__copy">
        <strong class="btnsera-status__label">{{ statusLabel }}</strong>
        <p class="btnsera-status__message">{{ statusDescription }}</p>
      </div>
    </div>
    <template #footer>
      <AdminButton variant="neutral-outline" data-modal-dismiss @click="closeModal">
        Cerrar
      </AdminButton>
    </template>
  </AppModalShell>
</template>

<script setup>
import { computed, nextTick, ref } from "vue";
import { IconAlertTriangle, IconChecks, IconClock, IconRosetteDiscountCheck } from "@tabler/icons-vue";
import { Modal } from "@/shared/utils/modalController";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";
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
        toneClass: "btnsera-status--certified"
      };
    case "reviewed":
      return {
        label: "Revisado",
        description: "El registro ya fue revisado y está pendiente de la siguiente acción.",
        icon: IconChecks,
        buttonClass: "btnsera sera-review",
        toneClass: "btnsera-status--reviewed"
      };
    case "denied":
      return {
        label: "Rechazado",
        description: "El registro fue observado o rechazado y requiere correcciones.",
        icon: IconAlertTriangle,
        buttonClass: "btnsera sera-denied",
        toneClass: "btnsera-status--denied"
      };
    default:
      return {
        label: "Enviado",
        description: "El registro fue enviado y está pendiente de revisión.",
        icon: IconClock,
        buttonClass: "btnsera sera-send",
        toneClass: "btnsera-status--pending"
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
