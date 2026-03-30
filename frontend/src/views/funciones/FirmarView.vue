<template>  
  <div class="min-h-[100vh] bg-slate-100 font-sans flex flex-col">
    <s-header :menu-open="vmenu" @onclick="onClick('Menu')">
        <div class="flex items-center gap-3 overflow-hidden flex-1">
            <!-- Opciones nativas de areas deprecadas -->
        </div>

        <div class="flex items-center gap-1 sm:gap-2 shrink-0">
            <router-link to="/roles" class="flex shrink-0 items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-white/10 !text-white/90 hover:bg-white/20 hover:!text-white transition-all border border-white/10 shadow-sm focus:outline-none focus:ring-2 focus:ring-white/30 sm:ms-3" title="Roles">
                <IconUsers class="w-4 h-4 sm:w-5 sm:h-5" />
            </router-link>

            <button class="flex shrink-0 items-center justify-center w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-white/10 !text-white/90 hover:bg-white/20 hover:!text-white transition-all border border-white/10 shadow-sm focus:outline-none focus:ring-2 focus:ring-white/30" type="button" @click="onClick('Message')" title="Notificaciones">
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
                <UserProfile photo="/images/avatar.png" :username="userFullName" />
                <div class="flex flex-col gap-1">
                  <button
                    class="flex items-center justify-between w-full px-3 py-2 text-sm font-semibold text-white/90 hover:text-white transition-colors"
                    type="button"
                    @click="showFormacion = !showFormacion"
                  >
                    <span>Formación y Experiencia</span>
                    <IconChevronDown class="w-4 h-4 transition-transform duration-200" :class="{ 'rotate-180': showFormacion }" />
                  </button>
                  <div v-show="showFormacion" class="flex flex-col gap-1 mt-1 pl-2">
                      <button v-for="(item, index) of menu" :key="index"
                        class="px-4 py-2.5 text-sm font-medium rounded-xl text-left transition-all duration-200"
                        :class="[item.active ? 'bg-white text-sky-800 shadow-sm border-none' : 'text-white/80 hover:bg-white/10 hover:text-white']"
                        type="button"
                        @click="onmenuClick(item.label)">
                        {{ item.label }}
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
            <div class="p-6">
                <FirmarPdf ref="firmarPdfRef"></FirmarPdf>
            </div>
        </s-body>
        
        <s-message :show="vnotify" />
        
        <s-nav-menu :show="showNavMenu" :is-admin="false" @close="showNavMenu = false" />
    </div>
  </div>
</template>
          
<script setup>  
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';

const isClient = typeof window !== 'undefined';
import { IconUsers, IconBell, IconHome, IconLogout, IconChevronDown } from '@tabler/icons-vue';
import SMenu from '@/layouts/SMenu.vue';
    import SMessage from '@/layouts/SNotify.vue';
    import SBody from '@/layouts/SBody.vue';
    import SHeader from '@/layouts/SHeader.vue';
    import SNavMenu from '@/layouts/SNavMenu.vue';
    import UserProfile from '@/components/UserProfile.vue';
    import FirmarPdf from './FirmarPdf.vue';

    // Obtener datos del usuario desde localStorage
    const currentUser = ref(null);
    const userFullName = computed(() => {
        if (currentUser.value) {
            const firstName = currentUser.value.first_name ?? '';
            const lastName = currentUser.value.last_name ?? '';
            return `${firstName} ${lastName}`.trim() || 'Usuario';
        }
        return 'Usuario';
    });

    // Cargar datos del usuario
    onMounted(() => {
        const userDataString = localStorage.getItem('user');
        if (userDataString) {
            try {
                currentUser.value = JSON.parse(userDataString);
                console.log('👤 Usuario cargado en FirmarView:', currentUser.value);
            } catch (error) {
                console.error('Error al cargar datos del usuario:', error);
            }
        }
    });

    const vmenu = ref(isClient ? window.innerWidth >= 1280 : true);

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
    });

    onBeforeUnmount(() => {
        if (isClient) {
            window.removeEventListener('resize', handleResize);
        }
    });

    const vnotify = ref(false);
    const showNavMenu = ref(false);
    const selected= ref("Formación")
    const showFormacion = ref(true);
    const firmarPdfRef = ref(null);
    
    
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
    
