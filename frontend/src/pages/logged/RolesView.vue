<template>  
  <div class="min-h-[100vh] bg-slate-100 font-sans flex flex-col">
    <s-header :menu-open="vmenu" @onclick="handleHeaderToggle">
       <div class="flex items-center gap-3 overflow-hidden flex-1">
        <div v-if="areas && areas.length" class="flex items-stretch gap-2 overflow-x-auto p-1 scrollbar-thin scrollbar-thumb-white/30 scrollbar-track-transparent">
          <button
            v-for="(item, index) in areas"
            :key="index"
            class="inline-flex items-center justify-center sm:justify-start gap-2 min-w-[44px] sm:min-w-[100px] lg:min-w-[140px] px-2 sm:px-3 py-2 rounded-xl border-none cursor-pointer transition-all shrink-0 group hover:-translate-y-[1px]" :title="item.name"
            :class="item.active ? 'bg-white/95 text-sky-700 shadow-[0_10px_20px_rgba(2,132,199,0.26)]' : 'bg-white/10 text-white/95 hover:bg-white/20'"
            type="button"
            @click="onheadClick(item)"
          >
             <component :is="resolveAreaIcon(item.name)" class="w-5 h-5 shrink-0" />
             <span class="text-sm font-semibold leading-tight hidden sm:inline-flex items-center gap-1.5 whitespace-nowrap overflow-hidden text-ellipsis">{{ item.name }}</span>
          </button>
        </div>
       </div>

       <div class="flex items-center gap-1 sm:gap-2 shrink-0">
          <router-link to="/firmar" class="flex shrink-0 items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-white/10 !text-white/90 hover:bg-white/20 hover:!text-white transition-all border border-white/10 shadow-sm focus:outline-none focus:ring-2 focus:ring-white/30 sm:ms-3" title="Firmar documentos">
            <IconSignature class="w-4 h-4 sm:w-5 sm:h-5" />
          </router-link>

          <button class="flex shrink-0 items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-white/10 text-white hover:bg-white/20 hover:text-white transition-all border border-white/10 shadow-sm focus:outline-none focus:ring-2 focus:ring-white/30" type="button" @click="onClick('Message')" title="Notificaciones">
             <IconBell class="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <router-link to="/dashboard" class="flex shrink-0 items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-white/10 !text-white/90 hover:bg-white/20 hover:!text-white transition-all border border-white/10 shadow-sm focus:outline-none focus:ring-2 focus:ring-white/30" title="Regresar al Dashboard">
             <IconHome class="w-4 h-4 sm:w-5 sm:h-5" />
          </router-link>

          <router-link to="/logout" class="flex shrink-0 items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-white/10 !text-white/90 hover:bg-white/20 hover:!text-white transition-all border border-white/10 shadow-sm focus:outline-none focus:ring-2 focus:ring-white/30" title="Cerrar sesión">
             <IconLogout class="w-4 h-4 sm:w-5 sm:h-5" />
          </router-link>
       </div>
    </s-header>
    
    <div class="flex flex-col xl:flex-row w-full flex-1 max-w-[2560px] mx-auto items-stretch">
        <s-menu :show="vmenu" @close-mobile="vmenu = false">
            <div class="flex flex-col gap-4 p-4 h-full xl:min-h-[calc(100vh-4rem)]">
                <UserProfile
                    :photo="userPhoto"
                    :username="userFullName"
                    :editable="false"
                    @photo-selected="handlePhotoSelected"
                />
                
                <div class="flex flex-col gap-1">
                  <button
                    class="flex items-center justify-between w-full px-3 py-2 text-sm font-semibold text-white/90 hover:text-white transition-colors"
                    type="button"
                    @click="showRol = !showRol"
                  >
                      <span>{{ userRole }}</span>
                      <IconChevronDown class="w-4 h-4 transition-transform duration-200" :class="{ 'rotate-180': showRol }" />
                  </button>

                  <div v-show="showRol" class="flex flex-col gap-1 mt-1 pl-2">
                      <button v-for="(item, index) of mainmenu" :key="index"
                        class="px-4 py-2.5 text-sm font-medium rounded-xl text-left transition-all duration-200 flex justify-between items-center"
                        :class="[item.active ? 'bg-white text-sky-800 shadow-sm border-none' : 'text-white/80 hover:bg-white/10 hover:text-white']"
                        type="button"
                        @click="onmenuClick(item.label)">
                        <span>{{ item.label }}</span>
                        <span v-if="item.key && processCounts[item.key] > 0" class="inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-white bg-sky-600 rounded-full">
                          {{ processCounts[item.key] }}
                        </span>
                      </button>
                  </div>
                </div>
            </div>
        </s-menu>
    
        <s-body
            class="flex-1 min-w-0"
            :showmenu="vmenu"
            :shownotify="vnotify"
            :shownavmenu="showNavMenu"
        >
            <div v-if="area=='Roles'" id="validar" class="p-6">
                <div v-if="process==='Proceso de contratación'">
                    <div class="mb-6">
                        <h2 class="text-2xl font-bold text-slate-800 tracking-tight">Proceso de contratación</h2>
                        <p class="text-sm font-medium text-slate-500 mt-1">Gestiona los procesos de contratación del personal.</p>
                    </div>
                    <div class="bg-white rounded-[1.5rem] shadow-xl shadow-slate-200/40 p-12 border border-slate-100 flex items-center justify-center">
                        <p class="text-slate-500 font-medium">Módulo en desarrollo</p>
                    </div>
                </div>
                <div v-else-if="process==='Proceso de memorándum'">
                  <MemorandumView />
                </div>
                <div v-else-if="process==='Proceso Horarios'">
                    <div class="mb-6">
                        <h2 class="text-2xl font-bold text-slate-800 tracking-tight">Proceso Horarios</h2>
                        <p class="text-sm font-medium text-slate-500 mt-1">Gestiona los horarios académicos y administrativos.</p>
                    </div>
                    <div class="bg-white rounded-[1.5rem] shadow-xl shadow-slate-200/40 p-12 border border-slate-100 flex items-center justify-center">
                        <p class="text-slate-500 font-medium">Módulo en desarrollo</p>
                    </div>
                </div>
            </div>
            <div v-else-if="area=='Academia'" class="p-6">
                <IndexAcademia v-if="process=='index'" area="area" perfil="perfil"></IndexAcademia>
                <LogrosView :tareas="tareas" v-else-if="process=='Logros Académicos'"></LogrosView>
            </div>
            <div v-else-if="area=='Firmar'" class="p-6">
                <FirmarPdf v-if="area=='Firmar'"></FirmarPdf>
            </div>
        </s-body>
        
        <s-message :show="vnotify" />
        
        <s-nav-menu :show="showNavMenu" :is-admin="false" @close="showNavMenu = false" />
    </div>
  </div>
</template>
          
    <script setup>  
    
    
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { IconUsers, IconBell, IconHome, IconLogout, IconChevronDown, IconSignature, IconBook, IconMicroscope, IconLink, IconWorld, IconAppWindow, IconUser } from '@tabler/icons-vue';

const isClient = typeof window !== 'undefined';
const resolveAreaIcon = (name) => {
    switch(name) {
        case 'Academia': return IconBook;
        case 'Investigación': return IconMicroscope;
        case 'Vinculación': return IconLink;
        case 'Internacionalización': return IconWorld;
        case 'Perfil': return IconUser;
        default: return IconAppWindow;
    }
};

import SMenu from '@/layouts/SMenu.vue';
    import SMessage from '@/layouts/SNotify.vue';
    import SBody from '@/layouts/SBody.vue';
    import SHeader from '@/layouts/SHeader.vue';
    import SNavMenu from '@/layouts/SNavMenu.vue';
    import UserProfile from '@/components/UserProfile.vue';

import IndexAcademia from '@/sections/academia/AcademiaView.vue';
import LogrosView from '@/sections/academia/LogrosView.vue';
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
            const nombre = currentUser.value.first_name || currentUser.value.nombre || currentUser.value.name || '';
            const apellido = currentUser.value.last_name || currentUser.value.apellido || currentUser.value.lastName || currentUser.value.lastname || '';
            const fullName = `${nombre} ${apellido}`.trim();
            return fullName || 'Usuario';
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
    const vmenu = ref(isClient ? window.innerWidth >= 1280 : true);
    const vnotify = ref(false);
    const showNavMenu = ref(false);
    const process= ref("Proceso de contratación")

    const area= ref("Roles")
    const showRol = ref(true);
    
    // Inicializar el área como Roles al montar
    
    const handleHeaderToggle = (item) => {
        if(item === "Message"){
            toggleNotify();
        } else {
            toggleVmenu();
        }
    };
    
    let isDesktopStatus = isClient ? window.innerWidth >= 1280 : true;

    const handleResize = () => {
        if (!isClient) return;
        const isNowDesktop = window.innerWidth >= 1280;
        if (isDesktopStatus !== isNowDesktop) {
            isDesktopStatus = isNowDesktop;
            vmenu.value = isNowDesktop;
        }
    };

    onMounted(() => {
        if (isClient) {
            window.addEventListener('resize', handleResize);
            handleResize();
        }

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


    onBeforeUnmount(() => {
        if (isClient) {
            window.removeEventListener('resize', handleResize);
        }
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
          
    
          
