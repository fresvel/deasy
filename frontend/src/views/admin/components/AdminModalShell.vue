<template>
  <div
    ref="rootElement"
    class="modal fade"
    tabindex="-1"
    :aria-labelledby="labelledBy"
    aria-hidden="true"
  >
    <div class="modal-dialog" :class="sizeClass">
      <div class="modal-content" :class="contentClass">
        <div class="modal-header">
          <h5 class="modal-title" :id="labelledBy">
            <slot name="title">{{ title }}</slot>
          </h5>
          <AdminButton
            v-if="showCloseButton"
            variant="close"
            :aria-label="closeLabel"
            :title="closeLabel"
            v-bind="closeButtonAttrs"
            @click="handleClose"
          />
        </div>
        <div class="modal-body" :class="bodyClass">
          <slot />
        </div>
        <div v-if="$slots.footer" class="modal-footer" :class="footerClass">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import AdminButton from "@/views/admin/components/AdminButton.vue";

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
  if (props.size === "lg") classes.push("modal-lg");
  if (props.size === "xl") classes.push("modal-xl");
  if (props.size === "scrollable") classes.push("modal-dialog-scrollable");
  if (props.size === "centered") classes.push("modal-dialog-centered");
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
