<template>
  <div class="deasy-auth-page flex justify-center">
    <div class="deasy-auth-card flex max-w-4xl flex-col">
      <div class="relative shrink-0 overflow-hidden border-b border-slate-200 bg-white p-8 text-slate-950 sm:p-10">
        <div class="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <AppLogo size="lg" class-name="mb-5" />
            <h1 class="text-3xl font-semibold tracking-tight">Términos y Condiciones</h1>
            <p class="mt-2 font-medium text-slate-500">Políticas de uso del sistema DEASY</p>
          </div>

          <router-link
            to="/register"
            class="inline-flex w-fit shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
          >
            <IconArrowLeft class="h-5 w-5" />
            Volver al registro
          </router-link>
        </div>
      </div>

      <div class="relative w-full grow rounded-b-xl bg-white p-8 sm:p-10 lg:p-12">
        <div v-if="loading" class="flex flex-col items-center justify-center py-20 text-slate-400">
          <IconLoader class="mb-4 h-10 w-10 animate-spin text-blue-600" />
          <p class="font-medium">Cargando términos y condiciones...</p>
        </div>

        <div v-else-if="error" class="flex flex-col items-center justify-center py-20 text-red-500">
          <IconAlertCircle class="mb-4 h-12 w-12" />
          <p class="text-lg font-medium">{{ error }}</p>
          <button @click="fetchTerms" class="mt-6 flex items-center gap-2 rounded-lg bg-blue-50 px-6 py-2 font-semibold text-blue-700 transition-colors hover:bg-blue-100">
            <IconRefresh class="h-5 w-5" /> Intentar de nuevo
          </button>
        </div>

        <div v-else class="prose prose-slate prose-headings:font-semibold prose-headings:text-slate-900 prose-a:text-blue-600 hover:prose-a:text-blue-700 prose-h1:text-3xl prose-h2:mt-10 prose-h2:text-2xl prose-p:text-slate-600 prose-li:text-slate-600 max-w-none">
          <div v-html="markdownContent"></div>
        </div>

        <div class="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-8 sm:flex-row">
          <p class="text-sm font-medium text-slate-500">
            Al registrarte en el sistema, confirmas tu conformidad con estas políticas.
          </p>
          <router-link
            :to="{ path: '/register', query: { terms: 'accepted' } }"
            class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-8 py-3 text-base font-semibold text-white transition-all hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 sm:w-auto"
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
