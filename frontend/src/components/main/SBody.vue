<template>
      <div :class="contentClass">
          <div class="ui segment">
            <slot></slot>
          </div>
      </div>




</template>

<script setup>
import {computed, defineProps } from 'vue';


const props=defineProps({
    showmenu: {
        type: Boolean,
        default: false
    },
    showmessage: {
        type: Boolean,
        default: false
    }
})

const contentClass= computed(()=>{
    if (props.showmenu&&props.showmessage) {
        return "eleven wide column stretched"
    }else if (!props.showmenu&&!props.showmessage) {
        return "sixteen wide column stretched"
    }else if (props.showmenu&&!props.showmessage) {
        return "thirteen wide column stretched"
    }else{
        return "fourteen wide column stretched"
    }
})


</script>

<style scoped>
  .main {
      height: 100vh;
  }

</style>