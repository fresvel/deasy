#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.dirname(__filename);
const REPO_ROOT = path.resolve(ROOT_DIR, "..", "..");
const SOURCE_DIR = path.join(ROOT_DIR, "templates");
const SEEDS_DIR = path.join(ROOT_DIR, "seeds", "latex");
const DIST_ROOT = path.join(ROOT_DIR, "dist", "Plantillas");
const CATALOG_PATH = path.join(ROOT_DIR, "CATALOG.yaml");
const PYTHON_DIR = path.join(ROOT_DIR, "python");
const DOCKER_DIR = path.join(REPO_ROOT, "docker");
const DEFAULT_SEED = "informe-docente";
const GENERATED_FILES = new Set([
  "main.aux",
  "main.bbl",
  "main.blg",
  "main.log",
  "main.out",
  "main.pdf",
  "report.pdf",
  "main.synctex.gz",
  "main.toc",
  "main.lof",
  "main.lot",
  "main.fls",
  "main.fdb_latexmk",
]);

function usage() {
  console.log(`Uso:
  node tools/templates/cli.mjs new --key <path> [--version 1.0.0] [--name "Nombre"] [--seed <name|path>]
  node tools/templates/cli.mjs version --key <path> --from <version> --to <version> [--name "Nombre"]
  node tools/templates/cli.mjs render --key <path> --version <version>
  node tools/templates/cli.mjs render --here
  node tools/templates/cli.mjs seed [--seed <name|path>] [--compile]
  node tools/templates/cli.mjs json --key <path> --version <version>
  node tools/templates/cli.mjs catalog
  node tools/templates/cli.mjs package
  node tools/templates/cli.mjs publish [--skip-package]

Notas:
  - La fuente vive en tools/templates/templates
  - El empaquetado genera tools/templates/dist/Plantillas
  - publish sube directo a MinIO usando docker compose + minio/mc
`);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      args._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function resolvePath(inputPath) {
  if (!inputPath) return "";
  if (path.isAbsolute(inputPath)) return inputPath;
  const fromCwd = path.resolve(process.cwd(), inputPath);
  if (fs.existsSync(fromCwd)) return fromCwd;
  return path.resolve(ROOT_DIR, inputPath);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function removeIfExists(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function copyDirContents(sourceDir, targetDir) {
  ensureDir(targetDir);
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      fs.cpSync(sourcePath, targetPath, { recursive: true });
      continue;
    }
    fs.copyFileSync(sourcePath, targetPath);
    const stat = fs.statSync(sourcePath);
    fs.chmodSync(targetPath, stat.mode);
  }
}

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

function walkDirs(baseDir, predicate, found = []) {
  if (!fs.existsSync(baseDir)) return found;
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    const current = path.join(baseDir, entry.name);
    if (!entry.isDirectory()) continue;
    if (predicate(current)) found.push(current);
    walkDirs(current, predicate, found);
  }
  return found;
}

function escapeYamlString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function getYamlScalar(content, key) {
  const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  if (!match) return "";
  let value = match[1].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return value;
}

function upsertYamlScalar(content, key, value, quote = true) {
  const serialized = quote ? `"${escapeYamlString(value)}"` : `${value}`;
  const line = `${key}: ${serialized}`;
  const pattern = new RegExp(`^${key}:\\s*.*$`, "m");
  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }
  return `${line}\n${content}`;
}

function makeExportId(templateKey) {
  return `tpl_${templateKey}`.replace(/[\/\-.]/g, "_");
}

function isVersionString(value) {
  return /^\d+\.\d+\.\d+$/.test(String(value));
}

function resolvePythonCommand() {
  for (const candidate of ["python3", "python"]) {
    const result = spawnSync(candidate, ["--version"], { stdio: "ignore" });
    if (result.status === 0) return candidate;
  }
  fail("No se encontro python3/python para renderizar templates.");
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    stdio: options.stdio ?? "inherit",
    env: options.env ?? process.env,
  });
  if (result.status !== 0) {
    fail(`Fallo el comando: ${command} ${args.join(" ")}`);
  }
}

function runPython(scriptName, args, options = {}) {
  const python = resolvePythonCommand();
  const scriptPath = path.join(PYTHON_DIR, scriptName);
  if (!fs.existsSync(scriptPath)) {
    fail(`Script python no encontrado: ${scriptPath}`);
  }
  runCommand(python, [scriptPath, ...args], options);
}

function resolveHereMetaDir() {
  const cwd = path.resolve(process.cwd());
  if (!cwd.startsWith(SOURCE_DIR)) {
    fail(`--here solo funciona dentro de ${SOURCE_DIR}`);
  }
  let current = cwd;
  while (current.startsWith(SOURCE_DIR)) {
    if (fs.existsSync(path.join(current, "meta.yaml"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  fail("No se encontro meta.yaml hacia arriba desde el directorio actual.");
}

function resolveSeedRoot(seedArg, allowHere = false) {
  if (allowHere && seedArg === true) {
    const cwd = path.resolve(process.cwd());
    if (!cwd.startsWith(SEEDS_DIR)) {
      fail(`--here solo funciona dentro de ${SEEDS_DIR}`);
    }
    let current = cwd;
    while (current.startsWith(SEEDS_DIR)) {
      if (fs.existsSync(path.join(current, "src")) && fs.existsSync(path.join(current, "defaults.yaml"))) {
        return current;
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
    fail("No se encontro una semilla valida hacia arriba desde el directorio actual.");
  }
  if (!seedArg) {
    return path.join(SEEDS_DIR, DEFAULT_SEED);
  }
  const resolved = resolvePath(seedArg);
  if (fs.existsSync(resolved)) return resolved;
  const byName = path.join(SEEDS_DIR, seedArg);
  if (fs.existsSync(byName)) return byName;
  fail(`Semilla no encontrada: ${seedArg}`);
}

function resolveTemplateVersionDir(args) {
  if (args.here === true) {
    return resolveHereMetaDir();
  }
  if (args.path) {
    const resolved = resolvePath(args.path);
    if (!fs.existsSync(path.join(resolved, "meta.yaml"))) {
      fail(`No se encontro meta.yaml en ${resolved}`);
    }
    return resolved;
  }
  if (args.key && args.version) {
    const baseDir = path.join(SOURCE_DIR, args.key, args.version);
    if (!fs.existsSync(path.join(baseDir, "meta.yaml"))) {
      fail(`No se encontro la version ${args.version} para ${args.key}`);
    }
    return baseDir;
  }
  fail("Debes indicar --here, --path, o --key + --version.");
}

function resolveNewKey(args) {
  if (args.key) return args.key;
  if (typeof args.here === "string") {
    const cwd = path.resolve(process.cwd());
    if (!cwd.startsWith(SOURCE_DIR)) {
      fail(`--here <nombre> solo funciona dentro de ${SOURCE_DIR}`);
    }
    const rel = path.relative(SOURCE_DIR, cwd);
    if (!rel || rel === ".") {
      return args.here;
    }
    if (isVersionString(path.basename(cwd))) {
      fail("--here <nombre> no se puede ejecutar dentro de una carpeta de version.");
    }
    return path.join(rel, args.here).replace(/\\/g, "/");
  }
  fail("Debes indicar --key o --here <nombre>.");
}

function renderDataJson(baseDir) {
  const dataYaml = path.join(baseDir, "data.yaml");
  const dataJson = path.join(baseDir, "data.json");
  if (!fs.existsSync(dataYaml)) {
    fail(`No se encontro data.yaml en ${baseDir}`);
  }
  runPython("render_data_json.py", ["--in", dataYaml, "--out", dataJson]);
  fs.chmodSync(dataJson, 0o444);
  console.log(`JSON regenerado: ${dataJson}`);
}

function renderTemplate(baseDir) {
  const systemDir = path.join(baseDir, "modes", "system", "jinja2", "src");
  const userDir = path.join(baseDir, "modes", "user", "latex", "src");
  const dataYaml = path.join(baseDir, "data.yaml");
  if (!fs.existsSync(systemDir)) fail(`No se encontro system/jinja2 en ${baseDir}`);
  if (!fs.existsSync(dataYaml)) fail(`No se encontro data.yaml en ${baseDir}`);
  removeIfExists(userDir);
  ensureDir(userDir);
  runPython("render_seed.py", ["--seed", systemDir, "--out", userDir, "--defaults", dataYaml]);
  renderDataJson(baseDir);
  console.log(`Render completado: ${userDir}`);
}

function renderSeedPreview(seedRoot, compile = false) {
  const seedSrc = path.join(seedRoot, "src");
  const seedDefaults = path.join(seedRoot, "defaults.yaml");
  const seedRender = path.join(seedRoot, "render");
  if (!fs.existsSync(seedSrc) || !fs.existsSync(seedDefaults)) {
    fail(`La semilla no es valida: ${seedRoot}`);
  }
  removeIfExists(seedRender);
  ensureDir(seedRender);
  runPython("render_seed.py", ["--seed", seedSrc, "--out", seedRender, "--defaults", seedDefaults]);
  if (compile) {
    const makeFile = path.join(seedRender, "make.sh");
    if (!fs.existsSync(makeFile)) fail(`No se encontro make.sh en ${seedRender}`);
    runCommand("sh", ["./make.sh"], { cwd: seedRender });
  }
  console.log(`Preview renderizado en ${seedRender}`);
}

function createDefaultUserModeDirs(baseDir) {
  for (const engine of ["docx", "latex", "pdf", "xlsx"]) {
    ensureDir(path.join(baseDir, "modes", "user", engine, "src"));
  }
}

function createDefaultPackagedUserModeDirs(templateDir) {
  for (const engine of ["docx", "latex", "pdf", "xlsx"]) {
    ensureDir(path.join(templateDir, "modes", "user", engine, "src"));
  }
}

function writeMinimalLatexFiles(targetDir) {
  const mainTex = path.join(targetDir, "main.tex");
  const makeSh = path.join(targetDir, "make.sh");
  if (!fs.existsSync(mainTex)) {
    fs.writeFileSync(
      mainTex,
      "\\documentclass{article}\n\\begin{document}\nTemplate placeholder.\n\\end{document}\n",
      "utf8",
    );
  }
  if (!fs.existsSync(makeSh)) {
    fs.writeFileSync(
      makeSh,
      "#!/bin/sh\nset -eu\nmkdir -p output/build output/pdf output/logs\npdflatex -interaction=nonstopmode -halt-on-error -output-directory=output/build main.tex\ncp output/build/main.pdf output/pdf/main.pdf\n",
      "utf8",
    );
    fs.chmodSync(makeSh, 0o755);
  }
}

function buildMetaContent({ key, name, version, mode, engine, includeSystem = false }) {
  if (includeSystem || mode === "user") {
    return `key: "${escapeYamlString(key)}"
export_id: ""
name: "${escapeYamlString(name)}"
version: ${version}
storage_version: v0001
modes:
${includeSystem ? `  system:
    jinja2:
      path: "modes/system/jinja2/src"
` : ""}  user:
    docx:
      path: "modes/user/docx/src"
    latex:
      path: "modes/user/latex/src"
    pdf:
      path: "modes/user/pdf/src"
    xlsx:
      path: "modes/user/xlsx/src"
origins: []
`;
  }
  return `key: "${escapeYamlString(key)}"
export_id: ""
name: "${escapeYamlString(name)}"
version: ${version}
storage_version: v0001
modes:
  ${mode}:
    ${engine}:
      path: "modes/${mode}/${engine}/src"
origins: []
`;
}

function removeGeneratedArtifacts(dirPath) {
  for (const outputDir of walkDirs(dirPath, (dir) => path.basename(dir) === "output")) {
    removeIfExists(outputDir);
  }
  for (const filePath of walkFiles(dirPath, (file) => GENERATED_FILES.has(path.basename(file)))) {
    fs.rmSync(filePath, { force: true });
  }
}

function replaceLegacyTemplateDirs(baseDir) {
  const legacyDirs = walkDirs(baseDir, (dir) => path.basename(dir) === "template");
  for (const legacyDir of legacyDirs) {
    const target = path.join(path.dirname(legacyDir), "src");
    if (!fs.existsSync(target)) {
      fs.renameSync(legacyDir, target);
    }
  }
}

function createTemplate(args) {
  const key = resolveNewKey(args);
  const version = args.version || "1.0.0";
  let name = args.name || key;
  const mode = args.mode || "user";
  const engine = (args.engine || "latex").replace("excel", "xlsx");
  if (!key.includes("/")) {
    fail(`El key debe incluir al menos grupo/template. Valor actual: ${key}`);
  }
  if (!isVersionString(version)) {
    fail(`La version debe usar formato x.y.z. Valor actual: ${version}`);
  }

  const dest = path.join(SOURCE_DIR, key, version);
  if (fs.existsSync(dest)) {
    fail(`El destino ya existe: ${dest}`);
  }

  if (args.from) {
    const fromDir = resolvePath(args.from);
    if (!fs.existsSync(fromDir)) fail(`No se encontro --from: ${fromDir}`);
    fs.cpSync(fromDir, dest, { recursive: true });
    replaceLegacyTemplateDirs(dest);
    const metaPath = path.join(dest, "meta.yaml");
    let metaContent = fs.existsSync(metaPath) ? fs.readFileSync(metaPath, "utf8") : "";
    if (!args.name) {
      name = getYamlScalar(metaContent, "name") || name;
    }
    metaContent = upsertYamlScalar(metaContent, "name", name, true);
    metaContent = upsertYamlScalar(metaContent, "version", version, false);
    metaContent = upsertYamlScalar(metaContent, "storage_version", "v0001", false);
    fs.writeFileSync(metaPath, metaContent, "utf8");
  } else if (mode === "user" && engine === "latex") {
    const seedRoot = resolveSeedRoot(args.seed, false);
    const seedSrc = path.join(seedRoot, "src");
    const seedDefaults = path.join(seedRoot, "defaults.yaml");
    if (!fs.existsSync(seedSrc) || !fs.existsSync(seedDefaults)) {
      fail(`La semilla no es valida: ${seedRoot}`);
    }
    ensureDir(path.join(dest, "modes", "system", "jinja2", "src"));
    createDefaultUserModeDirs(dest);
    copyDirContents(seedSrc, path.join(dest, "modes", "system", "jinja2", "src"));
    runPython("render_seed.py", [
      "--seed",
      path.join(dest, "modes", "system", "jinja2", "src"),
      "--out",
      path.join(dest, "modes", "user", "latex", "src"),
      "--defaults",
      seedDefaults,
    ]);
    fs.copyFileSync(seedDefaults, path.join(dest, "data.yaml"));
    renderDataJson(dest);
    fs.writeFileSync(path.join(dest, "meta.yaml"), buildMetaContent({ key, name, version, mode, engine, includeSystem: true }), "utf8");
  } else {
    if (mode === "user") {
      createDefaultUserModeDirs(dest);
    } else {
      ensureDir(path.join(dest, "modes", mode, engine, "src"));
    }
    if (engine === "latex") {
      const latexDir = mode === "user"
        ? path.join(dest, "modes", "user", "latex", "src")
        : path.join(dest, "modes", mode, engine, "src");
      writeMinimalLatexFiles(latexDir);
    }
    fs.writeFileSync(path.join(dest, "meta.yaml"), buildMetaContent({ key, name, version, mode, engine }), "utf8");
  }

  if (!fs.existsSync(path.join(dest, "schema.json"))) {
    fs.writeFileSync(
      path.join(dest, "schema.json"),
      '{\n  "type": "object",\n  "properties": {},\n  "additionalProperties": true\n}\n',
      "utf8",
    );
  }

  if (!fs.existsSync(path.join(dest, "README.md"))) {
    fs.writeFileSync(path.join(dest, "README.md"), `# ${name}\n\nVersion: ${version}\n`, "utf8");
  }

  removeGeneratedArtifacts(dest);
  syncCatalog({ quiet: true });
  console.log(`Template creado: ${dest}`);
}

function createVersion(args) {
  const key = args.key || (typeof args.here === "string" ? resolveNewKey(args) : "");
  const fromVersion = args.from;
  const toVersion = args.to;
  if (!key || !fromVersion || !toVersion) {
    fail("version requiere --key (o --here <nombre>), --from y --to.");
  }
  const sourceDir = path.join(SOURCE_DIR, key, fromVersion);
  if (!fs.existsSync(sourceDir)) {
    fail(`No se encontro la version origen: ${sourceDir}`);
  }
  createTemplate({
    key,
    version: toVersion,
    name: args.name || key,
    from: sourceDir,
  });
}

function syncCatalog({ quiet = false } = {}) {
  const metaFiles = walkFiles(SOURCE_DIR, (file) => path.basename(file) === "meta.yaml").sort();
  const catalogLines = ["# Template catalog (auto-generated)", "", "templates:"];

  for (const metaPath of metaFiles) {
    const baseDir = path.dirname(metaPath);
    const relDir = path.relative(SOURCE_DIR, baseDir).replace(/\\/g, "/");
    const version = path.basename(baseDir);
    const templatePath = relDir.slice(0, -(version.length + 1));
    const key = templatePath;
    const exportId = makeExportId(key);

    let metaContent = fs.readFileSync(metaPath, "utf8");
    metaContent = upsertYamlScalar(metaContent, "key", key, true);
    metaContent = upsertYamlScalar(metaContent, "export_id", exportId, true);
    fs.writeFileSync(metaPath, metaContent, "utf8");

    const name = getYamlScalar(metaContent, "name") || "Template";
    const storageVersion = getYamlScalar(metaContent, "storage_version") || "v0001";
    const templateId = getYamlScalar(metaContent, "template_id") || "null";

    catalogLines.push(`  - key: "${escapeYamlString(key)}"`);
    catalogLines.push(`    export_id: "${escapeYamlString(exportId)}"`);
    catalogLines.push(`    name: "${escapeYamlString(name)}"`);
    catalogLines.push(`    version: "${escapeYamlString(version)}"`);
    catalogLines.push(`    storage_version: "${escapeYamlString(storageVersion)}"`);
    catalogLines.push(`    template_id: ${templateId === "null" ? "null" : `"${escapeYamlString(templateId)}"`}`);
    catalogLines.push("    modes:");

    const userModes = [];
    for (const engine of ["docx", "latex", "pdf", "xlsx"]) {
      const enginePath = path.join(baseDir, "modes", "user", engine, "src");
      if (fs.existsSync(enginePath)) {
        userModes.push(`        ${engine}: "templates/${templatePath}/${version}/modes/user/${engine}/src"`);
      }
    }
    if (userModes.length) {
      catalogLines.push("      user:");
      catalogLines.push(...userModes);
    }

    if (fs.existsSync(path.join(baseDir, "modes", "system", "jinja2", "src"))) {
      catalogLines.push("      system:");
      catalogLines.push(`        jinja2: "templates/${templatePath}/${version}/modes/system/jinja2/src"`);
    }

    if (/^origins:\s*$/m.test(metaContent)) {
      catalogLines.push("    origins:");
      const originLines = metaContent
        .split("\n")
        .slice(metaContent.split("\n").findIndex((line) => /^origins:\s*$/.test(line)) + 1)
        .filter((line) => /^(\s*)- /.test(line));
      for (const line of originLines) {
        catalogLines.push(`    ${line.trimStart()}`);
      }
    }
  }

  fs.writeFileSync(CATALOG_PATH, `${catalogLines.join("\n")}\n`, "utf8");
  if (!quiet) console.log(`Catalogo actualizado: ${CATALOG_PATH}`);
}

function packageTemplates() {
  syncCatalog({ quiet: true });
  removeIfExists(DIST_ROOT);
  ensureDir(DIST_ROOT);

  const metaFiles = walkFiles(SOURCE_DIR, (file) => path.basename(file) === "meta.yaml").sort();
  for (const metaPath of metaFiles) {
    const baseDir = path.dirname(metaPath);
    const metaContent = fs.readFileSync(metaPath, "utf8");
    const exportId = getYamlScalar(metaContent, "export_id");
    const templateId = getYamlScalar(metaContent, "template_id");
    const storageVersion = getYamlScalar(metaContent, "storage_version") || "v0001";
    const destId = templateId && templateId !== "null" ? templateId : exportId;
    const destDir = path.join(DIST_ROOT, destId, storageVersion);
    const templateDest = path.join(destDir, "template");

    ensureDir(templateDest);
    for (const fileName of ["meta.yaml", "schema.json", "data.yaml", "data.json"]) {
      const sourcePath = path.join(baseDir, fileName);
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, path.join(destDir, fileName));
      }
    }
    for (const folderName of ["modes", "assets"]) {
      const sourcePath = path.join(baseDir, folderName);
      if (fs.existsSync(sourcePath)) {
        fs.cpSync(sourcePath, path.join(templateDest, folderName), { recursive: true });
      }
    }
    createDefaultPackagedUserModeDirs(templateDest);
  }

  console.log(`Templates empaquetados en ${DIST_ROOT}`);
}

function publishTemplates(skipPackage) {
  if (!skipPackage) {
    packageTemplates();
  }
  runCommand("docker", ["compose", "--profile", "storage-publish", "run", "--rm", "minio-publish"], {
    cwd: DOCKER_DIR,
  });
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help" || command === "-h") {
    usage();
    return;
  }

  const args = parseArgs(rest);

  switch (command) {
    case "new":
      createTemplate(args);
      return;
    case "version":
      createVersion(args);
      return;
    case "render":
      renderTemplate(resolveTemplateVersionDir(args));
      return;
    case "seed":
      renderSeedPreview(resolveSeedRoot(args.seed || args.here, args.here === true), args.compile === true);
      return;
    case "json":
      renderDataJson(resolveTemplateVersionDir(args));
      return;
    case "catalog":
      syncCatalog();
      return;
    case "package":
      packageTemplates();
      return;
    case "publish":
      publishTemplates(args["skip-package"] === true);
      return;
    default:
      fail(`Comando desconocido: ${command}`);
  }
}

main();
