// Cliente HTTP mínimo sobre fetch nativo (Node 18+). Sin dependencias.
//
// Devuelve siempre una forma uniforme { status, ok, headers, body } donde
// body es el JSON parseado si el content-type es JSON, o el texto crudo.
// Nunca lanza por status !=2xx: un 403 esperado es parte del comportamiento
// que queremos fijar en los characterization tests.

import { API_BASE, REQUEST_TIMEOUT_MS } from "../config.mjs";

export async function request(method, path, { token, body, headers = {} } = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const finalHeaders = { Accept: "application/json", ...headers };
  let payload;
  if (body !== undefined) {
    finalHeaders["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(url, {
      method,
      headers: finalHeaders,
      body: payload,
      signal: controller.signal,
    });

    const contentType = res.headers.get("content-type") ?? "";
    let parsed;
    if (contentType.includes("application/json")) {
      parsed = await res.json().catch(() => null);
    } else {
      parsed = await res.text().catch(() => null);
    }

    return {
      status: res.status,
      ok: res.ok,
      headers: Object.fromEntries(res.headers.entries()),
      body: parsed,
    };
  } finally {
    clearTimeout(timer);
  }
}

export const get = (path, opts) => request("GET", path, opts);
export const post = (path, opts) => request("POST", path, opts);
export const put = (path, opts) => request("PUT", path, opts);
export const del = (path, opts) => request("DELETE", path, opts);
