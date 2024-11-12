<template>  

  
<s-header @onclick="onClick('Menu')">
    <router-link to="/" class="item active large" @click="onClick('Academia')">Academia</router-link>
    <router-link to="/auth" class="item large">Investigación</router-link>
    <router-link to="/" class="item  large" >Vinculación</router-link>
    <router-link to="/auth" class="item large left aligned">Internacionalización</router-link>
    <router-link to="/logout" class="item  large right aligned">Salir</router-link>              
    <a class="item large" @click="onClick('Message')">
        <img class="avatar" src="/images/message.svg" alt="User Avatar">
    </a>

</s-header>

  
  <div class="ui grid">

    <s-menu
    :menu="menu"
    @onclick="handleHeader"
    :show="vmenu"
    />

    <s-body
    :showmenu="vmenu"
    :shownotify="vnotify"
    >
    <router-view v-if="1==1"></router-view>
    <router-link :to="{name:login}"></router-link>
    </s-body>

  
    <s-message
    :show="vnotify"
    />
      
  </div>
  
  </template>
      
<script setup>  


import { ref} from 'vue';
import SMenu from '@/components/main/SMenu.vue';
import SMessage from '@/components/main/SNotify.vue';
import SBody from '@/components/main/SBody.vue';

import SHeader from '@/components/main/SHeader.vue';
const vmenu = ref(true);
const vnotify = ref(true);


const toggleVmenu = () => {
    vmenu.value = !vmenu.value;
};
  
const toggleNotify = () => {
    vnotify.value = !vnotify.value;
};

const handleHeader = (item) => {
    for (const el of menu){
        if(el.label === item){
            el.active =true;
            //el.func()
        }else{
            el.active = false;
        }
    }

    console.log(menu);

}


const menu=ref([
        {
            label: 'User',
            active: true,
            //func:toggleVmenu
        },
        {
            label: 'Academia',
            active: false,
            //func:toggleVmenu
        },
        {
            label: 'Mensaje',
            active: false,
            //func:toggleNotify
        }
    ])



const onClick=(item)=>{
    if(item==="Message"){
        toggleNotify();
    }
    else{
        toggleVmenu();
    } 
        
}


  
  
</script>
      
<style scoped>



  
  

</style>
      