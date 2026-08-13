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

// --- Balance de bloques Jinja (§0.4 S4) ---------------------------------------------------------
//
// ESTO NO ES UN PARSER JINJA, Y NO HAY QUE CONFUNDIRLO CON UNO. No hay motor de Jinja en el backend
// (el render corre fuera, en `make.sh`, con una imagen de Python), así que no se puede compilar la
// plantilla para validarla. Lo único que se comprueba aquí es que **cada bloque que se abre se
// cierra, en el orden correcto**. No valida expresiones, ni nombres de variable, ni filtros, ni
// tipos: una plantilla que pase esto puede seguir reventando al renderizar. Lo que evita es el fallo
// concreto que hoy se publica sin que nadie mire — un `[[% for %]]` sin su `[[% endfor %]]` — y que
// revienta en render, cuando ya es tarde.
//
// ⚠️ LOS DELIMITADORES NO SON LOS DE JINJA POR DEFECTO. Comprobado en
// `services/system/seeds/informe-general/src/make.sh`, que construye el `Environment`:
//     block_start_string="[[%"   block_end_string="%]]"   comment_start_string="[[#"
// Las expresiones sí son las de serie, `{{ … }}`.
//
// Y LAS EXPRESIONES NO SE COMPRUEBAN, A PROPÓSITO: el contenido es LaTeX, donde `{{` y `}}` son
// llaves normales y frecuentísimas (`\newcommand{\x}{{\bf y}}`). Contarlas daría falsos positivos a
// puñados sobre plantillas correctas, que es peor que no mirar.
const JINJA_BLOCK_TAG = /\[\[%[-+]?\s*(\w+)/g;
const JINJA_COMMENT = /\[\[#[\s\S]*?#\]\]/g;

// Etiquetas que abren un bloque, con la que lo cierra. `raw` va incluida como par: no se suprime lo
// que hay dentro, que es otra de las cosas que un parser haría y esto no.
const JINJA_BLOCK_PAIRS = {
  if: "endif",
  for: "endfor",
  block: "endblock",
  macro: "endmacro",
  call: "endcall",
  filter: "endfilter",
  raw: "endraw",
  with: "endwith",
  trans: "endtrans",
  autoescape: "endautoescape",
  set: "endset",
};
const JINJA_CLOSERS = new Set(Object.values(JINJA_BLOCK_PAIRS));
// Etiquetas de continuación: no abren ni cierran, pero tienen que caer DENTRO de algo.
const JINJA_MIDDLE = new Set(["else", "elif"]);

// Devuelve la lista de desbalances (vacía = OK), con el mismo formato `ruta: motivo` que
// `sanitizeLatexSource`, para que las dos barreras acumulen en la misma lista de violaciones.
export const checkJinjaBlockBalance = (relpath, text) => {
  const violations = [];
  const source = String(text ?? "").replace(JINJA_COMMENT, "");

  // Una apertura de bloque sin su cierre de delimitador se come el resto del fichero en el render.
  const aperturas = (source.match(/\[\[%/g) || []).length;
  const cierres = (source.match(/%\]\]/g) || []).length;
  if (aperturas !== cierres) {
    violations.push(`${relpath}: hay ${aperturas} "[[%" y ${cierres} "%]]" — falta cerrar un delimitador de bloque`);
    return violations;
  }

  const pila = [];
  JINJA_BLOCK_TAG.lastIndex = 0;
  let match;
  while ((match = JINJA_BLOCK_TAG.exec(source)) !== null) {
    const tag = match[1];
    if (JINJA_CLOSERS.has(tag)) {
      const abierto = pila.pop();
      if (!abierto) {
        violations.push(`${relpath}: "${tag}" sin bloque abierto que cerrar`);
      } else if (JINJA_BLOCK_PAIRS[abierto] !== tag) {
        violations.push(`${relpath}: "${tag}" cierra un bloque "${abierto}", que esperaba "${JINJA_BLOCK_PAIRS[abierto]}"`);
      }
      continue;
    }
    if (JINJA_MIDDLE.has(tag)) {
      // `else` vale dentro de un `if` y también dentro de un `for` (Jinja lo permite).
      const abierto = pila.at(-1);
      if (abierto !== "if" && abierto !== "for") {
        violations.push(`${relpath}: "${tag}" fuera de un bloque "if" o "for"`);
      }
      continue;
    }
    if (!Object.hasOwn(JINJA_BLOCK_PAIRS, tag)) {
      continue; // `include`, `extends`, `import`, `do`… no abren bloque.
    }
    // `set` es las dos cosas: `[[% set x = 1 %]]` es una asignación suelta y no abre nada;
    // `[[% set x %]]…[[% endset %]]` sí. Los distingue el `=`, que es la regla real de Jinja.
    if (tag === "set") {
      const cierre = source.indexOf("%]]", match.index);
      const cuerpo = cierre === -1 ? "" : source.slice(match.index, cierre);
      if (cuerpo.includes("=")) continue;
    }
    pila.push(tag);
  }

  for (const abierto of pila.reverse()) {
    violations.push(`${relpath}: bloque "${abierto}" sin cerrar (falta "${JINJA_BLOCK_PAIRS[abierto]}")`);
  }
  return violations;
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

