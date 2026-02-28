<template>
  <div class="col-lg-2 col-md-3" v-if="show">
    <div class="smenu d-flex flex-column">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>

import {defineProps, /*defineEmits*/} from "vue"

defineProps({
show: {
    type: Boolean,
    default: true,
  },

menu: {
    type: Array,
    default: () => [],
},
  
})

/*
const emit=defineEmits(["onclick"])

const onClick=(item)=>{
  emit("onclick", item)
}

*/
</script>

<style scoped>


.smenu {
    height: calc(100vh - 1.1rem);
    margin-top: 0.12rem;
    background:
      linear-gradient(
        168deg,
        #0c1826 0%,
        rgba(var(--brand-primary-rgb), 0.9) 58%,
        rgba(26, 110, 168, 0.78) 100%
      );
    padding: 0.9rem 0.75rem;
    border-radius: 0 0 18px 18px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    box-shadow:
      0 22px 34px rgba(var(--brand-primary-rgb), 0.24),
      inset 0 1px 0 rgba(255, 255, 255, 0.14);
    position: sticky;
    top: 0.34rem;
    overflow: hidden;
}

</style>
