import { createHash } from "crypto";
import fs from "fs";

import {
  ensureBucketExists,
  uploadFileToMinio,
} from "./minio.js";
import { compilationPipelineService } from "./compilation-pipeline.js";
import {
  MINIO_DOCUMENTS_BUCKET,
  MINIO_DOCUMENTS_PREFIX,
  buildCompileReportPath,
  buildCompiledWorkingPdfPath,
} from "./storage-paths.js";

const writeJsonFile = async (targetPath, value) => {
  await fs.promises.writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const sha256File = async (filePath) => {
  const buffer = await fs.promises.readFile(filePath);
  return createHash("sha256").update(buffer).digest("hex");
};

export class CompilationPersistenceService {
  constructor({
    pipelineService = compilationPipelineService,
  } = {}) {
    this.pipelineService = pipelineService;
  }

  async persistNormalizedPayload(payload, { preserveWorkspace = true } = {}) {
    const pipelineResult = await this.pipelineService.compileNormalizedPayload(payload, {
      preserveWorkspace,
    });

    const canonicalBasePath = String(payload?.storage?.canonicalBasePath || "").trim();
    if (!canonicalBasePath) {
      const error = new Error("No se pudo resolver storage.canonicalBasePath para persistir el PDF.");
      error.code = "storage_base_path_missing";
      error.stage = "persist-storage";
      throw error;
    }

    const documentVersionId = Number(payload?.documentVersion?.id || 0);
    const workingFilePath = buildCompiledWorkingPdfPath({
      basePath: canonicalBasePath,
      documentVersionId,
    });
    const compileReportPath = buildCompileReportPath({
      basePath: canonicalBasePath,
    });
    const objectName = `${MINIO_DOCUMENTS_PREFIX}/${workingFilePath}`;
    const compileReportObjectName = `${MINIO_DOCUMENTS_PREFIX}/${compileReportPath}`;
    const fingerprintValue = await sha256File(pipelineResult.artifacts.compiledPdfPath);

    const compileReport = {
      status: "succeeded",
      documentVersion: {
        id: documentVersionId,
        documentId: Number(payload?.documentVersion?.documentId || 0) || null,
        version: Number(payload?.documentVersion?.version || 0) || null,
      },
      target: {
        renderEngine: payload?.target?.renderEngine || "jinja2",
        outputFormat: payload?.target?.outputFormat || "pdf",
      },
      storage: {
        bucket: MINIO_DOCUMENTS_BUCKET,
        documentsPrefix: MINIO_DOCUMENTS_PREFIX,
        canonicalBasePath,
        workingFilePath,
        compileReportPath,
        objectName,
        compileReportObjectName,
      },
      sources: {
        artifactBucket: payload?.artifact?.bucket || null,
        renderSourcePrefix: payload?.renderSource?.objectPrefix || null,
        renderSourceCount: Array.isArray(payload?.renderSource?.files)
          ? payload.renderSource.files.length
          : 0,
      },
      workspace: {
        root: pipelineResult.workspace.root,
        sourceDir: pipelineResult.workspace.sourceDir,
        renderedDir: pipelineResult.workspace.renderedDir,
        runtimePayloadPath: pipelineResult.workspace.runtimePayloadPath,
      },
      runtime: {
        startedAt: pipelineResult.startedAt,
        finishedAt: pipelineResult.finishedAt,
        durationMs: pipelineResult.durationMs,
      },
      commands: {
        render: pipelineResult.renderResult,
        latex: pipelineResult.compileResult,
      },
      fingerprint: {
        algorithm: "sha256",
        value: fingerprintValue,
      },
      artifacts: {
        mainTexPath: pipelineResult.artifacts.mainTexPath,
        compiledPdfLocalPath: pipelineResult.artifacts.compiledPdfPath,
      },
      warnings: [],
      errors: [],
    };

    await writeJsonFile(pipelineResult.workspace.compileReportLocalPath, compileReport);

    await ensureBucketExists(MINIO_DOCUMENTS_BUCKET);
    const uploadResult = await uploadFileToMinio(
      MINIO_DOCUMENTS_BUCKET,
      objectName,
      pipelineResult.artifacts.compiledPdfPath,
      {
        "Content-Type": "application/pdf",
        "Document-Version-Id": String(documentVersionId),
      }
    );
    const compileReportUploadResult = await uploadFileToMinio(
      MINIO_DOCUMENTS_BUCKET,
      compileReportObjectName,
      pipelineResult.workspace.compileReportLocalPath,
      {
        "Content-Type": "application/json",
        "Document-Version-Id": String(documentVersionId),
      }
    );

    return {
      ok: true,
      documentVersionId,
      workingFilePath,
      compileReportPath,
      bucket: MINIO_DOCUMENTS_BUCKET,
      objectName,
      compileReportObjectName,
      uploadResult,
      compileReportUploadResult,
      compileReport,
      pipelineResult,
    };
  }
}

export const compilationPersistenceService = new CompilationPersistenceService();
