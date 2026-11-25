import { API_ROUTES } from "@/core/config/apiConfig";
import axios from "@/core/services/httpClient";

/**
 * REDACTAR, PUBLICAR Y RETIRAR los textos legales.
 *
 * ⚠️ **NO es el servicio del registro.** `modules/auth/services/documentosLegalesService.js` lee lo
 * VIGENTE y es público a propósito —hay que poder leer lo que se acepta antes de tener cuenta—.
 * Éste vive bajo `/admin`, exige sesión y permiso (`legal_documents.*`), y es el único que escribe.
 * Son dos audiencias distintas sobre el mismo modelo, así que son dos módulos; fundirlos obligaría
 * al de registro a arrastrar rutas que un visitante no puede llamar.
 *
 * ⚠️ **Y el texto no viaja en la lista.** El listado da el metadato de cada versión; el cuerpo se
 * pide por su id. No es una optimización: son objetos de MinIO, y traer todos los textos para
 * pintar una tabla de estados sería descargar el archivo entero en cada refresco.
 */

/* El backend está naciendo a la vez que esta pantalla. Se acepta tanto un array pelado como
   `{ documentos: [...] }` —que es la forma que ya usa la ruta pública— para que un cambio de
   envoltorio no deje la pantalla en blanco sin decir por qué. */
const comoLista = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.documentos)) return data.documentos;
  return [];
};

export const listarDocumentosLegales = async () => {
  const { data } = await axios.get(API_ROUTES.ADMIN_LEGAL_DOCUMENTOS);
  return comoLista(data);
};

export const crearBorradorLegal = async ({ clase, version }) => {
  const { data } = await axios.post(API_ROUTES.ADMIN_LEGAL_DOCUMENTOS, { clase, version });
  return data?.documento ?? data;
};

/** El metadato MÁS el texto. Es la única llamada que descarga el objeto. */
export const leerDocumentoLegal = async (id) => {
  const { data } = await axios.get(API_ROUTES.ADMIN_LEGAL_DOCUMENTO(id));
  return data?.documento ?? data;
};

export const guardarBorradorLegal = async (id, texto) => {
  const { data } = await axios.put(API_ROUTES.ADMIN_LEGAL_DOCUMENTO(id), { texto });
  return data?.documento ?? data;
};

/** ⚠️ IRREVERSIBLE. El texto entra en el bucket WORM y no vuelve a salir. */
export const publicarDocumentoLegal = async (id) => {
  const { data } = await axios.post(API_ROUTES.ADMIN_LEGAL_DOCUMENTO_PUBLICAR(id));
  return data?.documento ?? data;
};

/** Retirar NO borra: la versión se conserva porque hay consentimientos que apuntan a ella. */
export const retirarDocumentoLegal = async (id) => {
  const { data } = await axios.post(API_ROUTES.ADMIN_LEGAL_DOCUMENTO_RETIRAR(id));
  return data?.documento ?? data;
};

/**
 * Las versiones de OBJETO del borrador: cada vez que se guardó, con su tamaño.
 * No es el historial de estados del documento — es el del fichero.
 */
export const historialDocumentoLegal = async (id) => {
  const { data } = await axios.get(API_ROUTES.ADMIN_LEGAL_DOCUMENTO_HISTORIAL(id));
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.historial) ? data.historial : [];
};

/**
 * El estado del archivo inmutable: bucket, si está bloqueado, en qué modo y cuántos días.
 *
 * ⚠️ **SÓLO SE LEE.** No hay aquí —ni debe haber— una llamada que lo cambie: la retención se
 * configura en la infraestructura, y la pantalla existe para que la institución pueda VERIFICARLA,
 * no para tocarla. Un botón aquí convertiría una garantía en un ajuste.
 */
export const estadoDelArchivoLegal = async () => {
  const { data } = await axios.get(API_ROUTES.ADMIN_LEGAL_ARCHIVO_ESTADO);
  return data?.archivo ?? data ?? null;
};
