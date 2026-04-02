<template>
    <div 
        class="profile-admin-skin file-dropzone" 
        @dragover.prevent 
        @drop="onFileDrop"
    >

        <div class="w-full">
            <input 
                type="file" 
                id="csv_input"
                class="file-input-hidden"
                v-on:change="onFileChange" 
                name="file" 
                ref="csv_input"
                multiple
            />
            <label for="csv_input" class="inline-flex w-full cursor-pointer items-center justify-center rounded-xl bg-sky-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700">
                {{ props.files.length > 0 ? props.files.map(file => file.name).join('\n') : 'Arrastra y suelta archivos o selecciona' }}
            </label>
        </div>
    
        <div class="w-full">
            <div v-if="props.files.length > 0" class="files rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div>
                    <div v-for="(file, index) in props.files" :key="index" class="item">
                        <span v-if="!file.isRenaming">{{ file.name }}</span>
                        <input 
                            v-else 
                            type="text" 
                            v-model="file.name" 
                            @blur="stopRenaming(index)" 
                            @keyup.enter="stopRenaming(index)"
                            class="profile-text-input file-rename-input"
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
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
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
    width: 70%;
}
</style>
