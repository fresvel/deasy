import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const compilerRoot = path.resolve(currentDir, "..", "..");

export const bundledRenderRuntime = {
  compilerRoot,
  requirementsPath: path.join(compilerRoot, "requirements.txt"),
  renderSeedScriptPath: path.join(compilerRoot, "python", "render_seed.py"),
};

export const getBundledRenderRuntimeStatus = () => {
  const requirementsExists = fs.existsSync(bundledRenderRuntime.requirementsPath);
  const renderSeedExists = fs.existsSync(bundledRenderRuntime.renderSeedScriptPath);

  return {
    ok: requirementsExists && renderSeedExists,
    requirementsExists,
    renderSeedExists,
    requirementsPath: bundledRenderRuntime.requirementsPath,
    renderSeedScriptPath: bundledRenderRuntime.renderSeedScriptPath,
  };
};
