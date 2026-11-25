// Espera a que el stack esté listo antes de correr la suite.
//
// El endpoint concreto de readiness se confirma en el mapa de la API
// (p.ej. system/bootstrap/status). Se parametriza vía READINESS_PATH.

import { get } from "./http.mjs";
import { READINESS_TIMEOUT_MS } from "../config.mjs";

const READINESS_PATH = process.env.READINESS_PATH ?? "/system/bootstrap/status";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function waitForReady() {
  const deadline = Date.now() + READINESS_TIMEOUT_MS;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const res = await get(READINESS_PATH);
      if (res.status >= 200 && res.status < 500) return res;
    } catch (err) {
      lastErr = err;
    }
    await sleep(2000);
  }
  throw new Error(
    `El stack no estuvo listo en ${READINESS_TIMEOUT_MS}ms (path=${READINESS_PATH}). ` +
      `Último error: ${lastErr?.message ?? "sin respuesta 2xx-4xx"}`,
  );
}
