<template>
    <a 
    @click="onclick"
    :class="btnseraClass"
    >
    <component :is="btnseraIcon" class="icon" />
        <span class="tooltip">{{ btnseraMessage }}</span>
    </a>

</template>

<script setup>
import {defineProps, computed, defineEmits} from "vue"
import { IconAward, IconCircleCheck, IconCircleX } from '@tabler/icons-vue'

const props=defineProps({
    type: {type: [String, Number], required: true},
});


const btnseraIcon= computed(()=>{
    switch (props.type) {
        case "certified":
            return IconAward
        case "denied":
            return IconCircleX
        case "reviewed":
            return IconCircleCheck        
        default:
            return IconCircleCheck
    }
})

const btnseraMessage= computed(()=>{
    switch (props.type) {
        case "certified":
            return "Certificado"
        case "reviewed":
            return "Solicitar Aprobación"
        case "denied":
            return "Denegado"
        default:
            return "Solicitar Revisión"        
    }
})

const btnseraClass= computed(()=>{
    switch (props.type) {
        case "certified":
            return "btnsera sera-certified"
        case "reviewed":
            return "btnsera sera-review"
        case "denied":
            return "btnsera sera-denied"
        default:
            return "btnsera sera-send"
    }
})


const emit =defineEmits(["onpress"])

const onclick=()=>{
    emit("onpress")
}



</script>

<style scoped>

.btnsera{
    position: relative;
    margin-left: 5px;
    margin-top: 5px;
    padding: 0;
    background-color: transparent;
    border: none;
    cursor: pointer;
    transition: color 0.3s ease-in-out;
    --tooltip-bg: var(--brand-accent);
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.icon {
    width: 1.25em;
    height: 1.25em;
}

.sera-send{
    color: var(--brand-accent);
    --tooltip-bg: var(--brand-accent);
}
.sera-review{
    color: var(--state-success);
    --tooltip-bg: var(--state-success);
}
.sera-certified{
    color: var(--state-gold);
    --tooltip-bg: var(--state-gold);
}

.sera-denied{
    color: var(--state-danger);
    --tooltip-bg: var(--state-danger);
}


.tooltip {
  visibility: hidden; /* Inicialmente oculto */
  position: absolute;
  top: 50%;
  left: calc(100% + 8px);
  transform: translateY(-50%);
  background-color: var(--tooltip-bg);
  color: var(--brand-white);
  padding: 0.35rem 0.5rem;
  font-family: var(--font-base);
  border-radius: 6px;
  font-size: 0.8rem;
  line-height: 1.2;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
  z-index: 25;
}

.btnsera:hover .tooltip {
  visibility: visible;
  opacity: 1; /* Lo hace visible cuando el hover es activado */
}


</style>
