<template>  

<s-header @onclick="handleHeaderClick">
  <div class="header-left">
    <button
      v-if="avatar.enable"
      class="nav-link text-white p-0"
      type="button"
      @click="layout_service.onHeaderClick('perfil')"
    >
      <img class="avatar" :src="avatar.src" alt="User Avatar">
    </button>

    <router-link
      v-for="(area, index) in header"
      :key="index"
      class="nav-link text-white px-2"
      :to="`/${area.route}`"
      :class="{ active: area.active === true }"
      @click="layout_service.onHeaderClick(area.name)"
    >
      {{ area.name }}
    </router-link>
  </div>

  <div class="header-right">
    <router-link to="/logout" class="nav-link text-white p-0 ms-lg-3">
      <img class="avatar" src="/images/logout.svg" alt="User Avatar">
    </router-link>
    <button class="nav-link text-white p-0" type="button" @click="layout_service.onHeaderClick('signer')">
      <img class="avatar" src="/images/pen_line.svg" alt="User Avatar">
    </button>
    <button class="nav-link text-white p-0" type="button" @click="layout_service.onHeaderClick('message')">
      <font-awesome-icon icon="bell" class="avatar" />
    </button>
  </div>
</s-header>

          
<div class="row g-3">

<user-menu 
:show="show_menu"
:username="menu.username"
:roles="menu.roles"
/>

<s-body
:showmenu="show_menu"
:shownotify="show_message"
>


</s-body>



<s-message
:show="show_message"
/>
    
</div>
      
</template>
          
<script setup>  

    import SHeader from '@/layouts/SHeader.vue';
    import UserMenu from '@/layouts/UserMenu.vue';
    import SMessage from '@/layouts/SNotify.vue';
    import SBody from '@/layouts/SBody.vue';
    import LayoutService from '@/services/layout/LayoutService.js';

    const layout_service = new LayoutService();
    layout_service.getAvatar()
    layout_service.getHeader()
    layout_service.getMenu()

    const avatar = layout_service.getLayoutData().avatar;
    const header = layout_service.getLayoutData().header;
    const menu = layout_service.getLayoutData().menu;
    const show_menu = layout_service.getLayoutData().show_menu;
    const show_message = layout_service.getLayoutData().show_message;

    const handleHeaderClick = (target) => {
        if (target === 'User') {
            layout_service.onHeaderClick('menu');
            return;
        }
        layout_service.onHeaderClick(target);
    };

    
        
    </script>
    
