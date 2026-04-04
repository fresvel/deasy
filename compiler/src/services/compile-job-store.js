import { randomUUID } from "crypto";

const jobs = new Map();

const nowIso = () => new Date().toISOString();

export const createCompileJob = ({
  documentVersionId,
  callback = null,
} = {}) => {
  const jobId = `cmp_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const job = {
    jobId,
    status: "pending",
    documentVersionId: Number(documentVersionId) || null,
    callback,
    createdAt: nowIso(),
    acceptedAt: nowIso(),
    startedAt: null,
    finishedAt: null,
    result: null,
    error: null,
  };
  jobs.set(jobId, job);
  return job;
};

export const markCompileJobRunning = (jobId) => {
  const job = jobs.get(jobId);
  if (!job) {
    return null;
  }
  job.status = "running";
  job.startedAt = nowIso();
  return job;
};

export const markCompileJobSucceeded = (jobId, result) => {
  const job = jobs.get(jobId);
  if (!job) {
    return null;
  }
  job.status = "succeeded";
  job.finishedAt = nowIso();
  job.result = result;
  return job;
};

export const markCompileJobFailed = (jobId, error) => {
  const job = jobs.get(jobId);
  if (!job) {
    return null;
  }
  job.status = "failed";
  job.finishedAt = nowIso();
  job.error = error;
  return job;
};

export const markCompileJobCallback = (jobId, callbackResult) => {
  const job = jobs.get(jobId);
  if (!job) {
    return null;
  }
  job.callbackResult = callbackResult;
  return job;
};

export const getCompileJob = (jobId) => jobs.get(String(jobId || "").trim()) || null;
