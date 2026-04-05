#!/usr/bin/env node
import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";

import {
  listTemplateKeys,
  listVersionsForKey,
  listSeeds,
  getDefaultSeed,
  getPathsSummary,
  templateActions,
} from "./core/index.mjs";

function clearScreen() {
  if (output.isTTY) {
    console.clear();
  }
}

function printHeader(title, subtitle = "") {
  clearScreen();
  console.log("DEASY Templates TUI");
  console.log(title);
  if (subtitle) {
    console.log(subtitle);
  }
  console.log("");
}

async function waitForEnter(rl, message = "Presiona Enter para continuar...") {
  await rl.question(`${message}`);
}

async function promptText(rl, label, { defaultValue = "", allowEmpty = false } = {}) {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  while (true) {
    const answer = (await rl.question(`${label}${suffix}: `)).trim();
    if (answer) return answer;
    if (defaultValue) return defaultValue;
    if (allowEmpty) return "";
  }
}

async function promptConfirm(rl, label, defaultValue = true) {
  const suffix = defaultValue ? " [Y/n]" : " [y/N]";
  const answer = (await rl.question(`${label}${suffix}: `)).trim().toLowerCase();
  if (!answer) return defaultValue;
  return ["y", "yes", "s", "si", "sí"].includes(answer);
}

async function promptSelect(rl, title, options, { allowBack = true } = {}) {
  while (true) {
    printHeader(title);
    options.forEach((option, index) => {
      console.log(`${index + 1}. ${option.label}`);
      if (option.description) {
        console.log(`   ${option.description}`);
      }
    });
    if (allowBack) {
      console.log("0. Volver");
    }
    console.log("");
    const raw = (await rl.question("Selecciona una opción: ")).trim();
    const value = Number(raw);
    if (allowBack && value === 0) return null;
    if (Number.isInteger(value) && value >= 1 && value <= options.length) {
      return options[value - 1].value;
    }
  }
}

async function selectTemplateKey(rl, title = "Seleccionar template") {
  const templates = listTemplateKeys();
  if (!templates.length) {
    throw new Error("No se encontraron templates fuente.");
  }
  return promptSelect(
    rl,
    title,
    templates.map((entry) => ({
      label: `${entry.key}`,
      description: entry.name,
      value: entry.key,
    })),
  );
}

async function selectTemplateVersion(rl, key, title = "Seleccionar versión") {
  const versions = listVersionsForKey(key);
  if (!versions.length) {
    throw new Error(`No se encontraron versiones para ${key}.`);
  }
  return promptSelect(
    rl,
    title,
    versions.map((entry) => ({
      label: `${entry.version}`,
      description: entry.name,
      value: entry,
    })),
  );
}

async function selectSeed(rl) {
  const seeds = listSeeds();
  if (!seeds.length) {
    throw new Error("No se encontraron seeds.");
  }
  return promptSelect(
    rl,
    "Seleccionar seed",
    seeds.map((entry) => ({
      label: entry.code,
      description: entry.path,
      value: entry,
    })),
  );
}

async function handleCreateTemplate(rl) {
  printHeader("Nuevo template");
  const key = await promptText(rl, "Key del template");
  const version = await promptText(rl, "Versión", { defaultValue: "1.0.0" });
  const name = await promptText(rl, "Nombre visible", { defaultValue: key });
  const useDefaultSeed = await promptConfirm(
    rl,
    `¿Usar seed por defecto (${getDefaultSeed()})?`,
    true,
  );
  let seed = getDefaultSeed();
  if (!useDefaultSeed) {
    const selected = await selectSeed(rl);
    if (!selected) return;
    seed = selected.code;
  }
  templateActions.createTemplate({ key, version, name, seed });
  console.log("");
  console.log("Template creado correctamente.");
}

async function handleCreateVersion(rl) {
  const key = await selectTemplateKey(rl, "Versionar template");
  if (!key) return;
  const from = await selectTemplateVersion(rl, key, "Versión origen");
  if (!from) return;
  printHeader("Nueva versión", `${key} desde ${from.version}`);
  const to = await promptText(rl, "Nueva versión");
  const name = await promptText(rl, "Nombre visible", { defaultValue: from.name });
  templateActions.createVersion({ key, from: from.version, to, name });
  console.log("");
  console.log("Versión creada correctamente.");
}

async function handleRenderTemplate(rl) {
  const key = await selectTemplateKey(rl, "Renderizar template");
  if (!key) return;
  const selected = await selectTemplateVersion(rl, key, "Versión a renderizar");
  if (!selected) return;
  templateActions.renderTemplate(selected.path);
  console.log("");
  console.log("Render completado.");
}

async function handleRenderJson(rl) {
  const key = await selectTemplateKey(rl, "Generar data.json");
  if (!key) return;
  const selected = await selectTemplateVersion(rl, key, "Versión");
  if (!selected) return;
  templateActions.renderDataJson(selected.path);
  console.log("");
  console.log("JSON regenerado.");
}

async function handlePrepareRuntime(rl) {
  const key = await selectTemplateKey(rl, "Preparar runtime");
  if (!key) return;
  const selected = await selectTemplateVersion(rl, key, "Versión");
  if (!selected) return;
  printHeader("Preparar runtime", `${selected.key} ${selected.version}`);
  const runtimePath = await promptText(rl, "Ruta del archivo runtime JSON/YAML");
  const outPath = await promptText(rl, "Ruta de salida (vacío = runtime.data.json)", {
    allowEmpty: true,
  });
  templateActions.prepareRuntimePayload(selected.path, runtimePath, outPath || "");
  console.log("");
  console.log("Payload runtime generado.");
}

async function handleSeedPreview(rl) {
  const selected = await selectSeed(rl);
  if (!selected) return;
  const compile = await promptConfirm(rl, "¿Compilar preview PDF?", false);
  templateActions.renderSeedPreview(selected.path, compile);
  console.log("");
  console.log("Preview de seed generado.");
}

async function handleCatalog() {
  templateActions.syncCatalog();
  console.log("");
  console.log("Catálogo sincronizado.");
}

async function handlePackage() {
  templateActions.packageTemplates();
  console.log("");
  console.log("Dist generado.");
}

async function handlePublish(rl) {
  const skipPackage = await promptConfirm(rl, "¿Reutilizar dist actual y omitir package?", false);
  templateActions.publishTemplates(skipPackage);
  console.log("");
  console.log("Templates publicados.");
}

async function handlePublishSeeds() {
  templateActions.publishSeeds();
  console.log("");
  console.log("Seeds publicadas.");
}

export async function runTui() {
  const rl = readline.createInterface({ input, output });
  const paths = getPathsSummary();

  try {
    while (true) {
      const action = await promptSelect(
        rl,
        "Menú principal",
        [
          { label: "Nuevo template", description: paths.sourceDir, value: "new" },
          { label: "Nueva versión", description: "Copiar estructura desde una versión existente", value: "version" },
          { label: "Renderizar template", description: "Genera modes/general/latex/src desde process/jinja2/src", value: "render" },
          { label: "Regenerar data.json", description: "Convierte data.yaml a data.json", value: "json" },
          { label: "Preparar runtime", description: "Materializa payload runtime desde pattern_ref", value: "prepare-runtime" },
          { label: "Preview de seed", description: paths.seedsDir, value: "seed" },
          { label: "Sincronizar catálogo", description: "Recalcula CATALOG.yaml", value: "catalog" },
          { label: "Empaquetar dist", description: paths.distRoot, value: "package" },
          { label: "Publicar templates", description: "Sube dist a MinIO", value: "publish" },
          { label: "Publicar seeds", description: "Sube Seeds a MinIO", value: "publish-seeds" },
          { label: "Salir", description: "", value: "exit" },
        ],
        { allowBack: false },
      );

      try {
        switch (action) {
          case "new":
            await handleCreateTemplate(rl);
            break;
          case "version":
            await handleCreateVersion(rl);
            break;
          case "render":
            await handleRenderTemplate(rl);
            break;
          case "json":
            await handleRenderJson(rl);
            break;
          case "prepare-runtime":
            await handlePrepareRuntime(rl);
            break;
          case "seed":
            await handleSeedPreview(rl);
            break;
          case "catalog":
            await handleCatalog();
            break;
          case "package":
            await handlePackage();
            break;
          case "publish":
            await handlePublish(rl);
            break;
          case "publish-seeds":
            await handlePublishSeeds();
            break;
          case "exit":
            return;
          default:
            break;
        }
      } catch (error) {
        console.log("");
        console.error(`Error: ${error.message}`);
      }

      console.log("");
      await waitForEnter(rl);
    }
  } finally {
    rl.close();
  }
}

if (process.argv[1] && process.argv[1].endsWith("/tui.mjs")) {
  await runTui();
}
