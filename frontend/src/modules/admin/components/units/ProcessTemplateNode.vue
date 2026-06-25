<template>
  <div
    class="tpl-node relative rounded-md border border-violet-200 border-l-4 border-l-violet-400 bg-violet-50/50 px-2.5 py-1.5 shadow-sm transition-all"
    :class="data.highlighted ? 'ring-2 ring-indigo-400 ring-offset-1' : ''"
    :title="data.display_name"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
  >
    <Handle type="target" :position="Position.Top" class="tpl-node__handle" />

    <div v-if="hover && data.editable" class="nodrag nopan tpl-node__toolbar">
      <button v-if="data.template_scope === 'ad_hoc'" type="button" class="tpl-node__btn" title="Versionar entregable" @click.stop="data.onVersion?.(data)">
        <IconGitBranch class="h-4 w-4" />
      </button>
      <button type="button" class="tpl-node__btn" title="Crear un entregable a partir de este" @click.stop="data.onClone?.(data)">
        <IconCopy class="h-4 w-4" />
      </button>
      <button type="button" class="tpl-node__btn" title="Agregar entregable hermano" @click.stop="data.onAddSibling?.(data)">
        <IconPlus class="h-4 w-4" />
      </button>
    </div>
    <p class="m-0 flex items-center gap-1">
      <IconFileText class="h-3.5 w-3.5 shrink-0 text-violet-500" />
      <span class="max-w-[8.5rem] truncate text-[12px] font-semibold text-slate-700">{{ data.display_name }}</span>
    </p>
    <p class="m-0 mt-0.5">
      <span class="inline-flex items-center rounded bg-violet-100 px-1 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-200" :title="`Código de plantilla: ${data.template_code}`">{{ data.template_code }}</span>
    </p>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { Handle, Position } from "@vue-flow/core";
import { IconFileText, IconGitBranch, IconPlus, IconCopy } from "@tabler/icons-vue";

defineProps({
  data: { type: Object, required: true }
});
const hover = ref(false);
</script>

<style scoped>
.tpl-node {
  width: 170px;
}
.tpl-node__handle {
  width: 8px;
  height: 8px;
  background: #a78bfa;
  border: 2px solid #fff;
}
.tpl-node__toolbar {
  position: absolute;
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  padding-left: 6px;
  display: inline-flex;
  flex-direction: column;
  gap: 4px;
  z-index: 6;
}
.tpl-node__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 26px;
  width: 26px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid #e2e8f0;
  color: #6d28d9;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.12);
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.tpl-node__btn:hover {
  background: #f5f3ff;
  border-color: #ddd6fe;
  color: #6d28d9;
}
</style>
