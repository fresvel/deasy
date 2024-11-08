<template>  
<s-header
:menu="header.menu"
@onclick="handleHeader"
/>
  
  
  <div class="ui grid">

    <s-menu
    :menu="header.menu"
    @onclick="handleHeader"
    :show="vmenu"
    />

    <s-body
    :showmenu="vmenu"
    :showmessage="vnotify"
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
import SHeader from '@/components/main/SHeader.vue';
import SMenu from '@/components/main/SMenu.vue';
import SMessage from '@/components/main/SMessage.vue';
import SBody from '@/components/main/SBody.vue';
//import router from '@/router';
//import LogrosCordinador from "../informes/programas/LogrosView.vue"



const vmenu = ref(true);
const vnotify = ref(true);


const toggleVmenu = () => {
    vmenu.value = !vmenu.value;
};
  
const toggleNotify = () => {
    vnotify.value = !vnotify.value;
};

const handleHeader = (item) => {
    for (const el of header.menu){
        if(el.label === item){
            el.active =true;
            el.func()
        }else{
            el.active = false;
        }

    }

}


    const header={
    menu:[
        {
            label: 'Menu',
            active: true,
            func:toggleVmenu
        },
        {
            label: 'About',
            active: false,
            func:toggleVmenu
        },
        {
            label: 'Mensajes',
            active: false,
            func:toggleNotify
        }
    ]
}





  
  
</script>
      
<style scoped>

 

  
  

</style>
      