<template>
  <div
    class="unit-node rounded-xl border px-3 py-2 shadow-sm transition-colors"
    :class="data.is_active ? 'border-slate-300 bg-white' : 'border-rose-200 bg-rose-50/70 opacity-80'"
  >
    <Handle type="target" :position="Position.Top" class="unit-node__handle" />
    <p class="m-0 max-w-[12rem] truncate text-sm font-bold text-slate-800" :title="data.name">{{ data.name }}</p>
    <p class="m-0 mt-1 flex items-center gap-1.5">
      <span class="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
        {{ data.unit_type_name || 'Sin tipo' }}
      </span>
      <span v-if="!data.is_active" class="text-[11px] font-semibold text-rose-500">Inactiva</span>
    </p>
    <Handle type="source" :position="Position.Bottom" class="unit-node__handle" />
  </div>
</template>

<script setup>
import { Handle, Position } from "@vue-flow/core";

defineProps({
  data: { type: Object, required: true }
});
</script>

<style scoped>
.unit-node__handle {
  width: 9px;
  height: 9px;
  background: #6366f1;
  border: 2px solid #fff;
}
</style>
