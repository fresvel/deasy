<template>
<div class="container-fluid py-4">
  <div class="row mb-4">
    <div class="col-10">
      <h2 class="text-start mb-0">Formación Profesional</h2>
    </div>
    <div class="col-2 text-end">
      <button class="btn btn-primary btn-lg" @click="openModal()">
        <font-awesome-icon icon="plus" class="me-2" />
        Agregar
      </button>
    </div>
  </div>
                
  
  <!-- Títulos Técnicos y Tecnológicos -->
  <div class="row mb-4">
    <div class="col-12">
      <h3 class="text-start mb-3">Títulos Técnicos y Tecnológicos</h3>
      <div class="table-responsive">
        <table class="table table-striped table-hover">
          <thead class="table-dark">
            <tr>
              <th width="5%"></th>
              <th class="text-start">TÍTULO</th>
              <th class="text-start">INSTITUCIÓN</th>
              <th class="text-start">TIPO</th>
              <th class="text-start">N.° DE REGISTRO SENESCYT</th>
              <th class="text-start">CAMPO</th>
              <th class="text-start">PAÍS</th>
              <th class="text-start">ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><BtnSera type="reviewed" @onpress="clickBtnsera"/></td>
              <td>Ingeniero en Electrónica y Comunicaciones</td>
              <td>Universidad Técnica de Ambato</td>
              <td>Presencial</td>
              <td>1011-2023-2327683</td>
              <td>Tecnologías de la Información y Comunicación</td>
              <td>Ecuador</td>
              <td>
                <div class="btn-group" role="group">
                  <BtnDelete @onpress="clickBtndelete"/>
                  <BtnEdit @onpress="clickBtnedit"/>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  
  <!-- Títulos de Grado -->
  <div class="row mb-4">
    <div class="col-12">
      <h3 class="text-start mb-3">Títulos de Grado</h3>
      <div class="table-responsive">
        <table class="table table-striped table-hover">
          <thead class="table-dark">
            <tr>
              <th width="5%"></th>
              <th class="text-start">TÍTULO</th>
              <th class="text-start">INSTITUCIÓN</th>
              <th class="text-start">TIPO</th>
              <th class="text-start">N.° DE REGISTRO SENESCYT</th>
              <th class="text-start">CAMPO</th>
              <th class="text-start">PAÍS</th>
              <th class="text-start">ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><BtnSera type="denied" @onpress="clickBtnsera"/></td>
              <td>Ingeniero en Electrónica y Comunicaciones</td>
              <td>Universidad Técnica de Ambato</td>
              <td>Presencial</td>
              <td>1011-2023-2327683</td>
              <td>Tecnologías de la Información y Comunicación</td>
              <td>Ecuador</td>
              <td>
                <div class="btn-group" role="group">
                  <BtnDelete @onpress="clickBtndelete"/>
                  <BtnEdit @onpress="clickBtnedit"/>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  
  <!-- Títulos de Cuarto Nivel -->
  <div class="row mb-4">
    <div class="col-12">
      <h3 class="text-start mb-3">Títulos de Cuarto Nivel</h3>
      <div class="table-responsive">
        <table class="table table-striped table-hover">
          <thead class="table-dark">
            <tr>
              <th width="5%"></th>
              <th class="text-start">TÍTULO</th>
              <th class="text-start">INSTITUCIÓN</th>
              <th class="text-start">TIPO</th>
              <th class="text-start">N.° DE REGISTRO SENESCYT</th>
              <th class="text-start">CAMPO</th>
              <th class="text-start">PAÍS</th>
              <th class="text-start">ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><BtnSera type="certified" @onpress="clickBtnsera"/></td>
              <td>Ingeniero en Electrónica y Comunicaciones</td>
              <td>Universidad Técnica de Ambato</td>
              <td>Presencial</td>
              <td>1011-2023-2327683</td>
              <td>Tecnologías de la Información y Comunicación</td>
              <td>Ecuador</td>
              <td>
                <div class="btn-group" role="group">
                  <BtnDelete @onpress="clickBtndelete"/>
                  <BtnEdit @onpress="clickBtnedit"/>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>


<!-- Modal Bootstrap -->
<div class="modal fade" id="tituloModal" tabindex="-1" aria-labelledby="tituloModalLabel" aria-hidden="true" ref="modal">
  <div class="modal-dialog modal-xl">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="tituloModalLabel">Agregar Título</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        <AgregarTitulo></AgregarTitulo>
      </div>
    </div>
  </div>
</div>
</template>

<script setup>
import {ref} from "vue"
import AgregarTitulo from "./AgregarTitulo.vue";
import BtnDelete from "@/components/database/BtnDelete.vue";
import BtnEdit from "@/components/database/BtnEdit.vue";
import BtnSera from "@/components/database/BtnSera.vue";
const modal = ref(null);

const openModal = () => {
    const modalElement = document.getElementById('tituloModal');
    const modal = new window.bootstrap.Modal(modalElement);
    modal.show();
};


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