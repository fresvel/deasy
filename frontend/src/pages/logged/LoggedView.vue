<template>  

    <s-header @onclick="onClick('Menu')">
        <a class="item large" @click="onheadClick({name:'Perfil'})">
            <img class="avatar" :src="userPhoto" alt="User Avatar">
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

            <UserProfile
                :photo="userPhoto"
                :username="userFullName"
                :editable="true"
                @photo-selected="handlePhotoSelected"
            />
            <a class="large item labeled menu-section-title">
                Coordinación          
            </a>

            
    

            <a v-for="(item, index) of mainmenu" :key="index"
            
                class="right medium item labeled"
                :class="item.active ? 'item active' : ''" 
                @click="onmenuClick(item.label)">
                {{ item.label }}
                    <div v-if="item.key" class="ui left pointing blue label">
                        <div class="medium">{{ dossierCounts[item.key] ?? 0 }}</div>
                    </div>
            </a>
            <a class="item large menu-section-title"> Docencia</a>
        </s-menu>
    
        <s-body
        :showmenu="vmenu"
        :shownotify="vnotify"
        >


        <div v-if="area=='Perfil'" id="validar">
            <TitulosView v-if="process==='Formación'"></TitulosView>
            <LaboralView v-else-if="process==='Experiencia'"></LaboralView>
            <ReferenciasView v-else-if="process==='Referencias'"></ReferenciasView>
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
    
    
import { ref, computed, onMounted, onBeforeUnmount} from 'vue';
import axios from 'axios';
    import SMenu from '@/layouts/SMenu.vue';
    import SMessage from '@/layouts/SNotify.vue';
    import SBody from '@/layouts/SBody.vue';
    import SHeader from '@/layouts/SHeader.vue';
    import UserProfile from '@/components/UserProfile.vue';
import TitulosView from '@/sections/perfil/TitulosView.vue';
import LaboralView from '@/sections/perfil/LaboralView.vue';
import ReferenciasView from '@/sections/perfil/ReferenciasView.vue';
import CertificacionView from '@/sections/perfil/CertificacionView.vue';

import IndexAcademia from '@/sections/academia/AcademiaView.vue';
import LogrosView from '@/sections/academia/LogrosView.vue';
import LogrosView2 from '@/sections/academia/LogrosView2.vue';

import TutoriasView from '@/sections/academia/TutoriasView.vue';

import FirmarPdf from '../logged/funciones/FirmarPdf.vue';


    import EasymServices from '@/services/EasymServices';

    const service = new EasymServices();
    const API_BASE_URL = 'http://localhost:3000';
    const API_PREFIX = `${API_BASE_URL}/easym/v1`;

    // Obtener datos del usuario desde localStorage
    const currentUser = ref(null);
    const defaultPhoto = '/images/avatar.png';
    const userPhoto = ref(defaultPhoto);
    const userFullName = computed(() => {
        if (currentUser.value) {
            return `${currentUser.value.nombre} ${currentUser.value.apellido}`;
        }
        return 'Usuario';
    });

    const resolvePhotoUrl = (value) => {
        if (!value) {
            return defaultPhoto;
        }
        if (value.startsWith('data:') || value.startsWith('http://') || value.startsWith('https://')) {
            return value;
        }
        const sanitized = value.replace(/^\/+/, '');
        return `${API_BASE_URL.replace(/\/$/, '')}/${sanitized}`;
    };

    const dossierCounts = ref({
        formacion: 0,
        experiencia: 0,
        referencias: 0,
        capacitacion: 0,
        certificacion: 0
    });

    const buildPerfilMenu = () => ([
        {
            label: 'Formación',
            key: 'formacion',
            active: true,
        },
        {
            label: 'Experiencia',
            key: 'experiencia',
            active: false,
        },
        {
            label: 'Referencias',
            key: 'referencias',
            active: false,
        },
        {
            label: 'Capacitación',
            key: 'capacitacion',
            active: false,
        },
        {
            label: 'Certificación',
            key: 'certificacion',
            active: false,
        }
    ]);

    const mainmenu=ref(buildPerfilMenu())
    
    
    const loadDossierCounts = async () => {
        if (!currentUser.value?.cedula) {
            return;
        }

        try {
            const url = `${API_PREFIX}/dossier/${currentUser.value.cedula}`;
            const { data } = await axios.get(url);
            if (data?.success && data?.data) {
                const dossier = data.data;
                dossierCounts.value.formacion = dossier.titulos?.length ?? 0;
                dossierCounts.value.experiencia = dossier.experiencia?.length ?? 0;
                dossierCounts.value.referencias = dossier.referencias?.length ?? 0;
                dossierCounts.value.capacitacion = dossier.formacion?.length ?? 0;
                dossierCounts.value.certificacion = dossier.certificaciones?.length ?? 0;
            }
        } catch (error) {
            console.error('Error al cargar conteos del dossier:', error);
        }
    };

    onMounted(() => {
        const userDataString = localStorage.getItem('user');
        if (userDataString) {
            try {
                currentUser.value = JSON.parse(userDataString);
                console.log('👤 Usuario cargado:', currentUser.value);

                userPhoto.value = resolvePhotoUrl(currentUser.value?.photoUrl);
                
                // Cargar tareas con la cédula del usuario
                if (currentUser.value.cedula) {
                    service.getTareasPendientes(currentUser.value.cedula);
                    loadDossierCounts();
                }
            } catch (error) {
                console.error('Error al cargar datos del usuario:', error);
            }
        }

        window.addEventListener('dossier-updated', loadDossierCounts);
    });

    service.getEasymAreas()
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
    
    
    
    const handlePhotoSelected = async (file) => {
        if (!file || !currentUser.value?.cedula) {
            return;
        }

        try {
            const formData = new FormData();
            formData.append('photo', file);

            const { data } = await axios.put(
                `${API_PREFIX}/users/${currentUser.value.cedula}/photo`,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                }
            );

            const updatedPhoto = resolvePhotoUrl(data?.user?.photoUrl);
            if (updatedPhoto) {
                currentUser.value.photoUrl = data.user.photoUrl;
                userPhoto.value = updatedPhoto;
            }
            localStorage.setItem('user', JSON.stringify(currentUser.value));
        } catch (error) {
            console.error('Error al actualizar la foto de perfil:', error);
        }
    };

    onBeforeUnmount(() => {
        window.removeEventListener('dossier-updated', loadDossierCounts);
    });

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
                mainmenu.value = buildPerfilMenu();
                process.value="Formación";
                break;
            case 'Academia':
                console.log("Academia detected")
                mainmenu.value=[
                    {
                        label: 'Logros Académicos',
                        key: null,
                        active: true,
                    },
                    {
                        label: 'Tutorías',
                        key: null,
                        active: false,
                    },
                    {
                        label: 'Horarios',
                        key: null,
                        active: false,
                    },
                    {
                        label: 'Gestión',
                        key: null,
                        active: false,
                    },
                    {
                        label: 'Eventos',
                        key: null,
                        active: false,
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
    .menu-section-title {
      text-align: center;
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    </style>
          
