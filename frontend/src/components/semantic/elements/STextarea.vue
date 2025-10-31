<template>
    <div class="col-5">
      <div class="mb-3">
        <label :for="textareaId" class="form-label">{{ label }}</label>
        <textarea
          :id="textareaId"
          :placeholder="placeholder" 
          :value="input"
          @input="updateValue"
          class="form-control"
          rows="3"
        ></textarea>
      </div>
    </div>
</template>
  
  <script setup>
  import { ref, watch, defineProps, defineEmits, computed } from 'vue';
  
  const props = defineProps({
    label: {
      type: String,
      required: true
    },
    placeholder: {
      type: String,
      required: true
    },
    modelValue: {
      type: String,
      default: ''
    },
    type:{
      type: String,
      default: 'text'
    }
  });
  
  const emit = defineEmits(['update:modelValue']);
  
  // Generar ID único para el textarea
  const textareaId = computed(() => `textarea-${Math.random().toString(36).substr(2, 9)}`);
  
  // Inicializa el valor del input con props.modelValue
  const input = ref(props.modelValue);
  
  // Actualiza el valor cuando cambian las props
  watch(() => props.modelValue, (newVal) => {
    input.value = newVal;
  });
  
  // Función para manejar los cambios del input
  function updateValue(event) {
    emit('update:modelValue', event.target.value);
  }
  </script>
  
  <style scoped>
  /* Agrega tus estilos aquí */
  </style>
  