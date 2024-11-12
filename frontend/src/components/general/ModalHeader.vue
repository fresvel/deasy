<template>
 <i class="close icon"></i>
  <div class="header modal-header">
    <slot></slot>
  </div>

</template>

<script setup>

</script>

<style scoped lang="scss">
@import "@/scss/_variables.scss";

.modal-header {
    background-color: $col-info !important;
}
</style>