// Red unitaria del plan de almacenamiento y firma.
//
// Lo que la caracterización NO alcanza y aquí sí: el bootstrap no siembra certificados, así que
// `buildSignContext` siempre corta en "certificado no encontrado" y los guards de detrás —el
// certificado ilegible en almacenamiento, el modo de firma, el token— nunca se ejecutan por HTTP.
// Aquí se ejercitan todos, y sobre todo se fija el CÓDIGO de cada uno.
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSignContext,
  buildStandaloneUserSignedPath,
  buildValidationSpoolPath,
  parseFields,
  resolveFieldsForPdf,
  resolveSigningStoragePlan,
  resolveStoredDocumentObject,
} from "./PdfSigningService.js";

// --- resolveStoredDocumentObject ----------------------------------------------------------------

test("una ruta vacía no resuelve a ningún objeto", () => {
  assert.equal(resolveStoredDocumentObject(""), null);
  assert.equal(resolveStoredDocumentObject(null), null);
  assert.equal(resolveStoredDocumentObject("   "), null);
});

test("una ruta que ya trae el prefijo de documentos no lo duplica", () => {
  const resuelto = resolveStoredDocumentObject("Unidades/isi/informe.pdf");
  assert.equal(resuelto.objectName, "Unidades/isi/informe.pdf");
  assert.equal(resuelto.relativePath, "isi/informe.pdf");
});

test("una ruta sin prefijo lo recibe, y la barra inicial se descarta", () => {
  const resuelto = resolveStoredDocumentObject("/isi/informe.pdf");
  assert.equal(resuelto.objectName, "Unidades/isi/informe.pdf");
  assert.equal(resuelto.relativePath, "isi/informe.pdf");
});

// --- rutas del espacio personal -----------------------------------------------------------------

// La ruta cuelga del ID de la persona, NO de su cédula: un documento de identidad puede cambiar
// (un pasaporte se renueva, un extranjero se nacionaliza) y usarlo de dirección le perdería los
// ficheros. Este test es el que lo fija.
test("la ruta de validación cuelga del id de la persona y la sesión, y siempre acaba en .pdf", () => {
  const ruta = buildValidationSpoolPath({ id: 42, cedula: "1122334455" }, "sesion-1", "mi informe.txt");
  assert.equal(ruta, "users/42/validation/sesion-1/mi_informe.txt.pdf");
});

test("la ruta NO usa la cédula aunque venga en el objeto", () => {
  assert.ok(!buildValidationSpoolPath({ id: 7, cedula: "1122334455" }, "s", "x.pdf").includes("1122334455"));
  assert.ok(!buildStandaloneUserSignedPath({ id: 7, cedula: "1122334455" }, "s", "x.pdf").includes("1122334455"));
});

test("no se puede salir del directorio: las barras se vuelven '_' y el nombre queda plano", () => {
  // Los ".." que sobreviven son inocuos justamente porque ya no hay separadores que los separen.
  assert.equal(
    buildValidationSpoolPath({ id: 1 }, "s", "../../etc/passwd.pdf"),
    "users/1/validation/s/_.._etc_passwd.pdf",
  );
});

test("un nombre que ya es .pdf no se duplica la extensión, sin importar mayúsculas", () => {
  assert.ok(buildValidationSpoolPath({ id: 1 }, "s", "informe.PDF").endsWith("informe.PDF"));
  assert.ok(buildValidationSpoolPath({ id: 1 }, "s", "informe.pdf").endsWith("informe.pdf"));
});

test("la ruta de firma personal sanea el nombre y garantiza el .pdf", () => {
  assert.equal(
    buildStandaloneUserSignedPath({ id: 9 }, "s", "acta de grado.docx"),
    "users/9/signed/s/acta_de_grado.docx.pdf",
  );
  assert.equal(
    buildStandaloneUserSignedPath({ id: 9 }, "s", undefined),
    "users/9/signed/s/documento.pdf",
  );
});

// --- parseFields: entrada del cliente, luego 400 ------------------------------------------------

test("un JSON malformado en `fields` es 400, no 500", () => {
  assert.throws(() => parseFields("{no soy json"), (error) => error.statusCode === 400);
});

test("una lista vacía o algo que no es lista es 400", () => {
  assert.throws(() => parseFields("[]"), (error) => error.statusCode === 400);
  assert.throws(() => parseFields(undefined), (error) => error.statusCode === 400);
  assert.throws(() => parseFields('{"page":1}'), (error) => error.statusCode === 400);
});

test("los campos se normalizan a números y `pageReference` cae en 'start'", () => {
  assert.deepEqual(parseFields('[{"page":"2","x":"10.5","y":"20"}]'), [
    { page: 2, pageReference: "start", pageValue: 2, pageOffset: 0, x: 10.5, y: 20 },
  ]);
});

// --- resolveFieldsForPdf: la aritmética de páginas ----------------------------------------------

const conPaginas = (total) => ({ getPageCount: async () => total });

test("`end` cuenta desde el final y nunca baja de la página 1", async () => {
  const [ultima] = await resolveFieldsForPdf("x.pdf", [{ pageReference: "end", pageOffset: 0 }], conPaginas(5));
  assert.equal(ultima.page, 5);
  const [penultima] = await resolveFieldsForPdf("x.pdf", [{ pageReference: "end", pageOffset: 1 }], conPaginas(5));
  assert.equal(penultima.page, 4);
  const [desbordada] = await resolveFieldsForPdf("x.pdf", [{ pageReference: "end", pageOffset: 99 }], conPaginas(5));
  assert.equal(desbordada.page, 1);
});

test("`start` se recorta al total de páginas del PDF", async () => {
  const [dentro] = await resolveFieldsForPdf("x.pdf", [{ pageReference: "start", pageValue: 3 }], conPaginas(5));
  assert.equal(dentro.page, 3);
  const [fuera] = await resolveFieldsForPdf("x.pdf", [{ pageReference: "start", pageValue: 99 }], conPaginas(5));
  assert.equal(fuera.page, 5);
  const [cero] = await resolveFieldsForPdf("x.pdf", [{ pageReference: "start", pageValue: 0 }], conPaginas(5));
  assert.equal(cero.page, 1);
});

test("una referencia desconocida deja la página tal cual y conserva el resto del campo", async () => {
  const [campo] = await resolveFieldsForPdf("x.pdf", [{ pageReference: "raro", page: 2, x: 7 }], conPaginas(5));
  assert.equal(campo.page, 2);
  assert.equal(campo.x, 7);
});

// --- buildSignContext: la cadena de validación y sus códigos ------------------------------------

const CERT = { id: 1, bucket: "deasy-users", object_name: "users/1/cert.p12" };
const USUARIO = { id: 7, cedula: "1122334455", signatureToken: null };

const deps = (overrides = {}) => ({
  resolveUser: async () => USUARIO,
  findOwnedCertificate: async () => CERT,
  statObject: async () => ({ size: 10 }),
  ...overrides,
});

const cuerpoValido = (overrides = {}) => ({
  certificate_id: "1",
  password: "secreta",
  stampText: "  Firmado por X  ",
  fields: '[{"page":1,"x":1,"y":2}]',
  ...overrides,
});

test("sin certificate_id, sin contraseña o sin sello es 400 (y no se consulta nada)", async () => {
  let consultas = 0;
  const espia = deps({ resolveUser: async () => { consultas += 1; return USUARIO; } });
  for (const falta of [{ certificate_id: undefined }, { password: undefined }, { stampText: "   " }]) {
    await assert.rejects(
      () => buildSignContext({ body: cuerpoValido(falta), userId: 7 }, espia),
      (error) => error.statusCode === 400,
      JSON.stringify(falta),
    );
  }
  assert.equal(consultas, 0, "la validación de entrada va ANTES de tocar la base");
});

test("un certificate_id no numérico también es 400", async () => {
  await assert.rejects(
    () => buildSignContext({ body: cuerpoValido({ certificate_id: "abc" }), userId: 7 }, deps()),
    (error) => error.statusCode === 400,
  );
});

test("un certificado que no es tuyo es 404, indistinguible de uno inexistente", async () => {
  await assert.rejects(
    () => buildSignContext({ body: cuerpoValido(), userId: 7 }, deps({ findOwnedCertificate: async () => null })),
    (error) => error.statusCode === 404 && /Certificado no encontrado/.test(error.message),
  );
});

test("si el almacenamiento no responde NO se acusa al cliente: sin statusCode (500) y con la causa real", async () => {
  const fallo = new Error("connect ECONNREFUSED minio:9000");
  await assert.rejects(
    () => buildSignContext({ body: cuerpoValido(), userId: 7 }, deps({ statObject: async () => { throw fallo; } })),
    (error) => error.statusCode === undefined
      && error.cause === fallo
      && /ya no está disponible en almacenamiento/.test(error.message),
  );
});

test("un modo de firma desconocido es 400", async () => {
  await assert.rejects(
    () => buildSignContext({ body: cuerpoValido({ sign_mode: "telepatía" }), userId: 7 }, deps()),
    (error) => error.statusCode === 400,
  );
});

test("en modo token, sin token del usuario ni en el cuerpo, es 400", async () => {
  await assert.rejects(
    () => buildSignContext({ body: cuerpoValido({ sign_mode: "token" }), userId: 7 }, deps()),
    (error) => error.statusCode === 400 && /token de firma/.test(error.message),
  );
});

test("el contexto de coordenadas recorta el sello, normaliza los booleanos y trae los campos", async () => {
  const context = await buildSignContext({
    body: cuerpoValido({ use_timestamp: "true", allow_untrusted_signer: "1", tsa_url: "  " }),
    userId: 7,
  }, deps());
  assert.equal(context.signMode, "coordinates");
  assert.equal(context.stampText, "Firmado por X");
  assert.equal(context.useTimestamp, true);
  assert.equal(context.allowUntrustedSigner, true);
  assert.equal(context.tsaUrl, undefined);
  assert.equal(context.resolvedToken, null);
  assert.equal(context.fields.length, 1);
});

test("con `document_fields` presente, unos `fields` ilegibles NO tumban la petición (los pone el lote)", async () => {
  const context = await buildSignContext({
    body: cuerpoValido({ fields: "{roto", document_fields: "[]" }),
    userId: 7,
  }, deps());
  assert.deepEqual(context.fields, []);
});

test("sin `document_fields`, unos `fields` ilegibles sí son 400", async () => {
  await assert.rejects(
    () => buildSignContext({ body: cuerpoValido({ fields: "{roto" }), userId: 7 }, deps()),
    (error) => error.statusCode === 400,
  );
});

test("los ids de workflow llegan como número o como null, nunca como cadena", async () => {
  const context = await buildSignContext({
    body: cuerpoValido({ signature_request_id: "12", document_version_id: "" }),
    userId: 7,
  }, deps());
  assert.equal(context.signatureRequestId, 12);
  assert.equal(context.documentVersionId, null);
});

// --- resolveSigningStoragePlan: el modo personal (sin base de datos) ----------------------------

test("sin versión documental, el plan es 'standalone' y apunta al espacio personal", async () => {
  const plan = await resolveSigningStoragePlan({
    context: { documentVersionId: null, user: USUARIO },
    file: { originalname: "acta.pdf" },
  });
  assert.equal(plan.mode, "standalone");
  assert.equal(plan.documentVersionId, null);
  assert.match(plan.objectPath, /^users\/7\/signed\/[0-9a-f-]{36}\/acta\.pdf$/);
  assert.equal(plan.storedPath, plan.objectPath);
  assert.equal(plan.downloadPath, plan.objectPath);
});
