import test from "node:test";
import assert from "node:assert/strict";

import {
  getCompilerMetrics,
  markCallbackAttempt,
  markCompileAccepted,
  markCompileFailed,
  markCompileRunning,
  markCompileSucceeded,
  resetCompilerObservability,
} from "./observability.js";

test("observability acumula contadores y duraciones", () => {
  resetCompilerObservability();

  markCompileAccepted({ jobId: "cmp_1", documentVersionId: 10 });
  markCompileRunning({ jobId: "cmp_1", documentVersionId: 10 });
  markCompileSucceeded({
    jobId: "cmp_1",
    documentVersionId: 10,
    durationMs: 2400,
    workingFilePath: "foo/working/pdf/document-version-10.pdf",
  });
  markCompileFailed({
    jobId: "cmp_2",
    documentVersionId: 11,
    stage: "compile-latex",
    code: "latex_compile_failed",
    message: "fallo latex",
  });
  markCallbackAttempt({
    jobId: "cmp_1",
    delivered: true,
    status: 200,
  });

  const metrics = getCompilerMetrics();
  assert.equal(metrics.counters.compileAccepted, 1);
  assert.equal(metrics.counters.compileRunning, 1);
  assert.equal(metrics.counters.compileSucceeded, 1);
  assert.equal(metrics.counters.compileFailed, 1);
  assert.equal(metrics.counters.callbackAttempted, 1);
  assert.equal(metrics.counters.callbackDelivered, 1);
  assert.equal(metrics.durations.averageMs, 2400);
  assert.ok(Array.isArray(metrics.lastEvents));
  assert.ok(metrics.lastEvents.length >= 5);
});
