<template>
<div class="three  wide column  stretched" v-show="show">
    <div class="ui inverted vertical menu smenu fluid" >
        <a v-for="(item, index) in menu" :key="index" 
              :class="item.active ? 'item active' : 'item'" 
              @click="onClick(item.label)">{{ item.label }}</a>
    </div>
</div>

</template>

<script setup>

import {defineProps, defineEmits} from "vue"

defineProps({
  menu: [
    {
      label:{
        type: String,
      },
      path:{
        type: String,
      },
      func:{
        type: Function,
      }
    }
],
show: {
    type: Boolean,
    default: true,
  }
  
})

const emit=defineEmits(["onclick"])

const onClick=(item)=>{
  emit("onclick", item)

}

</script>

<style scoped>


.smenu {
    height: 100vh;
    margin-top: 13px;
    background-color:rgb(0, 0, 15, 0.85);
}

</style>