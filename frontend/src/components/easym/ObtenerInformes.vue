<template>

<div class="ui right aligned grid">
  
  <div class="center aligned column row">
    
    
        <s-select
            label="Ciclo Académico"
            :options="periodos"
            @fromselect="selPeriod"
            wide="five"
        />
    
        <s-input
            :modelValue="anio"
            label="Año"
            type="number"
            placeholder=""
            @update:modelValue="onanioChange"
            wide="six"
        />
        <s-select
            class="column"
            label="Programa"
            :options="allprograms"
            @fromselect="selProgram"
            wide="five"
        />
    
  </div>
  

</div>





</template>


<script setup>
import {ref, defineProps} from 'vue'
import SSelect from '@/components/semantic/elements/SSelect.vue';
import SInput from '@/components/semantic/elements/SInput.vue';
import EasymServices from '@/services/EasymServices';


const props=defineProps({
    process:{
        type:String,
        required: true
    },
    url:{
        type:String,
        required: true
    }
})

const service = new EasymServices();
service.getEasymPrograms()

const allprograms=service.getEasymdata().programs;

const today= new Date();
const thisyear= today.getFullYear().toString();

const periodos= ref([{name:'Primer Periodo', value:'01'}, {name:'Segundo Periodo', value:'02'}])
const anio= ref(thisyear);


let program=""
let period=""

const selPeriod =(value)=>{
    period=value
    onparamsChange()
}

const selProgram=(value)=>{
    program=value
    onparamsChange()
}

const onanioChange=(value)=>{
    anio.value=value
    onparamsChange()
}

const onparamsChange=()=>{
    if(program!=""&&period!=""){
        console.log(program)
        console.log(period)
        console.log(anio.value)
        console.log(props.process)
        

        //Aquí se debe llamar al servicio para obtener los logros
}
}

</script>

<style scoped>

</style>