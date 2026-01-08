<template>
    <a 
    @click="onclick"
    :class="btnseraClass"
    >
    <font-awesome-icon :icon="btnseraIcon" class="icon" />
        <span class="tooltip">{{ btnseraMessage }}</span>
    </a>

</template>

<script setup>
import {defineProps, computed, defineEmits} from "vue"

const props=defineProps({
    type: {type: Number, required: true},
});


const btnseraIcon= computed(()=>{
    switch (props.type) {
        case "certified":
            return "certificate"
        case "reviewed":
            return "check-double"        
        default:
            return "check-double"
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
    position: relative; /* Necesario para posicionar el tooltip */
    margin-left: 5px;
    margin-top: 5px;
    padding: 0;
    background-color: transparent;
    border: none;
    cursor: pointer;
    font-size: 2em;
    font-weight: bold;
    transition: color 0.3s ease-in-out;
}

.sera-send{
    color: rgba(100, 83, 180, 0.85);
}
.sera-review{
    color: rgba(0, 150, 83, 0.85);
}
.sera-certified{
    color: rgba(212, 175, 55, 1);
}

.sera-denied{
    color: rgba(255, 20, 30, 0.85);
}


.tooltip {
  visibility: hidden; /* Inicialmente oculto */
  position: absolute;
  bottom: 100%; /* Lo coloca justo encima del botón */
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 150, 83, 0.85);
  color: #fff;
  padding: 5px;
  height:100%;
  font-family: Arial, sans-serif; /* Aquí defines la fuente */
  border-radius: 3px;
  font-size: 16px;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.3s;
}

.btnsera:hover .tooltip {
  visibility: visible;
  opacity: 1; /* Lo hace visible cuando el hover es activado */
}


</style>