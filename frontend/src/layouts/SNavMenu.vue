<template>
  <div v-if="show" class="profile-admin-skin w-full md:w-1/3 xl:w-1/5">
    <div class="deasy-nav-shell min-h-[calc(100vh-5.5rem)]">
      <div class="px-3 pt-2">
        <h5 class="m-0 text-lg font-semibold text-white">Navegación rápida</h5>
      </div>
      <div class="deasy-nav-group flex-1">
        <router-link 
          to="/dashboard" 
          class="deasy-nav-item"
          @click="$emit('close')"
        >
          <font-awesome-icon icon="home" />
          <span>Dashboard</span>
        </router-link>
        <router-link 
          to="/perfil" 
          class="deasy-nav-item"
          @click="$emit('close')"
        >
          <font-awesome-icon icon="user" />
          <span>Perfil</span>
        </router-link>
        <router-link 
          to="/roles" 
          class="deasy-nav-item"
          @click="$emit('close')"
        >
          <font-awesome-icon icon="id-card" />
          <span>Roles</span>
        </router-link>
        <router-link
          :to="{ path: '/dashboard', query: { view: 'firmar' } }"
          class="deasy-nav-item"
          @click="$emit('close')"
        >
          <font-awesome-icon icon="edit" />
          <span>Firmar documentos</span>
        </router-link>
        <router-link 
          to="/admin" 
          v-if="isAdmin"
          class="deasy-nav-item"
          @click="$emit('close')"
        >
          <font-awesome-icon icon="cog" />
          <span>Administración</span>
        </router-link>
        <router-link 
          to="/logout" 
          class="deasy-nav-item mt-auto border-t border-white/10 pt-4 text-red-100 hover:bg-red-500/10 hover:text-red-100"
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
