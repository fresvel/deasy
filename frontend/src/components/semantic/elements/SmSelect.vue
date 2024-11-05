<template>
    <div class="five wide column segment ui" style="background-color: rgba(0, 110, 220, 0.1);">
        <div class="ui labeled large fluid input">
            <div class="ui label">
            {{label}}
            </div>
            <select class="ui compact selection dropdown" @change="selSelect($event)" v-model="vselect">
                <option v-for="(option, index) in options " :key="index"  :value="option"> {{ option }} </option>
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
      type: [String],
      required: true
    }
  })

  const emit=defineEmits(["fromselect"])

    const vselect=ref("")
    const selSelect = (event) => {
      vselect.value = event.target.value    
      emit('fromselect', vselect.value)  
    }  
</script>

<style scoped>

</style>