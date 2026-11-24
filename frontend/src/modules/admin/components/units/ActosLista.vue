<template>
  <!-- UNA LISTA DE ACTOS CON SU PAPEL (frente 27, F27.P4.T11): cada acto dice si su documento se firmó
       en el sistema, si se adjuntó o si falta, y a los externos se les sube, se les cambia o se les
       quita el PDF aquí mismo. La usan la pestaña «Actos» del modal de un nodo —con los actos que
       ese nodo cita— y la lista general de la pantalla de actos.
       Cambiar o quitar el fichero de un acto que ya ordena algo es una corrección: pide el motivo. -->
  <div class="flex flex-col gap-3">
    <AppAlert v-if="error" variant="danger">{{ error }}</AppAlert>
  <ul class="m-0 flex list-none flex-col gap-2 p-0">
    <li v-for="acto in actos" :key="acto.id" class="flex flex-col gap-2 rounded-xl border border-line px-3 py-2.5">
      <div class="flex items-start gap-2">
        <div class="min-w-0 flex-1">
          <p class="m-0 text-sm font-semibold text-strong">{{ acto.tipo }} {{ acto.numero }}</p>
          <p class="m-0 mt-0.5 text-sm text-icon">{{ acto.asunto }}</p>
          <p class="m-0 mt-0.5 text-theme-xs text-muted">
            {{ acto.emisor }} · emitido el {{ acto.fecha_emision }}<span v-if="acto.ordena_algo && !acto.papel"> · ya ordena cambios de la estructura</span>
          </p>
          <!-- En el modal de un nodo: qué hizo este acto con él. -->
          <p v-if="acto.papel" class="m-0 mt-0.5 text-theme-xs font-semibold text-icon">{{ acto.papel }}</p>
        </div>
        <AppTag :variant="acto.documento ? 'success' : 'warning'" outlined class-name="shrink-0">{{ ROTULO[acto.documento] || "Sin documento" }}</AppTag>
      </div>

      <!-- El firmado en el sistema no se toca desde aquí: es un documento del sistema. -->
      <div v-if="acto.documento !== 'firmado'" class="flex flex-wrap items-center justify-end gap-2">
        <span v-if="acto.documento === 'adjunto'" class="mr-auto min-w-0 truncate text-theme-xs text-muted" :title="acto.adjunto_nombre">
          {{ acto.adjunto_nombre }} · {{ enKb(acto.adjunto_bytes) }}
        </span>
        <AppButton v-if="acto.documento === 'adjunto'" variant="neutral-outline" :disabled="ocupado" @click="ver(acto)">Ver</AppButton>
        <template v-if="editable && pidiendoMotivo?.id !== acto.id">
          <template v-if="!esCorreccion(acto) || puedeCorregir">
            <AppButton v-if="acto.documento === 'adjunto'" variant="danger-outline" :disabled="ocupado" @click="pedir(acto, 'quitar')">Quitar</AppButton>
            <AppButton variant="primary-outline" :disabled="ocupado" @click="pedir(acto, 'subir')">
              {{ acto.documento === "adjunto" ? "Cambiar" : "Adjuntar PDF" }}
            </AppButton>
          </template>
          <span v-else class="text-theme-xs text-muted">Cambiarlo es una corrección, y pide un permiso que no tienes.</span>
        </template>
      </div>

      <!-- CAMBIAR O QUITAR EL FICHERO DE UN ACTO QUE YA ORDENA ALGO ES UNA CORRECCIÓN. -->
      <div v-if="pidiendoMotivo?.id === acto.id" class="flex flex-col gap-2">
        <label class="deasy-form-label">
          Motivo de la corrección
          <textarea v-model="motivo" rows="2" class="deasy-control" placeholder="Qué estaba mal y por qué"></textarea>
          <span class="text-theme-xs font-normal text-muted">Este acto ya ordena cambios de la estructura: {{ pidiendoMotivo.que === "quitar" ? "quitar" : "cambiar" }} su fichero queda en la bitácora de correcciones, con el que tenía.</span>
        </label>
        <div class="flex justify-end gap-2">
          <AppButton variant="danger-outline" :disabled="ocupado" @click="pidiendoMotivo = null">Cancelar</AppButton>
          <AppButton variant="primary-outline" :disabled="ocupado || motivo.trim().length < MOTIVO_MINIMO" @click="confirmarConMotivo(acto)">
            {{ pidiendoMotivo.que === "quitar" ? "Quitar el fichero" : "Elegir el PDF nuevo" }}
          </AppButton>
        </div>
      </div>
    </li>
  </ul>
    <!-- Un solo selector de fichero para toda la lista: se abre para el acto que lo pidió. -->
    <input ref="selector" type="file" accept="application/pdf" class="hidden" @change="alElegir" />
  </div>
</template>

<script setup>
import { ref } from "vue";
import AppAlert from "@/shared/components/feedback/AppAlert.vue";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import AppTag from "@/shared/components/data/AppTag.vue";
import { adminSqlService } from "@/modules/admin/services/AdminSqlService";
import { MOTIVO_MINIMO, puedeCorregirLaEstructura } from "@/modules/admin/composables/estructura/useNodeVigencia.js";

defineProps({
  /* [{ id, tipo, numero, asunto, emisor, fecha_emision, documento, adjunto_nombre, adjunto_bytes,
        ordena_algo, papel? }] */
  actos: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false }
});
/* `cambio`: se subió, se cambió o se quitó un fichero. Quien usa la lista vuelve a pedirla. */
const emit = defineEmits(["cambio"]);

const ROTULO = Object.freeze({ firmado: "Firmado en el sistema", adjunto: "Adjunto" });
const puedeCorregir = puedeCorregirLaEstructura();
const ocupado = ref(false);
const error = ref("");
const enKb = (bytes) => `${Math.max(1, Math.round((Number(bytes) || 0) / 1024))} KB`;

/* Es una corrección cuando el acto ya tiene fichero Y ya ordena algo. Subir el primero nunca lo es. */
const esCorreccion = (acto) => acto.documento === "adjunto" && acto.ordena_algo;

const selector = ref(null);
const paraElActo = ref(null);
const pidiendoMotivo = ref(null);
const motivo = ref("");

const trabajar = async (accion, alFallar) => {
  ocupado.value = true;
  error.value = "";
  try {
    await accion();
    pidiendoMotivo.value = null;
    emit("cambio");
  } catch (e) {
    error.value = e?.response?.data?.message || alFallar;
  } finally {
    ocupado.value = false;
  }
};

const abrirSelector = (acto, conMotivo = "") => {
  paraElActo.value = { id: acto.id, motivo: conMotivo };
  selector.value.value = "";
  selector.value.click();
};
const quitar = (acto, conMotivo = "") =>
  trabajar(() => adminSqlService.quitarAdjuntoDelActo(acto.id, { motivo: conMotivo }), "No se pudo quitar el fichero.");

/* `que` = "subir" | "quitar". Si es una corrección, antes se pide el motivo. */
const pedir = (acto, que) => {
  if (esCorreccion(acto)) {
    motivo.value = "";
    pidiendoMotivo.value = { id: acto.id, que };
    return null;
  }
  return que === "quitar" ? quitar(acto) : abrirSelector(acto);
};
const confirmarConMotivo = (acto) => {
  const texto = motivo.value.trim();
  return pidiendoMotivo.value.que === "quitar" ? quitar(acto, texto) : abrirSelector(acto, texto);
};
const alElegir = (evento) => {
  const archivo = evento.target.files?.[0];
  const destino = paraElActo.value;
  if (!archivo || !destino) return null;
  return trabajar(() => adminSqlService.adjuntarAlActo(destino.id, archivo, { motivo: destino.motivo }), "No se pudo subir el fichero.");
};

const ver = async (acto) => {
  error.value = "";
  try {
    const { data } = await adminSqlService.descargarAdjuntoDelActo(acto.id);
    const url = URL.createObjectURL(data);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch {
    error.value = "No se pudo abrir el fichero.";
  }
};
</script>
