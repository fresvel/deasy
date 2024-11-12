<template>
<div class="four wide column">
    <div class="ui card">
        <div class="image">
            <img :src="photo" alt="User Avatar" >
        </div>
        <div class="content">
            <div class="header">
                {{ username }}
            </div>
        </div>
    </div>
</div>
</template>

<script setup>

import { defineProps } from 'vue';

defineProps({
    photo:{type:String},
    username:{type:String}
})

</script>

<style scoped>

.userphoto{
    border-radius: 109px;
}

</style>