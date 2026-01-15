<template>
    <div 
        class="row g-3 file-dropzone" 
        @dragover.prevent 
        @drop="onFileDrop"
    >

        <div class="col-12">
            <input 
                type="file" 
                id="csv_input"
                class="file-input-hidden"
                v-on:change="onFileChange" 
                name="file" 
                ref="csv_input"
                multiple
            />
            <label for="csv_input" class="btn btn-primary w-100">
                {{ props.files.length > 0 ? props.files.map(file => file.name).join('\n') : 'Arrastra y suelta archivos o selecciona' }}
            </label>
        </div>
    
        <div class="col-12">
            <div v-if="props.files.length > 0" class="files card">
                <div class="card-body">
                    <div v-for="(file, index) in props.files" :key="index" class="item">
                        <span v-if="!file.isRenaming">{{ file.name }}</span>
                        <input 
                            v-else 
                            type="text" 
                            v-model="file.name" 
                            @blur="stopRenaming(index)" 
                            @keyup.enter="stopRenaming(index)"
                            class="form-control file-rename-input"
                        />
                        <BtnDelete
                        @click="removeFile(index)"
                        />
                        <BtnEdit 
                        @click="startRenaming(index)" v-if="!file.isRenaming"
                        />
                    </div>
                </div>
            </div>
        </div>
</div>  



</template>

<script setup>
import { defineProps, defineEmits } from 'vue'
import BtnDelete from '@/components/BtnDelete.vue'
import BtnEdit from '@/components/BtnEdit.vue'


const props = defineProps({
    files : {
        type: Array,
        required: true
    }
})

const emit = defineEmits(['addFiles', 'removeFiles', 'editFiles'])

const onFileChange = (event) => {
    const files = event.target.files
    emit('addFiles', files)
}


const onFileDrop = (event) => {
    event.preventDefault()
    const files = event.dataTransfer.files
    emit('addFiles', files)

}


const removeFile = (index) => {
    emit('removeFiles', index)
}

const startRenaming = (index) => {
    emit('editFiles', index, true)
}

const stopRenaming = (index) => {
    emit('editFiles', index, false)
}
</script>

<style scoped>
.file-dropzone {
    border: 2px dashed var(--brand-accent);
    padding: 20px;
    cursor: pointer;
    border-radius: var(--radius-md);
    background: var(--brand-surface-alt);
    box-shadow: var(--brand-shadow-soft);
}

.file-input-hidden {
    display: none;
}

.file-rename-input {
    max-width: 300px;
    margin-right: 10px;
}

/* Estilos opcionales para la lista de archivos cargados */
.files .item {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
}

.files .item span {
    flex-grow: 1;
}

.files .item button {
    margin-left: 10px;
}
.files .item input {
    border-radius: 10px;
    padding: 7px;
    width: 70%;
}
</style>
