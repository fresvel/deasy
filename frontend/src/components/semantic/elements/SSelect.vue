<template>


<div class="five wide column segment ui" style="background-color: rgba(0, 110, 220, 0.1);">
  <div class="ui labeled large fluid input">
      <div class="ui label">
        {{label}}
      </div>
      <select 
          class="ui compact selection dropdown" 
          v-model="vselect" 
          @change="selSelect"
          style="width: 100%;"
      >
      <option v-for="(option, index) in options " :key="index"  :value="option.value"> {{ option.name }} </option>
      </select>
  </div>
</div>
</template>

<script setup>
import { defineProps, defineEmits, ref } from 'vue';
  defineProps( {
    label: {
      type: String,
      required: true
    },
    options: {
      type: Array,
      required: true
    }
  })

  const emit=defineEmits(["fromselect"])

    const vselect=ref("")
    const selSelect = () => {    
      emit('fromselect', vselect.value)
    }  
</script>

<style scoped>

</style>