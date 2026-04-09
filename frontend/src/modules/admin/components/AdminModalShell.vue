<template>
  <div
    ref="rootElement"
    class="deasy-dialog-root admin-dialog-root fixed inset-0 z-1060 hidden overflow-y-auto bg-slate-950/45 px-4 py-8 backdrop-blur-[2px]"
    data-dialog-root
    tabindex="-1"
    :aria-labelledby="labelledBy"
    aria-hidden="true"
  >
    <div class="deasy-dialog-shell admin-dialog-shell mx-auto flex min-h-full items-center justify-center" :class="sizeClass">
      <div class="deasy-dialog-panel admin-dialog-panel relative w-full overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl" :class="contentClass">
        <div class="deasy-dialog-header admin-dialog-header flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <h5 class="deasy-dialog-title admin-dialog-title text-lg font-bold text-slate-900" :id="labelledBy">
            <slot name="title">{{ title }}</slot>
          </h5>
          <button
            v-if="showCloseButton"
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
            :aria-label="closeLabel"
            :title="closeLabel"
            v-bind="closeButtonAttrs"
            @click="handleClose"
          >
            <IconX class="h-4 w-4" stroke-width="2.5" />
          </button>
        </div>
        <div class="deasy-dialog-body admin-dialog-body px-6 py-5" :class="bodyClass">
          <slot />
        </div>
        <div v-if="$slots.footer" class="deasy-dialog-footer admin-dialog-footer flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 px-6 py-4" :class="footerClass">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import AdminButton from "@/modules/admin/components/AdminButton.vue";
import { IconX } from "@tabler/icons-vue";

const props = defineProps({
  title: {
    type: String,
    default: ""
  },
  labelledBy: {
    type: String,
    required: true
  },
  size: {
    type: String,
    default: "md"
  },
  dialogClass: {
    type: [String, Array, Object],
    default: ""
  },
  contentClass: {
    type: [String, Array, Object],
    default: ""
  },
  bodyClass: {
    type: [String, Array, Object],
    default: ""
  },
  footerClass: {
    type: [String, Array, Object],
    default: ""
  },
  closeLabel: {
    type: String,
    default: "Close"
  },
  showCloseButton: {
    type: Boolean,
    default: true
  },
  closeAction: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(["close"]);

const rootElement = ref(null);

const sizeClass = computed(() => {
  const classes = [];
  if (props.size === "md") classes.push("max-w-3xl");
  if (props.size === "lg") classes.push("max-w-5xl");
  if (props.size === "xl") classes.push("max-w-7xl");
  if (props.size === "scrollable") classes.push("max-w-5xl");
  if (props.size === "centered") classes.push("max-w-3xl");
  if (Array.isArray(props.dialogClass)) {
    classes.push(...props.dialogClass);
  } else if (props.dialogClass) {
    classes.push(props.dialogClass);
  }
  return classes;
});

const closeButtonAttrs = computed(() => (
  props.closeAction ? {} : { "data-modal-dismiss": true }
));

const handleClose = (event) => {
  if (props.closeAction) {
    emit("close", event);
  }
};

defineExpose({
  el: rootElement
});
</script>
