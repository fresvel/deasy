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
    height: 100vh;
    margin-top: 13px;
    background-color: rgba(var(--brand-primary-rgb), 0.92);
    padding: 0.75rem;
    border-radius: var(--radius-md);
}

.smenu .list-group-item {
    background-color: transparent;
    color: var(--brand-white);
    border: 0;
    padding-left: 0;
    padding-right: 0;
}

.smenu .list-group-item.active {
    background-color: rgba(var(--brand-accent-rgb), 0.2);
    color: var(--brand-white);
}

</style>
