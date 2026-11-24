<template>
  <!-- LOS ACTOS Y SU PAPEL (frente 27, D-05 punto 3; F27.P4.T11). Un acto es su referencia, y el
       documento puede faltar «pero se ve que falta»: aquí se ve. Cada acto dice si su papel se
       firmó en el sistema, si se adjuntó —vino de fuera— o si sigue pendiente; y a los externos se
       les sube, se les cambia o se les quita el PDF.
       La regla de cambiarlo la decide si el acto ya ORDENA algo: si ninguna vida ni relación lo
       cita, sin trámite; si alguna lo cita, es una corrección, con su permiso y su motivo. -->
  <AppModalShell
    controlled
    :open="open"
    title="Actos y su documento"
    content-class="deasy-dialog-panel--viewport max-w-3xl"
    body-class="flex min-h-0 flex-col"
    footer-class="shrink-0"
    @close="$emit('close')"
  >
    <div class="flex shrink-0 items-center justify-between gap-3">
      <p class="m-0 text-sm text-icon">
        <strong class="text-strong">{{ sinDocumento }}</strong> de {{ actos.length }} {{ actos.length === 1 ? "acto" : "actos" }} {{ sinDocumento === 1 ? "sigue" : "siguen" }} sin documento.
      </p>
      <AppButton
        :variant="soloPendientes ? 'warning-soft' : 'neutral-outline'"
        :aria-pressed="soloPendientes"
        @click="soloPendientes = !soloPendientes"
      >Sólo sin documento</AppButton>
    </div>

    <AppAlert v-if="error" variant="danger" class="mt-3 shrink-0">{{ error }}</AppAlert>

    <div class="mt-4 min-h-0 flex-1 overflow-y-auto">
      <p v-if="cargando" class="m-0 text-sm text-muted">Cargando…</p>
      <AppEmpty v-else-if="!visibles.length" :icon="false">
        {{ actos.length ? "Todos los actos tienen su documento." : "Todavía no hay ningún acto registrado." }}
      </AppEmpty>
      <ActosLista v-else :actos="visibles" :editable="editable" @cambio="alCambiar" />
    </div>

    <template #footer>
      <AppButton variant="neutral-outline" @click="$emit('close')">Cerrar</AppButton>
    </template>
  </AppModalShell>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import AppAlert from "@/shared/components/feedback/AppAlert.vue";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import AppEmpty from "@/shared/components/feedback/AppEmpty.vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";
import ActosLista from "@/modules/admin/components/units/ActosLista.vue";
import { adminSqlService } from "@/modules/admin/services/AdminSqlService";

const props = defineProps({
  open: { type: Boolean, default: false },
  editable: { type: Boolean, default: false }
});
const emit = defineEmits(["close", "cambio"]);

const actos = ref([]);
const cargando = ref(false);
const error = ref("");
const soloPendientes = ref(true);
const sinDocumento = computed(() => actos.value.filter((a) => !a.documento).length);
const visibles = computed(() => (soloPendientes.value ? actos.value.filter((a) => !a.documento) : actos.value));

const cargar = async () => {
  cargando.value = true;
  error.value = "";
  try {
    const { data } = await adminSqlService.getActosYSuDocumento();
    actos.value = Array.isArray(data) ? data : [];
    // Si no queda ninguno pendiente, enseñar una lista vacía no dice nada: se enseñan todos.
    if (!sinDocumento.value) soloPendientes.value = false;
  } catch (e) {
    error.value = e?.response?.data?.message || "No se pudieron cargar los actos.";
  } finally {
    cargando.value = false;
  }
};
const alCambiar = async () => {
  await cargar();
  emit("cambio");
};
watch(() => props.open, (abierto) => {
  if (!abierto) return;
  soloPendientes.value = true;
  cargar();
}, { immediate: true });
</script>
