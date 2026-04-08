<template>
  <div
    ref="rootElement"
    class="deasy-dialog-root fixed inset-0 z-[1060] overflow-y-auto bg-slate-950/45 px-4 py-8 backdrop-blur-[2px]"
    :class="controlled ? (open ? 'flex' : 'hidden') : 'hidden'"
    data-dialog-root
    tabindex="-1"
    :aria-labelledby="labelledBy"
    :aria-hidden="controlled ? (!open).toString() : 'true'"
    aria-modal="true"
    v-bind="attrs"
    @click.self="handleBackdropClick"
  >
    <div class="deasy-dialog-shell mx-auto flex min-h-full w-full justify-center" :class="shellClass">
      <div class="deasy-dialog-panel relative w-full overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl" :class="contentClass">
        <div
          v-if="showHeader"
          class="deasy-dialog-header flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-5"
        >
          <h5 class="deasy-dialog-title text-lg font-bold text-slate-900" :id="labelledBy">
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
        <div class="deasy-dialog-body px-6 py-5" :class="bodyClass">
          <slot />
        </div>
        <div
          v-if="$slots.footer"
          class="deasy-dialog-footer flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 px-6 py-4"
          :class="footerClass"
        >
          <slot name="footer" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, useAttrs } from "vue";
import AppButton from "@/components/AppButton.vue";
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
  showHeader: {
    type: Boolean,
    default: true
  },
  closeAction: {
    type: Boolean,
    default: false
  },
  closeOnBackdrop: {
    type: Boolean,
    default: true
  },
  controlled: {
    type: Boolean,
    default: false
  },
  open: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(["close"]);

const attrs = useAttrs();
const rootElement = ref(null);

const shellClass = computed(() => {
  const classes = ["items-center"];
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

const closeButtonAttrs = computed(() => {
  if (props.controlled || props.closeAction) {
    return {};
  }
  return { "data-modal-dismiss": true };
});

const handleClose = (event) => {
  if (props.controlled || props.closeAction) {
    emit("close", event);
  }
};

const handleBackdropClick = (event) => {
  if (props.controlled && props.closeOnBackdrop) {
    emit("close", event);
  }
};

defineExpose({
  get el() {
    return rootElement.value;
  }
});
</script>
