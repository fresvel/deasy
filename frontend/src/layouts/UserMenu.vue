<template>
    <div class="three  wide column  stretched" v-if="props.show">
        <div class="ui inverted vertical menu smenu fluid">
            <UserProfile photo="/images/avatar.png" :username="props.username"> </UserProfile>
            
            
            <div class="ui inverted accordion">
            <div v-for="(rol, index) in roles "  :key="index" class="large accordion">
                <div class="title">
                {{ rol.name }}
                </div>
                <div class="content">          
                <a v-for="(job, jndex) of roles[0].jobs" :key="jndex"
            
                class="right medium item labeled"
                :class="job.active ? 'item active' : ''" 
                @click="onmenuClick(job.label)">
                {{ job }}
                    <div class="ui left pointing blue label">
                        <div class="medium">{{ index }}</div>
                    </div>
                </a>
                </div>
            </div>
            </div>
            
            

        </div>
    </div>
    
    </template>
    
    <script setup>
    
    import {defineProps, /*defineEmits*/ onMounted} from "vue"
import UserProfile from "@/components/UserProfile.vue";
    
    onMounted(()=>{
        console.log("menu mounted")
        $('.ui.accordion')
            .accordion();
    })

    const props=defineProps({
    show: {
        type: Boolean,
        default: true,
      },
    username: {
        type: String,
        default: "",
    },

    roles:[{
        name: {
            type: String,
            default: "",
        },
        jobs:{
            type:[String],
            default: () => [],
        }
    }]

    })
    
    /*
    const emit=defineEmits(["onclick"])
    
    const onClick=(item)=>{
      emit("onclick", item)
    }
    
    */



    </script>
    
    <style scoped>
    
    
.smenu {
    height: 100vh;
    margin-top: 13px;
    background-color: rgba(var(--brand-primary-rgb), 0.92);
}
    
    </style>
