<template>
  <nav id="hmenu" class="navbar navbar-expand-lg">
    <div class="container-fluid">
      <div class="d-flex align-items-center gap-3 w-100">
        <button class="btn btn-link text-white p-0" type="button" @click="onClick('menu')">
          <img class="menulogo avatar" src="/images/menu.svg" alt="User Avatar">
        </button>
        <button
          v-if="props.avatar.enable"
          class="btn btn-link text-white p-0"
          type="button"
          @click="onClick('perfil')"
        >
          <img class="avatar" :src="props.avatar.src" alt="User Avatar">
        </button>

        <div class="navbar-nav flex-row flex-wrap align-items-center gap-2 ms-auto">
          <router-link
            v-for="(area, index) in props.areas"
            :key="index"
            class="nav-link text-white px-2"
            :to="`/${area.route}`"
            :class="{ active: area.active === true }"
            @click="onClick(area.name)"
          >
            {{ area.name }}
          </router-link>

          <router-link to="/logout" class="nav-link text-white px-2 ms-lg-3">
            <img class="avatar" src="/images/logout.svg" alt="User Avatar">
          </router-link>
          <button class="btn btn-link text-white p-0" type="button" @click="onClick('signer')">
            <img class="avatar" src="/images/pen_line.svg" alt="User Avatar">
          </button>
          <button class="btn btn-link text-white p-0" type="button" @click="onClick('message')">
            <img class="avatar" src="/images/message.svg" alt="User Avatar">
          </button>
        </div>
      </div>
    </div>
  </nav>
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

#hmenu {
  background: var(--brand-gradient);
}

.menulogo{
  border-radius: 10px;
}

.nav-link.active {
  font-weight: 600;
}

</style>
