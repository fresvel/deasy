const state = {
  counters: {
    compileAccepted: 0,
    compileRunning: 0,
    compileSucceeded: 0,
    compileFailed: 0,
    callbackAttempted: 0,
    callbackDelivered: 0,
    callbackFailed: 0,
  },
  durationsMs: [],
  lastEvents: [],
};

const MAX_DURATION_SAMPLES = 100;
const MAX_EVENTS = 50;

const pushEvent = (event) => {
  state.lastEvents.unshift(event);
  if (state.lastEvents.length > MAX_EVENTS) {
    state.lastEvents.length = MAX_EVENTS;
  }
};

export const resetCompilerObservability = () => {
  state.counters.compileAccepted = 0;
  state.counters.compileRunning = 0;
  state.counters.compileSucceeded = 0;
  state.counters.compileFailed = 0;
  state.counters.callbackAttempted = 0;
  state.counters.callbackDelivered = 0;
  state.counters.callbackFailed = 0;
  state.durationsMs.length = 0;
  state.lastEvents.length = 0;
};

export const logCompilerEvent = (eventType, details = {}) => {
  const payload = {
    ts: new Date().toISOString(),
    service: "document-compiler",
    event: eventType,
    ...details,
  };
  console.log(JSON.stringify(payload));
  pushEvent(payload);
  return payload;
};

export const markCompileAccepted = ({ jobId, documentVersionId }) => {
  state.counters.compileAccepted += 1;
  return logCompilerEvent("compile.accepted", {
    job_id: jobId,
    document_version_id: documentVersionId,
  });
};

export const markCompileRunning = ({ jobId, documentVersionId }) => {
  state.counters.compileRunning += 1;
  return logCompilerEvent("compile.running", {
    job_id: jobId,
    document_version_id: documentVersionId,
  });
};

export const markCompileSucceeded = ({ jobId, documentVersionId, durationMs, workingFilePath }) => {
  state.counters.compileSucceeded += 1;
  if (Number.isFinite(durationMs)) {
    state.durationsMs.push(Number(durationMs));
    if (state.durationsMs.length > MAX_DURATION_SAMPLES) {
      state.durationsMs.shift();
    }
  }
  return logCompilerEvent("compile.succeeded", {
    job_id: jobId,
    document_version_id: documentVersionId,
    duration_ms: durationMs,
    working_file_path: workingFilePath || null,
  });
};

export const markCompileFailed = ({ jobId, documentVersionId, stage, code, message }) => {
  state.counters.compileFailed += 1;
  return logCompilerEvent("compile.failed", {
    job_id: jobId,
    document_version_id: documentVersionId,
    stage: stage || "compile",
    code: code || "compile_pipeline_failed",
    message: message || "El pipeline del compilador falló.",
  });
};

export const markCallbackAttempt = ({ jobId, delivered, status }) => {
  state.counters.callbackAttempted += 1;
  if (delivered) {
    state.counters.callbackDelivered += 1;
  } else {
    state.counters.callbackFailed += 1;
  }
  return logCompilerEvent("compile.callback", {
    job_id: jobId,
    delivered: Boolean(delivered),
    status: status ?? null,
  });
};

export const getCompilerMetrics = () => {
  const samples = state.durationsMs.slice();
  const totalDuration = samples.reduce((sum, value) => sum + value, 0);
  return {
    service: "document-compiler",
    counters: { ...state.counters },
    durations: {
      samples: samples.length,
      averageMs: samples.length ? Math.round(totalDuration / samples.length) : 0,
      maxMs: samples.length ? Math.max(...samples) : 0,
      minMs: samples.length ? Math.min(...samples) : 0,
    },
    lastEvents: [...state.lastEvents],
  };
};
