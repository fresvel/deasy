<template>
  <div class="deasy-field-wrapper" :class="columnClass">
    <div>
      <label :for="inputId" class="deasy-field-label">{{ label }}</label>
      <input 
        :id="inputId"
        :type="type" 
        :placeholder="placeholder" 
        :value="input"
        @input="updateValue"
        class="deasy-control"
      />
    </div>
  </div>
</template>
  
  <script setup>
  import { ref, watch, defineProps, defineEmits, computed, useId } from 'vue';

  // Enlaza cada <label for> con su control. useId() da un prefijo distinto por
  // instancia, para que dos montajes simultaneos no compartan el mismo id.
  const uid = useId();
  const fieldId = (name) => `${uid}-${name}`;
  
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
      type: [String, Number],
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
    const columnClass = computed(() => {
    const wideMap = {
        'one': 'deasy-col-1',
        'two': 'deasy-col-2', 
        'three': 'deasy-col-3',
        'four': 'deasy-col-4',
        'five': 'deasy-col-5',
        'six': 'deasy-col-6',
        'seven': 'deasy-col-7',
        'eight': 'deasy-col-8',
        'nine': 'deasy-col-9',
        'ten': 'deasy-col-10',
        'eleven': 'deasy-col-11',
        'twelve': 'deasy-col-12',
        'thirteen': 'deasy-col-12',
        'fourteen': 'deasy-col-12',
        'fifteen': 'deasy-col-12',
        'sixteen': 'deasy-col-12'
    };
      return props.wide ? wideMap[props.wide] || 'deasy-col-12' : 'deasy-col-12';
  });
  
  // Id estable por instancia para enlazar el <label for> con el <input id>.
  const inputId = fieldId("input");

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
