<template>  

    <s-header :menu-open="vmenu" @onclick="handleHeaderToggle">
        <div class="header-left">
            <button class="nav-link text-white p-0" type="button" @click="handleUserIconClick">
                <img class="avatar" :src="userPhoto" alt="User Avatar">
            </button>

            <button
            class="nav-link text-white"
            v-for="(area, index) in areas"
            :key="index"
            :class="{'active':area.active==true}"
            type="button"
            @click="onheadClick(area)"
            >
              {{ area.name}}
            </button>
        </div>

        <div class="header-right">
            <router-link to="/logout" class="nav-link text-white p-0">
                <img class="avatar" src="/images/logout.svg" alt="User Avatar">
            </router-link>              
            <button class="nav-link text-white p-0" type="button" @click="onheadClick({name:'Firmar'})"> 
                <img class="avatar" src="/images/pen_line.svg" alt="User Avatar">
            </button>
            <button class="nav-link text-white p-0" type="button" @click="onClick('Message')">
                <font-awesome-icon icon="bell" class="avatar" />
            </button>
        </div>
    </s-header>
    
      
      <div class="row g-3">
    
        <s-menu :show="vmenu">

            <div class="admin-menu">
                <UserProfile
                    :photo="userPhoto"
                    :username="userFullName"
                    :editable="true"
                    @photo-selected="handlePhotoSelected"
                />
                <div class="menu-section">
                  <button
                    class="menu-section-title text-white w-100"
                    type="button"
                    :class="{ 'is-open': showCoordinacion }"
                    @click="showCoordinacion = !showCoordinacion"
                  >
                      <span class="menu-title-left">
                        <font-awesome-icon :icon="menuSectionIcons.coordinacion" class="menu-title-icon" />
                        <span>Coordinación</span>
                      </span>
                  </button>

                  <div v-show="showCoordinacion" class="menu-section-body">
                    <div class="list-group list-group-flush">
                      <button v-for="(item, index) of mainmenu" :key="index"
                        class="list-group-item list-group-item-action"
                        :class="{ active: item.active }"
                        type="button"
                        @click="onmenuClick(item.label)">
                        <span class="menu-item-content">
                          <font-awesome-icon :icon="item.icon || 'circle'" class="menu-item-icon" />
                          <span>{{ item.label }}</span>
                        </span>
                        <span v-if="item.key" class="menu-indicator">
                          {{ dossierCounts[item.key] ?? 0 }}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                <div class="menu-section">
                  <button
                    class="menu-section-title text-white w-100"
                    type="button"
                    :class="{ 'is-open': showDocencia }"
                    @click="showDocencia = !showDocencia"
                  >
                    <span class="menu-title-left">
                      <font-awesome-icon :icon="menuSectionIcons.docencia" class="menu-title-icon" />
                      <span>Docencia</span>
                    </span>
                  </button>
                  <div v-show="showDocencia" class="menu-section-body"></div>
                </div>
            </div>
        </s-menu>
    
        <s-body
        :showmenu="vmenu"
        :shownotify="vnotify"
        >


        <div v-if="area=='Perfil'" id="validar">
            <ProfileHomePanel
              v-if="process==='Inicio'"
              :current-user="currentUser"
              :photo="userPhoto"
              :dossier-counts="dossierCounts"
              @navigate-section="onmenuClick"
            />
            <TitulosView v-else-if="process==='Formación'"></TitulosView>
            <LaboralView v-else-if="process==='Experiencia'"></LaboralView>
            <ReferenciasView v-else-if="process==='Referencias'"></ReferenciasView>
            <CapacitacionView v-else-if="process==='Capacitación'"></CapacitacionView>
            <CertificacionView v-else-if="process==='Certificación'"></CertificacionView>
            <InvestigacionView v-else-if="process==='Investigación'"></InvestigacionView>
        </div>
        <div v-else-if="area=='Academia'">
            <IndexAcademia v-if="process=='index'" area="area" perfil="perfil"></IndexAcademia>
            <LogrosView :tareas="tareas" v-else-if="process=='Logros Académicos'"></LogrosView>
            <TutoriasView v-else-if="process==='Tutorías'"></TutoriasView>
        </div>
        <div v-else-if="area=='Firmar'">
            <FirmarPdf v-if="area=='Firmar'"></FirmarPdf>
        </div>

        </s-body>
        

      
        <s-message
        :show="vnotify"
        />
          
      </div>
      
      </template>
          
    <script setup>  
    
    
import { ref, computed, onMounted, onBeforeUnmount} from 'vue';
import { useRoute, useRouter } from 'vue-router';
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
import CapacitacionView from '@/views/logged/perfil/CapacitaciónView.vue';
import ProfileHomePanel from '@/sections/perfil/ProfileHomePanel.vue';
import InvestigacionView from '@/sections/perfil/InvestigacionView.vue';

import IndexAcademia from '@/sections/academia/AcademiaView.vue';
import LogrosView from '@/sections/academia/LogrosView.vue';

import TutoriasView from '@/sections/academia/TutoriasView.vue';

import FirmarPdf from '../logged/funciones/FirmarPdf.vue';


    import EasymServices from '@/services/EasymServices';
    import { API_PREFIX, API_ROUTES } from '@/services/apiConfig';

    const router = useRouter();
    const route = useRoute();
    const service = new EasymServices();
    const API_BASE_URL = API_ROUTES.BASE;

    // Obtener datos del usuario desde localStorage
    const currentUser = ref(null);
    const defaultPhoto = '/images/avatar.png';
    const userPhoto = ref(defaultPhoto);
    const userFullName = computed(() => {
        if (currentUser.value) {
            const firstName = currentUser.value.first_name ?? '';
            const lastName = currentUser.value.last_name ?? '';
            return `${firstName} ${lastName}`.trim() || 'Usuario';
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
        certificacion: 0,
        investigacion: 0
    });

    const buildPerfilMenu = () => ([
        {
            label: 'Inicio',
            key: null,
            icon: 'user',
            active: true,
        },
        {
            label: 'Formación',
            key: 'formacion',
            icon: 'certificate',
            active: false,
        },
        {
            label: 'Experiencia',
            key: 'experiencia',
            icon: 'check-double',
            active: false,
        },
        {
            label: 'Referencias',
            key: 'referencias',
            icon: 'id-card',
            active: false,
        },
        {
            label: 'Capacitación',
            key: 'capacitacion',
            icon: 'square-check',
            active: false,
        },
        {
            label: 'Certificación',
            key: 'certificacion',
            icon: 'check-circle',
            active: false,
        },
        {
            label: 'Investigación',
            key: 'investigacion',
            icon: 'certificate',
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
                dossierCounts.value.investigacion = (dossier.investigacion?.articulos?.length ?? 0)
                    + (dossier.investigacion?.libros?.length ?? 0)
                    + (dossier.investigacion?.ponencias?.length ?? 0)
                    + (dossier.investigacion?.tesis?.length ?? 0)
                    + (dossier.investigacion?.proyectos?.length ?? 0);
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
    const process= ref("Inicio")

    const area= ref("Perfil")
    const showCoordinacion = ref(true);
    const showDocencia = ref(false);
    const menuSectionIcons = {
        coordinacion: 'id-card',
        docencia: 'certificate'
    };
    
    
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

    const handleHeaderToggle = (target) => {
        if (target === 'User') {
            router.push('/dashboard');
        }
    };

    const handleUserIconClick = () => {
        if (route.name !== 'perfil') {
            router.push('/perfil');
        } else {
            toggleVmenu();
        }
        onheadClick({ name: 'Perfil' });
    };
    

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
                process.value="Inicio";
                break;
            case 'Academia':
                console.log("Academia detected")
                mainmenu.value=[
                    {
                        label: 'Logros Académicos',
                        key: null,
                        icon: 'certificate',
                        active: true,
                    },
                    {
                        label: 'Tutorías',
                        key: null,
                        icon: 'check-double',
                        active: false,
                    },
                    {
                        label: 'Horarios',
                        key: null,
                        icon: 'info-circle',
                        active: false,
                    },
                    {
                        label: 'Gestión',
                        key: null,
                        icon: 'id-card',
                        active: false,
                    },
                    {
                        label: 'Eventos',
                        key: null,
                        icon: 'globe',
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
          
