<template>
  <AppButton
    variant="secondary"
    size="sm"
    :title="props.message"
    :aria-label="props.message"
    icon-only
    class-name="text-danger hope-action-btn hope-action-delete"
    @click="onclick"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" aria-hidden="true" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.325 9.468s-.543 6.735-.858 9.572c-.15 1.355-.987 2.15-2.358 2.174-2.61.047-5.221.05-7.83-.005-1.318-.027-2.141-.83-2.288-2.162-.317-2.862-.857-9.579-.857-9.579M20.708 6.24H3.75m13.69 0a1.65 1.65 0 0 1-1.614-1.324L15.583 3.7a1.28 1.28 0 0 0-1.237-.95h-4.233a1.28 1.28 0 0 0-1.237.95l-.243 1.216A1.65 1.65 0 0 1 7.018 6.24"/></svg>
  </AppButton>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';
import AppButton from '@/shared/components/ui/AppButton.vue';

const props = defineProps({
  message:{
    type: String,
    default: "Eliminar",
  }
})
const emit =defineEmits(["onpress"])

const onclick=()=>{
    emit("onpress")
}


</script>
