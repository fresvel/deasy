<template>
 <button type="button" class="btn-close" aria-label="Close"></button>
  <div class="header modal-header">
    <slot></slot>
  </div>

</template>

<script setup>

</script>

<style scoped lang="scss">
.modal-header {
    background-color: var(--brand-info-soft) !important;
}
</style>
