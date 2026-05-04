<template>
  <div class="mb-4 w-full">
    <div class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div class="flex items-center gap-3">
        <div 
          class="relative shrink-0 transition-transform hover:scale-[1.03]"
          :class="{ 'cursor-pointer': editable, 'cursor-default': !editable }"
          @click="handleImageClick"
        >
          <div class="group relative h-14 w-14 rounded-full border border-slate-200 bg-slate-50 p-1 shadow-inner sm:h-16 sm:w-16">
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
          <h3 class="m-0 truncate text-base font-semibold leading-tight text-slate-950">
            {{ username }}
          </h3>
          <p class="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Cuenta DEASY
          </p>
          <div v-if="signatureMarker" class="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
            <p class="m-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Token firma</p>
            <p class="mt-1 truncate font-mono text-xs text-slate-700">
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
