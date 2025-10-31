<template>
<div class="col" :class="bootstrapColumnClass">
  <div class="mb-3">
    <label :for="selectId" class="form-label">{{ label }}</label>
    <select 
        :id="selectId"
        class="form-select" 
        v-model="vselect" 
        @change="selSelect"
    >
      <option value="" disabled>Seleccione una opción</option>
      <option v-for="(option, index) in options" :key="index" :value="option.value"> 
        {{ option.name }} 
      </option>
    </select>
  </div>
</div>
</template>

<script setup>
import { defineProps, defineEmits, ref, computed} from 'vue';
  const props=defineProps( {
    label: {
      type: String,
      required: true
    },
    options: {
      type: Array,
      required: true
    },
    wide:{
      type: String,
    }
  })

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
  
  // Generar ID único para el select
  const selectId = computed(() => `select-${Math.random().toString(36).substr(2, 9)}`);

  const emit=defineEmits(["fromselect"])

    const vselect=ref("")
    const selSelect = () => {    
      emit('fromselect', vselect.value)
    }  
</script>

<style scoped>

</style>