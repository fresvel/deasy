<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <AppButton variant="primary-soft" @click="$emit('volver')">Volver</AppButton>
        <h2 class="deasy-title deasy-title--page">Documentos legales</h2>
        <p class="text-sm text-muted">
          Los textos que una persona acepta al registrarse. Se redactan aquí, y al publicarlos dejan
          de poder cambiarse.
        </p>
      </div>
    </div>

    <!-- ⚠️ UN FALLO DEL BACKEND SE VE EN PANTALLA. Una pantalla que se queda vacía cuando la
         llamada falla le dice a quien mira que no hay documentos, que es lo contrario de lo que
         pasó. El motivo se enseña; el volcado técnico lo filtra `resolveApiErrorMessage`. -->
    <AppAlert v-if="error" variant="danger">{{ error }}</AppAlert>

    <!-- ══ EL ARCHIVO INMUTABLE — SÓLO SE MIRA ═══════════════════════════════════════════════
         No hay aquí ni un control, y es la razón de ser del bloque: la institución tiene que poder
         COMPROBAR que lo publicado no se puede alterar. Si esto fuera configurable desde la misma
         pantalla que publica, la garantía valdría exactamente lo que valga la sesión abierta. -->
    <section class="deasy-card p-5" aria-labelledby="legal-archivo-titulo">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="legal-archivo-titulo" class="text-base font-semibold text-strong">
            Archivo inmutable
          </h3>
          <p class="text-sm text-muted">Información para verificar. No se configura desde aquí.</p>
        </div>
        <AppTag :variant="tonoDelArchivo(archivo)">{{ etiquetaDelArchivo(archivo) }}</AppTag>
      </div>

      <p class="mt-3 text-sm text-body">{{ explicacionDelArchivo(archivo) }}</p>

      <!-- El backend manda el MOTIVO cuando no hay retención («el bucket se creo sin bloqueo»,
           «no tiene retencion por defecto», o el error de MinIO). Es la mitad accionable del
           bloque: sin él, «sin retención» no le dice a nadie qué arreglar. -->
      <p v-if="archivo?.motivo" class="mt-2 font-mono text-xs text-body break-all">
        {{ archivo.motivo }}
      </p>

      <dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <dt class="text-muted">Bucket</dt>
          <dd class="font-mono text-body break-all">{{ archivo?.bucket ?? "sin dato" }}</dd>
        </div>
        <div>
          <dt class="text-muted">Retención</dt>
          <dd class="text-body">{{ archivo?.bloqueado ? "activada" : "NO activada" }}</dd>
        </div>
        <div>
          <dt class="text-muted">Modo</dt>
          <dd class="font-mono text-body">{{ archivo?.modo ?? "sin dato" }}</dd>
        </div>
        <div>
          <dt class="text-muted">Días</dt>
          <dd class="text-body">{{ archivo?.dias ?? "sin dato" }}</dd>
        </div>
      </dl>

      <p class="mt-4 text-xs text-muted">
        La retención la fija la infraestructura del almacén, no esta pantalla. Aquí se enseña para
        que pueda verificarse; para cambiarla hay que cambiar el despliegue.
      </p>
    </section>

    <Loading v-if="cargandoPrimeraVez" />

    <div v-else class="space-y-6">
    <section v-for="grupo in grupos" :key="grupo.clase" class="deasy-card p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <h3 class="text-base font-semibold text-strong">{{ grupo.titulo }}</h3>
        <div class="flex flex-wrap items-center gap-2">
          <label class="deasy-form-label deasy-form-label--inline" :for="`legal-version-${grupo.clase}`">
            Nueva versión
          </label>
          <input
            :id="`legal-version-${grupo.clase}`"
            v-model="nuevaVersion[grupo.clase]"
            class="deasy-control w-44"
            placeholder="ej. 2026-09"
          />
          <AppButton
            variant="primary-outline"
            :disabled="ocupado"
            @click="crearBorrador(grupo.clase)"
          >
            Crear borrador
          </AppButton>
        </div>
      </div>

      <div v-if="grupo.versiones.length" class="deasy-table-responsive mt-4">
        <table class="deasy-table">
          <thead>
            <tr>
              <th>Versión</th>
              <th>Estado</th>
              <th>Publicado</th>
              <th>Huella</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="documento in grupo.versiones" :key="documento.id">
              <td>{{ documento.version }}</td>
              <td>
                <AppTag :variant="tonoDeDocumento(documento)">
                  {{ etiquetaDeEstado(documento) }}
                </AppTag>
              </td>
              <td>{{ fechaLegible(documento.publicadoAt) }}</td>
              <td class="font-mono text-theme-xs break-all">
                {{ documento.contenidoHash || "—" }}
              </td>
              <td>
                <div class="flex flex-wrap items-center gap-2">
                  <AppButton variant="primary-outline" @click="abrirEditor(documento)">
                    {{ puedeEditarse(documento) ? "Editar" : "Ver texto" }}
                  </AppButton>
                  <AppButton
                    v-if="puedeEditarse(documento)"
                    variant="neutral-outline"
                    @click="abrirHistorial(documento)"
                  >
                    Historial
                  </AppButton>
                  <!-- ⚠️ NI PUBLICAR NI RETIRAR LLAMAN AL BACKEND DESDE AQUÍ. Abren la
                       confirmación, y la confirmación dice lo que pasa después. -->
                  <AppButton
                    v-if="puedePublicarse(documento)"
                    variant="success-outline"
                    @click="pedirConfirmacion(documento, 'publicar')"
                  >
                    Publicar
                  </AppButton>
                  <AppButton
                    v-if="puedeRetirarse(documento)"
                    variant="warning-outline"
                    @click="pedirConfirmacion(documento, 'retirar')"
                  >
                    Retirar
                  </AppButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <AppEmpty v-else class="mt-4">Todavía no hay ninguna versión de este documento.</AppEmpty>
    </section>
    </div>

    <!-- ══ EL EDITOR ═════════════════════════════════════════════════════════════════════════
         Un `textarea` y Markdown a pelo, a propósito. Un editor rico traería una dependencia y,
         peor, produciría un texto que no es el que se archiva: lo que entra en el bucket es esto,
         byte por byte, y su huella es la que se registra al aceptarlo. -->
    <AppModalShell
      v-if="editor"
      controlled
      :open="Boolean(editor)"
      :title="tituloEditor"
      size="lg"
      @close="cerrarEditor"
    >
      <AppAlert v-if="errorEditor" variant="danger">{{ errorEditor }}</AppAlert>

      <AppAlert v-if="!editorEditable" variant="info">
        Esta versión ya no es un borrador: se enseña tal como quedó archivada y no se puede
        modificar.
      </AppAlert>

      <label class="deasy-form-label" for="legal-editor-texto">Texto (Markdown)</label>
      <textarea
        id="legal-editor-texto"
        v-model="texto"
        rows="20"
        :readonly="!editorEditable"
        class="deasy-control deasy-control--textarea"
        placeholder="Escribe aquí el texto legal, en Markdown."
      ></textarea>

      <template #footer>
        <AppButton variant="neutral-outline" @click="cerrarEditor">Cerrar</AppButton>
        <AppButton
          v-if="editorEditable"
          variant="primary-outline"
          :disabled="ocupado"
          @click="guardar"
        >
          Guardar borrador
        </AppButton>
      </template>
    </AppModalShell>

    <!-- ══ EL HISTORIAL DE EDICIÓN ═══════════════════════════════════════════════════════════
         Son las versiones del OBJETO en el almacén —cada guardado del borrador—, no los estados
         del documento. Sirve para responder «¿qué le pasó a este texto antes de publicarse?». -->
    <AppModalShell
      v-if="historialDe"
      controlled
      :open="Boolean(historialDe)"
      title="Historial de edición del borrador"
      @close="historialDe = null"
    >
      <p class="text-sm text-muted">
        Cada fila es un guardado del borrador. No es el historial de estados: es el del fichero.
      </p>
      <div v-if="historial.length" class="deasy-table-responsive mt-4">
        <table class="deasy-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tamaño</th>
              <th>Versión de objeto</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entrada in historial" :key="entrada.objectVersionId">
              <td>{{ fechaLegible(entrada.fecha) }}</td>
              <td>{{ entrada.tamano }} B</td>
              <td class="font-mono text-theme-xs break-all">{{ entrada.objectVersionId }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <AppEmpty v-else class="mt-4">Este borrador no se ha guardado todavía.</AppEmpty>
    </AppModalShell>

    <!-- ══ LA CONFIRMACIÓN ═══════════════════════════════════════════════════════════════════
         El texto NO es «¿estás seguro?»: dice qué deja de poder deshacerse. Sale de
         `estadoLegal.js` y tiene test allí. -->
    <AppModalShell
      v-if="confirmacion"
      controlled
      :open="Boolean(confirmacion)"
      :title="aviso.titulo"
      @close="cancelarConfirmacion"
    >
      <AppAlert :variant="confirmacion.accion === 'publicar' ? 'danger' : 'warning'">
        {{ aviso.cuerpo }}
      </AppAlert>
      <!-- La SEGUNDA consecuencia, que el botón no dice: publicar jubila a la vigente. -->
      <AppAlert v-if="avisoDesplazamiento" variant="warning" class="mt-3">
        {{ avisoDesplazamiento }}
      </AppAlert>

      <p class="mt-3 text-sm text-body">
        {{ etiquetaClase(confirmacion.documento.clase) }} · versión
        {{ confirmacion.documento.version }}
      </p>

      <template #footer>
        <AppButton variant="neutral-outline" @click="cancelarConfirmacion">Cancelar</AppButton>
        <AppButton
          :variant="confirmacion.accion === 'publicar' ? 'danger-outline' : 'warning-outline'"
          :disabled="ocupado"
          @click="confirmar"
        >
          {{ aviso.confirmar }}
        </AppButton>
      </template>
    </AppModalShell>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from "vue";

import AppButton from "@/shared/components/buttons/AppButton.vue";
import AppTag from "@/shared/components/data/AppTag.vue";
import AppAlert from "@/shared/components/feedback/AppAlert.vue";
import AppEmpty from "@/shared/components/feedback/AppEmpty.vue";
import Loading from "@/shared/components/feedback/Loading.vue";
import AppModalShell from "@/shared/components/modals/AppModalShell.vue";
import { resolveApiErrorMessage } from "@/shared/utils/apiError.js";

import {
  agruparPorClase,
  avisoDe,
  avisoDeDesplazamiento,
  etiquetaClase,
  etiquetaDeEstado,
  etiquetaDelArchivo,
  explicacionDelArchivo,
  fechaLegible,
  puedeEditarse,
  puedePublicarse,
  puedeRetirarse,
  tonoDeDocumento,
  tonoDelArchivo,
} from "../../composables/legales/estadoLegal.js";
import {
  crearBorradorLegal,
  estadoDelArchivoLegal,
  guardarBorradorLegal,
  historialDocumentoLegal,
  leerDocumentoLegal,
  listarDocumentosLegales,
  publicarDocumentoLegal,
  retirarDocumentoLegal,
} from "../../services/documentosLegalesAdminService.js";

defineEmits(["volver"]);

const documentos = ref([]);
const archivo = ref(null);
const error = ref("");
const cargandoPrimeraVez = ref(true);
/* Un solo cerrojo para las cinco escrituras. Publicar dos veces por un doble clic no es un caso
   hipotético aquí: la segunda llamada ya no tendría vuelta atrás. */
const ocupado = ref(false);

const nuevaVersion = reactive({});

const editor = ref(null);
const texto = ref("");
const errorEditor = ref("");

const historialDe = ref(null);
const historial = ref([]);

const confirmacion = ref(null);

const grupos = computed(() => agruparPorClase(documentos.value));
const editorEditable = computed(() => puedeEditarse(editor.value));
const tituloEditor = computed(() =>
  editor.value
    ? `${etiquetaClase(editor.value.clase)} · versión ${editor.value.version}`
    : ""
);
const aviso = computed(() => avisoDe(confirmacion.value?.accion));

/* Sólo al publicar, y sólo si hay otra vigente en la misma clase. */
const avisoDesplazamiento = computed(() => {
  const pendiente = confirmacion.value;
  if (!pendiente || pendiente.accion !== "publicar") return "";
  const vigente = documentos.value.find(
    (candidato) =>
      candidato.clase === pendiente.documento.clase &&
      candidato.estado === "published" &&
      candidato.id !== pendiente.documento.id
  );
  return avisoDeDesplazamiento(vigente?.version);
});

/* Toda llamada pasa por aquí. Es lo que garantiza que un fallo acabe SIEMPRE en la alerta de
   arriba y nunca en la consola — que es donde no lo ve nadie. */
const intentar = async (fallback, accion) => {
  ocupado.value = true;
  try {
    return await accion();
  } catch (fallo) {
    error.value = resolveApiErrorMessage(fallo, fallback);
    return null;
  } finally {
    ocupado.value = false;
  }
};

const refrescar = async () => {
  error.value = "";
  const lista = await intentar("No se pudieron cargar los documentos legales.", listarDocumentosLegales);
  if (lista) documentos.value = lista;
  cargandoPrimeraVez.value = false;
};

/* El estado del archivo va en su propia llamada y con su propio fallo: que no se pueda leer la
   retención NO impide redactar, y mezclarlos dejaría la pantalla entera en blanco por un dato
   informativo. */
const refrescarArchivo = async () => {
  try {
    archivo.value = await estadoDelArchivoLegal();
  } catch (fallo) {
    archivo.value = null;
    error.value = resolveApiErrorMessage(fallo, "No se pudo consultar el estado del archivo.");
  }
};

const crearBorrador = async (clase) => {
  const version = String(nuevaVersion[clase] ?? "").trim();
  if (!version) {
    error.value = "Ponle un nombre a la versión antes de crear el borrador.";
    return;
  }
  error.value = "";
  const creado = await intentar("No se pudo crear el borrador.", () =>
    crearBorradorLegal({ clase, version })
  );
  if (!creado) return;
  nuevaVersion[clase] = "";
  await refrescar();
};

const abrirEditor = async (documento) => {
  errorEditor.value = "";
  texto.value = "";
  editor.value = documento;
  try {
    const completo = await leerDocumentoLegal(documento.id);
    texto.value = completo?.texto ?? "";
  } catch (fallo) {
    errorEditor.value = resolveApiErrorMessage(fallo, "No se pudo leer el texto.");
  }
};

const cerrarEditor = () => {
  editor.value = null;
  texto.value = "";
  errorEditor.value = "";
};

const guardar = async () => {
  /* ⚠️ LA GUARDA SE REPITE AQUÍ Y NO SOBRA. El botón ya no se pinta para lo publicado, pero el
     estado del documento pudo cambiar mientras el modal estaba abierto —otra persona lo publicó—,
     y entonces guardar sería pedirle al backend que escriba sobre un objeto WORM. */
  if (!puedeEditarse(editor.value)) {
    errorEditor.value = "Esta versión ya no es un borrador: no se puede guardar.";
    return;
  }
  errorEditor.value = "";
  ocupado.value = true;
  try {
    await guardarBorradorLegal(editor.value.id, texto.value);
    cerrarEditor();
    await refrescar();
  } catch (fallo) {
    errorEditor.value = resolveApiErrorMessage(fallo, "No se pudo guardar el borrador.");
  } finally {
    ocupado.value = false;
  }
};

const abrirHistorial = async (documento) => {
  historialDe.value = documento;
  historial.value = [];
  const entradas = await intentar("No se pudo leer el historial.", () =>
    historialDocumentoLegal(documento.id)
  );
  if (entradas) historial.value = entradas;
};

const pedirConfirmacion = (documento, accion) => {
  confirmacion.value = { documento, accion };
};

const cancelarConfirmacion = () => {
  confirmacion.value = null;
};

const confirmar = async () => {
  const pendiente = confirmacion.value;
  if (!pendiente) return;
  const { documento, accion } = pendiente;
  /* La misma guarda de `guardar`, por el mismo motivo: la pantalla pudo quedarse vieja. */
  const permitido = accion === "publicar" ? puedePublicarse(documento) : puedeRetirarse(documento);
  if (!permitido) {
    confirmacion.value = null;
    error.value = "El estado de esa versión cambió: vuelve a cargar la pantalla.";
    return;
  }
  error.value = "";
  const hecho = await intentar(
    accion === "publicar" ? "No se pudo publicar." : "No se pudo retirar.",
    () => (accion === "publicar" ? publicarDocumentoLegal(documento.id) : retirarDocumentoLegal(documento.id))
  );
  confirmacion.value = null;
  if (hecho) await refrescar();
};

onMounted(async () => {
  await refrescar();
  await refrescarArchivo();
});

defineExpose({ refrescar });
</script>
