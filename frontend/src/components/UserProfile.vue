<template>
  <div class="mb-4 w-full">
    <div class="bg-white/10 rounded-2xl shadow-lg p-4 flex flex-col items-center border border-white/20 backdrop-blur-sm">
      <div 
        class="relative flex justify-center items-center pb-2 pt-1 transition-transform hover:scale-105"
        :class="{ 'cursor-pointer': editable, 'cursor-default': !editable }"
        @click="handleImageClick"
      >
        <div class="relative w-20 h-20 sm:w-24 sm:h-24 p-1 rounded-2xl bg-white/20 border border-white/30 shadow-inner group">
          <img :src="displayPhoto" alt="User Avatar" class="w-full h-full object-cover rounded-xl block bg-white/50">
          <div 
            v-if="editable" 
            class="absolute inset-1 flex items-center justify-center bg-sky-900/80 text-white text-xs font-semibold rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-center px-1"
          >
            <span>Seleccionar foto</span>
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
      
      <div class="w-full mt-2 bg-white/10 rounded-xl px-3 py-2.5 border border-white/20 flex flex-col items-center justify-center">
        <h3 class="font-bold text-white text-base leading-tight text-center truncate w-full">
          {{ username }}
        </h3>
        <p class="text-sky-100/80 text-xs font-semibold tracking-wide text-center mt-1 uppercase">
          Cuenta institucional
        </p>
      </div>

      <div v-if="signatureMarker" class="w-full mt-3 bg-white/10 rounded-xl px-3 py-2.5 border border-white/20 flex flex-col items-center justify-center">
        <p class="text-sky-100/80 text-[11px] font-semibold tracking-wide text-center uppercase">
          Token firma
        </p>
        <p class="text-white text-xs font-mono text-center break-all mt-1 w-full">
          {{ signatureMarker }}
        </p>
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
