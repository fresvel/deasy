<template>
  <AppModalShell
    controlled
    :open="open"
    labelled-by="processLaunchModalLabel"
    title="Lanzar procesos del periodo"
    size="lg"
    @close="close"
  >
    <div class="flex flex-col gap-4">
      <div v-if="term" class="rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
        <span class="font-semibold text-body">Periodo:</span>
        <span class="ml-1 text-icon">{{ term.name || `#${term.id}` }}</span>
      </div>

      <div v-if="loading" class="text-sm text-muted">Cargando estado de lanzamiento...</div>

      <template v-else>
        <div v-if="!definitions.length" class="text-sm text-muted italic">
          No hay configuraciones de proceso activas vinculadas al tipo de periodo de este periodo.
        </div>

        <div v-else class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="deasy-overline">
              {{ pendingCount }} pendiente(s) · {{ definitions.length }} configuracion(es)
            </span>
            <AppButton
              v-if="pendingCount > 0"
              variant="primaryOutline"
              :disabled="busy"
              @click="launchAllPending"
            >
              Lanzar pendientes
            </AppButton>
          </div>

          <ul class="flex flex-col gap-2 m-0 p-0 list-none">
            <li
              v-for="def in definitions"
              :key="def.definition_id"
              class="flex flex-col gap-2 deasy-card px-4 py-3"
            >
              <div class="flex items-center justify-between gap-3">
                <div class="flex flex-col">
                  <span class="text-sm font-semibold text-body">{{ def.name }}</span>
                  <span class="text-xs" :class="statusClass(def)">{{ statusLabel(def) }}</span>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <AppButton
                    v-if="!def.launched"
                    variant="success"
                    :disabled="busy"
                    @click="launch(def, false)"
                  >
                    Lanzar
                  </AppButton>
                  <AppButton
                    v-else
                    variant="neutralOutline"
                    :disabled="busy"
                    @click="toggleRelaunch(def.definition_id)"
                  >
                    Relanzar
                  </AppButton>
                </div>
              </div>

              <div v-if="relaunchOpenId === def.definition_id" class="flex flex-col gap-2 rounded-xl bg-surface px-3 py-2">
                <label :for="fieldId('relaunchreason')" class="text-xs font-semibold text-icon">Motivo del relanzamiento (opcional)</label>
                <input :id="fieldId('relaunchreason')"
                  v-model="relaunchReason"
                  type="text"
                  class="h-10 rounded-xl border border-line px-3 text-sm"
                  placeholder="Ej. se agregaron nuevos destinatarios"
                />
                <div class="flex justify-end gap-2">
                  <AppButton variant="dangerOutline" :disabled="busy" @click="relaunchOpenId = null">Cancelar</AppButton>
                  <AppButton variant="success" :disabled="busy" @click="launch(def, true)">Confirmar relanzamiento</AppButton>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </template>
    </div>

    <template #footer>
      <AppButton variant="neutralOutline" :disabled="busy" @click="close">Cerrar</AppButton>
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
const emit = defineEmits(["notify", "changed"]);

const open = ref(false);
const term = ref(null);
const loading = ref(false);
const busy = ref(false);
const definitions = ref([]);
const relaunchOpenId = ref(null);
const relaunchReason = ref("");

const pendingCount = computed(() => definitions.value.filter((d) => !d.launched).length);

const statusLabel = (def) => {
  if (def.relaunched) return `Relanzado · ${def.run_count} corridas`;
  if (def.launched) return "Lanzado";
  return "Pendiente";
};
const statusClass = (def) => {
  if (def.relaunched) return "text-warning font-medium";
  if (def.launched) return "text-success font-medium";
  return "text-muted font-medium";
};

const loadStatus = async () => {
  if (!term.value?.id) return;
  loading.value = true;
  try {
    const response = await adminSqlService.getTermLaunchStatus(term.value.id);
    definitions.value = response?.data?.definitions || [];
  } catch (error) {
    emit("notify", {
      kind: "error",
      title: "No se pudo cargar el estado",
      message: error?.response?.data?.error || error?.response?.data?.message || "Error al consultar el estado de lanzamiento."
    });
    definitions.value = [];
  } finally {
    loading.value = false;
  }
};

const openModal = async (termRow) => {
  term.value = termRow || null;
  relaunchOpenId.value = null;
  relaunchReason.value = "";
  open.value = true;
  await loadStatus();
};

const close = () => {
  open.value = false;
};

const toggleRelaunch = (definitionId) => {
  relaunchReason.value = "";
  relaunchOpenId.value = relaunchOpenId.value === definitionId ? null : definitionId;
};

const launch = async (def, relaunch) => {
  if (!term.value?.id || busy.value) return;
  busy.value = true;
  try {
    const response = await adminSqlService.launchProcessDefinition(def.definition_id, {
      term_id: term.value.id,
      relaunch,
      reason: relaunch ? (relaunchReason.value || null) : null
    });
    const result = response?.data || {};
    relaunchOpenId.value = null;
    relaunchReason.value = "";
    emit("notify", {
      kind: "success",
      title: relaunch ? "Proceso relanzado" : "Proceso lanzado",
      message: `${def.name}: ${result.tasks_created ?? 0} tarea(s), ${result.task_items_created ?? 0} entregable(s).`
    });
    emit("changed");
    await loadStatus();
  } catch (error) {
    emit("notify", {
      kind: "error",
      title: relaunch ? "No se pudo relanzar" : "No se pudo lanzar",
      message: error?.response?.data?.error || error?.response?.data?.message || "Error al lanzar la configuracion."
    });
  } finally {
    busy.value = false;
  }
};

const launchAllPending = async () => {
  const pending = definitions.value.filter((d) => !d.launched);
  for (const def of pending) {
    await launch(def, false);
  }
};

defineExpose({ openModal, close });
</script>
