<template>
    <button 
      @click="onclick" 
      class="btnedit">
      <i class="edit icon"></i>
      <span class="tooltip">Editar Registro</span>
    </button>
  </template>
<script setup>
import { defineEmits } from 'vue';

const emit =defineEmits(["onpress"])

const onclick=()=>{
    emit("onpress")
}
</script>

<style scoped>

.btnedit {
    position: relative; /* Necesario para posicionar el tooltip */
    margin-left: 5px;
    margin-top: 5px;
    padding: 0;
    background-color: transparent;
    border: none;
    cursor: pointer;
    font-size: 2em;
    font-weight: bold;
    color: rgba(34, 150, 243, 0.9);
    transition: color 0.3s ease-in-out;
    position: relative; /* Necesario para posicionar el tooltip */
}

.tooltip {
  visibility: hidden; /* Inicialmente oculto */
  position: absolute;
  bottom: 100%; /* Lo coloca justo encima del botón */
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(34, 150, 243, 0.9);
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

.btnedit:hover .tooltip {
  visibility: visible;
  opacity: 1; /* Lo hace visible cuando el hover es activado */
}

</style>