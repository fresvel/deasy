<template>
    <div class="col-12 col-md-6">
      <div class="mb-3">
        <label :for="dateId" class="form-label">{{ label }}</label>
        <input
          :id="dateId"
          type="date"
          :value="formattedValue"
          @input="updateValue"
          class="form-control form-control-lg"
          :placeholder="placeholder"
        />
      </div>
    </div>
</template>
  
  <script setup>
  import { defineProps, defineEmits, computed } from 'vue';

  
  const props = defineProps({
    label: {
      type: String,
      required: true
    },
    placeholder: {
      type: String,
      required: false,
      default: 'Selecciona la fecha'
    },
    modelValue: {
      type: [String, Date],
      default: ''
    },
    type:{
      type: String,
      default: 'text'
    }
  });
  
  const emit = defineEmits(['update:modelValue']);
  
  // Generar ID único para el input
  const dateId = computed(() => `date-${Math.random().toString(36).substr(2, 9)}`);
  
  // Formatear el valor para el input type="date" (YYYY-MM-DD)
  const formattedValue = computed(() => {
    if (!props.modelValue) return '';
    
    let date;
    if (props.modelValue instanceof Date) {
      date = props.modelValue;
    } else if (typeof props.modelValue === 'string') {
      // Si ya está en formato YYYY-MM-DD, usarlo directamente
      if (/^\d{4}-\d{2}-\d{2}$/.test(props.modelValue)) {
        return props.modelValue;
      }
      date = new Date(props.modelValue);
      if (isNaN(date.getTime())) return '';
    } else {
      return '';
    }
    
    if (isNaN(date.getTime())) return '';
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  
  // Función para manejar los cambios del input
  function updateValue(event) {
    const value = event.target.value; // El input type="date" devuelve YYYY-MM-DD
    emit('update:modelValue', value);
  }
  </script>
  
  <style scoped>
  /* Agrega tus estilos aquí */
  </style>
