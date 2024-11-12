<template>
<div class="three  wide column  stretched" v-if="show">
    <div class="ui inverted vertical menu smenu fluid" >
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
  }
  
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
    background-color:rgb(0, 0, 15, 0.85);
}

</style>