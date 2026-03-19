<template>  
  <div class="min-h-[100vh] bg-slate-100 font-sans flex flex-col">
    <s-header :menu-open="vmenu" @onclick="handleHeaderToggle">
       <div class="flex items-center gap-3 overflow-hidden flex-1">
        <div v-if="areas && areas.length" class="flex items-stretch gap-2 overflow-x-auto p-1 scrollbar-thin scrollbar-thumb-white/30 scrollbar-track-transparent">
          <button
            v-for="(item, index) in areas"
            :key="index"
            class="inline-flex items-center gap-2 min-w-[140px] px-3 py-2 rounded-xl border-none cursor-pointer transition-all shrink-0 group hover:-translate-y-[1px]"
            :class="item.active ? 'bg-white/95 text-sky-700 shadow-[0_10px_20px_rgba(2,132,199,0.26)]' : 'bg-white/10 text-white/95 hover:bg-white/20'"
            type="button"
            @click="onheadClick(item)"
          >
             <span class="text-sm font-semibold leading-tight inline-flex items-center gap-1.5 whitespace-nowrap overflow-hidden text-ellipsis">{{ item.name }}</span>
          </button>
        </div>
       </div>

       <div class="flex items-center gap-1 sm:gap-2 shrink-0">
          <router-link to="/roles" class="flex shrink-0 items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-white/10 text-white hover:bg-white/20 hover:text-white transition-all border border-white/10 shadow-sm focus:outline-none focus:ring-2 focus:ring-white/30 sm:ms-3 !text-white/90" title="Roles">
            <IconUsers class="w-4 h-4 sm:w-5 sm:h-5" />
          </router-link>

          <button class="flex shrink-0 items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-white/10 text-white hover:bg-white/20 hover:text-white transition-all border border-white/10 shadow-sm focus:outline-none focus:ring-2 focus:ring-white/30" type="button" @click="onheadClick({name:'Firmar'})" title="Firmar documentos">
            <IconSignature class="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <button class="flex shrink-0 items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-white/10 text-white hover:bg-white/20 hover:text-white transition-all border border-white/10 shadow-sm focus:outline-none focus:ring-2 focus:ring-white/30" type="button" @click="onClick('Message')" title="Notificaciones">
            <IconBell class="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <button class="flex shrink-0 items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-white/10 text-white hover:bg-white/20 hover:text-white transition-all border border-white/10 shadow-sm focus:outline-none focus:ring-2 focus:ring-white/30" type="button" @click="handleUserIconClick" title="Regresar al Dashboard">
            <IconHome class="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <router-link to="/logout" class="flex shrink-0 items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-white/10 text-white hover:bg-white/20 hover:text-white transition-all border border-white/10 shadow-sm focus:outline-none focus:ring-2 focus:ring-white/30 !text-white/90" title="Cerrar sesión">
            <IconLogout class="w-4 h-4 sm:w-5 sm:h-5" />
          </router-link>
       </div>
    </s-header>

    <div class="flex flex-col xl:flex-row w-full flex-1 max-w-[2560px] mx-auto items-stretch">
      <s-menu :show="vmenu" @close-mobile="vmenu = false">
        <div class="flex flex-col">
            <UserProfile
                :photo="userPhoto"
                :username="userFullName"
                :editable="true"
                @photo-selected="handlePhotoSelected"
            />
            
            <div class="text-sm font-semibold mt-3 mb-2 opacity-85 text-white px-2">
                Secciones
            </div>

            <div class="flex flex-col gap-1 mt-2">
              <div class="flex flex-col mb-1">
                <button
                  class="w-full text-white bg-transparent border-none py-3 px-2 flex items-center justify-between text-left rounded-xl transition-colors hover:bg-white/10"
                  :class="{ 'bg-white/10 font-bold': showCoordinacion }"
                  type="button"
                  @click="showCoordinacion = !showCoordinacion"
                >
                    <span class="flex items-center gap-3 text-sm font-semibold">
                      <IconId class="w-5 h-5 shrink-0 opacity-90" />
                      <span class="truncate">Coordinación</span>
                    </span>
                </button>

                <div v-show="showCoordinacion" class="pl-4 py-2 ml-2 border-l border-white/20 mt-1 flex flex-col gap-1">
                    <button v-for="(item, index) of mainmenu" :key="index"
                      class="w-full text-left bg-transparent border-none py-2 px-3 rounded-lg text-sm transition-all focus:outline-none flex flex-row items-center justify-between hover:bg-white/10 hover:text-white"
                      :class="item.active ? 'bg-white text-sky-700 font-bold shadow-sm shadow-sky-900/20' : 'text-white/80'"
                      type="button"
                      @click="onmenuClick(item.label)">
                      <span class="flex items-center gap-2 truncate">
                        <component :is="getMenuIcon(item.icon)" class="w-4 h-4 shrink-0" />
                        <span class="truncate">{{ item.label }}</span>
                      </span>
                      <span v-if="item.key" class="bg-sky-500/20 text-white text-xs py-0.5 px-2 rounded-full font-bold ml-2 shrink-0">
                        {{ dossierCounts[item.key] ?? 0 }}
                      </span>
                    </button>
                </div>
              </div>

              <div class="flex flex-col mb-1">
                <button
                  class="w-full text-white bg-transparent border-none py-3 px-2 flex items-center justify-between text-left rounded-xl transition-colors hover:bg-white/10"
                  :class="{ 'bg-white/10 font-bold': showDocencia }"
                  type="button"
                  @click="showDocencia = !showDocencia"
                >
                  <span class="flex items-center gap-3 text-sm font-semibold">
                    <IconCertificate class="w-5 h-5 shrink-0 opacity-90" />
                    <span class="truncate">Docencia</span>
                  </span>
                </button>
                <div v-show="showDocencia" class="pl-4 py-2 ml-2 border-l border-white/20 mt-1 flex flex-col gap-1">
                </div>
              </div>
            </div>
        </div>
      </s-menu>

      <s-body :showmenu="vmenu" :shownotify="vnotify">
        <div v-if="area=='Perfil'" id="validar" class="w-full">
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
        <div v-else-if="area=='Academia'" class="w-full">
            <IndexAcademia v-if="process=='index'" area="area" perfil="perfil"></IndexAcademia>
            <LogrosView :tareas="tareas" v-else-if="process=='Logros Académicos'"></LogrosView>
            <TutoriasView v-else-if="process==='Tutorías'"></TutoriasView>
        </div>
        <div v-else-if="area=='Firmar'" class="w-full">
            <FirmarPdf v-if="area=='Firmar'"></FirmarPdf>
        </div>
      </s-body>
        
      <s-message :show="vnotify" @close="vnotify = false" />
    </div>
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
    import { 
      IconUser, IconCertificate, IconChecks, IconId, IconSquareCheck, IconCircleCheck, 
      IconInfoCircle, IconSignature, IconBell, IconUsers, IconLogout, IconMenu2, IconHome
    } from '@tabler/icons-vue';

    const getMenuIcon = (iconName) => {
      const map = {
        'user': IconUser,
        'certificate': IconCertificate,
        'check-double': IconChecks,
        'id-card': IconId,
        'square-check': IconSquareCheck,
        'check-circle': IconCircleCheck,
        'info-circle': IconInfoCircle
      };
      return map[iconName] || IconCircleCheck;
    };
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
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', handleResize);
        }
    });

    service.getEasymAreas()
    const areas =service.getEasymdata().areas
    const tareas=service.getEasymdata().tareas
    const isClient = typeof window !== 'undefined';
    const vmenu = ref(isClient ? window.innerWidth >= 1280 : true);
    const vnotify = ref(false);
    const process= ref("Inicio")

    let isDesktopStatus = isClient ? window.innerWidth >= 1280 : true;

    const handleResize = () => {
        if (!isClient) return;
        const isNowDesktop = window.innerWidth >= 1280;
        if (isDesktopStatus !== isNowDesktop) {
            isDesktopStatus = isNowDesktop;
            vmenu.value = isNowDesktop;
        }
    };

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
        window.removeEventListener('dossier-updated', loadDossierCounts);
        if (typeof window !== 'undefined') {
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

    const handleHeaderToggle = (target) => {
        if (target === 'User') {
            toggleVmenu();
        }
    };

    const handleUserIconClick = () => {
        router.push('/dashboard');
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
          
