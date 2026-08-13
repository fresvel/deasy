<template>
  <AppModalShell
    controlled
    :open="open"
    labelled-by="processDefinitionLaunchModalLabel"
    title="Lanzar configuración de proceso"
    size="lg"
    @close="close"
  >
    <div class="flex flex-col gap-4">
      <div v-if="definition" class="rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
        <span class="font-semibold text-body">Configuración:</span>
        <span class="ml-1 text-icon">{{ definition.name || `#${definition.id}` }}</span>
      </div>

      <div v-if="loading" class="text-sm text-muted">Cargando información de lanzamiento...</div>

      <template v-else>
        <div v-if="!periodTypes.length" class="text-sm text-muted italic">
          Esta configuración no tiene tipos de periodo activos. Defínelos en "Periodos del proceso" antes de lanzar.
        </div>

        <template v-else>
          <div class="flex flex-col gap-2">
            <label :for="fieldId('selectedtermid')" class="text-xs font-bold uppercase tracking-wider text-muted">Periodo</label>
            <select :id="fieldId('selectedtermid')"
              v-model="selectedTermId"
              class="h-10 rounded-xl border border-line px-3 text-sm"
            >
              <option value="" disabled>Selecciona un periodo</option>
              <option v-for="t in terms" :key="t.id" :value="String(t.id)">
                {{ t.name }}{{ t.launched ? " — ya lanzado" : "" }}
              </option>
            </select>
            <p v-if="!terms.length" class="text-xs text-muted italic">
              No hay periodos activos de los tipos en que corre este proceso.
            </p>
          </div>

          <div v-if="selectedTerm" class="flex flex-col gap-2 rounded-2xl border border-line bg-white px-4 py-3">
            <span class="text-sm" :class="selectedTerm.launched ? 'text-amber-600 font-medium' : 'text-muted font-medium'">
              {{ selectedTerm.launched ? "Este proceso ya está lanzado en el periodo seleccionado." : "Pendiente de lanzar en este periodo." }}
            </span>
            <div v-if="selectedTerm.launched" class="flex flex-col gap-2">
              <label :for="fieldId('relaunchreason')" class="text-xs font-semibold text-icon">Motivo del relanzamiento (opcional)</label>
              <input :id="fieldId('relaunchreason')"
                v-model="relaunchReason"
                type="text"
                class="h-10 rounded-xl border border-line px-3 text-sm"
                placeholder="Ej. se agregaron nuevos destinatarios"
              />
            </div>
            <div class="flex justify-end">
              <AppButton
                v-if="!selectedTerm.launched"
                variant="success"
                :disabled="busy"
                @click="launch(false)"
              >
                Lanzar en este periodo
              </AppButton>
              <AppButton
                v-else
                variant="secondary"
                :disabled="busy"
                @click="launch(true)"
              >
                Relanzar en este periodo
              </AppButton>
            </div>
          </div>
        </template>

        <div class="flex flex-col gap-2">
          <span class="text-xs font-bold uppercase tracking-wider text-muted">Historial de corridas</span>
          <div v-if="!runs.length" class="text-sm text-muted italic">Sin corridas registradas.</div>
          <ul v-else class="flex flex-col gap-1.5 m-0 p-0 list-none">
            <li
              v-for="run in runs"
              :key="run.id"
              class="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/60 px-3 py-2 text-sm"
            >
              <span class="text-icon">
                #{{ run.id }} · {{ run.term_name || "sin periodo" }}
                <span class="text-muted">({{ run.run_mode }}{{ run.source_run_id ? `, relanzó #${run.source_run_id}` : "" }})</span>
              </span>
              <span :class="runStatusClass(run.status)">{{ run.status }}</span>
            </li>
          </ul>
        </div>
      </template>
    </div>

    <template #footer>
      <AppButton variant="outlineDanger" :disabled="busy" @click="close">Cerrar</AppButton>
    </template>
  </AppModalShell>
</template>

<script setup>
import { computed, ref, useId } from "vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import { adminSqlService } from "@/modules/admin/services/AdminSqlService";


// Enlaza cada <label for> con su control. useId() da un prefijo distinto por
// instancia, para que dos montajes simultaneos no compartan el mismo id.
const uid = useId();
const fieldId = (name) => `${uid}-${name}`;
const emit = defineEmits(["notify", "changed", "close"]);

const open = ref(false);
const loading = ref(false);
const busy = ref(false);
const definition = ref(null);
const periodTypes = ref([]);
const terms = ref([]);
const runs = ref([]);
const selectedTermId = ref("");
const relaunchReason = ref("");

const selectedTerm = computed(() => terms.value.find((t) => String(t.id) === String(selectedTermId.value)) || null);

const runStatusClass = (status) => {
  if (status === "active") return "text-emerald-600 font-medium";
  if (status === "cancelled") return "text-red-500 font-medium";
  return "text-muted font-medium";
};

const loadInfo = async () => {
  if (!definition.value?.id) return;
  loading.value = true;
  try {
    const response = await adminSqlService.getProcessDefinitionLaunchInfo(definition.value.id);
    const data = response?.data || {};
    periodTypes.value = data.period_types || [];
    terms.value = data.terms || [];
    runs.value = data.runs || [];
    if (selectedTermId.value && !terms.value.some((t) => String(t.id) === String(selectedTermId.value))) {
      selectedTermId.value = "";
    }
  } catch (error) {
    emit("notify", {
      kind: "error",
      title: "No se pudo cargar",
      message: error?.response?.data?.error || error?.response?.data?.message || "Error al cargar la información de lanzamiento."
    });
    periodTypes.value = [];
    terms.value = [];
    runs.value = [];
  } finally {
    loading.value = false;
  }
};

const openModal = async (definitionRow) => {
  definition.value = definitionRow || null;
  selectedTermId.value = "";
  relaunchReason.value = "";
  open.value = true;
  await loadInfo();
};

const close = () => {
  open.value = false;
  emit("close");
};

const launch = async (relaunch) => {
  if (!definition.value?.id || !selectedTerm.value || busy.value) return;
  busy.value = true;
  try {
    const response = await adminSqlService.launchProcessDefinition(definition.value.id, {
      term_id: Number(selectedTerm.value.id),
      relaunch,
      reason: relaunch ? (relaunchReason.value || null) : null
    });
    const result = response?.data || {};
    relaunchReason.value = "";
    emit("notify", {
      kind: "success",
      title: relaunch ? "Proceso relanzado" : "Proceso lanzado",
      message: `${definition.value.name}: ${result.tasks_created ?? 0} tarea(s), ${result.task_items_created ?? 0} entregable(s).`
    });
    emit("changed");
    await loadInfo();
  } catch (error) {
    emit("notify", {
      kind: "error",
      title: relaunch ? "No se pudo relanzar" : "No se pudo lanzar",
      message: error?.response?.data?.error || error?.response?.data?.message || "Error al lanzar la configuración."
    });
  } finally {
    busy.value = false;
  }
};

defineExpose({ openModal, close });
</script>
