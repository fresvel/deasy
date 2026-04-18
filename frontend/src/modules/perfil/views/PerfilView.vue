<template>  
  <div class="min-h-screen bg-slate-100 font-sans flex flex-col">
    <app-workspace-header :menu-open="vmenu" current-section="perfil" @menu-toggle="handleHeaderToggle" @notify="toggleNotify" @sign="isSigningView = !isSigningView">
        <div v-if="areas && areas.length" class="flex items-stretch gap-2 overflow-x-auto p-1 scrollbar-thin scrollbar-thumb-white/30 scrollbar-track-transparent">
          <button
            v-for="(item, index) in areas"
            :key="index"
            class="inline-flex items-center justify-center sm:justify-start gap-2 min-w-11 sm:min-w-25 lg:min-w-35 px-2 sm:px-3 py-2 rounded-xl border-none cursor-pointer transition-all shrink-0 group hover:-translate-y-px" :title="item.name"
            :class="item.active ? 'bg-white/95 text-sky-700 shadow-[0_10px_20px_rgba(2,132,199,0.26)]' : 'bg-white/10 text-white/95 hover:bg-white/20'"
            type="button"
            @click="onheadClick(item)"
          >
             <component :is="resolveAreaIcon(item.name)" class="w-5 h-5 shrink-0" />
            <span class="text-sm font-semibold leading-tight hidden sm:inline-flex items-center gap-1.5 whitespace-nowrap overflow-hidden text-ellipsis">{{ item.name }}</span>
          </button>
        </div>
    </app-workspace-header>

    <div class="flex flex-col xl:flex-row w-full flex-1 max-w-640 mx-auto items-stretch">
      <app-workspace-sidebar :show="vmenu" :photo="userPhoto" :username="userFullName" :signature-marker="signatureMarker" :editable="true" @close-mobile="vmenu = false" @photo-selected="handlePhotoSelected">
        <div class="flex flex-col">
            <div class="deasy-nav-meta mt-3 mb-2">
                Secciones
            </div>

            <div class="deasy-nav-group mt-2">
              <div class="deasy-nav-shell">
              <div class="deasy-nav-section">
                <button
                  class="deasy-nav-group-title"
                  :class="{ 'deasy-nav-item--subtle-active': showCoordinacion }"
                  type="button"
                  @click="showCoordinacion = !showCoordinacion"
                >
                    <span class="flex items-center gap-3.5 text-base font-semibold">
                      <IconId class="w-6 h-6 shrink-0 opacity-90" />
                      <span class="truncate">Coordinación</span>
                    </span>
                </button>

                <div v-show="showCoordinacion" class="deasy-nav-tree">
                    <button v-for="(item, index) of mainmenu" :key="index"
                      class="deasy-nav-item"
                      :class="item.active ? 'deasy-nav-item--active' : ''"
                      type="button"
                      @click="onmenuClick(item.label)">
                      <span class="deasy-nav-item__icon deasy-nav-item__icon--direct">
                        <component :is="getMenuIcon(item.icon)" class="h-4.5 w-4.5 shrink-0" />
                      </span>
                      <span class="deasy-nav-item__label">{{ item.label }}</span>
                      <span v-if="item.key" class="ml-auto inline-flex items-center rounded-lg border border-[#bfd7ee] bg-[#e2f2fa] px-2 py-0.5 text-[10px] font-bold text-[#21517a] shrink-0">
                        {{ dossierCounts[item.key] ?? 0 }}
                      </span>
                    </button>
                </div>
              </div>

              <div class="deasy-nav-section">
                <button
                  class="deasy-nav-group-title"
                  :class="{ 'deasy-nav-item--subtle-active': showDocencia }"
                  type="button"
                  @click="showDocencia = !showDocencia"
                >
                  <span class="flex items-center gap-3.5 text-base font-semibold">
                    <IconCertificate class="w-6 h-6 shrink-0 opacity-90" />
                    <span class="truncate">Docencia</span>
                  </span>
                </button>
                <div v-show="showDocencia" class="deasy-nav-tree">
                </div>
              </div>
              </div>
            </div>
        </div>
      </app-workspace-sidebar>

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
            <CertificadosFirmaView v-else-if="process==='Certificados de firma'"></CertificadosFirmaView>
        </div>
        <div v-else-if="area=='Academia'" class="w-full">
            <IndexAcademia v-if="process=='index'" area="area" perfil="perfil"></IndexAcademia>
            <LogrosView :tareas="tareas" v-else-if="process=='Logros Académicos'"></LogrosView>
        </div>
        <div v-else-if="area=='Firmar'" class="w-full">
            <!-- <FirmarPdf v-if="area=='Firmar'"></FirmarPdf> -->
             <div class="p-6 text-center text-slate-500 bg-white rounded-2xl m-4">Módulo de firma en migración (no disponible temporalmente)</div>
        </div>
      </s-body>
        
      <s-message :show="vnotify" @close="vnotify = false" />
      <WorkspaceChatLauncher :current-person-id="currentUser?.id || currentUser?._id || null" />
    </div>
  </div>
</template>
          
    <script setup>  
    
    
import { ref, computed, onMounted, onBeforeUnmount, watch} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
    import AppWorkspaceSidebar from '@/layouts/menus/AppWorkspaceSidebar.vue';
    import SMessage from '@/layouts/core/SNotify.vue';
    import SBody from '@/layouts/core/SBody.vue';
    import AppWorkspaceHeader from '@/layouts/headers/AppWorkspaceHeader.vue';
    import WorkspaceChatLauncher from '@/shared/components/widgets/WorkspaceChatLauncher.vue';
    import { 
      IconUser, IconCertificate, IconChecks, IconId, IconSquareCheck, IconCircleCheck, 
      IconInfoCircle, IconMenu2, IconHome
    , IconBook, IconMicroscope, IconLink, IconWorld, IconAppWindow } from '@tabler/icons-vue';

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
import TitulosView from '@/modules/perfil/views/TitulosView.vue';
import LaboralView from '@/modules/perfil/views/LaboralView.vue';
import ReferenciasView from '@/modules/perfil/views/ReferenciasView.vue';
import CertificacionView from '@/modules/perfil/views/CertificacionView.vue';
import CapacitacionView from '@/modules/perfil/views/CapacitacionView.vue';
import ProfileHomePanel from '@/modules/perfil/components/ProfileHomePanel.vue';
import InvestigacionView from '@/modules/perfil/views/InvestigacionView.vue';
import CertificadosFirmaView from '@/modules/perfil/views/CertificadosFirmaView.vue';

import IndexAcademia from '@/modules/academia/views/AcademiaView.vue';
import LogrosView from '@/modules/academia/views/LogrosView.vue';

// import FirmarPdf from '@/views/funciones/FirmarPdf.vue';

    import EasymServices from '@/shared/services/EasymServices';
    import { API_PREFIX, API_ROUTES } from '@/core/config/apiConfig';

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
    const signatureMarker = computed(() => {
        const directMarker = currentUser.value?.signatureMarker;
        if (directMarker) {
            return directMarker;
        }
        const rawToken = currentUser.value?.signatureToken ?? currentUser.value?.token ?? '';
        return rawToken ? `!-${rawToken}-!` : '';
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

    const refreshCurrentUser = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            return;
        }

        try {
            const { data } = await axios.get(API_ROUTES.USERS_ME, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (data?.user) {
                const mergedUser = {
                    ...(currentUser.value ?? {}),
                    ...data.user
                };
                currentUser.value = mergedUser;
                userPhoto.value = resolvePhotoUrl(mergedUser.photoUrl);
                localStorage.setItem('user', JSON.stringify(mergedUser));
            }
        } catch (error) {
            console.error('Error al refrescar perfil del usuario:', error);
        }
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
        },
        {
            label: 'Certificados de firma',
            key: null,
            icon: 'id-card',
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
                refreshCurrentUser();
                
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

    const handleHeaderToggle = () => {
        toggleVmenu();
    };

    const syncAreaState = (areaName) => {
        area.value = areaName;
        for (const el of areas.value) {
            el.active = el.name === areaName;
        }
    };

    const openSigningWorkspace = () => {
        syncAreaState('Firmar');
        process.value = 'Firmar';
        router.replace({ path: '/perfil', query: { view: 'firmar' } });
    };

    const syncViewFromRoute = () => {
        if (route.query?.view === 'firmar') {
            syncAreaState('Firmar');
            process.value = 'Firmar';
            return;
        }
        if (area.value === 'Firmar') {
            syncAreaState('Perfil');
            mainmenu.value = buildPerfilMenu();
            process.value = 'Inicio';
        }
    };
    

    const onmenuClick=(item)=>{
        if (area.value === 'Firmar') {
            syncAreaState('Perfil');
            router.replace({ path: '/perfil' });
        }
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
        syncAreaState(item.name);
        switch(item.name){
            case 'Perfil':
                mainmenu.value = buildPerfilMenu();
                process.value="Inicio";
                router.replace({ path: '/perfil' });
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
                router.replace({ path: '/perfil' });
                break;
            case 'Investigación':
                mainmenu.value=[]
                process.value="Investigación";
                router.replace({ path: '/perfil' });
                break;
            case 'Vinculación':
                mainmenu.value=[]
                process.value="Vinculación";
                router.replace({ path: '/perfil' });
                break;
            case 'Internacionalización':
                mainmenu.value=[]
                process.value="Internacionalización";
                router.replace({ path: '/perfil' });
                break;
            case 'Firmar':
                openSigningWorkspace();
                break;
            case 'Message':
                break;
            default:
                break;
        }
    }

    watch(() => route.query.view, () => {
        syncViewFromRoute();
    });

    onMounted(() => {
        syncViewFromRoute();
    });


      
      
    </script>
          
