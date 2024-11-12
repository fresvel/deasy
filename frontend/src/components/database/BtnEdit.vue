<template>
    <button 
    @click="removeRow(index, level)"
    class="ui editar small btnedit">
    <i class="edit icon"></i>
    </button>

</template>

<script setup>

</script>

<style scoped>

.btnedit{
    margin-left: 5px;
    margin-top: 5px;
    padding: 0;
    background-color: transparent;
    border: none;
    cursor: pointer;
    font-size: 1.2em;
    font-weight: bold;
    color: rgba(34, 150, 243, 0.9)    ;
    transition: color 0.3s ease-in-out;
}

</style>