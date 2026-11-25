import { API_ROUTES } from "@/core/config/apiConfig";
import axios from "@/core/services/httpClient";

/**
 * Los textos legales vigentes.
 *
 * ⚠️ **Se piden al BACKEND, no se leen de un fichero del frontend.** Antes eran `public/terms.md`, y
 * eso era la cadena rota: el frontend enseñaba un texto y el backend habría registrado la huella de
 * otro, sin que nadie se enterase hasta que hiciera falta. Ahora lo que se enseña y lo que se
 * registra **son el mismo objeto**.
 *
 * ⚠️ **Y la pantalla NO sabe cuántos documentos hay.** Se dibuja una casilla por cada documento
 * publicado: el día que legal apruebe uno nuevo, aparece sola. Una lista escrita a mano aquí sería
 * una segunda fuente de verdad que se olvida de actualizar.
 */
export const obtenerDocumentosLegales = async () => {
  const { data } = await axios.get(API_ROUTES.LEGAL_DOCUMENTOS);
  return data?.documentos ?? [];
};

/** El título que se le enseña a una persona. La clase es del modelo; esto es de la pantalla. */
export const TITULOS = Object.freeze({
  terminos_de_uso: "los términos y condiciones",
  tratamiento_de_datos: "el tratamiento de mis datos personales",
});
