<template>
  <div v-if="show" class="profile-admin-skin w-full md:w-1/3 xl:w-1/5">
    <div class="nav-menu deasy-nav-shell">
      <div class="nav-menu-header">
        <h5 class="deasy-nav-meta mb-3 text-lg font-semibold">Navegación rápida</h5>
      </div>
      <div class="nav-menu-body deasy-nav-group">
        <router-link 
          to="/dashboard" 
          class="nav-menu-item deasy-nav-item"
          @click="$emit('close')"
        >
          <font-awesome-icon icon="home" />
          <span>Dashboard</span>
        </router-link>
        <router-link 
          to="/perfil" 
          class="nav-menu-item deasy-nav-item"
          @click="$emit('close')"
        >
          <font-awesome-icon icon="user" />
          <span>Perfil</span>
        </router-link>
        <router-link 
          to="/roles" 
          class="nav-menu-item deasy-nav-item"
          @click="$emit('close')"
        >
          <font-awesome-icon icon="id-card" />
          <span>Roles</span>
        </router-link>
        <router-link
          :to="{ path: '/dashboard', query: { view: 'firmar' } }"
          class="nav-menu-item deasy-nav-item"
          @click="$emit('close')"
        >
          <font-awesome-icon icon="edit" />
          <span>Firmar documentos</span>
        </router-link>
        <router-link 
          to="/admin" 
          v-if="isAdmin"
          class="nav-menu-item deasy-nav-item"
          @click="$emit('close')"
        >
          <font-awesome-icon icon="cog" />
          <span>Administración</span>
        </router-link>
        <router-link 
          to="/logout" 
          class="nav-menu-item nav-menu-item-logout deasy-nav-item"
          @click="$emit('close')"
        >
          <font-awesome-icon icon="sign-in-alt" />
          <span>Cerrar sesión</span>
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from "vue"

defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  }
})

defineEmits(['close'])
</script>

<style scoped>
.nav-menu {
  background-color: rgba(var(--brand-accent-rgb), 0.2);
  height: 100vh;
  margin-top: 13px;
  border-radius: var(--radius-md);
  padding: 0.75rem;
}

.nav-menu-header h5 {
  color: var(--brand-primary);
  font-weight: 600;
  margin-bottom: 1rem;
}

.nav-menu-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.nav-menu-item {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  color: var(--brand-primary);
  text-decoration: none;
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
  font-weight: 500;
}

.nav-menu-item:hover {
  background-color: rgba(var(--brand-primary-rgb), 0.1);
  color: var(--brand-primary);
  transform: translateX(4px);
}

.nav-menu-item.router-link-active {
  background-color: rgba(var(--brand-primary-rgb), 0.2);
  color: var(--brand-primary);
  font-weight: 600;
}

.nav-menu-item svg {
  width: 1.2rem;
  height: 1.2rem;
}

.nav-menu-item-logout {
  margin-top: auto;
  border-top: 1px solid rgba(var(--brand-primary-rgb), 0.2);
  padding-top: 1rem;
  margin-top: 1rem;
}

.nav-menu-item-logout:hover {
  background-color: rgba(220, 53, 69, 0.1);
  color: #dc3545;
}
</style>
