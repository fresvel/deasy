<template>
  <nav id="hmenu" class="navbar navbar-expand-lg app-navbar navs-sticky">
    <div class="container-fluid navbar-inner">
      <div class="d-flex align-items-center gap-3 w-100 header-main">
        <button class="sidebar-toggle" type="button" @click="onClick('User')" aria-label="Abrir menú">
          <img class="menu-icon" src="/images/menu.svg" alt="Dashboard">
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
  margin-top: 0.18rem;
  border-radius: 18px;
  background:
    linear-gradient(
      120deg,
      rgba(var(--brand-primary-rgb), 0.97) 0%,
      rgba(var(--brand-primary-rgb), 0.93) 38%,
      rgba(var(--brand-accent-rgb), 0.86) 100%
    );
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.06),
    0 18px 28px rgba(var(--brand-primary-rgb), 0.22),
    inset 0 0 18px rgba(255, 255, 255, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(8px);
  position: sticky;
  top: 0.42rem;
  z-index: 20;
}

.navbar-inner {
  padding: 0.44rem 0.72rem;
}

.header-main {
  min-height: 3rem;
}

.sidebar-toggle {
  width: 2.95rem;
  height: 2.95rem;
  border-radius: 11px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.14);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--brand-white);
  box-shadow:
    0 8px 15px rgba(var(--brand-primary-rgb), 0.24),
    inset 0 0 10px rgba(255, 255, 255, 0.18);
  transition: transform 0.18s ease, background-color 0.18s ease, border-color 0.18s ease;
  padding: 0;
}

.sidebar-toggle:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.22);
  border-color: rgba(255, 255, 255, 0.16);
}

.menu-icon {
  width: 1.88rem;
  height: 1.88rem;
  object-fit: contain;
  filter: brightness(0) invert(1);
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
    border-radius: 10px;
    border: 1px solid transparent;
    transition: all 0.2s ease;
    text-decoration: none;
  }

  :deep(.header-left .nav-link:not(.p-0)),
  :deep(.header-right .nav-link:not(.p-0)) {
    padding: 0.36rem 0.62rem !important;
    color: rgba(255, 255, 255, 0.95) !important;
  }

  :deep(.header-left .nav-link:not(.p-0):hover),
  :deep(.header-right .nav-link:not(.p-0):hover) {
    background: rgba(255, 255, 255, 0.14);
    border-color: transparent;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
    color: #ffffff !important;
  }

  :deep(.header-left .nav-link.text-white-50),
  :deep(.header-right .nav-link.text-white-50) {
    color: rgba(255, 255, 255, 0.64) !important;
    background: transparent !important;
    border-color: transparent !important;
    pointer-events: none;
  }

  :deep(.header-left .nav-link.active) {
    background: rgba(255, 255, 255, 0.95);
    border-color: transparent;
    color: var(--brand-primary) !important;
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.56),
      0 8px 16px rgba(var(--brand-primary-rgb), 0.22);
  }

  :deep(.header-left .nav-link.p-0),
  :deep(.header-right .nav-link.p-0) {
    width: 2.95rem;
    height: 2.95rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.14);
    border-color: transparent;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.22);
    color: rgba(255, 255, 255, 0.96) !important;
  }

  :deep(.header-left .nav-link.p-0:hover),
  :deep(.header-right .nav-link.p-0:hover) {
    background: rgba(255, 255, 255, 0.22);
    border-color: transparent;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.34);
  }

  :deep(.header-left .nav-link.p-0 .avatar) {
    width: 2.45rem;
    height: 2.45rem;
    border-radius: 10px;
    object-fit: cover;
  }

  :deep(.header-right .nav-link .avatar),
  :deep(.header-right .nav-link svg.avatar) {
    width: 1.98rem;
    height: 1.98rem;
    object-fit: contain;
  }

  :deep(.header-right .nav-link:not(.p-0) .avatar) {
    width: 1.98rem;
    height: 1.98rem;
  }

  :deep(.header-left) {
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  :deep(.header-left::-webkit-scrollbar) {
    display: none;
  }

  @media (max-width: 991px) {
    #hmenu {
      border-radius: 14px;
      top: 0.2rem;
    }

    .navbar-inner {
      padding: 0.34rem 0.54rem;
    }

    :deep(.header-left .nav-link:not(.p-0)),
    :deep(.header-right .nav-link:not(.p-0)) {
      padding: 0.3rem 0.5rem !important;
      font-size: 0.86rem;
    }

    :deep(.header-left .nav-link.p-0),
    :deep(.header-right .nav-link.p-0) {
      width: 2.45rem;
      height: 2.45rem;
    }

    :deep(.header-right .nav-link .avatar),
    :deep(.header-right .nav-link svg.avatar) {
      width: 1.68rem;
      height: 1.68rem;
    }
  }
  
  </style>
