import { API_PREFIX } from "../../config/apiPaths.js";
import { documentCompilerPayloadService } from "./DocumentCompilerPayloadService.js";
import { documentCompilationResultService } from "./DocumentCompilationResultService.js";
import { documentCompilationTrackingService } from "./DocumentCompilationTrackingService.js";
import {
  requestCompilerJob,
  requestCompilerJobStatus,
  requestCompilerValidation,
} from "../infrastructure/compiler_http.js";

const BACKEND_INTERNAL_BASE_URL = String(
  process.env.BACKEND_INTERNAL_BASE_URL || `http://backend:${process.env.PORT || 3030}`
).replace(/\/+$/g, "");
const COMPILER_SHARED_TOKEN = String(process.env.COMPILER_SHARED_TOKEN || "").trim();

const buildCompilerCallbackConfig = () => ({
  url: `${BACKEND_INTERNAL_BASE_URL}${API_PREFIX}/admin/compiler/callback`,
  token: COMPILER_SHARED_TOKEN,
});

export class DocumentCompilerOrchestratorService {
  constructor({
    payloadService = documentCompilerPayloadService,
    resultService = documentCompilationResultService,
    trackingService = documentCompilationTrackingService,
  } = {}) {
    this.payloadService = payloadService;
    this.resultService = resultService;
    this.trackingService = trackingService;
  }

  async buildRemotePayload(documentVersionId, externalConnection = null) {
    return this.payloadService.buildPayload(documentVersionId, externalConnection);
  }

  async validateDocumentVersion(documentVersionId, externalConnection = null) {
    const payload = await this.buildRemotePayload(documentVersionId, externalConnection);
    const compilerResponse = await requestCompilerValidation(payload);
    return {
      documentVersionId: Number(documentVersionId),
      payload,
      compilerResponse,
    };
  }

  async requestCompilation(documentVersionId, externalConnection = null) {
    const payload = await this.buildRemotePayload(documentVersionId, externalConnection);
    payload.callback = buildCompilerCallbackConfig();
    const compilerResponse = await requestCompilerJob(payload);
    this.trackingService.registerAcceptedJob({
      jobId: compilerResponse?.job_id,
      documentVersionId,
      compilerResponse,
    });
    return {
      documentVersionId: Number(documentVersionId),
      payload,
      compilerResponse,
    };
  }

  async getCompilationStatus(jobId) {
    const normalizedJobId = String(jobId || "").trim();
    const tracked = this.trackingService.get(normalizedJobId);

    if (tracked?.terminal && tracked.lastCompilerResponse) {
      return {
        jobId: normalizedJobId,
        compilerResponse: tracked.lastCompilerResponse,
        trackedLocally: true,
      };
    }

    try {
      const compilerResponse = await requestCompilerJobStatus(normalizedJobId);
      this.trackingService.markCompilerStatus(normalizedJobId, compilerResponse);

      if (compilerResponse?.status === "succeeded" && !tracked?.transitionApplied) {
        const transitionResult = await this.resultService.applySuccessfulCompilation({
          documentVersionId: tracked?.documentVersionId || compilerResponse?.document_version_id,
          compilerResponse,
        });
        this.trackingService.markTransitionApplied(normalizedJobId, transitionResult);
      }

      return {
        jobId: normalizedJobId,
        compilerResponse,
      };
    } catch (error) {
      if (
        error?.status === 404 &&
        error?.payload?.error?.code === "compile_job_not_found" &&
        tracked?.documentVersionId
      ) {
        const retry = await this.requestCompilation(tracked.documentVersionId);
        this.trackingService.markRetried(normalizedJobId, {
          jobId: retry?.compilerResponse?.job_id,
        });

        return {
          jobId: normalizedJobId,
          recovered: true,
          reason: "compiler_job_lost",
          retry,
        };
      }
      throw error;
    }
  }

  async applyCompilationCallback(callbackPayload) {
    const jobId = String(callbackPayload?.job_id || "").trim();
    if (!jobId) {
      throw new Error("El callback del compilador no incluye job_id.");
    }

    const tracked = this.trackingService.markCompilerStatus(jobId, callbackPayload) ||
      this.trackingService.registerAcceptedJob({
        jobId,
        documentVersionId: callbackPayload?.document_version_id,
        compilerResponse: callbackPayload,
      });

    let transitionResult = null;
    if (callbackPayload?.status === "succeeded" && !tracked?.transitionApplied) {
      transitionResult = await this.resultService.applySuccessfulCompilation({
        documentVersionId: tracked?.documentVersionId || callbackPayload?.document_version_id,
        compilerResponse: callbackPayload,
      });
      this.trackingService.markTransitionApplied(jobId, transitionResult);
    }

    return {
      ok: true,
      jobId,
      status: callbackPayload?.status || null,
      transitionApplied: Boolean(transitionResult),
      transitionResult,
    };
  }
}

export const documentCompilerOrchestratorService = new DocumentCompilerOrchestratorService();
