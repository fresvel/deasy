<template>
  <AdminButton
    variant="secondary"
    size="sm"
    :title="props.tooltip"
    :aria-label="props.tooltip"
    icon-only
    class-name="text-primary hope-action-btn hope-action-edit"
    @click="onclick"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" aria-hidden="true" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11.493 2.79h-3.74c-3.075 0-5.003 2.176-5.003 5.258v8.314c0 3.082 1.92 5.26 5.003 5.26h8.825c3.085 0 5.003-2.178 5.003-5.26v-4.028"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m8.828 10.921 7.473-7.473c.931-.93 2.44-.93 3.371 0l1.217 1.217a2.383 2.383 0 0 1 0 3.371l-7.509 7.509a2.17 2.17 0 0 1-1.535.636H8.1l.094-3.78a2.17 2.17 0 0 1 .635-1.48" clip-rule="evenodd"/><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="m15.166 4.603 4.566 4.566"/></svg>
  </AdminButton>
</template>
<script setup>
import { defineProps, defineEmits } from 'vue';
import AdminButton from '@/views/admin/components/AdminButton.vue';

const props = defineProps({
  tooltip:{
    type: String,
    default: 'Editar'
  }
})
const emit =defineEmits(["onpress"])


const onclick=()=>{
    emit("onpress")
}
</script>
