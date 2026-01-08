<template>
  <div class="col" :class="bootstrapColumnClass">
    <div class="mb-3">
      <label :for="inputId" class="form-label">{{ label }}</label>
      <input 
        :id="inputId"
        :type="type" 
        :placeholder="placeholder" 
        :value="input"
        @input="updateValue"
        class="form-control"
      />
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
    },
    wide:{
      type: String,
    }
  });
  

  // Mapear clases de Semantic UI a Bootstrap
  const bootstrapColumnClass = computed(() => {
    const wideMap = {
      'one': 'col-1',
      'two': 'col-2', 
      'three': 'col-3',
      'four': 'col-4',
      'five': 'col-5',
      'six': 'col-6',
      'seven': 'col-7',
      'eight': 'col-8',
      'nine': 'col-9',
      'ten': 'col-10',
      'eleven': 'col-11',
      'twelve': 'col-12',
      'thirteen': 'col-12',
      'fourteen': 'col-12',
      'fifteen': 'col-12',
      'sixteen': 'col-12'
    };
    return props.wide ? wideMap[props.wide] || 'col' : 'col';
  });
  
  // Generar ID único para el input
  const inputId = computed(() => `input-${Math.random().toString(36).substr(2, 9)}`);

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
  