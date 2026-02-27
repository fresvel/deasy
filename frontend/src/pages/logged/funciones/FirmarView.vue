<template>  

  
    <s-header :menu-open="vmenu" @onclick="onClick('Menu')">
        <div class="header-left">
            <router-link to="/" class="nav-link text-white" @click="onClick('Academia')">Academia</router-link>
            <router-link to="/auth" class="nav-link text-white">Investigación</router-link>
            <router-link to="/" class="nav-link text-white">Vinculación</router-link>
            <router-link to="/auth" class="nav-link text-white">Internacionalización</router-link>
        </div>

        <div class="header-right">
            <router-link to="/logout" class="nav-link text-white p-0 ms-lg-3">
                <img class="avatar" src="/images/logout.svg" alt="User Avatar">
            </router-link>              
            <router-link to="/firmar" class="nav-link text-white" @click="resetSigner"> 
                <img class="avatar" src="/images/pen_line.svg" alt="User Avatar">
            </router-link>
            <button class="nav-link text-white p-0" type="button" @click="onClick('Message')">
                <font-awesome-icon icon="bell" class="avatar" />
            </button>
        </div>
    
    </s-header>
    
      
      <div class="row g-3">
    
        <s-menu :show="vmenu">

            <div class="admin-menu">
                <UserProfile photo="/images/avatar.png" :username="userFullName" />
                <div class="menu-section">
                  <button
                    class="menu-section-title text-white w-100"
                    type="button"
                    :class="{ 'is-open': showFormacion }"
                    @click="showFormacion = !showFormacion"
                  >
                    Formación y Experiencia
                  </button>
                  <div v-show="showFormacion" class="menu-section-body">
                    <div class="list-group list-group-flush">
                      <button v-for="(item, index) of menu" :key="index"
                        class="list-group-item list-group-item-action"
                        :class="{ active: item.active }"
                        type="button"
                        @click="onmenuClick(item.label)">
                        {{ item.label }}
                      </button>
                    </div>
                  </div>
                </div>
            </div>
        </s-menu>
    
        <s-body
        :showmenu="vmenu"
        :shownotify="vnotify"
        >
        <FirmarPdf ref="firmarPdfRef"></FirmarPdf>

        </s-body>
        

      
        <s-message
        :show="vnotify"
        />
          
      </div>
      
      </template>
          
    <script setup>  
    
    
    import { ref, computed, onMounted} from 'vue';
    import SMenu from '@/layouts/SMenu.vue';
    import SMessage from '@/layouts/SNotify.vue';
    import SBody from '@/layouts/SBody.vue';
    import SHeader from '@/layouts/SHeader.vue';
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

    const vmenu = ref(true);
    const vnotify = ref(true);
    const selected= ref("Formación")
    const showFormacion = ref(true);
    const firmarPdfRef = ref(null);
    
    
    const toggleVmenu = () => {
        vmenu.value = !vmenu.value;
    };
      
    const toggleNotify = () => {
        vnotify.value = !vnotify.value;
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

    const resetSigner = () => {
        firmarPdfRef.value?.resetToStart?.();
    }
    
      
      
    </script>
    
