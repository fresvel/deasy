/**
 * Helpers de ruta de fichero. Puros: entran cadenas, salen cadenas.
 *
 * Vivian dentro del closure de useDeliverableView (1062 L) sin motivo --no tocan un solo ref--, lo que
 * obligaba a inyectar el composable entero para poder averiguar si una ruta acaba en .pdf. Aqui los puede
 * importar cualquiera. `getDeliverableSubject` NO se movio con ellos porque esa si depende del proceso
 * seleccionado (useDeliverableView.js:135,143) y no es pura.
 */

/** Ultimo segmento de la ruta. 'archivo' si no hay nada aprovechable. */
export const getFileNameFromPath = (filePath = "") => String(filePath || "").split("/").pop() || "archivo";

/** Extension en minusculas, sin punto. Cadena vacia si el nombre no tiene. */
export const getFileExtension = (filePath = "") => {
  const fileName = getFileNameFromPath(filePath);
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex + 1).toLowerCase() : "";
};

/**
 * Politica de vista previa: solo se previsualiza PDF en linea. Cualquier otra cosa se descarga.
 * El nombre dice la intencion, no el formato, porque la politica puede crecer (imagenes, texto...).
 */
export const canPreviewInline = (filePath = "") => getFileExtension(filePath) === "pdf";
