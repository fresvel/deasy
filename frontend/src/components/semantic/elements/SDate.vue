<template>
    <div class="col-5">
      <div class="mb-3">
        <label :for="dateId" class="form-label">{{ label }}</label>
        <datepicker   
          :id="dateId"
          :value="input"
          @date="updateValue"
          class="form-control"
          :placeholder="placeholder"
        />
      </div>
    </div>
</template>
  
  <script setup>
  import { ref, watch, defineProps, defineEmits, computed } from 'vue';
  import Datepicker from 'vuejs3-datepicker'

  
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
  
  // Generar ID único para el datepicker
  const dateId = computed(() => `date-${Math.random().toString(36).substr(2, 9)}`);
  
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
  