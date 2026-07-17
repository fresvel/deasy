/**
 * Formato de fecha del dossier: dd/mm/aaaa en es-EC. Estaba copiado byte a byte en cada seccion.
 * Cadena vacia si no hay fecha, para que la celda decida su propio texto ("Actualidad", "—"...).
 */
export const formatDossierDate = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleDateString("es-EC", { year: "numeric", month: "2-digit", day: "2-digit" });
};
