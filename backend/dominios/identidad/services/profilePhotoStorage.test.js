// Tests de las funciones puras del almacenamiento de fotos de perfil:
// parsePhotoReference (lee la referencia de persons.photo_url), detectImageFormat
// (decide el formato por la firma del fichero) y buildProfilePhotoObjectName.
// storeProfilePhoto/openProfilePhoto/removeStoredPhoto son IO sobre MinIO y se
// ejercen de extremo a extremo.

import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMinioReference,
  buildProfilePhotoObjectName,
  contentTypeForExtension,
  detectImageFormat,
  parsePhotoReference
} from "./profilePhotoStorage.js";

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const JPEG_HEADER = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(8)]);
const WEBP_HEADER = Buffer.concat([
  Buffer.from("RIFF", "ascii"),
  Buffer.alloc(4),
  Buffer.from("WEBP", "ascii")
]);

test("parsePhotoReference devuelve null cuando no hay foto", () => {
  assert.equal(parsePhotoReference(null), null);
  assert.equal(parsePhotoReference(""), null);
  assert.equal(parsePhotoReference("   "), null);
  assert.equal(parsePhotoReference(undefined), null);
});

test("parsePhotoReference lee una referencia de MinIO", () => {
  assert.deepEqual(parsePhotoReference("minio://deasy-users/users/123/profile/1.png"), {
    bucket: "deasy-users",
    objectName: "users/123/profile/1.png"
  });
});

test("parsePhotoReference descarta lo que no sea una referencia válida", () => {
  assert.equal(parsePhotoReference("minio://deasy-users"), null, "sin objeto");
  assert.equal(parsePhotoReference("minio:///users/123/a.png"), null, "sin bucket");
  assert.equal(parsePhotoReference("uploads/profile_photos/1.jpg"), null, "ruta de disco");
  assert.equal(parsePhotoReference("data:image/png;base64,AAAA"), null, "data URI");
  assert.equal(parsePhotoReference("https://cdn.example.org/a.png"), null, "URL externa");
});

test("buildMinioReference y parsePhotoReference son simétricos", () => {
  const reference = buildMinioReference("deasy-users", "/users/0987654321/profile/17.webp");
  assert.equal(reference, "minio://deasy-users/users/0987654321/profile/17.webp");
  assert.deepEqual(parsePhotoReference(reference), {
    bucket: "deasy-users",
    objectName: "users/0987654321/profile/17.webp"
  });
});

test("detectImageFormat reconoce PNG, JPEG y WEBP por su firma", () => {
  assert.equal(detectImageFormat(PNG_HEADER).extension, ".png");
  assert.equal(detectImageFormat(PNG_HEADER).contentType, "image/png");
  assert.equal(detectImageFormat(JPEG_HEADER).extension, ".jpg");
  assert.equal(detectImageFormat(WEBP_HEADER).contentType, "image/webp");
});

test("detectImageFormat rechaza lo que no es una imagen admitida", () => {
  // Un SVG (o cualquier otra cosa) declarado como image/png no debe colarse.
  assert.equal(detectImageFormat(Buffer.from("<svg xmlns='http://a'>", "ascii")), null);
  assert.equal(detectImageFormat(Buffer.from("GIF89a______", "ascii")), null);
  assert.equal(detectImageFormat(Buffer.alloc(12)), null, "ceros");
  assert.equal(detectImageFormat(Buffer.from([0x89, 0x50])), null, "demasiado corto");
  assert.equal(detectImageFormat(null), null);
});

test("buildProfilePhotoObjectName usa la convención users/{cedula}/profile", () => {
  assert.equal(
    buildProfilePhotoObjectName("0987654321", ".png", 1700000000000),
    "users/0987654321/profile/1700000000000.png"
  );
});

test("buildProfilePhotoObjectName saneja la cédula y exige que quede algo", () => {
  assert.equal(
    buildProfilePhotoObjectName("../../098 765", ".jpg", 42),
    "users/098765/profile/42.jpg"
  );
  assert.throws(() => buildProfilePhotoObjectName("///", ".jpg", 42), /cédula es requerida/);
  assert.throws(() => buildProfilePhotoObjectName(null, ".jpg", 42), /cédula es requerida/);
});

test("contentTypeForExtension cubre los formatos admitidos", () => {
  assert.equal(contentTypeForExtension(".png"), "image/png");
  assert.equal(contentTypeForExtension(".JPG"), "image/jpeg");
  assert.equal(contentTypeForExtension(".jpeg"), "image/jpeg");
  assert.equal(contentTypeForExtension(".webp"), "image/webp");
  assert.equal(contentTypeForExtension(".svg"), "application/octet-stream");
  assert.equal(contentTypeForExtension(""), "application/octet-stream");
});
