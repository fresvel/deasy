// Artefactos de plantilla: parsing de meta, saneo LaTeX y selección de PDF de vista previa.
//
// Extraído de SqlAdminService.js. Funciones puras (sin BD ni this). `sanitizeLatexSource`
// es la barrera anti-inyección del contenido LaTeX editable por el admin.
//
// AQUÍ VIVÍAN LAS MARCAS DE PROCEDENCIA del sync (`artifact_sync_fill:` /
// `artifact_sync_signature:`), su constructor, su parser y los dos predicados de `sync_mode`. Los
// borra el sub-paso 8 del §0.8 junto con `WorkflowSyncService`: eran la forma de reconocer los
// flujos que el sync proyectaba al vínculo y de detectar cuándo se habían quedado desfasados. Sin
// proyección no hay procedencia que marcar ni deriva que detectar.
//
// Y con la retirada del `meta.yaml` del paquete se va también `parseYamlDocument`, que solo servía
// para leerlo: su único llamador era `loadTemplateArtifactMetaDocument`. Con él sale la dependencia
// `js-yaml` del grafo de módulos del backend — era su última importación.

// Saneo anti-inyección del contenido LaTeX editable. Devuelve la lista de violaciones (vacía = OK).
export const sanitizeLatexSource = (relpath, text) => {
  const violations = [];
  const forbidden = [
    [/\\write18/, "shell-escape (\\write18)"],
    [/\\(directlua|latelua)\b/, "ejecución Lua (\\directlua/\\latelua)"],
    [/\\openout\b/, "\\openout (escritura de archivos)"],
    [/\\openin\b/, "\\openin (lectura de archivos)"],
    [/\\special\s*\{\s*(?:dvips:\s*)?[!`|]/, "\\special con comando"],
    [/\\ShellEscape\b/, "\\ShellEscape"],
  ];
  for (const [re, label] of forbidden) {
    if (re.test(text)) violations.push(`${relpath}: ${label}`);
  }
  // \input/\include/\includegraphics/... con pipe, ruta absoluta o que escape del árbol (..)
  const pathCmd = /\\(input|include|includegraphics|InputIfFileExists|import|subimport|usepackage)\b\s*(?:\[[^\]]*\])?\s*\{([^}]*)\}/g;
  let match;
  while ((match = pathCmd.exec(text)) !== null) {
    const target = String(match[2] || "").trim();
    if (/^[|`!]/.test(target) || target.startsWith("/") || target.includes("..") || /^[a-zA-Z]:[\\/]/.test(target)) {
      violations.push(`${relpath}: ruta no permitida en \\${match[1]}{${target}}`);
    }
  }
  return violations;
};

// --- Política de tipos de los adjuntos de plantilla (§0.4 S3) -----------------------------------
//
// QUÉ DECIDE, Y POR QUÉ LA EXTENSIÓN ES EL CONTROL. `_materializeDraftFormats`
// (`templateLifecycle.js`) construye el nombre del objeto de MinIO con
// `path.extname(file.originalname)`, **sin comprobarlo**. Es decir: la extensión que escribe el
// cliente decide el nombre del fichero que acaba publicado. Medido antes de escribir esto
// (experimento desechable): un `payload.sh` enviado por el campo `pdf_file` da **200** y acaba en
// `System/draft_.../template/pdf/payload.sh`. Y `sendResourcesAsZip` (`utils/templateArchive.js`)
// le pone **modo 0755** al empaquetarlo, junto al `make.sh` que al admin se le pide ejecutar.
//
// Por eso el gate es la EXTENSIÓN y no el mimetype: el mimetype lo declara el cliente y no influye
// en dónde acaba el fichero, así que aceptar por mimetype dejaría el agujero abierto entero (basta
// mandar `payload.sh` con `Content-Type: application/pdf`). El mimetype se comprueba **además**,
// como cordura, con `application/octet-stream` tolerado porque es lo que mandan varios clientes
// para cualquier binario.
//
// Un campo desconocido se rechaza: la lista de campos es cerrada y la fija el router.
const DRAFT_ARTIFACT_FILE_POLICY = {
  pdf_file: {
    extensions: [".pdf"],
    mimetypes: ["application/pdf"],
    label: "PDF",
  },
  docx_file: {
    extensions: [".docx"],
    mimetypes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    label: "Word (.docx)",
  },
  xlsx_file: {
    extensions: [".xlsx"],
    mimetypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    label: "Excel (.xlsx)",
  },
  pptx_file: {
    extensions: [".pptx"],
    mimetypes: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    label: "PowerPoint (.pptx)",
  },
  // La re-subida de código (`POST /template_artifacts/:id/source`) comparte instancia de multer con
  // el borrador, así que su campo va en el mismo mapa. `applyTemplateArtifactSource` ya lo trata
  // como ZIP (`unzipToDirectory`); antes ni siquiera se comprobaba que lo fuera.
  source: {
    extensions: [".zip"],
    mimetypes: ["application/zip", "application/x-zip-compressed", "application/x-compressed"],
    label: "ZIP",
  },
};

const GENERIC_BINARY_MIMETYPE = "application/octet-stream";

// Devuelve `null` si el fichero es aceptable, o el MOTIVO en castellano si no lo es.
// Pura a propósito: el `fileFilter` de multer es transporte y no debe llevar la política dentro.
export const describeRejectedDraftArtifactFile = ({ fieldname, originalname, mimetype } = {}) => {
  const policy = DRAFT_ARTIFACT_FILE_POLICY[String(fieldname || "")];
  if (!policy) {
    return `No se esperaba ningun archivo en el campo "${fieldname}".`;
  }
  const name = String(originalname || "").toLowerCase();
  if (!policy.extensions.some((extension) => name.endsWith(extension))) {
    return `El campo "${fieldname}" solo admite ${policy.label}: ${policy.extensions.join(", ")}.`;
  }
  const declared = String(mimetype || "").toLowerCase();
  if (declared && declared !== GENERIC_BINARY_MIMETYPE && !policy.mimetypes.includes(declared)) {
    return `El campo "${fieldname}" solo admite ${policy.label}; el archivo se declaro como "${mimetype}".`;
  }
  return null;
};

export const parseAvailableFormats = (value) => {
  if (!value) {
    return {};
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return {};
  }
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
};

export const findPreferredPdfObject = (objectNames = []) => {
  const pdfCandidates = (objectNames || []).filter((name) => /\.pdf$/i.test(String(name || "")));
  if (!pdfCandidates.length) {
    return null;
  }
  const preferredMatchers = [
    /\/render\/output\/pdf\/.+\.pdf$/i,
    /\/render\/.+\.pdf$/i,
    /\/preview\/.+\.pdf$/i,
    /\.pdf$/i
  ];
  for (const matcher of preferredMatchers) {
    const match = pdfCandidates.find((name) => matcher.test(name));
    if (match) {
      return match;
    }
  }
  return pdfCandidates[0];
};

