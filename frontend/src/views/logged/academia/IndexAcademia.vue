<template>

<div class="ui grid">
    <div class="row">
        <div class="sixteen wide column">
        <div class="ui grid">
            <div class="row">
                <s-select
                label="Programa"
                :options="programas"
                @fromselect="selProgram"
                />

                <s-input
                :modelValue="anio"
                label="Año"
                type="number"
                placeholder=""
                @update:modelValue="onanioChange"
                />

                <s-select
                label="Ciclo Académico"
                :options="periodos"
                @fromselect="selPeriod"
                />

            </div>

        </div>
    
    
        </div>
    </div>

</div>

</template>


<script setup>
import {ref} from 'vue'
import SSelect from '@/components/semantic/elements/SSelect.vue';
import SInput from '@/components/semantic/elements/SInput.vue';

const today= new Date();
const thisyear= today.getFullYear().toString();

const programas = ref(['Tecnologías de la Información', 'Programa2', 'Programa3', 'Programa4'])
const periodos= ref(['Primer Periodo', 'Segundo Periodo'])
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
    console.log("throw function")
    console.log(program)
    console.log(period)
    console.log(anio.value)
}
}

</script>

<style scoped>

</style>