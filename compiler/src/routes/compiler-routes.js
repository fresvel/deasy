import { Router } from "express";

import { dispatchCompileCallback } from "../services/callback-http.js";
import {
  createCompileJob,
  getCompileJob,
  markCompileJobCallback,
  markCompileJobFailed,
  markCompileJobRunning,
  markCompileJobSucceeded,
} from "../services/compile-job-store.js";
import { loadArtifactDescriptor } from "../services/artifact-loader.js";
import { compilationPersistenceService } from "../services/compilation-persistence.js";
import {
  getCompilerMetrics,
  logCompilerEvent,
  markCallbackAttempt,
  markCompileAccepted,
  markCompileFailed as markCompileFailedMetric,
  markCompileRunning as markCompileRunningMetric,
  markCompileSucceeded,
} from "../services/observability.js";
import { validateNormalizedCompilationPayload } from "../services/payload-contract.js";
import { getBundledRenderRuntimeStatus } from "../services/render-runtime.js";
import { validateCompilerPayloadTechnically } from "../services/template-validator.js";

const SERVICE_NAME = "document-compiler";

export const compilerRouter = Router();

const buildSucceededJobResponse = (job) => ({
  job_id: job.jobId,
  status: job.status,
  document_version_id: job.documentVersionId,
  started_at: job.startedAt,
  finished_at: job.finishedAt,
  artifacts: {
    working_file_path: job.result?.artifacts?.workingFilePath || null,
    compile_report_path: job.result?.artifacts?.compileReportPath || null,
    bucket: job.result?.artifacts?.bucket || null,
    object_name: job.result?.artifacts?.objectName || null,
    compile_report_object_name: job.result?.artifacts?.compileReportObjectName || null,
  },
  warnings: job.result?.warnings || [],
  errors: [],
  fingerprint: job.result?.fingerprint || null,
  callback: job.callbackResult || null,
});

const buildFailedJobResponse = (job) => ({
  job_id: job.jobId,
  status: job.status,
  document_version_id: job.documentVersionId,
  started_at: job.startedAt,
  finished_at: job.finishedAt,
  warnings: [],
  errors: [
    {
      code: job.error?.code || "compile_pipeline_failed",
      message: job.error?.message || "El pipeline del compilador falló.",
      stage: job.error?.stage || "compile",
      retryable: job.error?.stage === "persist-storage",
      details: job.error?.details || {},
    },
  ],
  callback: job.callbackResult || null,
});

compilerRouter.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: SERVICE_NAME,
  });
});

compilerRouter.get("/metrics", (req, res) => {
  res.json(getCompilerMetrics());
});

compilerRouter.get("/ready", (req, res) => {
  const renderRuntime = getBundledRenderRuntimeStatus();

  res.status(503).json({
    status: "not_ready",
    service: SERVICE_NAME,
    checks: {
      storage: "pending",
      texlive: "pending",
      runtime: renderRuntime.ok ? "bundled" : "missing",
    },
    render_runtime: renderRuntime,
  });
});

compilerRouter.post("/validate-template", async (req, res) => {
  if (req.body?.documentVersion && req.body?.payload) {
    const validation = validateCompilerPayloadTechnically(req.body);
    res.status(validation.ok ? 200 : 422).json({
      ok: validation.ok,
      document_version_id: Number(req.body.documentVersion?.id || 0) || null,
      errors: validation.errors,
      warnings: validation.warnings,
    });
    return;
  }

  const descriptor = await loadArtifactDescriptor(req.body || {});
  res.json({
    ok: true,
    bucket: descriptor.bucket,
    sources: {
      metaObjectKey: descriptor.metaObjectKey,
      schemaObjectKey: descriptor.schemaObjectKey,
      dataObjectKey: descriptor.dataObjectKey,
      renderSourcePrefix: descriptor.renderSourcePrefix,
      renderSourceCount: descriptor.renderSourceFiles.length,
    },
  });
});

compilerRouter.post("/compile", async (req, res) => {
  const requestPayload = req.body || {};
  const payloadValidation = validateNormalizedCompilationPayload(req.body || {});
  if (!payloadValidation.ok) {
    res.status(400).json({
      error: {
        code: "invalid_compile_payload",
        message: "El payload normalizado enviado por el backend no cumple el contrato mínimo del compilador.",
        stage: "compile",
        retryable: false,
        details: {
          errors: payloadValidation.errors,
        },
      },
    });
    return;
  }

  const technicalValidation = validateCompilerPayloadTechnically(req.body || {});
  if (!technicalValidation.ok) {
    res.status(422).json({
      error: {
        code: "template_contract_invalid",
        message: "El payload enviado al compilador no pasó la validación técnica del template.",
        stage: "validate-template",
        retryable: false,
        details: {
          errors: technicalValidation.errors,
          warnings: technicalValidation.warnings,
        },
      },
    });
    return;
  }

  const job = createCompileJob({
    documentVersionId: requestPayload.documentVersion?.id,
    callback: requestPayload.callback || null,
  });
  markCompileAccepted({
    jobId: job.jobId,
    documentVersionId: job.documentVersionId,
  });

  const runJob = async () => {
    markCompileJobRunning(job.jobId);
    markCompileRunningMetric({
      jobId: job.jobId,
      documentVersionId: job.documentVersionId,
    });
    try {
      const persistenceResult = await compilationPersistenceService.persistNormalizedPayload(
        requestPayload
      );

      const result = {
        acceptedAt: job.acceptedAt,
        executionMode: "in_memory_async_job",
        artifacts: {
          workspaceRoot: persistenceResult.pipelineResult.workspace.root,
          sourceDir: persistenceResult.pipelineResult.workspace.sourceDir,
          renderedDir: persistenceResult.pipelineResult.workspace.renderedDir,
          runtimePayloadPath: persistenceResult.pipelineResult.workspace.runtimePayloadPath,
          mainTexPath: persistenceResult.pipelineResult.artifacts.mainTexPath,
          compiledPdfPath: persistenceResult.pipelineResult.artifacts.compiledPdfPath,
          workingFilePath: persistenceResult.workingFilePath,
          compileReportPath: persistenceResult.compileReportPath,
          bucket: persistenceResult.bucket,
          objectName: persistenceResult.objectName,
          compileReportObjectName: persistenceResult.compileReportObjectName,
        },
        commands: {
          render: persistenceResult.pipelineResult.renderResult,
          latex: persistenceResult.pipelineResult.compileResult,
        },
        fingerprint: persistenceResult.compileReport.fingerprint,
        warnings: technicalValidation.warnings,
      };

      markCompileJobSucceeded(job.jobId, result);
      markCompileSucceeded({
        jobId: job.jobId,
        documentVersionId: job.documentVersionId,
        durationMs: persistenceResult.compileReport?.runtime?.durationMs || null,
        workingFilePath: persistenceResult.workingFilePath,
      });

      if (job.callback?.url) {
        try {
          const callbackResult = await dispatchCompileCallback(job.callback, buildSucceededJobResponse(job));
          markCompileJobCallback(job.jobId, callbackResult);
          markCallbackAttempt({
            jobId: job.jobId,
            delivered: callbackResult?.delivered,
            status: callbackResult?.status,
          });
        } catch (callbackError) {
          markCompileJobCallback(job.jobId, {
            attempted: true,
            delivered: false,
            error: callbackError?.message || "No se pudo entregar el callback del compilador.",
          });
          markCallbackAttempt({
            jobId: job.jobId,
            delivered: false,
            status: null,
          });
        }
      }
    } catch (error) {
      const normalizedError = {
        code: error?.code || "compile_pipeline_failed",
        message: error?.message || "El pipeline del compilador falló.",
        stage: error?.stage || "compile",
        details: {
          workspace: error?.workspace || null,
          commandResult: error?.commandResult || null,
        },
      };
      markCompileJobFailed(job.jobId, normalizedError);
      markCompileFailedMetric({
        jobId: job.jobId,
        documentVersionId: job.documentVersionId,
        stage: normalizedError.stage,
        code: normalizedError.code,
        message: normalizedError.message,
      });

      if (job.callback?.url) {
        try {
          const callbackResult = await dispatchCompileCallback(job.callback, buildFailedJobResponse(getCompileJob(job.jobId)));
          markCompileJobCallback(job.jobId, callbackResult);
          markCallbackAttempt({
            jobId: job.jobId,
            delivered: callbackResult?.delivered,
            status: callbackResult?.status,
          });
        } catch (callbackError) {
          markCompileJobCallback(job.jobId, {
            attempted: true,
            delivered: false,
            error: callbackError?.message || "No se pudo entregar el callback del compilador.",
          });
          markCallbackAttempt({
            jobId: job.jobId,
            delivered: false,
            status: null,
          });
        }
      }
    }
  };

  setImmediate(() => {
    runJob().catch(() => {});
  });

  res.status(202).json({
    job_id: job.jobId,
    status: job.status,
    accepted_at: job.acceptedAt,
    document_version_id: job.documentVersionId,
    poll_url: `/compile/${job.jobId}`,
    callback: job.callback?.url
      ? {
          configured: true,
          url: job.callback.url,
        }
      : {
          configured: false,
        },
    message:
      "El compilador aceptó el job. El backend puede consultar GET /compile/:jobId; callback queda opcional si se configuró.",
  });
});

compilerRouter.get("/compile/:jobId", (req, res) => {
  const job = getCompileJob(req.params?.jobId);
  if (!job) {
    logCompilerEvent("compile.status_not_found", {
      job_id: req.params?.jobId || null,
    });
    res.status(404).json({
      error: {
        code: "compile_job_not_found",
        message: "No existe un job de compilación con ese identificador.",
        stage: "compile-status",
        retryable: false,
      },
    });
    return;
  }

  if (job.status === "pending" || job.status === "running") {
    logCompilerEvent("compile.status_polled", {
      job_id: job.jobId,
      status: job.status,
      document_version_id: job.documentVersionId,
    });
    res.json({
      job_id: job.jobId,
      status: job.status,
      document_version_id: job.documentVersionId,
      accepted_at: job.acceptedAt,
      started_at: job.startedAt,
      callback: job.callbackResult || null,
    });
    return;
  }

  if (job.status === "failed") {
    logCompilerEvent("compile.status_polled", {
      job_id: job.jobId,
      status: job.status,
      document_version_id: job.documentVersionId,
    });
    res.json(buildFailedJobResponse(job));
    return;
  }

  logCompilerEvent("compile.status_polled", {
    job_id: job.jobId,
    status: job.status,
    document_version_id: job.documentVersionId,
  });
  res.json(buildSucceededJobResponse(job));
});
