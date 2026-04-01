import fs from "fs";
import path from "path";

import {
  ROOT_DIR,
  SOURCE_DIR,
  SEEDS_DIR,
  DIST_ROOT,
  DEFAULT_SEED,
  createTemplate,
  createVersion,
  renderTemplate,
  renderSeedPreview,
  renderDataJson,
  prepareRuntimePayload,
  syncCatalog,
  packageTemplates,
  publishTemplates,
  publishSeeds,
} from "../cli.mjs";

function walkFiles(baseDir, predicate, found = []) {
  if (!fs.existsSync(baseDir)) return found;
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    const current = path.join(baseDir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(current, predicate, found);
      continue;
    }
    if (predicate(current)) found.push(current);
  }
  return found;
}

function getYamlScalar(content, key) {
  const match = String(content || "").match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  if (!match) return "";
  let value = match[1].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return value;
}

export function listTemplateVersions() {
  const metaFiles = walkFiles(SOURCE_DIR, (file) => path.basename(file) === "meta.yaml").sort();
  return metaFiles.map((metaPath) => {
    const baseDir = path.dirname(metaPath);
    const version = path.basename(baseDir);
    const key = path.relative(SOURCE_DIR, path.dirname(baseDir)).replace(/\\/g, "/");
    const metaContent = fs.readFileSync(metaPath, "utf8");
    return {
      key,
      version,
      name: getYamlScalar(metaContent, "name") || key,
      path: baseDir,
    };
  });
}

export function listTemplateKeys() {
  const map = new Map();
  for (const entry of listTemplateVersions()) {
    if (!map.has(entry.key)) {
      map.set(entry.key, {
        key: entry.key,
        name: entry.name,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key, "es"));
}

export function listVersionsForKey(key) {
  return listTemplateVersions()
    .filter((entry) => entry.key === key)
    .sort((a, b) => a.version.localeCompare(b.version, "es"));
}

export function listSeeds() {
  const found = [];
  function walk(baseDir) {
    if (!fs.existsSync(baseDir)) return;
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    const hasSrc = fs.existsSync(path.join(baseDir, "src"));
    const hasDefaults = fs.existsSync(path.join(baseDir, "defaults.yaml"));
    if (hasSrc && hasDefaults) {
      found.push({
        code: path.relative(SEEDS_DIR, baseDir).replace(/\\/g, "/"),
        path: baseDir,
      });
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        walk(path.join(baseDir, entry.name));
      }
    }
  }
  walk(SEEDS_DIR);
  return found.sort((a, b) => a.code.localeCompare(b.code, "es"));
}

export function getDefaultSeed() {
  return DEFAULT_SEED;
}

export function getPathsSummary() {
  return {
    rootDir: ROOT_DIR,
    sourceDir: SOURCE_DIR,
    seedsDir: SEEDS_DIR,
    distRoot: DIST_ROOT,
  };
}

export const templateActions = {
  createTemplate,
  createVersion,
  renderTemplate,
  renderSeedPreview,
  renderDataJson,
  prepareRuntimePayload,
  syncCatalog,
  packageTemplates,
  publishTemplates,
  publishSeeds,
};
