// Constantes de almacenamiento y formato de las plantillas documentales.
//
// POR QUÉ EXISTE. El cut #3 (Extract Class de `TemplateArtifactService`) se llevó métodos que
// usaban estas tres constantes, y en vez de compartirlas las COPIÓ al módulo nuevo. Quedaron
// espejadas en dos ficheros: si mañana cambia el bucket o el subárbol editable y solo se toca una
// copia, el servicio y el motor apuntan a sitios distintos y el fallo aparece lejos de la causa.
// Un valor con dos dueños no es una constante, es un bug esperando.

/** Bucket de MinIO donde viven las plantillas. */
export const MINIO_TEMPLATES_BUCKET = process.env.MINIO_TEMPLATES_BUCKET || "deasy-templates";

/** Formato del contrato ejecutable (el único editable por el admin). */
export const CONTRACT_FORMAT = "jinja2";

/**
 * Único subárbol editable por el admin (contenido LaTeX). Todo lo demás del contrato es
 * protegido y se verifica por hash.
 */
export const EDITABLE_CONTENT_SUBPATH = `template/${CONTRACT_FORMAT}/Contenido/`;
