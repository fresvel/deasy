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
          <span v-if="meta" class="text-sm font-medium text-slate-400">{{ meta }}</span>
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
import AppButton from "@/components/AppButton.vue";
import AppTag from "@/components/AppTag.vue";

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
    ? "group bg-white rounded-xl border border-slate-200 p-5 text-left flex items-start gap-4 transition-all hover:border-sky-200 hover:shadow-md hover:shadow-sky-100/50 focus:outline-none focus:ring-2 focus:ring-sky-500/20 hover:-translate-y-1"
    : "group bg-white border border-slate-200 rounded-2xl p-5 hover:border-sky-300 hover:shadow-xl hover:shadow-sky-100 transition-all text-left flex flex-col justify-between",
  props.className
]);

const iconWrapperClasses = computed(() => [
  props.layout === "inline"
    ? "w-12 h-12 flex-shrink-0 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center border border-slate-100 group-hover:bg-sky-50 group-hover:text-sky-600 transition-colors"
    : "w-14 h-14 rounded-2xl bg-slate-50 text-slate-500 flex items-center justify-center border border-slate-100 group-hover:bg-sky-50 group-hover:text-sky-600 transition-all shadow-sm",
  props.iconWrapperClass
]);

const iconClasses = computed(() => props.iconClass);

const titleClasses = computed(() => [
  props.layout === "inline"
    ? "text-slate-800 font-bold text-base block truncate group-hover:text-sky-700 transition-colors"
    : "font-bold text-slate-800 text-lg leading-tight group-hover:text-sky-700 transition-colors",
  props.titleClass
]);

const arrowWrapperClasses = computed(() => [
  "w-8 h-8 rounded-full flex items-center justify-center text-slate-300 group-hover:text-sky-500 group-hover:bg-sky-100 transition-all opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0"
]);
</script>
