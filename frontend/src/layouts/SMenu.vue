<template>
<div class="three  wide column  stretched" v-if="show">
    <div class="ui inverted vertical menu smenu fluid"  >
        <!--<router-link v-for="(item, index) in menu" :key="index" :class="`item`"> {{ item.label }}</router-link>-->
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
}

</style>
