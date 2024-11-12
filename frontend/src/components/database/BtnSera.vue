<template>
    <button 
    @click="removeRow(index, level)"
    class="ui small btnsera">
    <i class="check icon"></i>
    </button>

</template>

<script setup>

</script>

<style scoped>

.btnsera{
    margin-left: 5px;
    margin-top: 5px;
    padding: 0;
    background-color: transparent;
    border: none;
    cursor: pointer;
    font-size: 1.2em;
    font-weight: bold;
    color: rgba(0, 200, 83, 0.85);
    transition: color 0.3s ease-in-out;
}

</style>