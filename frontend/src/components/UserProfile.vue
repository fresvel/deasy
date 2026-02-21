<template>
  <div class="user-profile">
    <div class="card">
      <div class="profile-chip">Perfil</div>
      <div
        class="image"
        :class="{ editable }"
        @click="handleImageClick"
      >
        <div class="image-frame">
          <img :src="displayPhoto" alt="User Avatar">
          <div v-if="editable" class="image-overlay">
            <span>Seleccionar foto</span>
          </div>
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
        <div class="card-subtitle">Cuenta institucional</div>
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

.user-profile {
    margin-bottom: 0.7rem;
}

.user-profile .card {
    background:
      linear-gradient(
        160deg,
        rgba(255, 255, 255, 0.18) 0%,
        rgba(255, 255, 255, 0.08) 100%
      );
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.24);
    box-shadow:
      0 14px 28px rgba(var(--brand-primary-rgb), 0.24),
      inset 0 1px 0 rgba(255, 255, 255, 0.18);
    backdrop-filter: blur(3px);
    padding: 0.65rem 0.65rem 0.45rem;
    text-align: center;
}

.profile-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: rgba(15, 163, 101, 0.2);
    color: #e8fff4;
    border: 1px solid rgba(189, 246, 224, 0.45);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 0.16rem 0.58rem;
    margin: 0 auto 0.35rem;
}

.user-profile .card-title {
    font-weight: 700;
    font-size: 0.94rem;
    color: rgba(255, 255, 255, 0.96);
    text-align: center;
    line-height: 1.25;
}

.user-profile .card-subtitle {
    margin-top: 0.15rem;
    color: rgba(255, 255, 255, 0.74);
    font-size: 0.75rem;
    letter-spacing: 0.02em;
}

.image {
    position: relative;
    cursor: default;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 0.45rem 0 0.25rem;
}

.image.editable {
    cursor: pointer;
}

.image-frame {
    position: relative;
    width: clamp(80px, 10vw, 102px);
    height: clamp(80px, 10vw, 102px);
    padding: 0.32rem;
    border-radius: 16px;
    background:
      linear-gradient(
        145deg,
        rgba(255, 255, 255, 0.48) 0%,
        rgba(255, 255, 255, 0.18) 100%
      );
    border: 1px solid rgba(255, 255, 255, 0.46);
    box-shadow:
      0 10px 18px rgba(var(--brand-primary-rgb), 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

.image img {
    width: clamp(72px, 10vw, 96px);
    height: clamp(72px, 10vw, 96px);
    object-fit: cover;
    border-radius: 12px;
    display: block;
}

.file-input {
    display: none;
}

.image-overlay {
    position: absolute;
    inset: 0.32rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(var(--brand-primary-rgb), 0.55);
    color: var(--brand-white);
    font-weight: 500;
    font-size: 0.75rem;
    line-height: 1.2;
    border-radius: 10px;
    opacity: 0;
    transition: opacity 0.2s ease;
    text-align: center;
    padding: 0 0.4rem;
}

.image.editable:hover .image-overlay {
    opacity: 1;
}

</style>
