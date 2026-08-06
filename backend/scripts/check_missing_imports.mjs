#!/usr/bin/env node
// Detector de "símbolo movido pero no importado".
//
// POR QUÉ EXISTE. La serie de refactors Extract Class (cuts #1-#7 de SqlAdminService, y antes
// user_controler y TaskGenerationService) mueve helpers a módulos hermanos. Si al mover uno se
// olvida su `import` en el fichero que lo usa, NADA lo detecta:
//
//   - `node --check` valida SINTAXIS: un identificador libre es sintaxis válida.
//   - El backend ARRANCA sin quejarse: el módulo carga, el fallo es en tiempo de LLAMADA.
//   - Los tests solo lo ven si cubren esa ruta concreta.
//
// Resultado real: cuatro `ReferenceError` en producción vivieron semanas sin que nadie lo notara
// (createUnitWithParent, getCargoCodeMap, getNextStorageVersionForTemplateCode,
// loadTemplateArtifactMetaDocument), introducidos por los cuts #2, #3 y #6.
//
// QUÉ COMPRUEBA. Construye el vocabulario de todo lo que EXPORTA cada módulo del backend y busca
// usos de esos nombres como llamada en ficheros que ni los importan ni los declaran. Es un
// detector ACOTADO a esta clase de fallo, no un linter: por eso no da falsos positivos con
// parámetros, variables locales ni globals de Node.
//
// Uso:  node scripts/check_missing_imports.mjs      (npm run check:imports)
// Sale con código 1 si encuentra algo, para poder usarlo como puerta en CI.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set(["node_modules", ".git", "tests", "scripts", "storage"]);

const collectFiles = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) collectFiles(path.join(dir, entry.name), out);
    } else if (entry.name.endsWith(".js") && !entry.name.endsWith(".test.js")) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
};

const exportedNames = (source) => {
  const names = new Set();
  for (const m of source.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of source.matchAll(/export\s+(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of source.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const raw of m[1].split(",")) {
      const name = raw.trim().split(" as ").pop().trim();
      if (name) names.add(name);
    }
  }
  return names;
};

const importedNames = (source) => {
  const names = new Set();
  const re = /import\s+(?:([A-Za-z_$][\w$]*)\s*,\s*)?(?:\{([^}]*)\}|([A-Za-z_$][\w$]*))\s+from/g;
  for (const m of source.matchAll(re)) {
    if (m[1]) names.add(m[1]);
    if (m[3]) names.add(m[3]);
    if (m[2]) {
      for (const raw of m[2].split(",")) {
        const name = raw.trim().split(" as ").pop().trim();
        if (name) names.add(name);
      }
    }
  }
  return names;
};

// Declaraciones del propio fichero: funciones, const/let/var/class y métodos de clase.
const declaredNames = (source) => {
  const names = new Set();
  for (const m of source.matchAll(/(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of source.matchAll(/(?:^|\n)\s*(?:export\s+)?(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of source.matchAll(/(?:^|\n)\s+(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g)) names.add(m[1]);
  return names;
};

const files = collectFiles(BACKEND_ROOT);
const sources = new Map(files.map((file) => [file, fs.readFileSync(file, "utf8")]));

const owners = new Map();
for (const [file, source] of sources) {
  for (const name of exportedNames(source)) {
    if (!owners.has(name)) owners.set(name, new Set());
    owners.get(name).add(file);
  }
}

const findings = [];
for (const [file, source] of sources) {
  const imported = importedNames(source);
  const declared = declaredNames(source);
  // Se quitan las líneas de import para no confundir la declaración con un uso.
  const body = source.replace(/import\s[^;]+;/g, "");
  const lines = body.split("\n");

  for (const [name, ownerFiles] of owners) {
    if (imported.has(name) || declared.has(name) || ownerFiles.has(file)) continue;
    // Uso como LLAMADA y no como propiedad (`this.x(` / `obj.x(` no cuentan).
    const usage = new RegExp(`(?<![.\\w$])${name}\\s*\\(`);
    if (!usage.test(body)) continue;
    const line = lines.findIndex((l) => usage.test(l)) + 1;
    findings.push({
      file: path.relative(BACKEND_ROOT, file),
      line,
      name,
      owners: [...ownerFiles].map((f) => path.relative(BACKEND_ROOT, f)),
    });
  }
}

if (!findings.length) {
  console.log(`check:imports OK — ${files.length} ficheros, ningún símbolo usado sin importar.`);
  process.exit(0);
}

console.error(`check:imports FALLA — ${findings.length} símbolo(s) usado(s) sin importar:\n`);
for (const finding of findings.sort((a, b) => a.file.localeCompare(b.file))) {
  console.error(`  ${finding.file}:${finding.line}`);
  console.error(`      ${finding.name}  →  falta importarlo de ${finding.owners.join(" o ")}\n`);
}
process.exit(1);
