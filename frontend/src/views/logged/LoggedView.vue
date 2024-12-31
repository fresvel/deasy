<template>  

    <s-header @onclick="onClick('Menu')">
        <a class="item large" @click="onheadClick('Perfil')">
            <img class="avatar" src="/images/avatar.png" alt="User Avatar">
        </a>
        <a class="item active large" @click="onheadClick('Academia')">Academia</a>
        <a to="/auth" class="item large" @click="onheadClick('Investigación')">Investigación</a>
        <a class="item  large" @click="onheadClick('Vinculación')">Vinculación</a>
        <a class="item large left aligned" @click="onheadClick('Internacionalización')">Internacionalización</a>
        <router-link to="/logout" class="item  large right aligned">
            <img class="avatar" src="/images/logout.svg" alt="User Avatar">
        </router-link>              
        <a class="item large" @click="onheadClick('Firmar')"> 
            <img class="avatar" src="/images/pen_line.svg" alt="User Avatar">
        </a>
        <a class="item large" @click="onClick('Message')">
            <img class="avatar" src="/images/message.svg" alt="User Avatar">
        </a>
    
    </s-header>
    
      
      <div class="ui grid">
    
        <s-menu :show="vmenu">

            <UserProfile photo="/images/avatar.png" username="Homero Velasteguí"> </UserProfile>
            <a class="item large"> Coordinación</a>
            <a v-for="(item, index) of mainmenu" :key="index" 
                :class="item.active ? 'item active' : 'item'" 
                @click="onmenuClick(item.label)">{{ item.label }}
            </a>
            <a class="item large"> Docencia</a>
        </s-menu>
    
        <s-body
        :showmenu="vmenu"
        :shownotify="vnotify"
        >


        <div v-if="headmenu=='Perfil'" id="validar">
            <TitulosView v-if="selmenu==='Formación'"></TitulosView>
            <LaboralView v-else-if="selmenu==='Experiencia'"></LaboralView>
            <ReferenciasView v-else-if="selmenu==='Referencias'"></ReferenciasView>
            <CapacitaciónView v-else-if="selmenu==='Capacitación'"></CapacitaciónView>
            <CertificacionView v-else-if="selmenu==='Certificación'"></CertificacionView>
        </div>
        <div v-else-if="headmenu=='Academia'">
            <LogrosView v-if="selmenu=='Logros'"></LogrosView>
            <TutoriasView v-else-if="selmenu==='Tutorías'"></TutoriasView>
        </div>
        <div v-else-if="headmenu=='Firmar'">
            <FirmarPdf v-if="headmenu=='Firmar'"></FirmarPdf>
        </div>

        

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
    import TitulosView from './perfil/TitulosView.vue';
    import LaboralView from './perfil/LaboralView.vue';
    import ReferenciasView from './perfil/ReferenciasView.vue';
    import CapacitaciónView from './perfil/CapacitaciónView.vue';
    import CertificacionView from './perfil/CertificacionView.vue';

    import LogrosView from './academia/LogrosView.vue';
    import TutoriasView from './academia/TutoriasView.vue';

    import FirmarPdf from './funciones/FirmarPdf.vue';


    const vmenu = ref(true);
    const vnotify = ref(true);
    const selmenu= ref("Formación")

    const headmenu= ref("Perfil")
    
    
    const toggleVmenu = () => {
        vmenu.value = !vmenu.value;
    };
      
    const toggleNotify = () => {
        vnotify.value = !vnotify.value;
    };
    
    const mainmenu=ref([            
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
            }])
    
    
    
    const onClick=(item)=>{
        if(item==="Message"){
            toggleNotify();
        }
        else{
            toggleVmenu();
        } 
            
    }
    

    const onmenuClick=(item)=>{
        for (const el of mainmenu.value){
            if(el.label === item){
                el.active =true;
                selmenu.value=el.label;
                //el.func()
            }else{
                el.active = false;
            }
        }
    }
    

    const onheadClick=(item)=>{
        headmenu.value=item;
        switch(item){
            case 'Perfil':
                mainmenu.value=[
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
                ]
                selmenu.value="Formación";
                break;
            case 'Academia':
                mainmenu.value=[
                    {
                        label: 'Logros',
                        active: true,
                        //body: '',
                    },
                    {
                        label: 'Tutorías',
                        active: false,
                        //func:toggleVmenu
                    },
                    {
                        label: 'Horarios',
                        active: false,
                        //func:toggleNotify
                    },
                    {
                        label: 'Gestión',
                        active: false,
                        //func:toggleNotify
                    },
                    {
                        label: 'Eventos',
                        active: false,
                        //func:toggleNotify
                    }
                ]
                selmenu.value="Logros";
                break;
            case 'Investigación':
                selmenu.value="Investigación";
                break;
            case 'Vinculación':
                selmenu.value="Vinculación";
                break;
            case 'Internacionalización':
                selmenu.value="Internacionalización";
                break;
            case 'Firmar':
                selmenu.value="Firmar";
                break;
            case 'Message':
                break;
            default:
                break;
        }
    }
      
      
    </script>
          
    <style scoped>
    
    
    
      
      
    
    </style>
          