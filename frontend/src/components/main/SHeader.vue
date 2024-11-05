<template>

<div class="ui grid" id="navbar">
      <div class="sixteen wide column">
        <div class="ui inverted segment" id="hmenu">
            <div class="ui inverted secondary menu">
              <a v-for="(item, index) in menu" :key="index" 
              :class="item.active ? 'item active' : 'item'" 
              @click="onClick(item.label)">{{ item.label }}</a>
            </div>
        </div>
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
]
  
})

const emit=defineEmits(["onclick"])

const onClick=(item)=>{
  emit("onclick", item)

}


</script>

<style scoped lang="scss">

#navbar {
      margin-bottom: -41px;
}

#hmenu{
      background-color:$col-header;
  
  
  }

</style>