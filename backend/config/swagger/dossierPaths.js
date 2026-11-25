// Paths OpenAPI de las secciones del dossier.
//
// Antes eran ~530 líneas de bloques CRUD casi idénticos repetidos por sección
// (Sonar los marcaba como 467 líneas duplicadas). Aquí la ESTRUCTURA repetida
// (parámetro cédula, requestBody, responses) se factoriza en helpers, y lo que de
// verdad varía —los textos, con su género gramatical, y qué operaciones tiene cada
// sección— vive explícito en la tabla SECTIONS. La estructura es genuinamente
// irregular: solo `titulos` tiene PUT; `experiencia` no tiene ruta de item.
//
// El objeto que produce este módulo es idéntico byte a byte al literal que había en
// index.js (verificado contra /deasy/docs.json), así que la API documentada no cambia.

import { PATHS } from "../apiPaths.js";

const DOSSIER_TAGS = ["Dossier"];

const cedulaParam = {
  name: "cedula",
  in: "path",
  required: true,
  schema: { type: "string" },
  description: "Cédula del usuario",
  example: "0954321876",
};

const idParam = (name, description, example) => ({
  name,
  in: "path",
  required: true,
  schema: { type: "string" },
  description,
  example,
});

const jsonBody = (schemaRef) => ({
  required: true,
  content: { "application/json": { schema: { $ref: `#/components/schemas/${schemaRef}` } } },
});

const jsonResponse = (description, schemaRef) => ({
  description,
  content: { "application/json": { schema: { $ref: `#/components/schemas/${schemaRef}` } } },
});

// POST sobre la colección: crea un elemento de la sección.
const postOperation = ({ summary, description, requestRef, created }) => ({
  post: {
    tags: DOSSIER_TAGS,
    summary,
    description,
    parameters: [cedulaParam],
    requestBody: jsonBody(requestRef),
    responses: {
      "200": jsonResponse(created, "SuccessResponse"),
      "400": jsonResponse("Error de validación", "ErrorResponse"),
    },
  },
});

// PUT sobre el item: actualiza un elemento existente.
const putOperation = ({ summary, description, idName, idDescription, idExample, requestRef, updated, notFound }) => ({
  put: {
    tags: DOSSIER_TAGS,
    summary,
    description,
    parameters: [cedulaParam, idParam(idName, idDescription, idExample)],
    requestBody: jsonBody(requestRef),
    responses: {
      "200": jsonResponse(updated, "SuccessResponse"),
      "404": jsonResponse(notFound, "ErrorResponse"),
    },
  },
});

// DELETE sobre el item: elimina un elemento existente (sin cuerpo).
const deleteOperation = ({ summary, description, idName, idDescription, idExample, removed, notFound }) => ({
  delete: {
    tags: DOSSIER_TAGS,
    summary,
    description,
    parameters: [cedulaParam, idParam(idName, idDescription, idExample)],
    responses: {
      "200": jsonResponse(removed, "SuccessResponse"),
      "404": jsonResponse(notFound, "ErrorResponse"),
    },
  },
});

// Cada sección declara sus textos y qué operaciones expone. `collection` siempre es
// un POST; `item` (opcional) agrupa put/delete sobre /{cedula}/<path>/{idName}.
const SECTIONS = [
  {
    path: "titulos",
    idName: "tituloId",
    idExample: "661f1b34fe5ed4e7a4a3f1c3",
    collection: {
      summary: "Agregar título académico",
      description: "Agrega un nuevo título académico al dossier del usuario.",
      requestRef: "TituloRequest",
      created: "Título agregado exitosamente",
    },
    item: {
      put: {
        summary: "Actualizar título académico",
        description: "Actualiza un título académico existente en el dossier.",
        idDescription: "ID del título a actualizar",
        requestRef: "TituloRequest",
        updated: "Título actualizado exitosamente",
        notFound: "Título no encontrado",
      },
      delete: {
        summary: "Eliminar título académico",
        description: "Elimina un título académico del dossier.",
        idDescription: "ID del título a eliminar",
        removed: "Título eliminado exitosamente",
        notFound: "Título no encontrado",
      },
    },
  },
  {
    path: "experiencia",
    collection: {
      summary: "Agregar experiencia laboral",
      description: "Agrega una nueva experiencia laboral al dossier del usuario.",
      requestRef: "ExperienciaRequest",
      created: "Experiencia agregada exitosamente",
    },
  },
  {
    path: "referencias",
    idName: "referenciaId",
    idExample: "661f1b34fe5ed4e7a4a3f1c4",
    collection: {
      summary: "Agregar referencia",
      description: "Agrega una nueva referencia (laboral, personal o familiar) al dossier del usuario.",
      requestRef: "ReferenciaRequest",
      created: "Referencia agregada exitosamente",
    },
    item: {
      delete: {
        summary: "Eliminar referencia",
        description: "Elimina una referencia del dossier.",
        idDescription: "ID de la referencia a eliminar",
        removed: "Referencia eliminada exitosamente",
        notFound: "Referencia no encontrada",
      },
    },
  },
  {
    path: "formacion",
    idName: "formacionId",
    idExample: "661f1b34fe5ed4e7a4a3f1c5",
    collection: {
      summary: "Agregar formación/capacitación",
      description: "Agrega un nuevo registro de formación o capacitación al dossier del usuario.",
      requestRef: "FormacionRequest",
      created: "Formación agregada exitosamente",
    },
    item: {
      delete: {
        summary: "Eliminar formación/capacitación",
        description: "Elimina un registro de formación o capacitación del dossier.",
        idDescription: "ID de la formación a eliminar",
        removed: "Formación eliminada exitosamente",
        notFound: "Formación no encontrada",
      },
    },
  },
  {
    path: "certificaciones",
    idName: "certificacionId",
    idExample: "661f1b34fe5ed4e7a4a3f1c6",
    collection: {
      summary: "Agregar certificación",
      description: "Agrega una nueva certificación o reconocimiento al dossier del usuario.",
      requestRef: "CertificacionRequest",
      created: "Certificación agregada exitosamente",
    },
    item: {
      delete: {
        summary: "Eliminar certificación",
        description: "Elimina una certificación del dossier.",
        idDescription: "ID de la certificación a eliminar",
        removed: "Certificación eliminada exitosamente",
        notFound: "Certificación no encontrada",
      },
    },
  },
];

const buildDossierPaths = () => {
  const paths = {
    // GET del dossier completo: no encaja en el patrón de secciones (es de lectura
    // sobre /{cedula}), así que se declara aparte.
    [`${PATHS.dossier}/{cedula}`]: {
      get: {
        tags: DOSSIER_TAGS,
        summary: "Obtener dossier completo del usuario",
        description:
          "Obtiene el dossier académico completo del usuario por su cédula. Si no existe, lo crea automáticamente.",
        parameters: [cedulaParam],
        responses: {
          "200": jsonResponse("Dossier obtenido exitosamente", "DossierResponse"),
          "404": jsonResponse("Usuario no encontrado", "ErrorResponse"),
        },
      },
    },
  };

  for (const section of SECTIONS) {
    paths[`${PATHS.dossier}/{cedula}/${section.path}`] = postOperation(section.collection);

    if (!section.item) continue;
    const itemPath = `${PATHS.dossier}/{cedula}/${section.path}/{${section.idName}}`;
    const operations = {};
    if (section.item.put) {
      Object.assign(operations, putOperation({
        ...section.item.put,
        idName: section.idName,
        idExample: section.idExample,
      }));
    }
    if (section.item.delete) {
      Object.assign(operations, deleteOperation({
        ...section.item.delete,
        idName: section.idName,
        idExample: section.idExample,
      }));
    }
    paths[itemPath] = operations;
  }

  return paths;
};

export const dossierPaths = buildDossierPaths();
