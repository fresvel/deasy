import path from "path";

const normalizeRelativePath = (value) => String(value || "").replace(/^\/+/, "");

const ALLOWED_SOURCE_EXTENSIONS = new Set([
  ".j2",
  ".tex",
  ".cls",
  ".sty",
  ".bib",
  ".png",
  ".jpg",
  ".jpeg",
  ".pdf",
  ".svg",
  ".ttf",
  ".otf",
  ".yaml",
  ".yml",
  ".json",
  ".csv",
  ".txt",
]);

const FORBIDDEN_SOURCE_BASENAMES = new Set([
  "make.sh",
]);

export const shouldMaterializeSourceFile = (relativePath) => {
  const normalized = normalizeRelativePath(relativePath);
  if (!normalized) {
    return false;
  }

  const basename = path.basename(normalized).toLowerCase();
  if (FORBIDDEN_SOURCE_BASENAMES.has(basename)) {
    return false;
  }

  const extension = path.extname(normalized).toLowerCase();
  return ALLOWED_SOURCE_EXTENSIONS.has(extension);
};
