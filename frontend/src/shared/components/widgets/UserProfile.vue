<template>
  <div class="mb-4 w-full">
    <div
      class="overflow-hidden rounded-[1.8rem] border p-4 shadow-[0_22px_40px_rgba(6,12,24,0.24)] backdrop-blur-sm"
      style="border-color: rgba(255,255,255,0.16); background: linear-gradient(180deg, rgba(120,179,223,0.92) 0%, rgba(130,185,228,0.82) 100%);"
    >
      <div class="flex items-center gap-3">
        <div 
          class="relative shrink-0 transition-transform hover:scale-[1.03]"
          :class="{ 'cursor-pointer': editable, 'cursor-default': !editable }"
          @click="handleImageClick"
        >
          <div class="group relative h-14 w-14 rounded-full border border-white/55 bg-white/40 p-1 shadow-inner sm:h-16 sm:w-16">
            <img :src="displayPhoto" alt="User Avatar" class="block h-full w-full rounded-full bg-white object-cover">
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
            class="hidden"
            @change="onFileChange"
          >
        </div>

        <div class="min-w-0 flex-1">
          <h3 class="m-0 truncate text-base font-semibold leading-tight text-white">
            {{ username }}
          </h3>
          <p class="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/78">
            Cuenta institucional
          </p>
          <div v-if="signatureMarker" class="mt-2 rounded-[10px] border border-white/16 bg-white/12 px-3 py-1.5">
            <p class="m-0 text-[11px] font-bold uppercase tracking-[0.12em] text-white/62">Token firma</p>
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
