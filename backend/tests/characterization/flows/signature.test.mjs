// Characterization: firma / entregables.
// Centros por usuario (requieren token + permiso). Fijamos la forma de la
// respuesta del admin. Los flujos por documentVersionId concreto se añadirán
// cuando el seed fije un id determinista (ver README, determinismo).

import { test, before } from "node:test";
import { get } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";
import { snapshotShape } from "../lib/normalize.mjs";
import { matchSnapshot } from "../lib/snapshot.mjs";
import { waitForReady } from "../lib/readiness.mjs";
import { USERS } from "../config.mjs";

const SUITE = "signature";
// Las URLs de artefactos en MinIO suelen venir prefirmadas (volátiles).
const URL_MASK = ["url", "signedUrl", "downloadUrl", "photoUrl", "path"];

before(async () => {
  await waitForReady();
});

test("GET /users/:id/signature-center (admin, propio) -> forma", async () => {
  const token = await tokenFor("admin");
  const res = await get(`/users/1/signature-center`, { token });
  matchSnapshot(SUITE, "signature_center_admin", snapshotShape(res, { extraMask: URL_MASK }));
});

test("GET /users/:id/document-center (admin, propio) -> forma", async () => {
  const token = await tokenFor("admin");
  const res = await get(`/users/1/document-center`, { token });
  matchSnapshot(SUITE, "document_center_admin", snapshotShape(res, { extraMask: URL_MASK }));
});

test("GET /users/:id/signature-center sin token -> 401", async () => {
  const res = await get(`/users/1/signature-center`);
  matchSnapshot(SUITE, "signature_center_no_token", snapshotShape(res));
});
