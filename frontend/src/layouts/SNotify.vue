<template>
  <div class="col-lg-2 col-md-3" v-if="show">
    <div class="notify">
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
    background-color: rgba(var(--brand-accent-rgb), 0.2);
    height: 100vh;
    margin-top: 13px;
    border-radius: var(--radius-md);
    padding: 0.75rem;
}

</style>
