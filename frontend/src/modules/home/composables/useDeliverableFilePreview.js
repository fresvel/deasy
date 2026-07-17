import { onBeforeUnmount, onMounted, ref } from "vue";
import { Modal } from "@/shared/utils/modalController";
import { canPreviewInline, getFileNameFromPath } from "@/shared/utils/filePath.js";

/**
 * Ver y descargar el fichero de un entregable.
 *
 * Vivia dentro de HomeView (5 refs + la instancia del modal + el teardown en onMounted + tres funciones),
 * lo que ataba la vista previa a esa pantalla. El centro documental la necesita igual, asi que se saca.
 *
 * Recibe tres FUNCIONES, no estado:
 *
 * - `getSubject(payload)`: normaliza el payload. Se inyecta porque la implementacion de HomeView
 *   (useDeliverableView.js:135,143) enriquece con el proceso seleccionado ambiente y NO es pura; otra
 *   pantalla puede pasar una version simple. Inyectar la funcion es honesto; inyectar los refs de otro
 *   componente --lo que hace useDeliverableView-- es lo que convierte un composable en Middle Man.
 * - `fetchBlob(payload, kind)`: la descarga en si. Depende del servicio y del usuario, no de esto.
 * - `onError(mensaje)`: como avisar. Cada pantalla tiene su canal (toast, alerta...).
 *
 * El estado SI es suyo: cada pantalla que lo llame tiene su propia vista previa.
 */
export function useDeliverableFilePreview({ getSubject, fetchBlob, onError }) {
  const previewModal = ref(null);
  const previewUrl = ref("");
  const previewName = ref("");
  const previewPath = ref("");
  const previewSource = ref(null);
  const previewIsPdf = ref(false);
  let modalInstance = null;

  const releaseUrl = () => {
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value);
    }
  };

  /** Estado a cero y URL liberada: se dispara al cerrarse el modal, venga de donde venga el cierre. */
  const resetPreview = () => {
    releaseUrl();
    previewUrl.value = "";
    previewName.value = "";
    previewPath.value = "";
    previewSource.value = null;
    previewIsPdf.value = false;
  };

  /** Descarga por el navegador. Sin Vue de por medio: es DOM puro. */
  const saveBlobAs = (blob, fileName) => {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  };

  /** El fichero final manda sobre el de trabajo cuando existe. */
  const preferredKindFor = (subject) => (subject.finalFilePath ? "final" : "working");

  const downloadFile = async (payload) => {
    const subject = getSubject(payload);
    if (!subject.preloadFilePath) {
      onError(`El entregable ${subject.title} todavía no tiene un archivo vinculado.`);
      return;
    }
    try {
      const blob = await fetchBlob(payload, preferredKindFor(subject));
      saveBlobAs(blob, getFileNameFromPath(subject.preloadFilePath));
    } catch (error) {
      onError(error?.response?.data?.message || error?.message || "No se pudo descargar el archivo del entregable.");
    }
  };

  const previewFile = async (payload) => {
    const subject = getSubject(payload);
    if (!subject.preloadFilePath) {
      onError(`El entregable ${subject.title} todavía no tiene un archivo vinculado.`);
      return;
    }
    // Lo que no se puede ver en linea se descarga: es preferible a abrir un visor vacio.
    if (!canPreviewInline(subject.preloadFilePath)) {
      await downloadFile(payload);
      return;
    }
    try {
      const blob = await fetchBlob(payload, preferredKindFor(subject));
      releaseUrl();
      previewUrl.value = URL.createObjectURL(blob);
      previewName.value = getFileNameFromPath(subject.preloadFilePath);
      previewPath.value = subject.preloadFilePath;
      previewSource.value = payload;
      previewIsPdf.value = true;
      modalInstance = Modal.getOrCreateInstance(previewModal.value?.el);
      modalInstance?.show();
    } catch (error) {
      onError(error?.response?.data?.message || error?.message || "No se pudo abrir la vista previa del archivo.");
    }
  };

  /** Descarga lo que se esta viendo. Se vuelve a pedir el blob en vez de reutilizar el del visor. */
  const downloadPreviewed = async () => {
    if (!previewPath.value || !previewSource.value) return;
    try {
      const subject = getSubject(previewSource.value);
      const blob = await fetchBlob(previewSource.value, preferredKindFor(subject));
      saveBlobAs(blob, previewName.value || getFileNameFromPath(previewPath.value));
    } catch (error) {
      onError(error?.response?.data?.message || error?.message || "No se pudo descargar el archivo del entregable.");
    }
  };

  const hidePreview = () => modalInstance?.hide();

  onMounted(() => {
    if (previewModal.value?.el) {
      modalInstance = Modal.getOrCreateInstance(previewModal.value.el);
      previewModal.value.el.addEventListener("hidden.bs.modal", resetPreview);
    }
  });

  onBeforeUnmount(() => {
    releaseUrl();
    previewSource.value = null;
  });

  return {
    previewModal,
    previewUrl,
    previewName,
    previewPath,
    previewSource,
    previewIsPdf,
    previewFile,
    downloadFile,
    downloadPreviewed,
    hidePreview,
    saveBlobAs
  };
}
