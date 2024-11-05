<template>
      <div class="two wide column stretched" v-if="show" >
        <div class="ui segment notify">
          This is an stretched grid column. This segment will always match the tab height
        </div>
      </div>

</template>

<script setup>
import {defineProps} from "vue"


defineProps({
    show: {
      type: Boolean,
      default: true,
    }
})

</script>

<style scoped>

.notify{
    background-color: rgb(74, 140, 255, 0.5);
    height: 100vh;
    margin-top: 13px;
}

</style>