class AdminPresentationService {
  formatDateOnly(value) {
    if (!value) {
      return "—";
    }
    if (typeof value === "string") {
      const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
      if (match) {
        return match[1];
      }
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return `${date.getFullYear()}-${this.pad2(date.getMonth() + 1)}-${this.pad2(date.getDate())}`;
  }

  formatDateTimeHour(value) {
    if (!value) {
      return "—";
    }
    if (typeof value === "string") {
      const match = value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2})/);
      if (match) {
        return `${match[1]} ${match[2]}`;
      }
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return `${date.getFullYear()}-${this.pad2(date.getMonth() + 1)}-${this.pad2(date.getDate())} ${this.pad2(date.getHours())}`;
  }

  /* Escribia «Promocion» y «Simbolico» SIN TILDE mientras `UnitGraphView` y `HomeView` escribian
     las mismas tres palabras CON tilde. Ahora las tres salen del vocabulario unico, acentuadas. */
  formatPositionType(value) {
    if (value === null || value === undefined || value === "") {
      return "—";
    }
    return this.formatSelectOptionLabel({ name: "position_type" }, value);
  }

  /* EL VOCABULARIO DE LAS CLASIFICACIONES, EN UN SOLO SITIO.
   *
   * Hasta el 2026-08-20 esto era una cadena de cuatro `if` y conocia **4 de los 20 campos de
   * clasificacion** que declara `sqlTables.js`: los otros 16 salian en `snake_case` INGLES en
   * la tabla de admin (`routed`, `auto_one`, `task_assignee`, `process_defined`, `at_least`…).
   * No se noto mientras eran texto plano; al pasar a pastilla se ve, que es justo lo que una
   * pastilla hace bien.
   *
   * ⚠️ NINGUNA DE ESTAS PALABRAS ES INVENTADA: todas salen de donde la aplicacion YA las decia
   * —los `<option>` del asistente de plantilla, `itemModeLabel` del panel de artefactos y
   * `APPROVAL_LABEL` del modal de borrador—, porque inventar un segundo nombre para el mismo
   * codigo es la enfermedad que este frente lleva cuatro fases matando.
   *
   * ⚠️ Y hay divergencias CONOCIDAS que NO se tocan aqui porque son de otro contexto:
   * `UnitGraphView` llama `unit_exact` «Esta unidad» donde esta tabla dice «Unidad exacta».
   * Son cinco diccionarios de etiqueta repartidos por el frontend; unificarlos es trabajo
   * aparte y esta anotado.
   *
   * ✅ Una de esas divergencias SE CERRO el 2026-08-23, y no cambiando la etiqueta: el codigo
   * que la sostenia no existia. `one_per_unit` se llamaba «Un puesto por unidad» aqui y
   * «Jefatura de la unidad» en el organigrama, y no hacia ninguna de las dos —cogia el puesto
   * de menor `slot_no`—. Ahora es `unit_head`, hace lo que dice, y tiene UN solo nombre. */
  static SELECT_OPTION_LABELS = {
    scope: { owner: "Propietario", collaborator: "Operativo" },
    source_type: { unit_type: "Tipo de unidad", cargo: "Cargo", default: "Predeterminada" },
    unit_scope_type: {
      unit_exact: "Unidad exacta",
      unit_subtree: "Unidad y descendientes",
      unit_type: "Tipo de unidad",
      all_units: "Todas las unidades",
      context_exact: "Unidad del contexto"
    },
    recipient_policy: {
      all_matches: "Todos los puestos coincidentes",
      unit_head: "Jefatura de la unidad",
      exact_position: "Puesto exacto"
    },
    run_mode: { automatic: "Automatica", manual: "Manual" },
    origin_kind: { process_defined: "Definido por el proceso", user_added: "Añadido por el usuario" },
    template_scope: { official: "Oficial", ad_hoc: "Ad hoc" },
    item_mode: { single: "Simple", replicated: "Replicado", routed: "Ruteado" },
    source: { manual: "Manual", derived: "Derivado" },
    position_type: { real: "Real", promocion: "Promoción", simbolico: "Simbólico" },
    /* ⚠️ SOLO LOS TRES VIVOS, Y ES DELIBERADO. `document_owner`, `position` y `manual_pick`
       estan RETIRADOS: `postgres_schema.sql` los excluye del CHECK. Si alguno aparece en la
       tabla saldra con su codigo crudo, y eso es la señal correcta — una base sin re-bootstrap.
       Medido el 2026-08-20 en la pila B: su CHECK es el LEGACY de seis valores (se llama
       `fill_flow_steps_resolver_type_check`, no `chk_…`) y tiene 3 filas con `document_owner`.
       Darles etiqueta bonita habria disfrazado de normal un dato que no deberia existir. */
    resolver_type: {
      task_assignee: "Responsable del entregable",
      cargo_in_scope: "Por cargo",
      specific_person: "Persona concreta"
    },
    selection_mode: { auto_one: "Uno cualquiera", auto_all: "Todas", manual: "Manual" },
    approval_mode: { and: "Todas", or: "Cualquiera", at_least: "Al menos N" },
    dedication: { TC: "Tiempo completo", MT: "Medio tiempo", TP: "Tiempo parcial" },
    relation_type: { dependencia: "Dependencia", servicios: "Servicios", promocion: "Promoción" }
  };

  hasSelectOptionLabels(fieldName) {
    return Object.hasOwn(AdminPresentationService.SELECT_OPTION_LABELS, String(fieldName || ""));
  }

  formatSelectOptionLabel(field, value) {
    const mapa = AdminPresentationService.SELECT_OPTION_LABELS[field?.name];
    if (!mapa) {
      return value;
    }
    /* `dedication` son siglas en MAYUSCULA (`TC`); el resto son codigos en minuscula. Se prueba
       el valor tal cual antes de normalizar para no perder las siglas. */
    return mapa[value] ?? mapa[String(value ?? "").trim().toLowerCase()] ?? value;
  }

  prettifyFormatName(value) {
    if (value === null || value === undefined || value === "") {
      return "";
    }
    return String(value).replaceAll("_", " ");
  }

  getFileNameFromObjectKey(value) {
    if (value === null || value === undefined || value === "") {
      return "";
    }
    const normalized = String(value).replaceAll("\\", "/").replaceAll(/\/+$/g, "");
    const parts = normalized.split("/").filter(Boolean);
    const fileName = parts.length ? parts[parts.length - 1] : "";
    if (fileName.toLowerCase() === "src") {
      return "Contenido actual";
    }
    return fileName;
  }

  normalizeAvailableFormats(value) {
    if (!value) {
      return null;
    }
    let parsed = value;
    if (typeof value === "string") {
      try {
        parsed = JSON.parse(value);
      } catch {
        return null;
      }
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  }

  // El rol se deriva del formato (ya no se almacena el eje "mode"): jinja2 = contrato, latex = render,
  // el resto = documento de referencia. Espejo de FORMAT_ROLE del backend.
  formatRole(format) {
    return { jinja2: "contract", latex: "render" }[String(format || "").toLowerCase()] || "reference";
  }

  getAvailableFormatSections(value) {
    const parsed = this.normalizeAvailableFormats(value);
    if (!parsed) {
      return [];
    }
    const roleLabels = { contract: "Contrato", reference: "Referencia", render: "Render" };
    const roleOrder = ["contract", "reference", "render"];
    // available_formats es plano: { <format>: { entry_object_key } }. Se agrupa por rol derivado.
    const groups = {};
    for (const [format, meta] of Object.entries(parsed)) {
      if (!format || !meta || typeof meta !== "object" || Array.isArray(meta)) {
        continue;
      }
      const role = this.formatRole(format);
      (groups[role] = groups[role] || []).push({
        format,
        formatLabel: this.prettifyFormatName(format),
        entryObjectKey: meta.entry_object_key || meta.entryObjectKey || ""
      });
    }
    return roleOrder
      .filter((role) => groups[role]?.length)
      .map((role) => ({
        // `mode` se conserva por compatibilidad con componentes que lo usan como clave/estilo: ahora es el rol.
        mode: role,
        role,
        label: roleLabels[role] || role,
        entries: groups[role]
      }));
  }

  /* [2026-08-20 · F8] AQUI ESTABA `getAvailableFormatBadgeStyle`, Y CON EL DOS AYUDANTES:
   * `getDefaultAvailableFormatColor` —un mapa de SEIS HEX CRUDOS, `jinja2 #18b7a3`,
   * `latex #8b5cf6`, `docx #2563eb`, `pdf #ef4444`, `xlsx #16a34a`— y `toRgbaFromHex`, que los
   * convertia a `rgba()` con alfa 0.2 y 0.44 para aplicarlos como **`:style` en linea**.
   *
   * Tres cosas mal a la vez, y ninguna la veia ningun gate:
   *   1. un color decidido en JavaScript (es F8 en una linea);
   *   2. con ALFA, o sea que el resultado depende del fondo — lo mismo que `deasy-progress`
   *      documenta haber quitado;
   *   3. como estilo EN LINEA, que no es una clase y por tanto es invisible incluso a
   *      `check-orphan-classes`, que mide contra el CSS construido.
   *
   * 🪤 Y no era solo deuda: **los SEIS fallaban el contraste AA**, entre 2.10:1 y 3.89:1, porque
   * el texto iba del color puro sobre su propio tinte al 20 %. `contraste.mjs` no podia verlo: lee
   * los tokens de `tokens.css`, y esto eran hex en un `.js`. La pastilla neutral del sistema da
   * 4.51:1.
   *
   * Ahora son `<AppTag variant="neutral" outlined>`. Y el color NO se sustituye por otro: los
   * formatos son valores PARES entre si —`docx` no es mejor que `pdf`— y la doctrina de F9.D dice
   * que una clasificacion no toma tonos de juicio. Ademas dos de aquellos colores mentian: `pdf`
   * en ROJO y `xlsx` en VERDE gastaban los dos colores que en este sistema significan error y
   * exito. Lo que distingue un formato de otro es su ETIQUETA, que ya la lleva escrita. */

  formatAvailableFormatsSummary(value) {
    const parts = this.getAvailableFormatSections(value).map(
      (section) => `${section.label}: ${section.entries.map((entry) => entry.formatLabel).join(", ")}`
    );
    return parts.length ? parts.join(" | ") : "—";
  }

  formatFkOptionLabel(tableName, row, getFkCachedLabel) {
    if (!row) {
      return "—";
    }
    if (tableName === "process_definition_versions") {
      const parts = [row.variation_key, row.definition_version, row.name]
        .filter((part) => part !== null && part !== undefined && String(part).trim() !== "");
      if (parts.length) {
        return parts.join(" · ");
      }
    }
    if (tableName === "process_definition_templates") {
      const parts = [
        row.process_definition_id ? `Def ${row.process_definition_id}` : null,
        row.template_artifact_id
          ? (getFkCachedLabel("template_artifacts", row.template_artifact_id) || `Paquete ${row.template_artifact_id}`)
          : null
      ].filter((part) => part !== null && part !== undefined && String(part).trim() !== "");
      if (parts.length) {
        return parts.join(" · ");
      }
    }
    if (tableName === "template_artifacts") {
      return this.getFirstDefinedValue(row.display_name, row.template_code, row.id);
    }
    if (tableName === "template_seeds") {
      return this.getFirstDefinedValue(row.display_name, row.seed_code, row.id);
    }
    return this.getFirstDefinedValue(
      row.name,
      row.title,
      row.email,
      row.label,
      row.code,
      row.slug,
      row.id
    );
  }

  pad2(value) {
    return String(value).padStart(2, "0");
  }

  expandHexColor(hex) {
    if (!hex) {
      return "";
    }
    const normalized = hex.replace("#", "");
    if (normalized.length === 3) {
      return normalized
        .split("")
        .map((char) => `${char}${char}`)
        .join("");
    }
    return normalized;
  }

getFirstDefinedValue(...values) {
    const match = values.find((value) => value !== null && value !== undefined && value !== "");
    return match !== undefined ? String(match) : "—";
  }
}

export const adminPresentationService = new AdminPresentationService();
