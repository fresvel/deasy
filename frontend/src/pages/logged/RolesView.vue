<template>  

    <s-header @onclick="onClick('Menu')">
        <div class="header-left">
            <button class="nav-link text-white p-0" type="button" @click="navigateToPerfil" title="Ir al perfil">
                <img class="avatar" :src="userPhoto" alt="User Avatar">
            </button>
            <router-link to="/roles" class="nav-link text-white p-0" title="Roles">
                <font-awesome-icon icon="user" class="avatar" />
            </router-link>

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
            <button class="nav-link text-white p-0" type="button" @click="onClick('Message')">
                <font-awesome-icon icon="bell" class="avatar" />
            </button>
            <button class="nav-link text-white p-0" type="button" @click="toggleNavMenu" title="Menú de navegación">
                <font-awesome-icon icon="bars" class="avatar" />
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
                    :class="{ 'is-open': showRol }"
                    @click="showRol = !showRol"
                  >
                      {{ userRole }}
                  </button>

                  <div v-show="showRol" class="menu-section-body">
                    <div class="list-group list-group-flush">
                      <button v-for="(item, index) of mainmenu" :key="index"
                        class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                        :class="{ active: item.active }"
                        type="button"
                        @click="onmenuClick(item.label)">
                        <span>{{ item.label }}</span>
                        <span v-if="item.key" class="badge bg-primary rounded-pill">
                          {{ processCounts[item.key] ?? 0 }}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
            </div>
        </s-menu>
    
        <s-body
        :showmenu="vmenu"
        :shownotify="vnotify"
        :shownavmenu="showNavMenu"
        >

        <div v-if="area=='Roles'" id="validar" class="container-fluid py-4">
            <div v-if="process==='Proceso de contratación'">
                <div class="profile-section-header">
                    <div>
                        <h2 class="text-start profile-section-title">Proceso de contratación</h2>
                        <p class="profile-section-subtitle">Gestiona los procesos de contratación del personal.</p>
                    </div>
                </div>
                <div class="card shadow-sm">
                    <div class="card-body text-center py-5">
                        <p class="text-muted">Módulo en desarrollo</p>
                    </div>
                </div>
            </div>
            <MemorandumView v-else-if="process==='Proceso de memorándum'" />
            <div v-else-if="process==='Proceso Horarios'">
                <div class="profile-section-header">
                    <div>
                        <h2 class="text-start profile-section-title">Proceso Horarios</h2>
                        <p class="profile-section-subtitle">Gestiona los horarios académicos y administrativos.</p>
                    </div>
                </div>
                <div class="card shadow-sm">
                    <div class="card-body text-center py-5">
                        <p class="text-muted">Módulo en desarrollo</p>
                    </div>
                </div>
            </div>
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
        
        <s-nav-menu :show="showNavMenu" :is-admin="false" @close="showNavMenu = false" />
          
      </div>
      
      </template>
          
    <script setup>  
    
    
import { ref, computed, onMounted} from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
    import SMenu from '@/layouts/SMenu.vue';
    import SMessage from '@/layouts/SNotify.vue';
    import SBody from '@/layouts/SBody.vue';
    import SHeader from '@/layouts/SHeader.vue';
    import SNavMenu from '@/layouts/SNavMenu.vue';
    import UserProfile from '@/components/UserProfile.vue';

import IndexAcademia from '@/sections/academia/AcademiaView.vue';
import LogrosView from '@/sections/academia/LogrosView.vue';
import TutoriasView from '@/sections/academia/TutoriasView.vue';
import MemorandumView from '@/sections/roles/MemorandumView.vue';
import FirmarPdf from '../logged/funciones/FirmarPdf.vue';


    import EasymServices from '@/services/EasymServices';
    import { API_PREFIX, API_ROUTES } from '@/services/apiConfig';

    const router = useRouter();
    const service = new EasymServices();
    const API_BASE_URL = API_ROUTES.BASE;

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
    
    // Rol del usuario (por defecto Coordinador)
    const userRole = ref('Coordinador');

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

    const processCounts = ref({
        contratacion: 0,
        memorandum: 0,
        horarios: 0
    });

    const buildRolesMenu = () => ([
        {
            label: 'Proceso de contratación',
            key: 'contratacion',
            active: true,
        },
        {
            label: 'Proceso de memorándum',
            key: 'memorandum',
            active: false,
        },
        {
            label: 'Proceso Horarios',
            key: 'horarios',
            active: false,
        }
    ]);

    const mainmenu=ref(buildRolesMenu())
    
    service.getEasymAreas()
    const areas =service.getEasymdata().areas
    const tareas=service.getEasymdata().tareas
    const vmenu = ref(true);
    const vnotify = ref(false);
    const showNavMenu = ref(false);
    const process= ref("Proceso de contratación")

    const area= ref("Roles")
    const showRol = ref(true);
    
    // Inicializar el área como Roles al montar
    onMounted(() => {
        const userDataString = localStorage.getItem('user');
        if (userDataString) {
            try {
                currentUser.value = JSON.parse(userDataString);
                console.log('👤 Usuario cargado:', currentUser.value);

                userPhoto.value = resolvePhotoUrl(currentUser.value?.photoUrl);
                
                // TODO: Cargar el rol real del usuario desde el backend
                // Por ahora se deja por defecto "Coordinador"
                // if (currentUser.value.rol) {
                //     userRole.value = currentUser.value.rol;
                // }
            } catch (error) {
                console.error('Error al cargar datos del usuario:', error);
            }
        }
        
        // Asegurar que el área inicial sea Roles
        area.value = "Roles";
        mainmenu.value = buildRolesMenu();
        process.value = "Proceso de contratación";
    });
    
    const toggleVmenu = () => {
        vmenu.value = !vmenu.value;
    };
      
    const toggleNotify = () => {
        if (showNavMenu.value) {
            showNavMenu.value = false;
        }
        vnotify.value = !vnotify.value;
    };
    
    const toggleNavMenu = () => {
        if (vnotify.value) {
            vnotify.value = false;
        }
        showNavMenu.value = !showNavMenu.value;
    };
    
    const navigateToPerfil = () => {
        router.push('/perfil');
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
            case 'Roles':
                mainmenu.value = buildRolesMenu();
                process.value="Proceso de contratación";
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
          
