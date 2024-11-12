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
    :shownotify="vnotify"
    >
    <LogrosCordinador></LogrosCordinador>
    </s-body>

  
    <s-message
    :show="vnotify"
    />
      
  </div>
  
  </template>
      
<script setup>  


import { ref} from 'vue';
import SHeader from '../main/SHeader.vue';
import SMenu from '../main/SMenu.vue';
import SMessage from '../main/SNotify.vue';
import SBody from '../main/SBody.vue';
import LogrosCordinador from "../informes/LogrosCordinador.vue"



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
      