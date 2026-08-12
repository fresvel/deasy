<template>
  <div v-if="compact" class="w-full">
    <button
      type="button"
      class="group relative flex h-12 w-12 items-center justify-center rounded-xl border border-brand-white/10 bg-brand-white/8 p-1.5 text-white transition-all hover:bg-brand-white/12 focus:outline-none focus:ring-2 focus:ring-white/18"
      :class="{ 'cursor-pointer': editable, 'cursor-default': !editable }"
      :title="username"
      :aria-label="`Perfil de ${username}`"
      @click="handleImageClick"
    >
      <img :src="displayPhoto" alt="User Avatar" class="block h-full w-full rounded-2xl bg-brand-white object-cover">
      <span
        v-if="signatureMarker"
        class="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-brand-navy-deep bg-emerald-400"
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
      class="overflow-hidden rounded-2xl border border-brand-white/10 bg-brand-white/8 p-3 shadow-none backdrop-blur-sm"
    >
      <div class="flex items-center gap-3">
        <div 
          class="relative shrink-0 transition-transform hover:scale-[1.03]"
          :class="{ 'cursor-pointer': editable, 'cursor-default': !editable }"
          @click="handleImageClick"
        >
          <div class="group relative h-12 w-12 rounded-xl border border-brand-white/15 bg-brand-white/10 p-1 shadow-none">
            <img :src="displayPhoto" alt="User Avatar" class="block h-full w-full rounded-full bg-brand-white object-cover">
            <div 
              v-if="editable" 
              class="absolute inset-1 flex items-center justify-center rounded-full bg-slate-950/80 px-1 text-center text-[10px] font-semibold text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100"
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
          <h3 class="m-0 truncate text-sm font-semibold leading-tight text-white">
            {{ username }}
          </h3>
          <p class="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/58">
            {{ subtitle }}
          </p>
          <div v-if="showSignatureDetails && signatureMarker" class="mt-2 rounded-2xl border border-brand-white/10 bg-brand-white/8 px-2.5 py-1.5">
            <p class="m-0 text-[10px] font-bold uppercase tracking-[0.12em] text-white/52">Token firma</p>
            <p class="mt-1 truncate font-mono text-xs text-white/92">
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
