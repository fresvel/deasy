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
    if (field?.name === "artifact_origin") {
      return {
        process: "Proceso",
        general: "General"
      }[value] || value;
    }
    if (field?.name === "usage_role" || field?.name === "template_usage_role") {
      return {
        primary: "Principal",
        attachment: "Adjunto",
        support: "Soporte"
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

  getAvailableFormatSections(value) {
    const parsed = this.normalizeAvailableFormats(value);
    if (!parsed) {
      return [];
    }
    const modeLabels = {
      process: "Proceso",
      general: "General"
    };
    return Object.entries(parsed)
      .map(([mode, formats]) => {
        if (!formats || typeof formats !== "object" || Array.isArray(formats)) {
          return null;
        }
        const entries = Object.entries(formats)
          .map(([format, meta]) => ({
            format,
            formatLabel: this.prettifyFormatName(format),
            entryObjectKey:
              meta && typeof meta === "object" && !Array.isArray(meta)
                ? meta.entry_object_key || meta.entryObjectKey || ""
                : ""
          }))
          .filter((entry) => entry.format);
        if (!entries.length) {
          return null;
        }
        return {
          mode,
          label: modeLabels[mode] || mode,
          entries
        };
      })
      .filter(Boolean);
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
          : null,
        this.formatSelectOptionLabel({ name: "usage_role" }, row.usage_role)
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
    return {
      "process:jinja2": "#18b7a3",
      "general:latex": "#8b5cf6",
      "general:docx": "#2563eb",
      "general:pdf": "#ef4444",
      "general:xlsx": "#16a34a"
    }[`${mode}:${format}`] || "#8a94a6";
  }

  getFirstDefinedValue(...values) {
    const match = values.find((value) => value !== null && value !== undefined && value !== "");
    return match !== undefined ? String(match) : "—";
  }
}

export const adminPresentationService = new AdminPresentationService();
