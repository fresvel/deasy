import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { pipeline as streamPipeline } from "stream/promises";

import { getMinioObjectStream } from "./minio.js";
import { bundledRenderRuntime } from "./render-runtime.js";
import { shouldMaterializeSourceFile } from "./source-policy.js";

const DEFAULT_WORKSPACE_ROOT = path.join(
  process.env.COMPILER_WORKSPACE_ROOT || os.tmpdir(),
  "deasy-compiler"
);

const ensureDir = async (targetPath) => {
  await fs.promises.mkdir(targetPath, { recursive: true });
};

const writeJsonFile = async (targetPath, value) => {
  await ensureDir(path.dirname(targetPath));
  await fs.promises.writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const writeMinioObjectToFile = async ({ bucket, objectName, targetPath }) => {
  const sourceStream = await getMinioObjectStream(bucket, objectName);
  await ensureDir(path.dirname(targetPath));
  const destination = fs.createWriteStream(targetPath);
  await streamPipeline(sourceStream, destination);
};

const runProcess = (command, args, { cwd } = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        code: Number(code ?? 1),
        stdout,
        stderr,
      });
    });
  });

const buildWorkspaceLayout = (workspaceRoot) => ({
  root: workspaceRoot,
  sourceDir: path.join(workspaceRoot, "source"),
  renderedDir: path.join(workspaceRoot, "rendered"),
  pdfOutputDir: path.join(workspaceRoot, "rendered", "output", "pdf"),
  runtimePayloadPath: path.join(workspaceRoot, "runtime.data.json"),
  compileReportLocalPath: path.join(workspaceRoot, "compile_report.json"),
});

const normalizeRelativePath = (value) => String(value || "").replace(/^\/+/, "");

const pickExistingFile = async (...candidatePaths) => {
  for (const candidatePath of candidatePaths) {
    try {
      await fs.promises.access(candidatePath, fs.constants.F_OK);
      return candidatePath;
    } catch {
      continue;
    }
  }
  return null;
};

export class CompilationPipelineService {
  constructor({ workspaceRoot = DEFAULT_WORKSPACE_ROOT } = {}) {
    this.workspaceRoot = workspaceRoot;
  }

  async materializeRenderSource(renderSource, targetDir) {
    const files = Array.isArray(renderSource?.files) ? renderSource.files : [];
    for (const file of files) {
      if (!shouldMaterializeSourceFile(file.relativePath)) {
        continue;
      }
      await writeMinioObjectToFile({
        bucket: renderSource.bucket,
        objectName: file.objectName,
        targetPath: path.join(targetDir, normalizeRelativePath(file.relativePath)),
      });
    }
  }

  async renderJinjaToWorkspace({ sourceDir, renderedDir, runtimePayloadPath }) {
    return runProcess("python3", [
      bundledRenderRuntime.renderSeedScriptPath,
      "--seed",
      sourceDir,
      "--out",
      renderedDir,
      "--defaults",
      runtimePayloadPath,
    ]);
  }

  async runPdflatexPass({ renderedDir, pdfOutputDir, mainTexPath }) {
    return runProcess("pdflatex", [
      "-interaction=nonstopmode",
      "-halt-on-error",
      "-file-line-error",
      `-output-directory=${pdfOutputDir}`,
      mainTexPath,
    ], { cwd: renderedDir });
  }

  async compileLatexWorkspace({ renderedDir, pdfOutputDir, mainTexPath }) {
    const passes = [];
    for (let index = 0; index < 3; index += 1) {
      // Fixed compiler passes owned by the microservice. Templates contribute sources, not shell logic.
      const result = await this.runPdflatexPass({
        renderedDir,
        pdfOutputDir,
        mainTexPath,
      });
      passes.push(result);
      if (result.code !== 0) {
        break;
      }
    }
    return passes;
  }

  async compileNormalizedPayload(payload, { preserveWorkspace = true } = {}) {
    const documentVersionId = Number(payload?.documentVersion?.id || 0) || "na";
    const startedAt = new Date();
    const workspaceRoot = path.join(
      this.workspaceRoot,
      `document-version-${documentVersionId}-${Date.now()}`
    );
    const workspace = buildWorkspaceLayout(workspaceRoot);

    try {
      await ensureDir(workspace.sourceDir);
      await ensureDir(workspace.renderedDir);
      await ensureDir(workspace.pdfOutputDir);

      await this.materializeRenderSource(payload.renderSource, workspace.sourceDir);
      await writeJsonFile(workspace.runtimePayloadPath, payload.payload.mergedPayload || {});

      const renderResult = await this.renderJinjaToWorkspace({
        sourceDir: workspace.sourceDir,
        renderedDir: workspace.renderedDir,
        runtimePayloadPath: workspace.runtimePayloadPath,
      });
      if (renderResult.code !== 0) {
        const error = new Error("Falló el render Jinja del artifact.");
        error.code = "render_failed";
        error.stage = "render-jinja";
        error.commandResult = renderResult;
        error.workspace = workspace;
        throw error;
      }

      const mainTexPath = path.join(workspace.renderedDir, "main.tex");
      await fs.promises.access(mainTexPath, fs.constants.F_OK).catch(() => {
        const error = new Error("El render Jinja no produjo main.tex en el workspace renderizado.");
        error.code = "render_output_missing";
        error.stage = "render-jinja";
        error.workspace = workspace;
        throw error;
      });

      const compilePasses = await this.compileLatexWorkspace({
        renderedDir: workspace.renderedDir,
        pdfOutputDir: workspace.pdfOutputDir,
        mainTexPath,
      });
      const lastCompileResult = compilePasses[compilePasses.length - 1] || {
        code: 1,
        stdout: "",
        stderr: "No se ejecutó ninguna pasada de pdflatex.",
      };
      if (lastCompileResult.code !== 0) {
        const error = new Error("Falló la compilación LaTeX del workspace renderizado.");
        error.code = "latex_compile_failed";
        error.stage = "compile-latex";
        error.commandResult = {
          passes: compilePasses,
          last: lastCompileResult,
        };
        error.workspace = workspace;
        throw error;
      }

      const mainPdfPath = path.join(workspace.pdfOutputDir, "main.pdf");
      const compiledPdfPath = await pickExistingFile(mainPdfPath);

      if (!compiledPdfPath) {
        const error = new Error(
          "La compilación LaTeX terminó sin generar main.pdf en output/pdf."
        );
        error.code = "compiled_pdf_missing";
        error.stage = "compile-latex";
        error.commandResult = {
          passes: compilePasses,
          last: lastCompileResult,
        };
        error.workspace = workspace;
        throw error;
      }

      return {
        ok: true,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
        workspace,
        renderResult,
        compileResult: {
          passes: compilePasses,
          last: lastCompileResult,
        },
        artifacts: {
          mainTexPath,
          mainPdfPath,
          compiledPdfPath,
        },
      };
    } finally {
      if (!preserveWorkspace) {
        await fs.promises.rm(workspaceRoot, { recursive: true, force: true }).catch(() => {});
      }
    }
  }
}

export const compilationPipelineService = new CompilationPipelineService();
