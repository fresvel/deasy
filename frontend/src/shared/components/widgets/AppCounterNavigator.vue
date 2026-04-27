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
      :class="editable ? 'min-w-[7.5rem]' : 'min-w-[5rem]'"
    >
      <template v-if="editable">
        <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">{{ label }}</div>
        <div class="flex items-center justify-center gap-1 text-sm font-bold text-slate-700">
          <input
            :value="modelValue"
            class="w-10 rounded-lg border border-slate-100 bg-slate-50 px-1.5 py-1 text-center text-sm font-black text-slate-700 shadow-inner outline-none transition [appearance:textfield] focus:border-sky-300 focus:bg-white focus:shadow-[0_0_0_3px_rgba(14,165,233,0.12)] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            @input="$emit('update:modelValue', $event.target.value)"
            @keyup.enter="$emit('submit')"
            @blur="$emit('submit')"
          />
          <span>/ {{ total }}</span>
        </div>
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
