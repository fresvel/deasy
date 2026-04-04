const jobs = new Map();

export class DocumentCompilationTrackingService {
  registerAcceptedJob({ jobId, documentVersionId, compilerResponse }) {
    const record = {
      jobId: String(jobId || "").trim(),
      documentVersionId: Number(documentVersionId),
      status: String(compilerResponse?.status || "pending"),
      acceptedAt: compilerResponse?.accepted_at || new Date().toISOString(),
      lastCompilerResponse: compilerResponse || null,
      retryCount: 0,
      terminal: false,
      transitionApplied: false,
    };
    jobs.set(record.jobId, record);
    return record;
  }

  get(jobId) {
    return jobs.get(String(jobId || "").trim()) || null;
  }

  markCompilerStatus(jobId, compilerResponse) {
    const record = this.get(jobId);
    if (!record) {
      return null;
    }
    record.status = String(compilerResponse?.status || record.status || "pending");
    record.lastCompilerResponse = compilerResponse || record.lastCompilerResponse;
    record.terminal = ["succeeded", "failed"].includes(record.status);
    return record;
  }

  markTransitionApplied(jobId, transitionResult) {
    const record = this.get(jobId);
    if (!record) {
      return null;
    }
    record.transitionApplied = true;
    record.transitionResult = transitionResult;
    return record;
  }

  markRetried(jobId, nextJob) {
    const record = this.get(jobId);
    if (!record) {
      return null;
    }
    record.retryCount += 1;
    record.retriedAsJobId = nextJob?.jobId || null;
    record.terminal = true;
    record.status = "retried";
    record.lastCompilerResponse = {
      status: "retried",
      previous_job_id: record.jobId,
      retried_as_job_id: record.retriedAsJobId,
      document_version_id: record.documentVersionId,
    };
    return record;
  }
}

export const documentCompilationTrackingService = new DocumentCompilationTrackingService();
