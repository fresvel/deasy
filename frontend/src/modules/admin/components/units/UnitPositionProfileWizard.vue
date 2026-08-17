<template>
  <AppModalShell
      v-if="open"
      controlled
    :open="open"
    :title="`Perfil del puesto${positionLabel ? ' · ' + positionLabel : ''}`"
    content-class="max-w-lg"
    @close="$emit('close')"
  >
    <!-- Indicador de pasos -->
    <div class="mb-5 flex items-center gap-1.5">
      <template v-for="(step, idx) in stepLabels" :key="idx">
        <div class="flex items-center gap-1.5">
          <span class="profile-step-dot" :class="dotClass(idx)">
            <IconCheck v-if="idx < current" class="h-3.5 w-3.5" />
            <span v-else>{{ idx + 1 }}</span>
          </span>
          <span class="hidden text-theme-xs font-semibold sm:inline" :class="idx === current ? 'text-primary' : 'text-muted'">{{ step }}</span>
        </div>
        <div v-if="idx < stepLabels.length - 1" class="h-px flex-1 bg-gray-200"></div>
      </template>
    </div>

    <!-- Paso de sección -->
    <div v-if="currentSection">
      <h4 :id="sectionTitleId" class="m-0 text-base font-bold text-strong">{{ currentSection.label }}</h4>
      <p class="m-0 mt-1 mb-3 text-sm text-muted">{{ currentSection.hint }}</p>
      <textarea
        v-model="form[currentSection.key]"
        :aria-labelledby="sectionTitleId"
        rows="5"
        class="w-full border px-3 py-2 text-sm outline-none"
        :placeholder="currentSection.placeholder"
      ></textarea>
    </div>

    <!-- Paso de revisión -->
    <div v-else>
      <h4 class="m-0 mb-3 text-base font-bold text-strong">Revisión</h4>
      <ul class="m-0 flex list-none flex-col gap-2.5 p-0">
        <li v-for="section in SECTIONS" :key="section.key" class="rounded-2xl border border-line px-3 py-2">
          <span class="block text-xs font-bold uppercase tracking-wide text-muted">{{ section.label }}</span>
          <p class="m-0 mt-0.5 whitespace-pre-line text-sm" :class="form[section.key] ? 'text-body' : 'italic text-muted'">
            {{ form[section.key] || 'Sin especificar' }}
          </p>
        </li>
      </ul>
    </div>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-3">
        <AppButton v-if="current > 0" variant="neutral-outline" @click="current--">Atrás</AppButton>
        <span v-else></span>
        <div class="flex items-center gap-3">
          <AppButton variant="danger-outline" @click="$emit('close')">Cancelar</AppButton>
          <AppButton v-if="!isReview" variant="primary-outline" @click="current++">Siguiente</AppButton>
          <AppButton v-else variant="primary-outline" @click="submit">Guardar perfil</AppButton>
        </div>
      </div>
    </template>
  </AppModalShell>
</template>

<script setup>
import { ref, computed, watch, useId } from "vue";
import { IconCheck } from "@tabler/icons-vue";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";

// El nombre visible del textarea es el <h4> del paso; se enlaza por aria-labelledby.
// useId() da un prefijo distinto por instancia para no duplicar el id.
const uid = useId();
const sectionTitleId = `${uid}-section-title`;

const props = defineProps({
  open: { type: Boolean, default: false },
  position: { type: Object, default: null }
});
const emit = defineEmits(["close", "save"]);

const SECTIONS = [
  { key: "formacion", label: "Formación", hint: "Formación académica requerida para ocupar el puesto.", placeholder: "Ej. Magíster o PhD en el área afín…" },
  { key: "experiencia", label: "Experiencia", hint: "Experiencia profesional o docente requerida.", placeholder: "Ej. 3 años en docencia universitaria…" },
  { key: "capacitacion", label: "Capacitación", hint: "Capacitaciones o certificaciones requeridas.", placeholder: "Ej. Pedagogía universitaria, ofimática…" },
  { key: "investigacion", label: "Investigación", hint: "Requisitos de investigación o producción académica.", placeholder: "Ej. Publicaciones indexadas, proyectos…" }
];
const stepLabels = [...SECTIONS.map((s) => s.label), "Revisión"];

const current = ref(0);
const form = ref({ formacion: "", experiencia: "", capacitacion: "", investigacion: "" });

const isReview = computed(() => current.value >= SECTIONS.length);
const currentSection = computed(() => (isReview.value ? null : SECTIONS[current.value]));
const positionLabel = computed(() => {
  const p = props.position;
  if (!p) return "";
  return p.cargo_name || p.title || "Puesto";
});

const dotClass = (idx) => {
  if (idx < current.value) return "profile-step-dot--done";
  if (idx === current.value) return "profile-step-dot--active";
  return "profile-step-dot--idle";
};

const resetFromPosition = () => {
  current.value = 0;
  let prof = props.position?.profile || {};
  if (typeof prof === "string") {
    try { prof = JSON.parse(prof); } catch { prof = {}; }
  }
  form.value = {
    formacion: prof.formacion || "",
    experiencia: prof.experiencia || "",
    capacitacion: prof.capacitacion || "",
    investigacion: prof.investigacion || ""
  };
};

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) resetFromPosition();
  },
  { immediate: true }
);

const submit = () => {
  emit("save", { ...form.value });
};
</script>
