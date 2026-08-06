// Tests del resolver de referencias de foto de perfil.
//
// Se prueban las funciones puras: parsePhotoReference (decide que formato guarda
// persons.photo_url) y resolveLegacyPhotoPath (confina las rutas heredadas dentro
// de uploads/). openProfilePhoto es IO sobre MinIO/disco y se ejerce end-to-end.

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  LEGACY_UPLOADS_ROOT,
  buildMinioReference,
  contentTypeForExtension,
  parsePhotoReference,
  resolveLegacyPhotoPath
} from "./profilePhotoStorage.js";

test("parsePhotoReference devuelve null cuando no hay foto", () => {
  assert.equal(parsePhotoReference(null), null);
  assert.equal(parsePhotoReference(""), null);
  assert.equal(parsePhotoReference("   "), null);
  assert.equal(parsePhotoReference(undefined), null);
});

test("parsePhotoReference reconoce una referencia de MinIO", () => {
  assert.deepEqual(parsePhotoReference("minio://deasy-users/users/123/profile/1.png"), {
    kind: "minio",
    bucket: "deasy-users",
    objectName: "users/123/profile/1.png"
  });
});

test("parsePhotoReference descarta referencias de MinIO incompletas", () => {
  assert.equal(parsePhotoReference("minio://deasy-users"), null, "sin objeto");
  assert.equal(parsePhotoReference("minio:///users/123/a.png"), null, "sin bucket");
});

test("buildMinioReference y parsePhotoReference son simétricos", () => {
  const reference = buildMinioReference("deasy-users", "/users/0987654321/profile/17.webp");
  assert.equal(reference, "minio://deasy-users/users/0987654321/profile/17.webp");
  assert.deepEqual(parsePhotoReference(reference), {
    kind: "minio",
    bucket: "deasy-users",
    objectName: "users/0987654321/profile/17.webp"
  });
});

test("parsePhotoReference reconoce las data URI heredadas", () => {
  assert.deepEqual(parsePhotoReference("data:image/png;base64,AAAA"), {
    kind: "data-uri",
    contentType: "image/png",
    isBase64: true,
    payload: "AAAA"
  });
});

test("parsePhotoReference reconoce URLs externas", () => {
  assert.deepEqual(parsePhotoReference("https://cdn.example.org/a.png"), {
    kind: "external",
    url: "https://cdn.example.org/a.png"
  });
});

test("parsePhotoReference trata el resto como ruta heredada en disco", () => {
  assert.deepEqual(parsePhotoReference("uploads/profile_photos/123_17.jpg"), {
    kind: "legacy-file",
    relativePath: "uploads/profile_photos/123_17.jpg"
  });
  assert.deepEqual(parsePhotoReference("/uploads/profile_photos/123_17.jpg"), {
    kind: "legacy-file",
    relativePath: "uploads/profile_photos/123_17.jpg"
  });
});

test("resolveLegacyPhotoPath resuelve dentro de uploads/ con o sin el prefijo", () => {
  const expected = path.join(LEGACY_UPLOADS_ROOT, "profile_photos", "123_17.jpg");
  assert.equal(resolveLegacyPhotoPath("uploads/profile_photos/123_17.jpg"), expected);
  assert.equal(resolveLegacyPhotoPath("profile_photos/123_17.jpg"), expected);
});

test("resolveLegacyPhotoPath rechaza cualquier escape del directorio", () => {
  assert.equal(resolveLegacyPhotoPath("../../etc/passwd"), null);
  assert.equal(resolveLegacyPhotoPath("uploads/../../etc/passwd"), null);
  assert.equal(resolveLegacyPhotoPath("profile_photos/../../../.env"), null);
  assert.equal(resolveLegacyPhotoPath(""), null);
});

test("contentTypeForExtension cubre los formatos admitidos", () => {
  assert.equal(contentTypeForExtension(".png"), "image/png");
  assert.equal(contentTypeForExtension(".JPG"), "image/jpeg");
  assert.equal(contentTypeForExtension(".jpeg"), "image/jpeg");
  assert.equal(contentTypeForExtension(".webp"), "image/webp");
  assert.equal(contentTypeForExtension(".svg"), "application/octet-stream");
  assert.equal(contentTypeForExtension(""), "application/octet-stream");
});
