<template>
  <div class="mb-4 w-full">
    <div class="rounded-[1.8rem] border border-white/16 bg-[linear-gradient(180deg,rgba(120,179,223,0.92)_0%,rgba(130,185,228,0.82)_100%)] shadow-[0_22px_40px_rgba(6,12,24,0.24)] p-4 backdrop-blur-sm">
      <div class="flex items-center gap-3">
        <div 
          class="relative shrink-0 transition-transform hover:scale-[1.03]"
          :class="{ 'cursor-pointer': editable, 'cursor-default': !editable }"
          @click="handleImageClick"
        >
          <div class="relative w-16 h-16 sm:w-18 sm:h-18 p-1 rounded-full bg-white/40 border border-white/55 shadow-inner group">
            <img :src="displayPhoto" alt="User Avatar" class="w-full h-full object-cover rounded-full block bg-white/70">
            <div 
              v-if="editable" 
              class="absolute inset-1 flex items-center justify-center bg-[#036065]/82 text-white text-[10px] font-semibold rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-center px-1"
            >
              <span>Foto</span>
            </div>
          </div>
          <input
            v-if="editable"
            ref="fileInput"
            type="file"
            accept="image/*"
            class="hidden"
            @change="onFileChange"
          >
        </div>

        <div class="min-w-0 flex-1">
          <h3 class="m-0 truncate text-lg font-semibold leading-tight text-white">
            {{ username }}
          </h3>
          <p class="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/78">
            Cuenta institucional
          </p>
          <div v-if="signatureMarker" class="mt-2 rounded-xl bg-white/18 px-3 py-1.5">
            <p class="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/72">Token firma</p>
            <p class="mt-1 text-xs font-mono text-white/92 truncate">
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
    signatureMarker: {
        type: String,
        default: ''
    },
    editable: {
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
