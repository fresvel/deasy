<template>
  <AppModalShell
      v-if="open"
      controlled
      nested :open="open" :title="guided ? 'Actualizar plantilla de configuración activa' : 'Crear nueva versión'" content-class="max-w-md" @close="$emit('close')">
    <p v-if="guided" class="mb-3 mt-0 text-sm text-icon">
      Crea borradores de <strong>{{ template?.display_name || template?.template_code || "la plantilla" }}</strong>
      y de su configuración activa. Editarás el contenido y, al publicar, se <strong>publica la plantilla y se
      activa la nueva configuración</strong> juntas (la versión anterior queda retirada).
    </p>
    <p v-else class="mb-3 mt-0 text-sm text-icon">
      Nueva versión de <strong>{{ template?.display_name || template?.template_code || "la plantilla" }}</strong>.
      Nace <strong>en borrador</strong>, clonada de la versión actual<span v-if="template?.storage_version"> ({{ template.storage_version }})</span>.
    </p>
    <div class="flex flex-col gap-2">
      <label
        v-for="opt in options"
        :key="opt.value"
        class="flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors"
        :class="level === opt.value ? 'border-brand-400 bg-brand-50/60' : 'border-line hover:border-line-strong'"
      >
        <input v-model="level" type="radio" name="tpl-version-bump" :value="opt.value" class="mt-1" />
        <span class="min-w-0">
          <span class="block text-sm font-semibold text-strong">{{ opt.label }} <span class="font-mono text-xs font-normal text-muted">{{ opt.example }}</span></span>
          <span class="block text-xs text-muted">{{ opt.hint }}</span>
        </span>
      </label>
    </div>
    <template #footer>
      <AppButton variant="danger-outline" :disabled="busy" @click="$emit('close')">Cancelar</AppButton>
      <AppButton variant="primary-outline" :disabled="busy" @click="$emit('confirm', level)">{{ busy ? "Creando…" : (guided ? "Crear borradores" : "Crear versión") }}</AppButton>
    </template>
  </AppModalShell>
</template>

<script setup>
import { ref, watch } from "vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";
import AppButton from "@/shared/components/buttons/AppButton.vue";

const props = defineProps({
  open: { type: Boolean, default: false },
  template: { type: Object, default: null },
  busy: { type: Boolean, default: false },
  guided: { type: Boolean, default: false }
});
defineEmits(["close", "confirm"]);

const level = ref("minor");
const options = [
  { value: "patch", label: "Parche", example: "X.Y.Z+1", hint: "Correcciones o ajustes menores." },
  { value: "minor", label: "Menor", example: "X.Y+1.0", hint: "Cambios compatibles (nuevos campos, mejoras)." },
  { value: "major", label: "Mayor", example: "X+1.0.0", hint: "Cambios importantes o incompatibles." }
];
// Reinicia a "minor" cada vez que se abre.
watch(() => props.open, (isOpen) => { if (isOpen) level.value = "minor"; });
</script>
