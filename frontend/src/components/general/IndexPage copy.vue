<template>  
  <div class="ui grid" id="navbar">
      <div class="sixteen wide column">
        <div class="ui inverted segment" id="hmenu">
            <div class="ui inverted secondary menu">
                <a class="active item" @click="toggleVmenu">
                Menu
                </a>
                <a class="item" @click="toggleNotify">
                Notify
                </a>
                <a class="item">
                Friends
                </a>
            </div>
        </div>
      </div>
  </div>
  
  
  <div class="ui grid">
      <div class="three  wide column  mainmenu" v-show="vmenu">
        <div class="ui inverted vertical menu fluid" id="mainmenu" >
          <a class="item">
            Bio
          </a>
          <a class="item">
            Pics
          </a>
          <a class="item active">
            Companies
          </a>
          <a class="item active">
            Links
          </a>
        </div>
      </div>
    
      <div :class="contentClass">
          <div class="ui segment">
            <LogrosCordinador></LogrosCordinador>
          </div>
      </div>
    
      <div class="two wide stretched column" v-if="vnotify" >
        <div class="ui segment notify">
          This is an stretched grid column. This segment will always match the tab height
        </div>
      </div>
      
  </div>
  
  </template>
      
<script setup>  
  import LogrosCordinador from '../informes/LogrosCordinador.vue';
  import { ref, computed } from 'vue';
  
  const vmenu = ref(true);
  const vnotify = ref(true);

  
  const toggleVmenu = () => {
        vmenu.value = !vmenu.value;
  };
  
  const toggleNotify = () => {
    vnotify.value = !vnotify.value;
    };

const contentClass= computed(()=>{
    if (vmenu.value&&vnotify.value) {
        return "eleven wide stretched column"
    }else if (!vmenu.value&&!vnotify.value) {
        return "sixteen wide stretched column"
    }else if (vmenu.value&&!vnotify.value) {
        return "thirteen wide stretched column"
    }else{
        return "fourteen wide stretched column"
    }
})
</script>
      
<style scoped>
#navbar {
      margin-bottom: -45px;
  }
  
  #mainmenu {
      height: 100vh;
      margin-top: 10px;
      background-color:rgb(0, 0, 15, 0.85);
  }
  
  .mainmenu {
      margin-top: 13px;
      background-color:rgb(0, 0, 15, 0.85);
  }
  
  #vmenu {
      display: block;
  }
  
  #vnotify {
      display: none;
  }
  .notify{
      background-color: rgb(74, 140, 255, 0.5);
      ;
  }
  
  #hmenu{
      background-color:rgb(0, 10, 50, 0.9);
  
  
  }
  
  #content {
      height: 100%;
  }
  
  
  #app{
      height: 100vh;
  }
  </style>
      