<template>
  <AppButton
    variant="plain"
    type="button"
    :title="title"
    :aria-label="ariaLabel || title"
    :class-name="rootClasses"
    @click="$emit('click', $event)"
  >
    <template v-if="layout === 'inline'">
      <span :class="iconWrapperClasses">
        <component :is="icon" :class="iconClasses" />
      </span>
      <span class="flex flex-col flex-1 min-w-0 pt-0.5">
        <strong :class="titleClasses">{{ title }}</strong>
        <span v-if="meta" class="text-slate-500 text-sm font-medium mt-1 inline-flex items-center gap-1.5 opacity-80">
          <span v-if="showMetaDot" class="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-sky-400 transition-colors"></span>
          {{ meta }}
        </span>
        <span v-if="description" class="text-sm font-medium text-slate-500 leading-snug line-clamp-2 mt-1">{{ description }}</span>
      </span>
    </template>

    <template v-else>
      <div class="flex flex-col h-full w-full">
        <div class="flex items-start justify-between mb-4">
          <div :class="iconWrapperClasses">
            <component :is="icon" :class="iconClasses" />
          </div>
          <div v-if="showArrow" :class="arrowWrapperClasses">
            <IconChevronRight class="w-6 h-6" />
          </div>
        </div>
        <div class="flex flex-col flex-1">
          <h3 :class="titleClasses">{{ title }}</h3>
          <span v-if="meta" class="text-sm font-medium text-muted">{{ meta }}</span>
          <span v-if="description" class="text-sm font-medium text-slate-500 leading-snug line-clamp-2 mt-1">{{ description }}</span>
        </div>
      </div>
      <AppTag v-if="badge" :variant="badgeVariant" class-name="mt-4 self-start">
        {{ badge }}
      </AppTag>
    </template>
  </AppButton>
</template>

<script setup>
import { computed } from "vue";
import { IconChevronRight } from "@tabler/icons-vue";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import AppTag from "@/shared/components/data/AppTag.vue";

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  icon: {
    type: [Object, Function, String],
    required: true
  },
  description: {
    type: String,
    default: ""
  },
  meta: {
    type: String,
    default: ""
  },
  layout: {
    type: String,
    default: "stacked"
  },
  showArrow: {
    type: Boolean,
    default: false
  },
  showMetaDot: {
    type: Boolean,
    default: true
  },
  badge: {
    type: String,
    default: ""
  },
  badgeVariant: {
    type: String,
    default: "info"
  },
  ariaLabel: {
    type: String,
    default: ""
  },
  className: {
    type: [String, Array, Object],
    default: ""
  },
  iconWrapperClass: {
    type: [String, Array, Object],
    default: ""
  },
  iconClass: {
    type: [String, Array, Object],
    default: "w-6 h-6"
  },
  titleClass: {
    type: [String, Array, Object],
    default: ""
  }
});

defineEmits(["click"]);

const rootClasses = computed(() => [
  props.layout === "inline"
    ? "group flex items-start gap-4 rounded-xl border border-line bg-white p-5 text-left transition-all hover:border-slate-300 hover:bg-surface focus:outline-none focus:ring-2 focus:ring-blue-500/15"
    : "group flex flex-col justify-between rounded-xl border border-line bg-white p-5 text-left transition-all hover:border-slate-300 hover:bg-surface focus:outline-none focus:ring-2 focus:ring-blue-500/15",
  props.className
]);

const iconWrapperClasses = computed(() => [
  props.layout === "inline"
    ? "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-line bg-surface text-slate-500 transition-colors group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-blue-700"
    : "flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-surface text-slate-500 transition-colors group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-blue-700",
  props.iconWrapperClass
]);

const iconClasses = computed(() => props.iconClass);

const titleClasses = computed(() => [
  props.layout === "inline"
    ? "block truncate text-base font-semibold text-slate-950 transition-colors"
    : "text-lg font-semibold leading-tight text-slate-950 transition-colors",
  props.titleClass
]);

const arrowWrapperClasses = computed(() => [
  "flex h-8 w-8 translate-x-2 items-center justify-center rounded-full text-slate-300 opacity-0 transition-all group-hover:translate-x-0 group-hover:bg-white group-hover:text-slate-700 group-hover:opacity-100"
]);
</script>
