<template>

<div class="ui grid" id="navbar">
      <div class="sixteen wide column">
        <div class="ui inverted segment" id="hmenu">
            <div class="ui inverted secondary menu flex">
              <a class="item large" @click="onClick('menu')">
                <img class="menulogo" src="/images/menu.svg" alt="User Avatar">
              </a>
              <a v-if="props.avatar.enable" class="item large" @click="onClick('perfil')">
                  <img class="avatar" :src="props.avatar.src" alt="User Avatar">
              </a>


              <router-link v-for="(area, index) in props.areas" :key="index"
              class="item large"
              :to="`/${area.route}`"
              :class="{'active':area.active==true}" 
              @click="onClick(area.name)">{{ area.name}}
              </router-link>

              <router-link to="/logout" class="item  large right aligned">
                  <img class="avatar" src="/images/logout.svg" alt="User Avatar">
              </router-link>
              <a class="item large" @click="onClick('signer')"> 
                <img class="avatar" src="/images/pen_line.svg" alt="User Avatar">
              </a>
              <a class="item large" @click="onClick('message')">
                <img class="avatar" src="/images/message.svg" alt="User Avatar">
              </a>
            
            </div>
        </div>
      </div>
</div>


</template>

<script setup>
import {defineProps, defineEmits} from "vue"

const props=defineProps({
  avatar:{
    enable:{
      type:Boolean,
      default:false
    },
    src:{
      type:String,
      default:'/images/avatar.png'
    }
    
  },
  areas:[
    {
    active:{
      type:Boolean,
      default:false
    },  
    name:{
      type:String,
      default:''
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

#hmenu {
  background: var(--brand-gradient);
}

.menulogo{
  border-radius: 10px;
}

</style>
