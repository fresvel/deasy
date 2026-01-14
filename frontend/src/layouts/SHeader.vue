<template>
  <nav id="hmenu" class="navbar navbar-expand-lg">
    <div class="container-fluid">
      <div class="d-flex align-items-center gap-3 w-100">
        <button class="btn btn-link text-white p-0" type="button" @click="onClick('User')">
          <img class="menulogo avatar" src="/images/menu.svg" alt="User Avatar">
        </button>
        <div class="header-actions">
          <slot></slot>
        </div>
      </div>
    </div>
  </nav>
</template>
  
  <script setup>
  import {defineProps, defineEmits} from "vue"
  
  defineProps({
    menu: [
      {
        label:{
          type: String,
        },
        path:{
          type: String,
        },
        func:{
          type: Function,
        }
      }
  ]
    
  })
  
  const emit=defineEmits(["onclick"])
  
  const onClick=(item)=>{
    emit("onclick", item)
  }
  
  
  </script>
  
  <style scoped lang="scss">
  
#hmenu {
  background: var(--brand-gradient);
}
  
  .menulogo{
    border-radius: 10px;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    justify-content: space-between;
    flex-wrap: nowrap;
    min-width: 0;
  }

  .header-left,
  .header-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: nowrap;
  }

  .header-right {
    margin-left: auto;
    flex-shrink: 0;
  }

  :deep(.header-left),
  :deep(.header-right) {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: nowrap;
  }

  :deep(.header-left .nav-link),
  :deep(.header-right .nav-link) {
    white-space: nowrap;
  }
  
  </style>
