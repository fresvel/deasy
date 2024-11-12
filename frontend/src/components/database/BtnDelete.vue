<template>
    <button 
    @click="removeRow(index, level)"
    class="ui negative small btndelete">
    <i class="remove icon"></i>
    </button>

</template>

<script setup>


</script>

<style scoped>

.btndelete{
    margin-left: 5px;
    margin-top: 5px;
    padding: 0;
    background-color: transparent;
    border: none;
    cursor: pointer;
    font-size: 1.2em;
    font-weight: bold;
    color: #FF5722;
    transition: color 0.3s ease-in-out;
}

</style>