<template>
    <div class="five wide column segment ui">
      <div class="ui labeled large fluid input">
        <div class="ui label">
          {{ label }}                    
        </div>
        <input 
          type="text" 
          :placeholder="placeholder" 
          :value="input"
          @input="updateValue"
        />
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, watch, defineProps, defineEmits } from 'vue';
  
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
    }
  });
  
  const emit = defineEmits(['update:modelValue']);
  
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
  