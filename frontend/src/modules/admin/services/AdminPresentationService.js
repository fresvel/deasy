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

  formatPositionType(value) {
    if (value === null || value === undefined || value === "") {
      return "—";
    }
    return {
      real: "Real",
      promocion: "Promocion",
      simbolico: "Simbolico"
    }[value] || value;
  }

  formatSelectOptionLabel(field, value) {
    if (field?.name === "source_type") {
      return {
        unit_type: "Tipo de unidad",
        cargo: "Cargo",
        unit_type_cargo: "Tipo de unidad y cargo",
        default: "Predeterminada"
      }[value] || value;
    }
    if (field?.name === "unit_scope_type") {
      return {
        unit_exact: "Unidad exacta",
        unit_subtree: "Unidad y descendientes",
        unit_type: "Tipo de unidad",
        all_units: "Todas las unidades"
      }[value] || value;
    }
    if (field?.name === "recipient_policy") {
      return {
        all_matches: "Todos los puestos coincidentes",
        one_per_unit: "Un puesto por unidad",
        exact_position: "Puesto exacto"
      }[value] || value;
    }
    if (field?.name === "scope") {
      return {
        owner: "Propietario",
        collaborator: "Operativo"
      }[value] || value;
    }
    return value;
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
    const normalized = String(value).replace(/\\/g, "/").replace(/\/+$/g, "");
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

  getAvailableFormatBadgeStyle(mode, entry) {
    const color = this.getDefaultAvailableFormatColor(mode, entry?.format);
    const backgroundColor = this.toRgbaFromHex(color, 0.2);
    const borderColor = this.toRgbaFromHex(color, 0.44);
    return {
      color,
      backgroundColor: backgroundColor || undefined,
      borderColor: borderColor || undefined
    };
  }

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

  toRgbaFromHex(hex, alpha) {
    const expanded = this.expandHexColor(hex);
    if (!expanded || expanded.length !== 6) {
      return "";
    }
    const red = Number.parseInt(expanded.slice(0, 2), 16);
    const green = Number.parseInt(expanded.slice(2, 4), 16);
    const blue = Number.parseInt(expanded.slice(4, 6), 16);
    if ([red, green, blue].some((value) => Number.isNaN(value))) {
      return "";
    }
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  getDefaultAvailableFormatColor(mode, format) {
    // El color se determina por formato (el formato es único; el rol/"mode" ya no discrimina).
    return {
      jinja2: "#18b7a3",
      latex: "#8b5cf6",
      docx: "#2563eb",
      pdf: "#ef4444",
      xlsx: "#16a34a"
    }[String(format || "").toLowerCase()] || "#8a94a6";
  }

  getFirstDefinedValue(...values) {
    const match = values.find((value) => value !== null && value !== undefined && value !== "");
    return match !== undefined ? String(match) : "—";
  }
}

export const adminPresentationService = new AdminPresentationService();
