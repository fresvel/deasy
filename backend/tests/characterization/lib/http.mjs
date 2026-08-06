// Cliente HTTP mínimo sobre fetch nativo (Node 18+). Sin dependencias.
//
// Devuelve siempre una forma uniforme { status, ok, headers, body } donde
// body es el JSON parseado si el content-type es JSON, o el texto crudo.
// Nunca lanza por status !=2xx: un 403 esperado es parte del comportamiento
// que queremos fijar en los characterization tests.
//
// Dos formas de cuerpo, excluyentes:
//   - `body`  → JSON (camino histórico; NO se toca, lo usan los 148 casos ya fijados).
//   - `form`  → multipart/form-data, para las rutas que reciben ficheros vía multer
//               (p. ej. el borrador de plantilla, que sube pdf/docx/xlsx/pptx).

import { API_BASE, REQUEST_TIMEOUT_MS } from "../config.mjs";

// Construye el FormData a partir de un objeto plano. Cada valor puede ser:
//   - un escalar        → se envía como campo de texto (String(valor))
//   - { filename, content, contentType } → se envía como fichero adjunto
//     (`content` puede ser Buffer, Uint8Array o string)
export function buildFormData(fields = {}) {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "object" && value.filename !== undefined) {
      const { filename, content, contentType } = value;
      const bytes = typeof content === "string" ? new TextEncoder().encode(content) : new Uint8Array(content);
      form.append(name, new Blob([bytes], { type: contentType || "application/octet-stream" }), filename);
      continue;
    }
    form.append(name, typeof value === "string" ? value : String(value));
  }
  return form;
}

export async function request(method, path, { token, body, form, headers = {} } = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const finalHeaders = { Accept: "application/json", ...headers };
  let payload;
  if (body !== undefined) {
    finalHeaders["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  } else if (form !== undefined) {
    // OJO: NO se fija Content-Type a mano. `fetch` lo pone con el `boundary` que genera
    // para este FormData; escribirlo nosotros lo dejaría sin boundary y multer rechazaría
    // la petición ("Boundary not found").
    payload = form instanceof FormData ? form : buildFormData(form);
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
export const patch = (path, opts) => request("PATCH", path, opts);
export const del = (path, opts) => request("DELETE", path, opts);
