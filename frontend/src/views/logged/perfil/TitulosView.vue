<template>

<div class="ui grid flex center aligned middle segment">        
              
              <div class="grid ui container" style="margin-bottom: 2%;">
                <div class="fourteen wide column center">
                    <h2 class="ui  header   left aligned">Formación Profesional </h2>
                </div>
                <div class="two wide column">
                    <button class="ui blue button large two wide column" @click="openModal()">Agregar</button>
                </div>
                
                
                <div class="grid ui container">
                    <div class="ten wide column">
                        <h3 class="ui  header   left aligned">Títulos Técnicos y Tecnológicos</h3>
                    </div>
                    <table class="ui compact celled definition table">
                        <thead>
                        <tr>
                            <th></th>
                            <th class="text-left">
                            TÍTULO
                            </th>
                            <th class="text-left">
                            INSTITUCIÓN
                            </th>
                            <th class="text-left">
                            TIPO
                            </th>
                            <th class="text-left">
                            N.° DE REGISTRO SENESCYT
                            </th>
                            <th class="text-left">
                            CAMPO
                            </th>
                            <th class="text-left">
                            PAÍS
                            </th>
                            <th class="text-left">
                            ACCIÓN
                            </th>
                        </tr>
                        </thead>
                        <tbody>
                        <tr>
                            <td><BtnSera type="reviewed" @onpress="clickBtnsera"/></td>
                            <td>Ingeniero en Electrónica y Comunicaciones</td>
                            <td>Universidad Técnica de Ambato</td>
                            <td>Presencial</td>
                            <td>1011-2023-2327683</td>
                            <td>Tecnologías de la Información y COmunicación</td>
                            <td>Ecuador</td>
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
                        <h3 class="ui  header   left aligned">Títulos de Grado</h3>
                    </div>
                    <table class="ui compact celled definition table">
                        <thead>
                        <tr>
                            <th></th>
                            <th class="text-left">
                            TÍTULO
                            </th>
                            <th class="text-left">
                            INSTITUCIÓN
                            </th>
                            <th class="text-left">
                            TIPO
                            </th>
                            <th class="text-left">
                            N.° DE REGISTRO SENESCYT
                            </th>
                            <th class="text-left">
                            CAMPO
                            </th>
                            <th class="text-left">
                            PAÍS
                            </th>
                            <th class="text-left">
                            ACCIÓN
                            </th>
                        </tr>
                        </thead>
                        <tbody>
                        <tr>
                            <td><BtnSera type="denied" @onpress="clickBtnsera"/></td>
                            <td>Ingeniero en Electrónica y Comunicaciones</td>
                            <td>Universidad Técnica de Ambato</td>
                            <td>Presencial</td>
                            <td>1011-2023-2327683</td>
                            <td>Tecnologías de la Información y COmunicación</td>
                            <td>Ecuador</td>

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
                        <h3 class="ui  header   left aligned">Títulos de Cuarto Nivel</h3>
                    </div>
                    <table class="ui compact celled definition table">
                        <thead>
                        <tr>
                            <th></th>
                            <th class="text-left">
                            TÍTULO
                            </th>
                            <th class="text-left">
                            INSTITUCIÓN
                            </th>
                            <th class="text-left">
                            TIPO
                            </th>
                            <th class="text-left">
                            N.° DE REGISTRO SENESCYT
                            </th>
                            <th class="text-left">
                            CAMPO
                            </th>
                            <th class="text-left">
                            PAÍS
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
                            <td>Presencial</td>
                            <td>1011-2023-2327683</td>
                            <td>Tecnologías de la Información y COmunicación</td>
                            <td>Ecuador</td>

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
  <AgregarTitulo></AgregarTitulo>
</div>
</template>

<script setup>
import {ref, onMounted} from "vue"
import AgregarTitulo from "./AgregarTitulo.vue";
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


/*
titulo:{type: Striewg,},
    ies:{type: String,},
    nivel:{type: String,required: true,
        enum:["Técnico","Tecnólogo","Grado", "Maestría", "Maestría Tecnológica", "Diplomado","Doctorado", "Posdoctorado"]
    },
    sreg:{type: String},//Número de registro en senescyt
    campo_amplio:{type: String},
    tipo:{type: String, required: true,
        enum:["Presencial","Semipresencial","Virtual", "Híbrido"]
    },
    pais:{type: String, default:"Ecuador"},
    sera:{type: String, enum: ["Enviado", "Revisado", "Aprobado"], default: "Enviado"
    }

*/
</script>

<style scoped lang="scss">
  .editar{
    background-color:$col-edit;
    color: white;
    margin: 1%;
  }
</style>