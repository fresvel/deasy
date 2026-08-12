<template>
  <div class="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm">
    <p class="m-0 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Qué cambia al activar</p>

    <div v-if="loading" class="text-xs text-slate-500">Calculando cambios…</div>
    <div v-else-if="error" class="text-xs text-rose-600">{{ error }}</div>

    <template v-else-if="diff">
      <p v-if="!diff.has_active" class="m-0 text-xs text-brand-icon">
        Primera activación de esta serie (no hay una versión activa que reemplazar). Se activará la <strong>v{{ diff.to_version }}</strong>.
      </p>
      <template v-else>
        <p class="m-0 mb-2 text-xs text-brand-icon">
          Reemplaza la versión activa <strong>v{{ diff.from_version }}</strong> por la <strong>v{{ diff.to_version }}</strong>.
        </p>

        <p class="m-0 mb-1 text-[11px] font-semibold text-slate-500">Entregables</p>
        <ul class="m-0 mb-2 flex list-none flex-col gap-1 p-0">
          <li v-for="t in diff.templates" :key="t.template_code" class="flex items-center gap-2 text-xs">
            <span class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1" :class="changeClass(t.change)">{{ changeLabel(t.change) }}</span>
            <span class="font-medium text-slate-700">{{ t.display_name || t.template_code }}</span>
            <span v-if="t.change === 'changed'" class="text-slate-500">v{{ t.from_version }} → <strong>v{{ t.to_version }}</strong></span>
            <span v-else-if="t.change === 'added'" class="text-slate-500">nueva · v{{ t.to_version }}</span>
            <span v-else-if="t.change === 'removed'" class="text-slate-500">se quita (v{{ t.from_version }})</span>
            <span v-else class="text-brand-text-muted">sin cambios · v{{ t.to_version }}</span>
          </li>
          <li v-if="!diff.templates.length" class="text-xs text-brand-text-muted">Sin entregables.</li>
        </ul>

        <p class="m-0 text-[11px] text-slate-500">
          Reglas: {{ diff.rules.from }} → {{ diff.rules.to }} · Periodos: {{ diff.period_types.from }} → {{ diff.period_types.to }}
        </p>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { adminSqlService } from "@/modules/admin/services/AdminSqlService";

const props = defineProps({
  definitionId: { type: [String, Number], default: null }
});

const loading = ref(false);
const error = ref("");
const diff = ref(null);

const load = async () => {
  if (!props.definitionId) {
    diff.value = null;
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    const { data } = await adminSqlService.getConfigActivationDiff(props.definitionId);
    diff.value = data;
  } catch (err) {
    error.value = err?.response?.data?.message || "No se pudieron calcular los cambios.";
    diff.value = null;
  } finally {
    loading.value = false;
  }
};

watch(() => props.definitionId, load, { immediate: true });

const changeLabel = (c) => ({ changed: "Cambia", added: "Nuevo", removed: "Quita", unchanged: "Igual" }[c] || c);
const changeClass = (c) => ({
  changed: "bg-amber-50 text-state-warning ring-amber-200",
  added: "bg-emerald-50 text-state-success ring-emerald-200",
  removed: "bg-rose-50 text-rose-700 ring-rose-200",
  unchanged: "bg-slate-100 text-slate-500 ring-slate-200"
}[c] || "bg-slate-100 text-slate-500 ring-slate-200");
</script>
