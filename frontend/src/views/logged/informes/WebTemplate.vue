<template>
    <div class="ui grid">
        <div class="sixteen wide column">
            <s-file 
                :files="csv_files" 
                @addFiles="updateFiles"
                @removeFiles="deleteFiles"
                @editFiles="editFiles"
            />
        </div>
        <div class="row">
            <div class="eight wide column">
            <s-input 
            label="Nombre"
            v-model="name"
            placeholder="Nombre del Template"
            />

            </div>
            <div class="eight wide column middle aligned right aligned ">
                <button class="ui blue button large" @click="createTemplate">Crear Template</button>
            </div>
        </div>

    </div>
</template>

<script setup>
import { ref } from 'vue'
import SFile from '@/components/semantic/elements/SFile.vue'
import SInput from '@/components/semantic/elements/SInput.vue'
//import axios from 'axios'
import TemplateService from '@/services/TemplateService.js'
const template_service = new TemplateService()

const csv_files = ref([])
const name=ref('')

// Función que recibe los archivos desde el hijo y actualiza el estado en el padre
const updateFiles = (newFiles) => {
    //console.log(newFiles)
    csv_files.value = [
        ...csv_files.value,
        ...Array.from(newFiles).map(file => ({ content:file, isRenaming: false, name:file.name }))
    ]
    console.log(csv_files.value)
}

const deleteFiles = (index) => {
    csv_files.value.splice(index, 1)

}

const editFiles = (index, start) => {
    csv_files.value[index].isRenaming = start
}

// Función para crear el template (como en el ejemplo anterior)
const createTemplate = async () => {

    const files = csv_files.value.map(file =>file.content)
    console.log(files)
    template_service.createTemplate(files, name.value)
}
</script>
