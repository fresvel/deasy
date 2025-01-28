<template>  

    <s-header @onclick="onClick('Menu')">
        <a class="item large" @click="onheadClick({name:'Perfil'})">
            <img class="avatar" src="/images/avatar.png" alt="User Avatar">
        </a>

        <a class="item large" 
        v-for="(area, index) in areas" :key="index"
        :class="{'active':area.active==true}" 
        @click="onheadClick(area)">{{ area.name}}</a>

        
        <router-link to="/logout" class="item  large right aligned">
            <img class="avatar" src="/images/logout.svg" alt="User Avatar">
        </router-link>              
        <a class="item large" @click="onheadClick({name:'Firmar'})"> 
            <img class="avatar" src="/images/pen_line.svg" alt="User Avatar">
        </a>
        <a class="item large" @click="onClick('Message')">
            <img class="avatar" src="/images/message.svg" alt="User Avatar">
        </a>
    
    </s-header>
    
      
      <div class="ui grid">
    
        <s-menu :show="vmenu">

            <UserProfile photo="/images/avatar.png" username="Homero Velasteguí"> </UserProfile>
            <a class="large item labeled" style="text-align: center;">
                Coordinación          
            </a>

            
    

            <a v-for="(item, index) of mainmenu" :key="index"
            
                class="right medium item labeled"
                :class="item.active ? 'item active' : ''" 
                @click="onmenuClick(item.label)">
                {{ item.label }}
                    <div class="ui left pointing blue label">
                        <div class="medium">{{ index }}</div>
                    </div>
            </a>
            <a class="item large" style="text-align: center;"> Docencia</a>
        </s-menu>
    
        <s-body
        :showmenu="vmenu"
        :shownotify="vnotify"
        >


        <div v-if="area=='Perfil'" id="validar">
            <TitulosView v-if="process==='Formación'"></TitulosView>
            <LaboralView v-else-if="process==='Experiencia'"></LaboralView>
            <ReferenciasView v-else-if="process==='Referencias'"></ReferenciasView>
            <CapacitaciónView v-else-if="process==='Capacitación'"></CapacitaciónView>
            <CertificacionView v-else-if="process==='Certificación'"></CertificacionView>
        </div>
        <div v-else-if="area=='Academia'">
            <IndexAcademia v-if="process=='index'" area="area" perfil="perfil"></IndexAcademia>
            <LogrosView :tareas="tareas" v-else-if="process=='Logros Académicos'"></LogrosView>
            <TutoriasView v-else-if="process==='Tutorías'"></TutoriasView>
        </div>
        <div v-else-if="area=='Firmar'">
            <FirmarPdf v-if="area=='Firmar'"></FirmarPdf>
        </div>

        <LogrosView2></LogrosView2>

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

    import IndexAcademia from './academia/AcademiaView.vue';
    import LogrosView from './academia/LogrosView.vue';
    import LogrosView2 from './academia/LogrosView2.vue';

    import TutoriasView from './academia/TutoriasView.vue';

    import FirmarPdf from './funciones/FirmarPdf.vue';


    import EasymServices from '@/services/EasymServices';

    const service = new EasymServices();

    service.getEasymAreas()
    service.getTareasPendientes("1804326534")
    const areas =service.getEasymdata().areas
    const tareas=service.getEasymdata().tareas
    const vmenu = ref(true);
    const vnotify = ref(true);
    const process= ref("Formación")

    const area= ref("Perfil")
    
    
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
                process.value=el.label;
                //el.func()
            }else{
                el.active = false;
            }
        }
    }
    

    const onheadClick=(item)=>{
        area.value=item.name;
        for (let el of areas.value){
            if(el.code === item.code){
                el.active = true;
            } else{
                el.active = false;
            }
        }



        switch(item.name){
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
                process.value="Formación";
                break;
            case 'Academia':
                console.log("Academia detected")
                mainmenu.value=[
                    {
                        label: 'Logros Académicos',
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
                process.value="index";
                break;
            case 'Investigación':
                mainmenu.value=[]
                process.value="Investigación";
                break;
            case 'Vinculación':
                mainmenu.value=[]
                process.value="Vinculación";
                break;
            case 'Internacionalización':
                mainmenu.value=[]
                process.value="Internacionalización";
                break;
            case 'Firmar':
                process.value="Firmar";
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
          