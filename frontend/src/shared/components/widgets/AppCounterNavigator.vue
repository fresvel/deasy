<template>
  <div class="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
    <button
      type="button"
      class="rounded-lg p-2 text-slate-500 transition hover:bg-sky-50 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
      :disabled="previousDisabled"
      :title="previousTitle"
      @click="$emit('previous')"
    >
      <IconChevronLeft class="h-5 w-5" />
    </button>

    <div
      class="border-x border-slate-100 px-3 py-1 text-center"
      :class="editable ? 'flex items-center gap-2 min-w-[10.5rem]' : 'min-w-[5rem]'"
    >
      <template v-if="editable">
        <span class="text-xs font-bold uppercase tracking-wider text-slate-400">{{ label }}</span>
        <input
          :value="modelValue"
          class="w-12 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-center text-sm font-bold text-slate-800 outline-none transition focus:border-sky-500 focus:bg-white"
          type="number"
          :min="min"
          :max="total"
          @input="$emit('update:modelValue', $event.target.value)"
          @keyup.enter="$emit('submit')"
        />
        <span class="text-sm font-semibold text-slate-500">de {{ total }}</span>
      </template>

      <template v-else>
        <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">{{ label }}</div>
        <div class="text-sm font-bold text-slate-700">{{ current }} / {{ total }}</div>
      </template>
    </div>

    <button
      type="button"
      class="rounded-lg p-2 text-slate-500 transition hover:bg-sky-50 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
      :disabled="nextDisabled"
      :title="nextTitle"
      @click="$emit('next')"
    >
      <IconChevronRight class="h-5 w-5" />
    </button>
  </div>
</template>

<script setup>
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-vue";

defineProps({
  label: {
    type: String,
    required: true
  },
  current: {
    type: Number,
    default: 1
  },
  total: {
    type: Number,
    default: 1
  },
  editable: {
    type: Boolean,
    default: false
  },
  modelValue: {
    type: [Number, String],
    default: ""
  },
  min: {
    type: Number,
    default: 1
  },
  previousDisabled: {
    type: Boolean,
    default: false
  },
  nextDisabled: {
    type: Boolean,
    default: false
  },
  previousTitle: {
    type: String,
    default: ""
  },
  nextTitle: {
    type: String,
    default: ""
  }
});

defineEmits(["previous", "next", "update:modelValue", "submit"]);
</script>
