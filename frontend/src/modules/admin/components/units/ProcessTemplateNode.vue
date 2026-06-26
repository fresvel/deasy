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
      <button v-if="data.parentConfigStatus === 'active'" type="button" class="tpl-node__btn tpl-node__btn--accent" title="Actualizar plantilla (nueva versión de plantilla + configuración, publica y activa juntas)" @click.stop="data.onGuidedUpdate?.(data)">
        <IconRefresh class="h-4 w-4" />
      </button>
      <button type="button" class="tpl-node__btn" title="Versionar entregable (crea una versión en borrador)" @click.stop="data.onVersion?.(data)">
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
    <p class="m-0 mt-0.5 flex items-center gap-1">
      <span class="inline-flex items-center rounded bg-violet-100 px-1 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-violet-200" :title="`Código de plantilla: ${data.template_code}`">{{ data.template_code }}</span>
      <span
        v-if="data.storage_version"
        class="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-semibold ring-1"
        :class="stateBadgeClass"
        :title="`Versión vinculada: ${data.storage_version} (${stateLabel})${Number(data.version_count) > 1 ? ` · ${data.version_count} versiones` : ''}`"
      >
        <span class="h-1.5 w-1.5 rounded-full" :class="stateDotClass"></span>
        v{{ data.storage_version }}
        <span v-if="Number(data.version_count) > 1" class="opacity-70">· {{ data.version_count }}</span>
      </span>
    </p>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { Handle, Position } from "@vue-flow/core";
import { IconFileText, IconGitBranch, IconPlus, IconCopy, IconRefresh } from "@tabler/icons-vue";
import { computed } from "vue";

const props = defineProps({
  data: { type: Object, required: true }
});
const hover = ref(false);

// Estado de la versión vinculada (badge en el nodo). El detalle de TODAS las versiones va en el drawer.
const lifecycleState = computed(() => String(props.data.lifecycle_state || "published"));
const stateLabel = computed(() => ({ draft: "Borrador", published: "Publicada", retired: "Retirada" }[lifecycleState.value] || lifecycleState.value));
const stateBadgeClass = computed(() => ({
  published: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  draft: "bg-amber-50 text-amber-700 ring-amber-200",
  retired: "bg-slate-100 text-slate-500 ring-slate-200"
}[lifecycleState.value] || "bg-slate-100 text-slate-500 ring-slate-200"));
const stateDotClass = computed(() => ({
  published: "bg-emerald-500",
  draft: "bg-amber-500",
  retired: "bg-slate-400"
}[lifecycleState.value] || "bg-slate-400"));
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
.tpl-node__btn--accent {
  background: #4f46e5;
  border-color: #4f46e5;
  color: #fff;
}
.tpl-node__btn--accent:hover {
  background: #4338ca;
  border-color: #4338ca;
  color: #fff;
}
</style>
