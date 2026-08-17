<template>
  <!-- ⚠️ EL CENTRADO VIVE AQUI DESDE EL 2026-08-16, y antes no hacia falta: la forma `compact`
       nacio para el rail de 80 px, que la centraba con su propio `items-center`. Al morir el rail
       (F4.C·B) el avatar se quedo pegado a la izquierda de una columna de 282, y no se noto hasta
       medir la distancia al centro. Una forma que depende de que su contenedor la centre no esta
       terminada: el centrado es suyo. -->
  <div v-if="compact" class="flex w-full justify-center">
    <button
      type="button"
      class="deasy-nav-avatar group"
      :class="{ 'cursor-pointer': editable, 'cursor-default': !editable }"
      :title="username"
      :aria-label="`Perfil de ${username}`"
      @click="handleImageClick"
    >
      <img :src="displayPhoto" alt="User Avatar" class="block h-full w-full rounded-2xl bg-white object-cover">
      <span
        v-if="signatureMarker"
        class="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-navy-deep bg-emerald-400"
        aria-hidden="true"
      ></span>
    </button>
    <input
      v-if="editable"
      ref="fileInput"
      type="file"
      accept="image/*"
      aria-label="Selecciona una foto de perfil"
      class="hidden"
      @change="onFileChange"
    >
  </div>

  <div v-else class="mb-3 w-full">
    <div
      class="overflow-hidden rounded-2xl border border-line bg-surface p-3 shadow-none"
    >
      <div class="flex items-center gap-3">
        <div 
          class="relative shrink-0 transition-transform hover:scale-[1.03]"
          :class="{ 'cursor-pointer': editable, 'cursor-default': !editable }"
          @click="handleImageClick"
        >
          <div class="group relative h-12 w-12 rounded-xl border border-line bg-white p-1 shadow-none">
            <img :src="displayPhoto" alt="User Avatar" class="block h-full w-full rounded-full bg-white object-cover">
            <div 
              v-if="editable" 
              class="absolute inset-1 flex items-center justify-center rounded-full bg-navy/80 px-1 text-center text-[10px] font-semibold text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            >
              <span>Foto</span>
            </div>
          </div>
          <input
            v-if="editable"
            ref="fileInput"
            type="file"
            accept="image/*"
            aria-label="Selecciona una foto de perfil"
            class="hidden"
            @change="onFileChange"
          >
        </div>

        <div class="min-w-0 flex-1">
          <h3 class="m-0 truncate text-sm font-semibold leading-tight text-strong">
            {{ username }}
          </h3>
          <p class="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            {{ subtitle }}
          </p>
          <div v-if="showSignatureDetails && signatureMarker" class="mt-2 rounded-2xl border border-line bg-white px-2.5 py-1.5">
            <p class="m-0 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">Token firma</p>
            <p class="mt-1 truncate font-mono text-xs text-body">
              {{ signatureMarker }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, defineProps, defineEmits, ref } from 'vue';

const props = defineProps({
    photo: {
        type: String,
        default: '/images/avatar.png'
    },
    username: {
        type: String,
        default: 'Usuario'
    },
    subtitle: {
        type: String,
        default: 'Cuenta institucional'
    },
    signatureMarker: {
        type: String,
        default: ''
    },
    showSignatureDetails: {
        type: Boolean,
        default: true
    },
    editable: {
        type: Boolean,
        default: false
    },
    compact: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['photo-selected']);

const fileInput = ref(null);
const displayPhoto = computed(() => props.photo || '/images/avatar.png');

const handleImageClick = () => {
    if (!props.editable) {
        return;
    }
    fileInput.value?.click();
};

const onFileChange = (event) => {
    const [file] = event.target.files || [];
    if (!file) {
        return;
    }
    emit('photo-selected', file);
    event.target.value = '';
};
</script>
