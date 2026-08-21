<template>  
  <AppWorkspaceShell
    :menu-open="vmenu"
    :show-notify="vnotify"
    current-section="perfil"
    :photo="userPhoto"
    :username="userFullName"
    sidebar-subtitle="Dossier profesional"
    :signature-marker="signatureMarker"
    editable
    @menu-toggle="toggleMenu"
    @close-mobile="closeMenu"
    @notify="toggleNotify"
    @notify-close="closeNotify"
    @sign="router.push({ name: 'home-signatures' })"
    @photo-selected="handlePhotoSelected"
    @primary-nav="revealSidebarForNav"
  >
    <template #header>
      <AppContextHeader :title="profileContextTitle" :subtitle="profileContextSubtitle" />
    </template>

    <template #sidebar>
        <div class="flex flex-col">
            <div class="deasy-nav-group mt-2">
              <div class="deasy-nav-shell">
              <div class="deasy-nav-section">
                <button
                  class="deasy-nav-group-title"
                  :class="{ 'deasy-nav-item--subtle-active': showDossierMenu }"
                  type="button"
                  @click="showDossierMenu = !showDossierMenu"
                >
                    <span class="flex items-center gap-4 text-base font-semibold">
                      <span class="deasy-nav-glyph" :class="workspaceIconToneClass(dossierIconMeta.tone, 'deasy-nav-glyph')">
                        <component :is="dossierIconMeta.icon" class="h-5 w-5 shrink-0" />
                      </span>
                      <span class="truncate">Dossier profesional</span>
                    </span>
                </button>

                <div v-show="showDossierMenu" class="deasy-nav-tree">
                    <!-- router-link, no button: la seccion activa la decide la URL, no un string. -->
                    <router-link
                      :to="{ name: 'perfil' }"
                      class="deasy-nav-item"
                      :class="$route.name === 'perfil' ? 'deasy-nav-item--active' : ''"
                    >
                      <span class="deasy-nav-item__icon" :class="workspaceIconToneClass(inicioIconMeta.tone)">
                        <component :is="inicioIconMeta.icon" class="h-4.5 w-4.5 shrink-0" />
                      </span>
                      <span class="deasy-nav-item__label">Inicio</span>
                    </router-link>
                    <router-link
                      v-for="section of PROFILE_SECTIONS"
                      :key="section.slug"
                      :to="{ name: section.name }"
                      class="deasy-nav-item"
                      :class="$route.name === section.name ? 'deasy-nav-item--active' : ''"
                    >
                      <span class="deasy-nav-item__icon" :class="workspaceIconToneClass(sectionIconMeta(section).tone)">
                        <component :is="sectionIconMeta(section).icon" class="h-4.5 w-4.5 shrink-0" />
                      </span>
                      <span class="deasy-nav-item__label">{{ section.label }}</span>
                      <span v-if="section.countKey" class="ml-auto inline-flex items-center rounded-2xl border border-[#bfd7ee] bg-[#e2f2fa] px-2 py-0.5 text-theme-xs font-bold text-[#21517a] shrink-0">
                        {{ dossierCounts[section.countKey] ?? 0 }}
                      </span>
                    </router-link>
                </div>
              </div>
              </div>
            </div>
        </div>
    </template>

        <!-- Aqui habia una cadena de 8 v-else-if sobre `process`, un string en espanol con tilde. Cada
             seccion tiene ya su ruta: el router decide, y una URL que no casa falla ruidosamente. -->
        <div id="validar" class="w-full">
            <router-view />
        </div>
  </AppWorkspaceShell>

  <WorkspaceChatLauncher :current-person-id="currentUser?.id || currentUser?._id || null" />
</template>
          
    <script setup>  
    
    
import { ref, computed, onMounted, onBeforeUnmount, provide } from 'vue';
import AppContextHeader from "@/shared/components/layout/AppContextHeader.vue";
import { useWorkspaceChrome } from '@/shared/composables/useWorkspaceChrome.js';
import { useRoute, useRouter } from 'vue-router';
import axios from '@/core/services/httpClient';
    import AppWorkspaceShell from '@/layouts/workspace/AppWorkspaceShell.vue';
    import WorkspaceChatLauncher from '@/shared/components/widgets/WorkspaceChatLauncher.vue';
import {
      resolveWorkspaceProfileMenuIcon,
      resolveWorkspaceSectionIcon,
      workspaceIconToneClass,
    } from '@/shared/utils/workspaceNavIcons.js';
// Las secciones ya no se importan aqui: cada una es una ruta hija y las monta el <router-view>.
import { PROFILE_SECTIONS, PROFILE_CONTEXT } from '@/modules/perfil/profileSections.js';

    import { API_PREFIX, API_ROUTES } from '@/core/config/apiConfig';
import {
  DEFAULT_USER_PHOTO,
  invalidateUserPhoto,
  resolveUserPhotoUrl
} from '@/core/services/userPhotoService.js';

const router = useRouter();
    const route = useRoute();

const goBackFromProfileHome = () => {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back();
    return;
  }
  router.push('/home');
};

    // Obtener datos del usuario desde localStorage
    const currentUser = ref(null);
    const userPhoto = ref(DEFAULT_USER_PHOTO);
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
                userPhoto.value = await resolveUserPhotoUrl(mergedUser);
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

    onMounted(async () => {
        const userDataString = localStorage.getItem('user');
        if (userDataString) {
            try {
                currentUser.value = JSON.parse(userDataString);
                console.log('👤 Usuario cargado:', currentUser.value);

                userPhoto.value = await resolveUserPhotoUrl(currentUser.value);
                refreshCurrentUser();
                
                if (currentUser.value.cedula) {
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

const { isClient, menuOpen: vmenu, showNotify: vnotify, toggleMenu, closeMenu, toggleNotify, closeNotify, revealSidebarForNav } =
  useWorkspaceChrome();

const dossierIconMeta = resolveWorkspaceSectionIcon('Perfil');
const inicioIconMeta = resolveWorkspaceProfileMenuIcon('user', 'Inicio');
const sectionIconMeta = (section) => resolveWorkspaceProfileMenuIcon(section.icon, section.label);

// ProfileHomePanel pasa a ser ruta hija, asi que ya no puede recibir props del padre. El contexto va por
// provide/inject: es lo idiomatico para que un layout comparta datos con lo que monta el <router-view>,
// y evita colar props a todas las secciones --que no los quieren-- solo para que llegue a una.
provide(PROFILE_CONTEXT, {
  currentUser,
  photo: userPhoto,
  dossierCounts,
  goBack: goBackFromProfileHome
});

// La cabecera sale de la ruta activa, no de un string de estado.
const activeSection = computed(() => PROFILE_SECTIONS.find((s) => s.name === route.name) || null);
const profileContextTitle = computed(() => activeSection.value?.label || 'Dossier profesional');
const profileContextSubtitle = computed(() =>
  activeSection.value ? '' : 'Vista general de tu perfil académico y profesional'
);

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
    const showDossierMenu = ref(true);
    
    
    
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

            if (data?.user?.photoUrl) {
                currentUser.value.photoUrl = data.user.photoUrl;
                // La foto anterior sigue cacheada bajo la misma cedula: hay que tirarla.
                invalidateUserPhoto(currentUser.value.cedula);
                userPhoto.value = await resolveUserPhotoUrl(currentUser.value);
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

    // Aqui vivia el conmutador de pestanas: `process`/`area`, `onmenuClick` --que recorria el menu
    // comparando ETIQUETAS en espanol con tilde-- y el par openSigningWorkspace/syncViewFromRoute del
    // deep-link `?view=firmar`. Ese ultimo era doblemente muerto: apuntaba a un modulo desactivado ("en
    // migracion") y su unico emisor, openSigningWorkspace, no se llamaba desde ningun sitio. Ahora la
    // seccion la decide la URL y el router valida el destino.


      
      
    </script>
          
