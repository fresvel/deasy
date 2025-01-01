<template>




<div class="ui grid">
    <div class="row">
        <div class="sixteen wide column">
        <div class="ui grid">
            <div class="row">
                <s-select
                label="Programa"
                :options="allprograms"
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

<LogrosView v-if="1==1"></LogrosView>

</template>


<script setup>
import {ref, defineProps} from 'vue'
import SSelect from '@/components/semantic/elements/SSelect.vue';
import SInput from '@/components/semantic/elements/SInput.vue';
import EasymServices from '@/services/EasymServices';

import LogrosView from './LogrosView.vue';

const props=defineProps({
    area:{
        type:String,
        required: true
    },
    perfil:{
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
        const process={code:"ac_cca_logros"} //Obtener posterior desde la base de datos
        console.log(program)
        console.log(period)
        console.log(anio.value)
        console.log(props.area)
        console.log(props.perfil)
        console.log(process.code)

        //Aquí se debe llamar al servicio para obtener los logros
}
}

</script>

<style scoped>

</style>