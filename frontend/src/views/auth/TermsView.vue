<template>
  <div class="min-h-screen bg-slate-100 py-8 md:py-12 px-4 sm:px-6 flex justify-center font-sans">
    <div class="max-w-4xl w-full bg-white rounded-4xl shadow-2xl shadow-slate-300/50 flex flex-col border border-slate-200">
      
      <!-- Header -->
      <div class="bg-sky-700 bg-linear-to-br from-sky-800 via-sky-700 to-sky-600 p-8 sm:p-10 rounded-t-4xl text-white relative overflow-hidden shrink-0">
        <!-- Abstract shapes -->
        <div class="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
          <div class="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white blur-3xl opacity-50"></div>
          <div class="absolute top-1/2 right-12 w-64 h-64 rounded-full bg-sky-300 blur-3xl opacity-40"></div>
        </div>
        
        <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div class="flex items-center gap-2 mb-4">
              <span class="text-2xl font-extrabold tracking-tight">PUCE</span>
              <span class="text-2xl font-light tracking-wide">ESMERALDAS</span>
            </div>
            <h1 class="text-3xl font-bold">Términos y Condiciones</h1>
            <p class="text-sky-100/90 mt-2 font-medium">Políticas de uso del sistema DEASY</p>
          </div>
          
          <router-link to="/register" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-sky-800! hover:bg-sky-50 shadow-sm font-bold transition-all w-fit shrink-0">
            <IconArrowLeft class="w-5 h-5" />
            Volver al registro
          </router-link>
        </div>
      </div>

      <!-- Content Container -->
      <div class="w-full p-8 sm:p-10 lg:p-12 relative grow bg-white rounded-b-4xl">
        
        <!-- Loading State -->
        <div v-if="loading" class="flex flex-col items-center justify-center py-20 text-slate-400">
          <IconLoader class="w-10 h-10 animate-spin text-sky-600 mb-4" />
          <p class="font-medium">Cargando términos y condiciones...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="flex flex-col items-center justify-center py-20 text-red-500">
          <IconAlertCircle class="w-12 h-12 mb-4" />
          <p class="font-medium text-lg">{{ error }}</p>
          <button @click="fetchTerms" class="mt-6 px-6 py-2 bg-sky-50 text-sky-700 rounded-xl font-semibold hover:bg-sky-100 flex items-center gap-2 transition-colors">
            <IconRefresh class="w-5 h-5" /> Intentar de nuevo
          </button>
        </div>

        <!-- Markdown Rendered Content -->
        <div v-else class="prose prose-slate prose-headings:text-slate-800 prose-a:text-sky-600 hover:prose-a:text-sky-700 prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h2:mt-10 prose-p:text-slate-600 prose-li:text-slate-600 max-w-none">
          <div v-html="markdownContent"></div>
        </div>
        
        <div class="mt-12 pt-8 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p class="text-sm font-medium text-slate-500">
            Al registrarte en el sistema, confirmas tu conformidad con estas políticas.
          </p>
          <router-link :to="{ path: '/register', query: { terms: 'accepted' } }" class="inline-flex justify-center items-center gap-2 py-3 px-8 rounded-xl text-white! text-base font-bold bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-500/30 transition-all shadow-lg shadow-sky-600/30 w-full sm:w-auto">
            Entendido
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { marked } from 'marked';
import { 
  IconArrowLeft, 
  IconLoader, 
  IconAlertCircle, 
  IconRefresh 
} from '@tabler/icons-vue';

const markdownContent = ref('');
const loading = ref(true);
const error = ref('');

const fetchTerms = async () => {
  loading.value = true;
  error.value = '';
  
  try {
    const response = await fetch('/terms.md');
    if (!response.ok) {
        throw new Error('No se pudo cargar el archivo de términos.');
    }
    const text = await response.text();
    // Parse the markdown string to HTML
    markdownContent.value = marked.parse(text);
  } catch (err) {
    error.value = 'Hubo un problema al cargar los términos y condiciones. Por favor verifica tu conexión.';
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchTerms();
});
</script>