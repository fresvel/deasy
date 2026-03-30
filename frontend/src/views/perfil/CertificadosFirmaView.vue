<template>
  <div class="w-full">
    <section class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-slate-800 m-0">Certificados de firma</h2>
        <p class="text-sm text-slate-500 mt-2 mb-0">
          Gestiona los certificados digitales asociados a tu perfil y define cuál usar por defecto al firmar.
        </p>
      </div>
      <UserCertificatesPanel
        title=""
        description=""
      />
    </section>
  </div>
</template>

<script setup>
import UserCertificatesPanel from "@/components/UserCertificatesPanel.vue";
</script>
