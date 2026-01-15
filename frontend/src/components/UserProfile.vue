<template>
  <div class="user-profile">
    <div class="card">
      <div
        class="image"
        :class="{ editable }"
        @click="handleImageClick"
      >
        <img :src="displayPhoto" alt="User Avatar">
        <div v-if="editable" class="image-overlay">
          <span>Seleccionar foto</span>
        </div>
        <input
          v-if="editable"
          ref="fileInput"
          type="file"
          accept="image/*"
          class="file-input"
          @change="onFileChange"
        >
      </div>
      <div class="card-body">
        <div class="card-title mb-0">
          {{ username }}
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

<style scoped>

.userphoto{
    border-radius: 109px;
}

.user-profile .card {
    background: var(--brand-white);
    border-radius: var(--radius-md);
}

.user-profile .card-title {
    font-weight: 600;
    color: var(--brand-navy);
    text-align: center;
}

.image {
    position: relative;
    cursor: default;
}

.image.editable {
    cursor: pointer;
}

.image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.file-input {
    display: none;
}

.image-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(var(--brand-primary-rgb), 0.55);
    color: var(--brand-white);
    font-weight: 500;
    font-size: 0.95rem;
    opacity: 0;
    transition: opacity 0.2s ease;
    text-align: center;
    padding: 0 0.75rem;
}

.image.editable:hover .image-overlay {
    opacity: 1;
}

</style>
