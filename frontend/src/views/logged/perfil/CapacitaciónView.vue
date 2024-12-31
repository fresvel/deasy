<template>

<div class="ui grid flex center aligned middle segment">
              <div class="grid ui container" style="margin-bottom: 2%;">
                <div class="fourteen wide column center">
                    <h2 class="ui  header   left aligned">Formación Continua y Conferencias</h2>
                </div>
                <div class="two wide column">
                    <button class="ui blue button large two wide column" @click="openModal()">Agregar</button>
                </div>
                
                
                <div class="grid ui container">
                    <div class="ten wide column">
                        <h3 class="ui  header   left aligned">Capacitación en Área de la Docencia</h3>
                    </div>
                    <table class="ui compact celled definition table">
                        <thead>
                        <tr>
                            <th></th>
                            <th class="text-left">
                                TEMA
                            </th>
                            <th class="text-left">
                                INSTITUCIÓN
                            </th>
                            <th class="text-left">
                                HORAS
                            </th>
                            <th class="text-left">
                                FECHA INICIAL
                            </th>
                            <th class="text-left">
                                FECHA FINAL
                            </th>
                            <th class="text-left">
                                TIPO
                            </th>
                            <th class="text-left">
                                ACCIÓN
                            </th>
                        </tr>
                        </thead>
                        <tbody>
                        <tr>
                            <td><BtnSera type="certified" @onpress="clickBtnsera"/></td>
                            <td>Ingeniero en Electrónica y Comunicaciones</td>
                            <td>Universidad Técnica de Ambato</td>
                            <td>40</td>
                            <td>23-07-2024</td>
                            <td>23-07-2024</td>
                            <td>Participacción</td>
                            <td>
                                <BtnDelete @onpress="clickBtndelete"/>
                                <BtnEdit @onpress="clickBtnedit"/>
                            </td>
                        </tr>
                        </tbody>
                    </table>
                </div>


                <div class="grid ui container">
                    <div class="ten wide column">
                        <h3 class="ui  header   left aligned">Capacitación en Profesional</h3>
                    </div>
                    <table class="ui compact celled definition table">
                        <thead>
                        <tr>
                            <th></th>
                            <th class="text-left">
                                TEMA
                            </th>
                            <th class="text-left">
                                INSTITUCIÓN
                            </th>
                            <th class="text-left">
                                HORAS
                            </th>
                            <th class="text-left">
                                FECHA INICIAL
                            </th>
                            <th class="text-left">
                                FECHA FINAL
                            </th>
                            <th class="text-left">
                                TIPO
                            </th>
                            <th class="text-left">
                                ACCIÓN
                            </th>
                        </tr>
                        </thead>
                        <tbody>
                        <tr>
                            <td><BtnSera type="certified" @onpress="clickBtnsera"/></td>
                            <td>Ingeniero en Electrónica y Comunicaciones</td>
                            <td>Universidad Técnica de Ambato</td>
                            <td>40</td>
                            <td>23-07-2024</td>
                            <td>23-07-2024</td>
                            <td>Participacción</td>
                            <td>
                                <BtnDelete @onpress="clickBtndelete"/>
                                <BtnEdit @onpress="clickBtnedit"/>
                            </td>
                        </tr>
                        </tbody>
                    </table>
                </div>
                  
              </div>    
</div>


<!-- Sección de Modales-->
<div class="ui longer modal" style="width: 75%;" ref="modal">
  <AgregarCapacitacion/>
</div>
</template>

<script setup>
import {ref, onMounted} from "vue"
import AgregarCapacitacion from "./AgregarCapacitacion.vue";
import BtnDelete from "@/components/database/BtnDelete.vue";
import BtnEdit from "@/components/database/BtnEdit.vue";
import BtnSera from "@/components/database/BtnSera.vue";
const modal = ref(null);

const openModal = () => {
    $(modal.value).modal('show');
};

// Inicializa el modal al montar el componente
onMounted(() => {
    if (modal.value) {
        $(modal.value).modal();
    }
});


</script>

<style scoped lang="scss">
  .editar{
    background-color:$col-edit;
    color: white;
    margin: 1%;
  }

</style>