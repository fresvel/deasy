<template>  

  
    <s-header @onclick="onClick('Menu')">
        <router-link to="/" class="item active large" @click="onClick('Academia')">Academia</router-link>
        <router-link to="/auth" class="item large">Investigación</router-link>
        <router-link to="/" class="item  large" >Vinculación</router-link>
        <router-link to="/auth" class="item large left aligned">Internacionalización</router-link>
        <router-link to="/logout" class="item  large right aligned">
            <img class="avatar" src="/images/logout.svg" alt="User Avatar">
        </router-link>              
        <router-link to="/firmar" class="item large"> 
            <img class="avatar" src="/images/pen_line.svg" alt="User Avatar">
        </router-link>
        <a class="item large" @click="onClick('Message')">
            <img class="avatar" src="/images/message.svg" alt="User Avatar">
        </a>
    
    </s-header>
    
      
      <div class="ui grid">
    
        <s-menu :show="vmenu">

            <UserProfile photo="/images/avatar.png" :username="userFullName"> </UserProfile>
            <a class="item large"> Formación y Experiencia</a>
            <a v-for="(item, index) of menu" :key="index" 
                :class="item.active ? 'item active' : 'item'" 
                @click="onmenuClick(item.label)">{{ item.label }}
            </a>
        </s-menu>
    
        <s-body
        :showmenu="vmenu"
        :shownotify="vnotify"
        >
        <FirmarPdf></FirmarPdf>

        </s-body>
        

      
        <s-message
        :show="vnotify"
        />
          
      </div>
      
      </template>
          
    <script setup>  
    
    
    import { ref, computed, onMounted} from 'vue';
    import SMenu from '@/components/main/SMenu.vue';
    import SMessage from '@/components/main/SNotify.vue';
    import SBody from '@/components/main/SBody.vue';
    import SHeader from '@/components/main/SHeader.vue';
    import UserProfile from '@/components/general/UserProfile.vue';
    import FirmarPdf from './FirmarPdf.vue';

    // Obtener datos del usuario desde localStorage
    const currentUser = ref(null);
    const userFullName = computed(() => {
        if (currentUser.value) {
            return `${currentUser.value.nombre} ${currentUser.value.apellido}`;
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
    
      
      
    </script>
          
    <style scoped>
    
    
    
      
      
    
    </style>
          