<template>
  <div class="container-fluid py-4">
    <ProfileSectionShell
      title="Investigación y producción académica"
      subtitle="Gestiona artículos, libros, ponencias, tesis y proyectos."
      @add="openModal"
    >
      <ProfileTableBlock title="Artículos">
        <div class="table-responsive">
          <table class="table table-striped table-hover align-middle table-institutional">
            <thead>
              <tr>
                <th width="5%"></th>
                <th class="text-start">TÍTULO</th>
                <th class="text-start">REVISTA</th>
                <th class="text-start">DOI</th>
                <th class="text-start">FECHA</th>
                <th class="text-start">ESTADO</th>
                <th class="text-start">ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!articulos.length">
                <td colspan="7" class="text-center text-muted">
                  <p class="my-3">No hay artículos registrados.</p>
                </td>
              </tr>
              <tr v-for="item in articulos" :key="item._id">
                <td><BtnSera :type="getSeraType(item.sera)" /></td>
                <td>{{ item.titulo }}</td>
                <td>{{ item.revista || "N/A" }}</td>
                <td>{{ item.doi || "N/A" }}</td>
                <td>{{ formatDate(item.fecha) || "N/A" }}</td>
                <td>{{ item.estado || "N/A" }}</td>
                <td>
                  <div class="btn-group" role="group">
                    <BtnDelete @onpress="() => removeItem('articulos', item)" />
                    <BtnEdit @onpress="() => editItem('articulos', item)" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ProfileTableBlock>

      <ProfileTableBlock title="Libros y capítulos">
        <div class="table-responsive">
          <table class="table table-striped table-hover align-middle table-institutional">
            <thead>
              <tr>
                <th width="5%"></th>
                <th class="text-start">TÍTULO</th>
                <th class="text-start">EDITORIAL</th>
                <th class="text-start">ISBN</th>
                <th class="text-start">AÑO</th>
                <th class="text-start">TIPO</th>
                <th class="text-start">ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!libros.length">
                <td colspan="7" class="text-center text-muted">
                  <p class="my-3">No hay libros o capítulos registrados.</p>
                </td>
              </tr>
              <tr v-for="item in libros" :key="item._id">
                <td><BtnSera :type="getSeraType(item.sera)" /></td>
                <td>{{ item.titulo }}</td>
                <td>{{ item.editorial || "N/A" }}</td>
                <td>{{ item.isbn || item.isnn || "N/A" }}</td>
                <td>{{ item['año'] || "N/A" }}</td>
                <td>{{ item.tipo || "N/A" }}</td>
                <td>
                  <div class="btn-group" role="group">
                    <BtnDelete @onpress="() => removeItem('libros', item)" />
                    <BtnEdit @onpress="() => editItem('libros', item)" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ProfileTableBlock>

      <ProfileTableBlock title="Ponencias">
        <div class="table-responsive">
          <table class="table table-striped table-hover align-middle table-institutional">
            <thead>
              <tr>
                <th width="5%"></th>
                <th class="text-start">TÍTULO</th>
                <th class="text-start">EVENTO</th>
                <th class="text-start">AÑO</th>
                <th class="text-start">PAÍS</th>
                <th class="text-start">ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!ponencias.length">
                <td colspan="6" class="text-center text-muted">
                  <p class="my-3">No hay ponencias registradas.</p>
                </td>
              </tr>
              <tr v-for="item in ponencias" :key="item._id">
                <td><BtnSera :type="getSeraType(item.sera)" /></td>
                <td>{{ item.titulo }}</td>
                <td>{{ item.evento || "N/A" }}</td>
                <td>{{ item['año'] || "N/A" }}</td>
                <td>{{ item.pais || "N/A" }}</td>
                <td>
                  <div class="btn-group" role="group">
                    <BtnDelete @onpress="() => removeItem('ponencias', item)" />
                    <BtnEdit @onpress="() => editItem('ponencias', item)" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ProfileTableBlock>

      <ProfileTableBlock title="Tesis dirigidas o revisadas">
        <div class="table-responsive">
          <table class="table table-striped table-hover align-middle table-institutional">
            <thead>
              <tr>
                <th width="5%"></th>
                <th class="text-start">INSTITUCIÓN</th>
                <th class="text-start">TEMA</th>
                <th class="text-start">NIVEL</th>
                <th class="text-start">AÑO</th>
                <th class="text-start">ROL</th>
                <th class="text-start">ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!tesis.length">
                <td colspan="7" class="text-center text-muted">
                  <p class="my-3">No hay tesis registradas.</p>
                </td>
              </tr>
              <tr v-for="item in tesis" :key="item._id">
                <td><BtnSera :type="getSeraType(item.sera)" /></td>
                <td>{{ item.ies || "N/A" }}</td>
                <td>{{ item.tema || "N/A" }}</td>
                <td>{{ item.nivel || "N/A" }}</td>
                <td>{{ item['año'] || "N/A" }}</td>
                <td>{{ item.rol || "N/A" }}</td>
                <td>
                  <div class="btn-group" role="group">
                    <BtnDelete @onpress="() => removeItem('tesis', item)" />
                    <BtnEdit @onpress="() => editItem('tesis', item)" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ProfileTableBlock>

      <ProfileTableBlock title="Proyectos">
        <div class="table-responsive">
          <table class="table table-striped table-hover align-middle table-institutional">
            <thead>
              <tr>
                <th width="5%"></th>
                <th class="text-start">TEMA</th>
                <th class="text-start">INSTITUCIÓN</th>
                <th class="text-start">TIPO</th>
                <th class="text-start">INICIO</th>
                <th class="text-start">FIN</th>
                <th class="text-start">AVANCE</th>
                <th class="text-start">ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!proyectos.length">
                <td colspan="8" class="text-center text-muted">
                  <p class="my-3">No hay proyectos registrados.</p>
                </td>
              </tr>
              <tr v-for="item in proyectos" :key="item._id">
                <td><BtnSera :type="getSeraType(item.sera)" /></td>
                <td>{{ item.tema || "N/A" }}</td>
                <td>{{ item.institucion || "N/A" }}</td>
                <td>{{ item.tipo || "N/A" }}</td>
                <td>{{ formatDate(item.inicio) || "N/A" }}</td>
                <td>{{ formatDate(item.fin) || "N/A" }}</td>
                <td>{{ item.avance !== undefined ? `${item.avance}%` : "N/A" }}</td>
                <td>
                  <div class="btn-group" role="group">
                    <BtnDelete @onpress="() => removeItem('proyectos', item)" />
                    <BtnEdit @onpress="() => editItem('proyectos', item)" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ProfileTableBlock>
    </ProfileSectionShell>

    <div class="modal fade" id="investigacionModal" tabindex="-1" ref="modal" aria-hidden="true">
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Agregar registro de investigación</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <AgregarInvestigacion @investigacion-added="handleInvestigacionAdded" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import axios from "axios";
import { Modal } from "bootstrap";
import BtnDelete from "@/components/BtnDelete.vue";
import BtnEdit from "@/components/BtnEdit.vue";
import BtnSera from "@/components/BtnSera.vue";
import ProfileSectionShell from "@/sections/perfil/ProfileSectionShell.vue";
import ProfileTableBlock from "@/sections/perfil/ProfileTableBlock.vue";
import AgregarInvestigacion from "@/sections/perfil/AgregarInvestigacion.vue";
import { API_PREFIX } from "@/services/apiConfig";

const modal = ref(null);
const dossier = ref(null);
const currentUser = ref(null);
let bootstrapModal = null;

const investigacion = computed(() => dossier.value?.investigacion || {});
const articulos = computed(() => investigacion.value?.articulos || []);
const libros = computed(() => investigacion.value?.libros || []);
const ponencias = computed(() => investigacion.value?.ponencias || []);
const tesis = computed(() => investigacion.value?.tesis || []);
const proyectos = computed(() => investigacion.value?.proyectos || []);

const getSeraType = (sera) => {
  if (!sera || sera === "Enviado") return "pending";
  if (sera === "Revisado") return "reviewed";
  if (sera === "Aprobado") return "certified";
  return "denied";
};

const formatDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-EC", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
};

const loadDossier = async () => {
  try {
    const userDataString = localStorage.getItem("user");
    if (!userDataString) return;
    currentUser.value = JSON.parse(userDataString);

    const url = `${API_PREFIX}/dossier/${currentUser.value.cedula}`;
    const response = await axios.get(url);
    if (response.data.success) {
      dossier.value = response.data.data;
    }
  } catch (error) {
    console.error("Error al cargar investigación del dossier:", error);
  }
};

const openModal = () => {
  if (!modal.value) return;
  bootstrapModal = Modal.getOrCreateInstance(modal.value);
  bootstrapModal.show();
};

const handleInvestigacionAdded = () => {
  loadDossier();
};

const removeItem = async (tipo, item) => {
  if (!currentUser.value?.cedula || !item?._id) return;
  if (!confirm("¿Deseas eliminar este registro de investigación?")) return;

  try {
    const url = `${API_PREFIX}/dossier/${currentUser.value.cedula}/investigacion/${tipo}/${item._id}`;
    await axios.delete(url);
    window.dispatchEvent(new Event("dossier-updated"));
    await loadDossier();
  } catch (error) {
    console.error("Error al eliminar investigación:", error);
    alert("No se pudo eliminar el registro.");
  }
};

const editItem = (tipo, item) => {
  console.info("Editar investigación", tipo, item);
};

onMounted(() => {
  loadDossier();
  window.addEventListener("dossier-updated", loadDossier);
});

onBeforeUnmount(() => {
  if (bootstrapModal) {
    bootstrapModal.hide();
    bootstrapModal.dispose();
    bootstrapModal = null;
  }
  window.removeEventListener("dossier-updated", loadDossier);
});
</script>
