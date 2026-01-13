<template>
  <div class="column" :class="wideClass">
    <div class="segment ui">
      <div class="ui labeled large fluid input">
        <div class="ui label">
          {{ label }}                    
        </div>
        <input 
          :type="type" 
          :placeholder="placeholder" 
          :value="modelValue" 
          @input="updateValue"
        />
      </div>
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
    required: true
  },
  modelValue: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    default: 'text'
  },
  wide: {
    type: String
  }
});

const emit = defineEmits(['update:modelValue']);

const updateValue = (event) => {
  emit('update:modelValue', event.target.value);
};

const wideClass = computed(() => props.wide ? `${props.wide} wide` : '');
</script>

<style scoped>

</style>
