import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { pipeline as streamPipeline } from "stream/promises";

import { getMinioObjectStream } from "../storage/minio_service.js";
import { documentTemplateTechnicalValidatorService } from "./DocumentTemplateTechnicalValidatorService.js";

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..");
const RENDER_SEED_SCRIPT = path.join(REPO_ROOT, "tools", "templates", "python", "render_seed.py");
const DEFAULT_WORKSPACE_ROOT = path.join(os.tmpdir(), "deasy-document-compiler");

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
  runtimePayloadPath: path.join(workspaceRoot, "runtime.data.json"),
});

const normalizeRelativePath = (value) => String(value || "").replace(/^\/+/, "");

export class DocumentCompilationPipelineService {
  constructor({
    validatorService = documentTemplateTechnicalValidatorService,
    workspaceRoot = DEFAULT_WORKSPACE_ROOT,
  } = {}) {
    this.validatorService = validatorService;
    this.workspaceRoot = workspaceRoot;
  }

  async materializeRenderSource(renderSource, targetDir) {
    const files = Array.isArray(renderSource?.files) ? renderSource.files : [];
    for (const file of files) {
      await writeMinioObjectToFile({
        bucket: renderSource.bucket,
        objectName: file.objectName,
        targetPath: path.join(targetDir, normalizeRelativePath(file.relativePath)),
      });
    }
  }

  async renderJinjaToLatex({ sourceDir, renderedDir, runtimePayloadPath }) {
    return runProcess("python3", [
      RENDER_SEED_SCRIPT,
      "--seed",
      sourceDir,
      "--out",
      renderedDir,
      "--defaults",
      runtimePayloadPath,
    ]);
  }

  async compileLatexWorkspace(renderedDir) {
    return runProcess("bash", ["./make.sh"], { cwd: renderedDir });
  }

  async compileDocumentVersion(documentVersionId, { preserveWorkspace = true } = {}) {
    const validation = await this.validatorService.validateDocumentVersion(documentVersionId);
    if (!validation.ok) {
      const error = new Error("El template no pasó la validación técnica previa a compilación.");
      error.code = "template_contract_invalid";
      error.validation = validation;
      throw error;
    }

    const workspaceRoot = path.join(
      this.workspaceRoot,
      `document-version-${documentVersionId}-${Date.now()}`
    );
    const workspace = buildWorkspaceLayout(workspaceRoot);

    try {
      await ensureDir(workspace.sourceDir);
      await ensureDir(workspace.renderedDir);
      await this.materializeRenderSource(validation.payload.renderSource, workspace.sourceDir);
      await writeJsonFile(workspace.runtimePayloadPath, validation.payload.payload.mergedPayload || {});

      const renderResult = await this.renderJinjaToLatex({
        sourceDir: workspace.sourceDir,
        renderedDir: workspace.renderedDir,
        runtimePayloadPath: workspace.runtimePayloadPath,
      });
      if (renderResult.code !== 0) {
        const error = new Error("Falló el render Jinja del artifact.");
        error.code = "render_failed";
        error.stage = "render-jinja";
        error.commandResult = renderResult;
        throw error;
      }

      const mainTexPath = path.join(workspace.renderedDir, "main.tex");
      await fs.promises.access(mainTexPath);

      const compileResult = await this.compileLatexWorkspace(workspace.renderedDir);
      if (compileResult.code !== 0) {
        const error = new Error("Falló la compilación LaTeX del workspace renderizado.");
        error.code = "latex_compile_failed";
        error.stage = "compile-latex";
        error.commandResult = compileResult;
        throw error;
      }

      const reportPdfPath = path.join(workspace.renderedDir, "output", "pdf", "report.pdf");
      const mainPdfPath = path.join(workspace.renderedDir, "output", "pdf", "main.pdf");

      return {
        ok: true,
        documentVersionId: Number(documentVersionId),
        workspace,
        renderResult,
        compileResult,
        artifacts: {
          mainTexPath,
          mainPdfPath,
          reportPdfPath,
        },
        payload: validation.payload,
      };
    } finally {
      if (!preserveWorkspace) {
        await fs.promises.rm(workspaceRoot, { recursive: true, force: true }).catch(() => {});
      }
    }
  }
}

export const documentCompilationPipelineService = new DocumentCompilationPipelineService();
