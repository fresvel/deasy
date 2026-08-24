<template>
  <!-- Solo se muestra a quien encabeza alguna unidad (is_supervisor). Si no, no renderiza nada. -->
  <section
    v-if="isSupervisor"
    class="deasy-card p-5 md:p-6 flex flex-col gap-4"
  >
    <div class="flex items-start justify-between gap-3">
      <div>
        <h2 class="deasy-title deasy-title--block">Supervisión — entregables atascados</h2>
        <p class="m-0 mt-0.5 text-xs font-medium text-muted">
          Entregables abiertos en tus unidades (y sus dependencias) que no tienen responsable o cuyo titular ya no ocupa el puesto.
        </p>
      </div>
      <AppButton
        variant="neutral-outline"
        :disabled="loading"
        @click="load"
      >↻ Actualizar</AppButton>
    </div>

    <div v-if="loading" class="deasy-card px-4 py-4 text-sm font-medium text-muted">
      Cargando…
    </div>
    <AppAlert v-else-if="error">
      {{ error }}
    </AppAlert>
    <AppAlert variant="success" v-else-if="!items.length">
      Sin entregables atascados. Todo asignado. ✓
    </AppAlert>

    <div v-else class="flex flex-col gap-4">
      <div v-for="group in grouped" :key="group.unit_id ?? 'sin-unidad'" class="flex flex-col gap-2">
        <h3 class="deasy-overline">{{ group.unit_name || 'Sin unidad' }}</h3>
        <div
          v-for="item in group.items"
          :key="item.id"
          class="deasy-card flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
        >
          <div class="flex flex-col">
            <span class="text-sm font-semibold text-body">
              {{ item.cargo_name || 'Cargo' }} · entregable #{{ item.id }}
            </span>
            <span class="text-xs font-medium text-muted">Estado: {{ item.status }}</span>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <AppTag :variant="item.reason === 'sin_responsable' ? 'warning' : 'danger'">
              {{ item.reason === 'sin_responsable' ? 'Sin responsable' : 'Titular se fue' }}
            </AppTag>
            <AppTag v-if="item.started" variant="primary">Iniciado</AppTag>

            <!-- Reasignar. Se ofrece la gente de la unidad y no un buscador a propósito: un jefe
                 reparte dentro de lo suyo, así que la lista es corta y cerrada. -->
            <SSelect
              :model-value="destino[item.id] ?? ''"
              :options="staffOptions(item.unit_id)"
              placeholder="Reasignar a…"
              class="min-w-52"
              @update:modelValue="(v) => (destino[item.id] = v)"
            />
            <AppButton
              variant="primary-soft"
              :disabled="!destino[item.id] || busy === item.id"
              @click="reasignar(item)"
            >Reasignar</AppButton>

            <!-- Reiniciar. Es lo único que desatasca un entregable EN FIRMA cuyo titular se fue:
                 ni el relevo automático lo mueve ni el propio titular puede pedirlo ya. -->
            <AppButton
              variant="neutral-outline"
              :disabled="busy === item.id"
              @click="reiniciar(item)"
            >Reiniciar flujo</AppButton>
          </div>
        </div>
      </div>
      <AppAlert v-if="mensaje" variant="success">{{ mensaje }}</AppAlert>
      <AppAlert v-if="accionError" variant="danger">{{ accionError }}</AppAlert>
      <p class="m-0 text-theme-xs text-muted">
        Total atascados: <span class="font-semibold text-icon">{{ items.length }}</span>.
      </p>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import AppTag from "@/shared/components/data/AppTag.vue";
// ⚠️ `AppButton` NO estaba importado, y el «↻ Actualizar» de este panel llevaba desde su nacimiento
// renderizándose como `<appbutton>` —un elemento desconocido para el navegador: sin estilo, sin
// caja y sin fallar—. Ni el lint ni el build lo ven: Vue resuelve los componentes en tiempo de
// ejecución. Se destapó al probar los botones nuevos en el navegador, no con una prueba.
import AppButton from "@/shared/components/buttons/AppButton.vue";
import axios from "@/core/services/httpClient";
import { API_ROUTES } from "@/core/config/apiConfig";
import AppAlert from "@/shared/components/feedback/AppAlert.vue";
import SSelect from "@/shared/components/forms/SSelect.vue";

const isSupervisor = ref(false);
const items = ref([]);
const staff = ref([]);
const loading = ref(false);
const error = ref("");
const destino = reactive({});
const busy = ref(null);
const mensaje = ref("");
const accionError = ref("");

const grouped = computed(() => {
  const map = new Map();
  for (const it of items.value) {
    const key = it.unit_id ?? 0;
    if (!map.has(key)) map.set(key, { unit_id: it.unit_id, unit_name: it.unit_name, items: [] });
    map.get(key).items.push(it);
  }
  return [...map.values()];
});

const load = async () => {
  loading.value = true;
  error.value = "";
  try {
    const { data } = await axios.get(API_ROUTES.TAREA_SUPERVISED_STUCK);
    isSupervisor.value = Boolean(data?.is_supervisor);
    items.value = Array.isArray(data?.items) ? data.items : [];
    staff.value = Array.isArray(data?.staff) ? data.staff : [];
  } catch {
    error.value = "No se pudo cargar la supervisión.";
  } finally {
    loading.value = false;
  }
};

// La gente de ESA unidad. El backend manda la plantilla de todas las unidades implicadas en una
// sola consulta, así que aquí sólo hay que filtrar.
const staffOptions = (unitId) =>
  staff.value
    .filter((s) => Number(s.unit_id) === Number(unitId))
    .map((s) => ({ value: String(s.person_id), label: s.cargo_name ? `${s.person_name} — ${s.cargo_name}` : s.person_name }));

const ejecutar = async (item, peticion, exito) => {
  busy.value = item.id;
  mensaje.value = "";
  accionError.value = "";
  try {
    await peticion();
    mensaje.value = exito;
    await load();
  } catch (e) {
    // El backend explica POR QUÉ en texto plano (fuera de tu unidad, documento cerrado…), y ese
    // mensaje es más útil que uno genérico: se muestra tal cual.
    accionError.value = e?.response?.data?.message || "No se pudo completar la acción.";
  } finally {
    busy.value = null;
  }
};

const reasignar = (item) =>
  ejecutar(
    item,
    () => axios.post(API_ROUTES.TAREA_SUPERVISED_HANDOVER(item.id), { to_person_id: Number(destino[item.id]) }),
    `Entregable #${item.id} reasignado.`,
  );

const reiniciar = (item) =>
  ejecutar(
    item,
    () => axios.post(API_ROUTES.TAREA_SUPERVISED_RESET(item.id), {}),
    `Flujo del entregable #${item.id} reiniciado: nace una versión nueva y la anterior se conserva.`,
  );

onMounted(load);
</script>
