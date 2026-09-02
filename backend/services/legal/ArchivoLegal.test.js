import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";

import ArchivoLegal, { claveDe } from "./ArchivoLegal.js";
import { huellaDe } from "./huella.js";

/**
 * UN MinIO DE MENTIRA, pero con las reglas que de verdad importan.
 *
 * No pretende imitar MinIO: imita **las cuatro cosas medidas** que el diseño da por ciertas, porque
 * son las que las garantías de `ArchivoLegal` presuponen.
 *
 *   1. Un bucket sin bloqueo responde con ERROR a `getObjectLockConfig` (no con una respuesta
 *      vacía), que es lo que obliga a traducirlo a `null` en el servicio.
 *   2. Sin versionado, `putObject` no devuelve `versionId`.
 *   3. ⚠️ **Una clave devuelve LA ÚLTIMA versión.** Es la trampa central: sobrescribir un objeto
 *      bloqueado no borra nada, pero cambia lo que la clave devuelve. Este doble lo reproduce, y es
 *      lo que hace que un test falle si alguien lee por clave.
 *   4. El bloqueo solo se puede pedir al crear el bucket.
 */
const minioFalso = () => {
  const buckets = new Map();
  let contador = 0;

  const bucketDe = (nombre) => {
    const b = buckets.get(nombre);
    if (!b) {
      const error = new Error(`NoSuchBucket: ${nombre}`);
      error.code = "NoSuchBucket";
      throw error;
    }
    return b;
  };

  return {
    buckets,
    // Cuando está a `true`, lo que se relee NO es lo que se escribió: simula un archivo que miente.
    corromperLectura: false,

    async bucketExists(nombre) {
      return buckets.has(nombre);
    },
    async makeBucket(nombre, _region, opciones = {}) {
      // ⚠️ MEDIDO: pedir la creacion CON bloqueo sobre un bucket que YA EXISTE sin el responde
      // «created successfully» y sale con codigo 0, sin bloquear nada. Por eso aqui es un no-op en
      // vez de un error: si el doble fallara, un `asegurarBuckets` que dedujera el bloqueo de «no
      // lanzo» pasaria los tests y dejaria el archivo sin proteger en produccion.
      if (buckets.has(nombre)) {
        return;
      }
      buckets.set(nombre, {
        bloqueo: opciones?.ObjectLocking ? { objectLockEnabled: "Enabled" } : null,
        // El bloqueo de objetos activa el versionado por su cuenta; sin él hay que pedirlo.
        versionado: Boolean(opciones?.ObjectLocking),
        objetos: new Map(),
        // Claves con *delete marker*: siguen teniendo todas sus versiones, pero la clave ya no
        // resuelve y desaparecen del listado.
        conMarcaDeBorrado: new Set(),
      });
    },
    async setBucketVersioning(nombre, config) {
      bucketDe(nombre).versionado = config?.Status === "Enabled";
    },
    async getObjectLockConfig(nombre) {
      const b = bucketDe(nombre);
      if (!b.bloqueo) {
        const error = new Error("Bucket is missing ObjectLockConfiguration");
        error.code = "ObjectLockConfigurationNotFoundError";
        throw error;
      }
      return b.bloqueo;
    },
    async setObjectLockConfig(nombre, conf) {
      const b = bucketDe(nombre);
      if (!b.bloqueo) {
        throw new Error("Bucket does not support locking");
      }
      b.bloqueo = { objectLockEnabled: "Enabled", ...conf };
    },
    async putObject(nombre, clave, bytes) {
      const b = bucketDe(nombre);
      const versiones = b.objetos.get(clave) ?? [];
      contador += 1;
      const versionId = b.versionado ? `ver-${contador}` : null;
      versiones.push({ versionId, bytes: Buffer.from(bytes), fecha: new Date(2026, 8, 2, 0, 0, contador) });
      b.objetos.set(clave, versiones);
      return { etag: `etag-${contador}`, versionId };
    },
    async removeObject(nombre, clave) {
      // Un borrado corriente sobre un objeto bloqueado SE ACEPTA: no destruye nada, pone un delete
      // marker. Es lo medido, y es lo que hace que leer por clave pueda responder «no existe».
      const b = bucketDe(nombre);
      b.conMarcaDeBorrado.add(clave);
      contador += 1;
      // ⚠️ Y el listado por versiones la devuelve como UNA ENTRADA MAS: `isLatest`, tamaño 0 y sin
      // contenido. Comprobado contra el MinIO real de la pila C.
      (b.objetos.get(clave) ?? []).push({
        versionId: `ver-${contador}`, bytes: Buffer.alloc(0), fecha: new Date(2026, 8, 2, 1, 0, contador),
        esMarcaDeBorrado: true,
      });
    },
    async getObject(nombre, clave, opciones = {}) {
      const b = bucketDe(nombre);
      const versiones = b.objetos.get(clave) ?? [];
      if (!opciones.versionId && b.conMarcaDeBorrado.has(clave)) {
        throw new Error(`NoSuchKey: ${clave}`);
      }
      const encontrada = opciones.versionId
        ? versiones.find((v) => v.versionId === opciones.versionId)
        : versiones.at(-1); // ← una clave devuelve LA ÚLTIMA, no la que alguien aceptó
      if (!encontrada) {
        throw new Error(`NoSuchKey: ${clave}`);
      }
      const bytes = this.corromperLectura ? Buffer.from("otra cosa") : encontrada.bytes;
      return Readable.from([bytes]);
    },
    listObjects(nombre, prefijo) {
      const b = bucketDe(nombre);
      const flujo = new Readable({ objectMode: true, read() {} });
      queueMicrotask(() => {
        for (const [clave, versiones] of b.objetos) {
          if (!clave.startsWith(prefijo)) continue;
          versiones.forEach((v, indice) => flujo.push({
            name: clave,
            versionId: v.versionId,
            lastModified: v.fecha,
            size: v.bytes.length,
            isLatest: indice === versiones.length - 1,
            isDeleteMarker: Boolean(v.esMarcaDeBorrado),
          }));
        }
        flujo.push(null);
      });
      return flujo;
    },
  };
};

const archivoDePrueba = (cliente, extra = {}) => new ArchivoLegal({
  cliente,
  bucket: "legal",
  bucketBorradores: "legal-borradores",
  dias: 3650,
  modo: "COMPLIANCE",
  ...extra,
});

describe("ArchivoLegal · las claves de objeto", () => {
  it("son <clase>/<version>.md", () => {
    assert.equal(claveDe("terminos_de_uso", "v2"), "terminos_de_uso/v2.md");
  });

  it("rechazan lo que se saldria de su sitio", () => {
    assert.throws(() => claveDe("../../otro", "v1"), /no validas/);
    assert.throws(() => claveDe("terminos_de_uso", "v1/../../x"), /no validas/);
  });
});

describe("ArchivoLegal · asegurarBuckets", () => {
  it("crea el archivo CON bloqueo y le pone la retencion por defecto", async () => {
    const minio = minioFalso();
    await archivoDePrueba(minio).asegurarBuckets();

    const archivo = minio.buckets.get("legal");
    assert.ok(archivo.bloqueo, "el bucket de archivo tiene que nacer con bloqueo de objetos");
    assert.equal(archivo.bloqueo.mode, "COMPLIANCE");
    assert.equal(archivo.bloqueo.validity, 3650);
    assert.equal(archivo.bloqueo.unit, "Days");
  });

  it("el de borradores NO lleva bloqueo, pero si versionado", async () => {
    const minio = minioFalso();
    await archivoDePrueba(minio).asegurarBuckets();

    const borradores = minio.buckets.get("legal-borradores");
    assert.equal(borradores.bloqueo, null, "un borrador bloqueado no se podria corregir");
    assert.equal(borradores.versionado, true, "sin versionado no hay historial de edicion");
  });

  it("SE NIEGA si el bucket de archivo ya existe SIN bloqueo", async () => {
    // Es la garantia principal, y es fail-closed a proposito: el bloqueo solo se concede al crear
    // el bucket, asi que aqui no hay nada que reparar sobre la marcha. Seguir adelante produciria
    // un archivo que parece prueba y no lo es.
    const minio = minioFalso();
    await minio.makeBucket("legal", "");

    await assert.rejects(
      archivoDePrueba(minio).asegurarBuckets(),
      /SIN bloqueo de objetos.*NO se puede añadir despues/s
    );
  });

  it("y el mensaje dice como se arregla, porque no es obvio", async () => {
    const minio = minioFalso();
    await minio.makeBucket("legal", "");
    await assert.rejects(archivoDePrueba(minio).asegurarBuckets(), (error) => {
      assert.match(error.message, /RECREARLO/);
      return true;
    });
  });
});

describe("ArchivoLegal · archivar", () => {
  it("devuelve la version de objeto y la huella de lo escrito", async () => {
    const minio = minioFalso();
    const archivo = archivoDePrueba(minio);
    await archivo.asegurarBuckets();

    const sellado = await archivo.archivar("terminos_de_uso", "v1", "# Terminos\n");

    assert.equal(sellado.bucket, "legal");
    assert.equal(sellado.objectKey, "terminos_de_uso/v1.md");
    assert.ok(sellado.objectVersionId, "sin version de objeto el puntero seria ambiguo");
    assert.equal(sellado.hash, huellaDe("# Terminos\n"));
  });

  it("LANZA si lo releido no coincide con lo que se quiso archivar", async () => {
    const minio = minioFalso();
    const archivo = archivoDePrueba(minio);
    await archivo.asegurarBuckets();
    minio.corromperLectura = true;

    await assert.rejects(
      archivo.archivar("terminos_de_uso", "v1", "# Terminos\n"),
      /NO coincide con lo que se quiso archivar/
    );
  });

  it("LANZA si el bucket no devuelve version de objeto", async () => {
    // Pasa de verdad: un bucket sin versionado acepta el `put` tan campante y devuelve `versionId`
    // nulo. Sin esa comprobacion se sellaria una fila que solo se puede leer por clave.
    const minio = minioFalso();
    await minio.makeBucket("legal", "", { ObjectLocking: true });
    minio.buckets.get("legal").versionado = false;

    await assert.rejects(
      archivoDePrueba(minio).archivar("terminos_de_uso", "v1", "texto"),
      /no devolvio un identificador de version/
    );
  });

  it("una sobrescritura NO se lleva por delante lo ya archivado", async () => {
    // El WORM protege la VERSION, no la clave: escribir encima esta permitido. Lo que no puede
    // pasar es que quien tenga la version vieja reciba lo nuevo.
    const minio = minioFalso();
    const archivo = archivoDePrueba(minio);
    await archivo.asegurarBuckets();

    const primero = await archivo.archivar("terminos_de_uso", "v1", "TEXTO ORIGINAL");
    await archivo.archivar("terminos_de_uso", "v1", "TEXTO SUPLANTADO");

    const leido = await archivo.leerArchivado({ ...primero });
    assert.equal(leido, "TEXTO ORIGINAL");
  });
});

describe("ArchivoLegal · leerArchivado", () => {
  it("EXIGE la version de objeto", async () => {
    const minio = minioFalso();
    const archivo = archivoDePrueba(minio);
    await archivo.asegurarBuckets();
    const sellado = await archivo.archivar("terminos_de_uso", "v1", "TEXTO");

    await assert.rejects(
      archivo.leerArchivado({ bucket: sellado.bucket, objectKey: sellado.objectKey }),
      /hace falta el identificador de version/
    );
  });

  it("y la exige aunque le den la huella: una huella no desambigua, solo delata", async () => {
    const archivo = archivoDePrueba(minioFalso());
    await assert.rejects(
      archivo.leerArchivado({ objectKey: "terminos_de_uso/v1.md", hash: huellaDe("TEXTO") }),
      /hace falta el identificador de version/
    );
  });

  it("verifica la huella cuando se la dan, y lanza si no cuadra", async () => {
    const minio = minioFalso();
    const archivo = archivoDePrueba(minio);
    await archivo.asegurarBuckets();
    const sellado = await archivo.archivar("terminos_de_uso", "v1", "TEXTO");

    await assert.rejects(
      archivo.leerArchivado({ ...sellado, hash: huellaDe("OTRO TEXTO") }),
      /no cuadra con la huella registrada/
    );
  });

  it("sin clave tampoco lee", async () => {
    const archivo = archivoDePrueba(minioFalso());
    await assert.rejects(archivo.leerArchivado({ objectVersionId: "ver-1" }), /hace falta la clave/);
  });
});

describe("ArchivoLegal · borradores", () => {
  it("cada guardado deja una entrada en el historial, y la fila sigue siendo una", async () => {
    const minio = minioFalso();
    const archivo = archivoDePrueba(minio);
    await archivo.asegurarBuckets();

    await archivo.guardarBorrador("terminos_de_uso", "v2", "primera");
    await archivo.guardarBorrador("terminos_de_uso", "v2", "segunda");
    await archivo.guardarBorrador("terminos_de_uso", "v2", "tercera");

    const historial = await archivo.historialBorrador("terminos_de_uso", "v2");
    assert.equal(historial.length, 3);
    assert.equal(historial[0].esUltima, true, "el mas reciente va primero");
    assert.ok(historial.every((e) => e.objectVersionId), "cada guardado tiene su version de objeto");
    assert.equal(await archivo.leerBorrador("terminos_de_uso", "v2"), "tercera");
  });

  it("los bytes del borrador se entregan sin pasar por texto", async () => {
    const minio = minioFalso();
    const archivo = archivoDePrueba(minio);
    await archivo.asegurarBuckets();
    await archivo.guardarBorrador("terminos_de_uso", "v2", "áéí ⟦corchetes⟧");

    const bytes = await archivo.bytesDelBorrador("terminos_de_uso", "v2");
    assert.ok(Buffer.isBuffer(bytes));
    assert.equal(bytes.toString("utf8"), "áéí ⟦corchetes⟧");
  });
});

describe("ArchivoLegal · estadoDelArchivo", () => {
  it("lo lee DEL BUCKET, no de la configuracion que se le paso", async () => {
    const minio = minioFalso();
    const archivo = archivoDePrueba(minio);
    await archivo.asegurarBuckets();
    // Alguien cambia la retencion por fuera: el estado tiene que contar lo que hay, no lo que se
    // pidio en su dia.
    minio.buckets.get("legal").bloqueo = { objectLockEnabled: "Enabled", mode: "COMPLIANCE", unit: "Years", validity: 10 };

    const estado = await archivo.estadoDelArchivo();
    assert.deepEqual(
      { bucket: estado.bucket, bloqueado: estado.bloqueado, modo: estado.modo, dias: estado.dias },
      { bucket: "legal", bloqueado: true, modo: "COMPLIANCE", dias: 3650 }
    );
  });

  it("un bucket sin bloqueo se enseña como NO bloqueado, con su motivo", async () => {
    const minio = minioFalso();
    await minio.makeBucket("legal", "");

    const estado = await archivoDePrueba(minio).estadoDelArchivo();
    assert.equal(estado.bloqueado, false);
    assert.match(estado.motivo, /sin bloqueo/);
  });

  it("un bucket que PUEDE bloquear pero no tiene retencion tampoco esta protegido de hecho", async () => {
    // Medido: un bucket con Object Lock admite objetos SIN bloquear si no hay retencion por
    // defecto. Enseñarlo como «bloqueado: si» a secas seria mentir.
    const minio = minioFalso();
    await minio.makeBucket("legal", "", { ObjectLocking: true });

    const estado = await archivoDePrueba(minio).estadoDelArchivo();
    assert.equal(estado.modo, null);
    assert.match(estado.motivo, /NO tiene retencion por defecto/);
  });

  it("no revienta si MinIO no contesta: lo cuenta", async () => {
    const roto = { async bucketExists() { throw new Error("connect ECONNREFUSED minio:9000"); } };
    const estado = await archivoDePrueba(roto).estadoDelArchivo();
    assert.equal(estado.bloqueado, false);
    assert.match(estado.motivo, /ECONNREFUSED/);
  });
});

describe("ArchivoLegal · la comprobacion del bloqueo", () => {
  it("NO se deduce de que makeBucket no fallara: se le PIDE la retencion al bucket", async () => {
    // Este test existe por una medicion concreta: `mc mb --with-lock --ignore-existing` sobre un
    // bucket que ya existe SIN bloqueo responde «Bucket created successfully» y sale con 0. Quien
    // implemente el fail-closed como «intento crearlo con bloqueo y, si no lanza, esta bloqueado»
    // no detecta NADA -- y el archivo legal se queda sin proteger, en silencio y para siempre.
    const minio = minioFalso();
    await minio.makeBucket("legal", "");

    // La creacion "con bloqueo" sobre el existente no lanza y NO lo bloquea. Es el escenario exacto.
    await minio.makeBucket("legal", "", { ObjectLocking: true });
    assert.equal(minio.buckets.get("legal").bloqueo, null, "sigue sin bloqueo pese a haberlo pedido");

    // Y aun asi, asegurarBuckets se entera. Porque pregunta.
    await assert.rejects(archivoDePrueba(minio).asegurarBuckets(), /SIN bloqueo de objetos/);
  });

  it("un delete marker esconde la clave, pero la version archivada sigue leyendose", async () => {
    // Medido: un borrado corriente sobre un objeto bloqueado se acepta, no destruye nada y hace que
    // el objeto desaparezca del listado. Leer por clave responderia «no existe»; por version, no.
    const minio = minioFalso();
    const archivo = archivoDePrueba(minio);
    await archivo.asegurarBuckets();
    const sellado = await archivo.archivar("terminos_de_uso", "v1", "LA PRUEBA");

    await minio.removeObject("legal", sellado.objectKey);

    assert.deepEqual(
      await archivo.inventarioDelArchivo(), [],
      "la marca de borrado NO se toma por un documento: leerla responderia 'method not allowed'"
    );
    await assert.rejects(minio.getObject("legal", sellado.objectKey), /NoSuchKey/, "por clave, no existe");
    assert.equal(await archivo.leerArchivado({ ...sellado }), "LA PRUEBA", "por version, sigue intacta");
  });
});

describe("ArchivoLegal · inventarioDelArchivo", () => {
  it("devuelve la ULTIMA version de cada clave, con su identificador", async () => {
    const minio = minioFalso();
    const archivo = archivoDePrueba(minio);
    await archivo.asegurarBuckets();
    await archivo.archivar("terminos_de_uso", "v1", "primero");
    const ultimo = await archivo.archivar("terminos_de_uso", "v1", "segundo");
    await archivo.archivar("tratamiento_de_datos", "v1", "datos");

    const inventario = await archivo.inventarioDelArchivo();

    assert.equal(inventario.length, 2, "una entrada por clave, no por version");
    const terminos = inventario.find((o) => o.objectKey === "terminos_de_uso/v1.md");
    assert.equal(terminos.objectVersionId, ultimo.objectVersionId);
    assert.equal(terminos.bucket, "legal");
  });
});

describe("ArchivoLegal · las marcas de borrado", () => {
  it("no cuentan como un guardado en el historial del borrador", async () => {
    const minio = minioFalso();
    const archivo = archivoDePrueba(minio);
    await archivo.asegurarBuckets();
    await archivo.guardarBorrador("terminos_de_uso", "v2", "unico guardado");
    await minio.removeObject("legal-borradores", "terminos_de_uso/v2.md");

    const historial = await archivo.historialBorrador("terminos_de_uso", "v2");
    assert.equal(historial.length, 1, "un borrado no es una edicion");
    assert.equal(historial[0].tamano, "unico guardado".length);
  });
});
