<template>
<div class="container-fluid py-4">
  <div class="row mb-4">
    <div class="col-10">
      <h2 class="text-start mb-0">Referencias</h2>
    </div>
    <div class="col-2 text-end">
      <button class="btn btn-primary btn-lg" @click="openModal()">
        <font-awesome-icon icon="plus" class="me-2" />
        Agregar
      </button>
    </div>
  </div>
                
  
  <!-- Referencias Laborales -->
  <div class="row mb-4">
    <div class="col-12">
      <h3 class="text-start mb-3">Referencias Laborales</h3>
      <div class="table-responsive">
        <table class="table table-striped table-hover">
          <thead class="table-dark">
            <tr>
              <th width="5%"></th>
              <th class="text-start">REFERENCIA</th>
              <th class="text-start">CARGO</th>
              <th class="text-start">CORREO</th>
              <th class="text-start">TELÉFONO</th>
              <th class="text-start">INSTITUCIÓN</th>
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

  <!-- Referencias Familiares -->
  <div class="row mb-4">
    <div class="col-12">
      <h3 class="text-start mb-3">Referencias Familiares</h3>
      <div class="table-responsive">
        <table class="table table-striped table-hover">
          <thead class="table-dark">
            <tr>
              <th width="5%"></th>
              <th class="text-start">REFERENCIA</th>
              <th class="text-start">PARENTESCO</th>
              <th class="text-start">CORREO</th>
              <th class="text-start">TELÉFONO</th>
              <th class="text-start">ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><BtnSera type="certified" @onpress="clickBtnsera"/></td>
              <td>Ingeniero en Electrónica y Comunicaciones</td>
              <td>Universidad Técnica de Ambato</td>
              <td>Presencial</td>
              <td>Tecnologías de la Información y Comunicación</td>
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

  <!-- Referencias Personales -->
  <div class="row mb-4">
    <div class="col-12">
      <h3 class="text-start mb-3">Referencias Personales</h3>
      <div class="table-responsive">
        <table class="table table-striped table-hover">
          <thead class="table-dark">
            <tr>
              <th width="5%"></th>
              <th class="text-start">REFERENCIA</th>
              <th class="text-start">CORREO</th>
              <th class="text-start">TELÉFONO</th>
              <th class="text-start">ACCIÓN</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><BtnSera type="certified" @onpress="clickBtnsera"/></td>
              <td>Ingeniero en Electrónica y Comunicaciones</td>
              <td>Universidad Técnica de Ambato</td>
              <td>Tecnologías de la Información y Comunicación</td>
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
<div class="modal fade" id="referenciaModal" tabindex="-1" aria-labelledby="referenciaModalLabel" aria-hidden="true" ref="modal">
  <div class="modal-dialog modal-xl">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="referenciaModalLabel">Agregar Referencia</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        <AgregarReferencia/>
      </div>
    </div>
  </div>
</div>
</template>

<script setup>
import {ref} from "vue"
import AgregarReferencia from "./AgregarReferencia.vue";
import BtnDelete from "@/components/database/BtnDelete.vue";
import BtnEdit from "@/components/database/BtnEdit.vue";
import BtnSera from "@/components/database/BtnSera.vue";
const modal = ref(null);

const openModal = () => {
    const modalElement = document.getElementById('referenciaModal');
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