const COMPILER_BASE_URL = String(
  process.env.COMPILER_BASE_URL || "http://compiler:4100"
).replace(/\/+$/g, "");
const COMPILER_SHARED_TOKEN = String(process.env.COMPILER_SHARED_TOKEN || "").trim();

const buildHeaders = () => ({
  "Content-Type": "application/json",
  ...(COMPILER_SHARED_TOKEN ? { Authorization: `Bearer ${COMPILER_SHARED_TOKEN}` } : {}),
});

const parseResponseBody = async (response) => {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const compilerRequest = async (method, routePath, body = null) => {
  const response = await fetch(`${COMPILER_BASE_URL}${routePath}`, {
    method,
    headers: buildHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await parseResponseBody(response);
  if (!response.ok) {
    const error = new Error(
      payload?.error?.message ||
      payload?.message ||
      `El compilador respondió con ${response.status}.`
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
};

export const requestCompilerValidation = async (payload) =>
  compilerRequest("POST", "/validate-template", payload);

export const requestCompilerJob = async (payload) =>
  compilerRequest("POST", "/compile", payload);

export const requestCompilerJobStatus = async (jobId) =>
  compilerRequest("GET", `/compile/${encodeURIComponent(String(jobId || "").trim())}`);
