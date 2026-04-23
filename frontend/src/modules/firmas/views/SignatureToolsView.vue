<template>
  <div class="min-h-screen bg-slate-100">
    <section class="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <AppPageIntro
        variant="dashboard"
        title="Herramientas de firma"
        meta="Firma manual, solicitudes, validación y multifirmador general"
        description="Esta vista concentra las utilidades generales de firmas electrónicas fuera del dashboard operativo."
      >
        <template #actions>
          <AppButton variant="secondary" size="md" class-name="whitespace-nowrap" @click="router.push({ name: 'dashboard-signatures' })">
            Volver a firmas del dashboard
          </AppButton>
        </template>
      </AppPageIntro>

      <section class="rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-200/30">
        <FirmarPdf />
      </section>
    </section>
  </div>
</template>

<script setup>
import { useRouter } from "vue-router";
import AppButton from "@/shared/components/buttons/AppButton.vue";
import AppPageIntro from "@/shared/components/layout/AppPageIntro.vue";
import FirmarPdf from "@/modules/firmas/components/FirmarPdf.vue";

const router = useRouter();
</script>
