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
    
        <s-menu :show="vmenu">

            <UserProfile photo="/images/avatar.png" username="Homero Velasteguí"> </UserProfile>
            <a class="item large"> Formación y Experiencia</a>
            <a v-for="(item, index) of menu" :key="index" 
                :class="item.active ? 'item active' : 'item'" 
                @click="onmenuClick(item.label)">{{ item.label }}
            </a>
        </s-menu>
    
        <s-body
        :showmenu="vmenu"
        :shownotify="vnotify"
        >
        <TitulosView v-if="selected==='Formación'"></TitulosView>
        <LaboralView v-else-if="selected==='Experiencia'"></LaboralView>
        <ReferenciasView v-else-if="selected==='Referencias'"></ReferenciasView>
        <CapacitaciónView v-else-if="selected==='Capacitación'"></CapacitaciónView>
        <CertificacionView v-else-if="selected==='Certificación'"></CertificacionView>


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
    import UserProfile from '@/components/general/UserProfile.vue';
    import TitulosView from './TitulosView.vue';
    import LaboralView from './LaboralView.vue';
    import ReferenciasView from './ReferenciasView.vue';
    import CapacitaciónView from './CapacitaciónView.vue';
    import CertificacionView from './CertificacionView.vue';
    const vmenu = ref(true);
    const vnotify = ref(true);
    const selected= ref("Formación")
    
    
    const toggleVmenu = () => {
        vmenu.value = !vmenu.value;
    };
      
    const toggleNotify = () => {
        vnotify.value = !vnotify.value;
    };
    
    const menu=ref([
            {
                label: 'Formación',
                active: true,
                //body: '',
            },
            {
                label: 'Experiencia',
                active: false,
                //func:toggleVmenu
            },
            {
                label: 'Referencias',
                active: false,
                //func:toggleNotify
            },
            {
                label: 'Capacitación',
                active: false,
                //func:toggleNotify
            },
            {
                label: 'Certificación',
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
    

    const onmenuClick=(item)=>{
        for (const el of menu.value){
            if(el.label === item){
                el.active =true;
                selected.value=el.label;
                //el.func()
            }else{
                el.active = false;
            }
        }
    }
    
      
      
    </script>
          
    <style scoped>
    
    
    
      
      
    
    </style>
          