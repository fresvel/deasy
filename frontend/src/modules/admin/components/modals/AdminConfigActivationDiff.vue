<template>
  <div class="deasy-card px-3 py-2.5 text-sm">
    <p class="deasy-overline mb-2">Qué cambia al activar</p>

    <div v-if="loading" class="text-xs text-muted">Calculando cambios…</div>
    <div v-else-if="error" class="text-xs text-danger">{{ error }}</div>

    <template v-else-if="diff">
      <p v-if="!diff.has_active" class="m-0 text-xs text-icon">
        Primera activación de esta serie (no hay una versión activa que reemplazar). Se activará la <strong>v{{ diff.to_version }}</strong>.
      </p>
      <template v-else>
        <p class="m-0 mb-2 text-xs text-icon">
          Reemplaza la versión activa <strong>v{{ diff.from_version }}</strong> por la <strong>v{{ diff.to_version }}</strong>.
        </p>

        <p class="m-0 mb-1 text-theme-xs font-semibold text-muted">Entregables</p>
        <ul class="m-0 mb-2 flex list-none flex-col gap-1 p-0">
          <li v-for="t in diff.templates" :key="t.template_code" class="flex items-center gap-2 text-xs">
            <AppTag :variant="tonoDiff(t.change)" outlined>{{ changeLabel(t.change) }}</AppTag>
            <span class="font-medium text-body">{{ t.display_name || t.template_code }}</span>
            <span v-if="t.change === 'changed'" class="text-muted">v{{ t.from_version }} → <strong>v{{ t.to_version }}</strong></span>
            <span v-else-if="t.change === 'added'" class="text-muted">nueva · v{{ t.to_version }}</span>
            <span v-else-if="t.change === 'removed'" class="text-muted">se quita (v{{ t.from_version }})</span>
            <span v-else class="text-muted">sin cambios · v{{ t.to_version }}</span>
          </li>
          <li v-if="!diff.templates.length" class="text-xs text-muted">Sin entregables.</li>
        </ul>

        <p class="m-0 text-theme-xs text-muted">
          Reglas: {{ diff.rules.from }} → {{ diff.rules.to }} · Periodos: {{ diff.period_types.from }} → {{ diff.period_types.to }}
        </p>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { adminSqlService } from "@/modules/admin/services/AdminSqlService";
import AppTag from "@/shared/components/data/AppTag.vue";
import { tonoDiff } from "@/shared/utils/estadoTono.js";

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
/* `changeClass` murio el 2026-08-15 (F3.3 · L5). `changeLabel` se queda: es TEXTO, y el corte de
   esta fase es justamente ese —quien pregunta por el color se va, quien pregunta por el dato se
   queda—. `changed` pasa de ambar a INFO, porque el ambar ya significa «retirado» y un cambio no
   es bueno ni malo; `removed` conserva el rojo, que quitar si es destruir. */
</script>
