<template>  

<user-header
:avatar="avatar"
@onclick="layout_service.onHeaderClick"
:areas="header"
/>

          
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

    import UserHeader from '@/components/main/UserHeader.vue'; 
    import UserMenu from '@/components/main/UserMenu.vue';
    import SMessage from '@/components/main/SNotify.vue';
    import SBody from '@/components/main/SBody.vue';
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

    
        
    </script>
    
