<template>
  <div class="deasy-auth-page flex justify-center">
    <div class="deasy-auth-card flex max-w-4xl flex-col">
      <div class="relative shrink-0 overflow-hidden border-b border-line bg-white p-8 text-navy sm:p-10">
        <div class="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <AppLogo size="lg" class-name="mb-5" />
            <h1 class="text-3xl font-semibold tracking-tight">Términos y Condiciones</h1>
            <p class="mt-2 font-medium text-muted">Políticas de uso del sistema DEASY</p>
          </div>

          <router-link
            to="/register"
            class="inline-flex w-fit shrink-0 items-center gap-2 deasy-card px-5 py-2.5 font-semibold text-body transition-all hover:bg-surface"
          >
            <IconArrowLeft class="h-5 w-5" />
            Volver al registro
          </router-link>
        </div>
      </div>

      <div class="relative w-full grow rounded-b-xl bg-white p-8 sm:p-10 lg:p-12">
        <div v-if="loading" class="flex flex-col items-center justify-center py-20 text-muted">
          <IconLoader class="mb-4 h-10 w-10 animate-spin text-info" />
          <p class="font-medium">Cargando términos y condiciones...</p>
        </div>

        <div v-else-if="error" class="flex flex-col items-center justify-center py-20 text-danger">
          <IconAlertCircle class="mb-4 h-12 w-12" />
          <p class="text-lg font-medium">{{ error }}</p>
          <AppButton variant="info-soft" class-name="mt-6" @click="fetchTerms">
            <IconRefresh class="h-5 w-5" /> Intentar de nuevo
          </AppButton>
        </div>

        <div v-else class="prose prose-slate prose-headings:font-semibold prose-headings:text-navy prose-a:text-info hover:prose-a:text-info prose-h1:text-3xl prose-h2:mt-10 prose-h2:text-2xl prose-p:text-icon prose-li:text-icon max-w-none">
          <div v-html="markdownContent"></div>
        </div>

        <div class="mt-12 flex flex-col items-center justify-between gap-4 border-t border-line pt-8 sm:flex-row">
          <p class="text-sm font-medium text-muted">
            Al registrarte en el sistema, confirmas tu conformidad con estas políticas.
          </p>
          <router-link
            :to="{ path: '/register', query: { terms: 'accepted' } }"
            class="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-light-600 px-8 py-3 text-base font-semibold text-white transition-all hover:bg-blue-light-700 focus:outline-none focus:ring-4 sm:w-auto"
          >
            Entendido
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { marked } from "marked";
import AppLogo from "@/shared/components/layout/AppLogo.vue";
import {
  IconArrowLeft,
  IconLoader,
  IconAlertCircle,
  IconRefresh
} from "@tabler/icons-vue";

const markdownContent = ref("");
const loading = ref(true);
const error = ref("");

const fetchTerms = async () => {
  loading.value = true;
  error.value = "";

  try {
    const response = await fetch("/terms.md");
    if (!response.ok) {
      throw new Error("No se pudo cargar el archivo de términos.");
    }
    const text = await response.text();
    markdownContent.value = marked.parse(text);
  } catch (err) {
    error.value = "Hubo un problema al cargar los términos y condiciones. Por favor verifica tu conexión.";
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchTerms();
});
</script>
