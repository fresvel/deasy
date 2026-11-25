import { describe, it } from "node:test";
import assert from "node:assert/strict";

import DocumentosLegales, { CLASES } from "./DocumentosLegales.js";
import { huellaDe } from "./huella.js";

/**
 * UNA BASE DE MENTIRA con una sola tabla.
 *
 * Reconoce las consultas por su forma en vez de imitar SQL: lo que estos tests comprueban es el
 * ORDEN de las operaciones —qué se escribe, cuándo, y sobre todo **qué NO se escribe si algo
 * falla**—, no que PostgreSQL sepa hacer un `UPDATE`.
 */
const baseFalsa = (filasIniciales = []) => {
  const filas = filasIniciales.map((f) => ({ ...f }));
  let siguienteId = Math.max(0, ...filas.map((f) => f.id)) + 1;
  const escrituras = [];

  const query = async (sql, params = []) => {
    const texto = String(sql).replace(/\s+/g, " ").trim();

    if (texto === "SELECT id, clase, version, contenido_hash, object_version_id, estado FROM documentos_legales") {
      return [filas.map((f) => ({ ...f }))];
    }
    if (texto.startsWith("SELECT") && / WHERE id = \?/.test(texto)) {
      return [filas.filter((f) => f.id === Number(params[0]))];
    }
    if (texto.startsWith("SELECT") && /WHERE estado = 'published'/.test(texto)) {
      return [filas.filter((f) => f.estado === "published")];
    }
    if (texto.startsWith("SELECT") && /WHERE clase = \? AND estado = 'published'/.test(texto)) {
      return [filas.filter((f) => f.clase === params[0] && f.estado === "published")];
    }
    if (texto.startsWith("SELECT") && /WHERE clase = \? AND version = \?/.test(texto)) {
      return [filas.filter((f) => f.clase === params[0] && f.version === params[1])];
    }
    if (texto.startsWith("SELECT") && /ORDER BY clase/.test(texto)) {
      return [[...filas]];
    }
    if (texto.startsWith("INSERT INTO documentos_legales") && /object_version_id, contenido_hash, estado, publicado_at/.test(texto)) {
      const [clase, version, bucket, objectKey, objectVersionId, hash] = params;
      const fila = {
        id: siguienteId++, clase, version, bucket, object_key: objectKey,
        object_version_id: objectVersionId, contenido_hash: hash, estado: "published",
        publicado_at: new Date(), created_at: new Date(),
      };
      filas.push(fila);
      escrituras.push({ tipo: "adoptar", id: fila.id });
      return [{ insertId: fila.id }];
    }
    if (texto.startsWith("INSERT INTO documentos_legales")) {
      const [clase, version, bucket, objectKey] = params;
      const fila = {
        id: siguienteId++, clase, version, bucket, object_key: objectKey, object_version_id: null,
        contenido_hash: null, estado: "draft", publicado_at: null, created_at: new Date(),
      };
      filas.push(fila);
      escrituras.push({ tipo: "insert", id: fila.id });
      return [{ insertId: fila.id }];
    }
    if (/SET bucket = \?, object_key = \?, object_version_id = \?, contenido_hash = \? WHERE id = \?/.test(texto)) {
      const fila = filas.find((f) => f.id === Number(params[4]));
      Object.assign(fila, {
        bucket: params[0], object_key: params[1], object_version_id: params[2], contenido_hash: params[3],
      });
      escrituras.push({ tipo: "sellar", id: fila.id });
      return [{ affectedRows: 1 }];
    }
    if (/SET bucket = \?, object_key = \?, contenido_hash = \?/.test(texto)) {
      const fila = filas.find((f) => f.id === Number(params[3]));
      Object.assign(fila, { bucket: params[0], object_key: params[1], contenido_hash: params[2] });
      escrituras.push({ tipo: "guardar", id: fila.id });
      return [{ affectedRows: 1 }];
    }
    if (/SET estado = 'retired' WHERE clase = \?/.test(texto)) {
      for (const f of filas) {
        if (f.clase === params[0] && f.estado === "published" && f.id !== Number(params[1])) {
          f.estado = "retired";
          escrituras.push({ tipo: "retirar-anterior", id: f.id });
        }
      }
      return [{ affectedRows: 1 }];
    }
    if (/estado = 'published', publicado_at/.test(texto)) {
      const fila = filas.find((f) => f.id === Number(params[4]));
      Object.assign(fila, {
        bucket: params[0], object_key: params[1], object_version_id: params[2],
        contenido_hash: params[3], estado: "published", publicado_at: new Date(),
      });
      escrituras.push({ tipo: "publicar", id: fila.id });
      return [{ affectedRows: 1 }];
    }
    if (/SET estado = 'retired' WHERE id = \?/.test(texto)) {
      const fila = filas.find((f) => f.id === Number(params[0]));
      fila.estado = "retired";
      escrituras.push({ tipo: "retirar", id: fila.id });
      return [{ affectedRows: 1 }];
    }
    if (texto.startsWith("INSERT INTO consentimientos")) {
      escrituras.push({ tipo: "consentimiento", params });
      return [{ insertId: 1 }];
    }
    throw new Error(`La base de mentira no sabe responder a: ${texto}`);
  };

  return {
    filas,
    escrituras,
    query,
    async getConnection() {
      return { query, async beginTransaction() {}, async commit() {}, async rollback() {}, release() {} };
    },
  };
};

/** Un archivo de mentira. `falla` decide en qué punto se rompe. */
const archivoFalso = ({ falla = null, bytes = Buffer.from("TEXTO PUBLICABLE") } = {}) => ({
  llamadas: [],
  async guardarBorrador(clase, version, texto) {
    this.llamadas.push({ metodo: "guardarBorrador", clase, version, texto });
    if (falla === "guardarBorrador") throw new Error("MinIO no acepta el borrador");
    return { bucket: "legal-borradores", objectKey: `${clase}/${version}.md` };
  },
  async bytesDelBorrador() {
    if (falla === "bytesDelBorrador") throw new Error("el borrador no existe en MinIO");
    return bytes;
  },
  async leerBorrador() {
    return bytes.toString("utf8");
  },
  async archivar(clase, version, contenido) {
    this.llamadas.push({ metodo: "archivar", clase, version });
    if (falla === "archivar") {
      throw new Error("Lo archivado NO coincide con lo que se quiso archivar");
    }
    return {
      bucket: "legal",
      objectKey: `${clase}/${version}.md`,
      objectVersionId: "ver-7",
      hash: huellaDe(Buffer.from(contenido).toString("utf8")),
    };
  },
  async leerArchivado({ objectVersionId, hash }) {
    this.llamadas.push({ metodo: "leerArchivado", objectVersionId, hash });
    if (!objectVersionId) throw new Error("hace falta el identificador de version");
    if (falla === "leerArchivado") throw new Error("no cuadra con la huella registrada");
    return bytes.toString("utf8");
  },
  async historialBorrador(clase, version) {
    return [{ objectVersionId: "ver-3", fecha: new Date(), tamano: 10, esUltima: true, clase, version }];
  },
  async estadoDelArchivo() {
    return { bucket: "legal", bloqueado: true, modo: "COMPLIANCE", dias: 3650 };
  },
  inventario: [],
  async inventarioDelArchivo() {
    return this.inventario;
  },
});

const servicio = (base, archivo) => new DocumentosLegales(base, archivo);

const borrador = (extra = {}) => ({
  id: 1, clase: CLASES.TERMINOS, version: "v1", bucket: "legal-borradores",
  object_key: "terminos_de_uso/v1.md", object_version_id: null, contenido_hash: null,
  estado: "draft", publicado_at: null, created_at: new Date(), ...extra,
});

const publicado = (extra = {}) => borrador({
  id: 2, estado: "published", bucket: "legal", object_version_id: "ver-1",
  contenido_hash: huellaDe("TEXTO PUBLICABLE"), publicado_at: new Date(), ...extra,
});

describe("DocumentosLegales · publicar", () => {
  it("sella la fila con el bucket, la clave, la VERSION DE OBJETO y la huella", async () => {
    const base = baseFalsa([borrador()]);
    const doc = await servicio(base, archivoFalso()).publicar(1);

    assert.equal(doc.estado, "published");
    assert.equal(doc.bucket, "legal");
    assert.equal(doc.object_version_id, "ver-7");
    assert.equal(doc.contenido_hash, huellaDe("TEXTO PUBLICABLE"));
    assert.ok(doc.publicado_at);
  });

  it("NO escribe la fila si la verificacion del archivo falla", async () => {
    // La garantia central: la base se toca LA ULTIMA. Un puntero que dice apuntar a una prueba y
    // apunta a otra cosa es peor que no tener puntero.
    const base = baseFalsa([borrador()]);

    await assert.rejects(servicio(base, archivoFalso({ falla: "archivar" })).publicar(1), /NO coincide/);

    assert.equal(base.filas[0].estado, "draft", "la fila sigue siendo borrador");
    assert.equal(base.filas[0].object_version_id, null);
    assert.deepEqual(base.escrituras, [], "no se escribio NADA en la base");
  });

  it("tampoco escribe si el borrador no esta en MinIO", async () => {
    const base = baseFalsa([borrador()]);
    await assert.rejects(servicio(base, archivoFalso({ falla: "bytesDelBorrador" })).publicar(1), /no existe/);
    assert.deepEqual(base.escrituras, []);
  });

  it("se niega a publicar un borrador vacio", async () => {
    const base = baseFalsa([borrador()]);
    await assert.rejects(
      servicio(base, archivoFalso({ bytes: Buffer.alloc(0) })).publicar(1),
      /esta vacio/
    );
    assert.deepEqual(base.escrituras, []);
  });

  it("retira la version anterior de la misma clase, y no la borra", async () => {
    // Solo puede haber una publicada por clase (indice unico parcial). La anterior se RETIRA porque
    // hay gente cuya prueba de consentimiento apunta a ella.
    const base = baseFalsa([borrador(), publicado()]);
    await servicio(base, archivoFalso()).publicar(1);

    const anterior = base.filas.find((f) => f.id === 2);
    assert.equal(anterior.estado, "retired");
    assert.equal(anterior.object_version_id, "ver-1", "su puntero al archivo sigue intacto");
  });

  it("no se publica dos veces", async () => {
    const base = baseFalsa([publicado()]);
    await assert.rejects(servicio(base, archivoFalso()).publicar(2), /no es un borrador/);
  });

  it("y publicar es lo primero que hace que la huella se CALCULE de verdad", async () => {
    // Antes de esto la huella de la base era un literal escrito a mano que nada recomputaba.
    const base = baseFalsa([borrador()]);
    const archivo = archivoFalso({ bytes: Buffer.from("otro texto distinto") });
    const doc = await servicio(base, archivo).publicar(1);
    assert.equal(doc.contenido_hash, huellaDe("otro texto distinto"));
  });
});

describe("DocumentosLegales · borradores", () => {
  it("guardar escribe en MinIO y deja la huella de lo escrito", async () => {
    const base = baseFalsa([borrador()]);
    const archivo = archivoFalso();
    const doc = await servicio(base, archivo).guardarBorrador(1, "# Hola");

    assert.equal(doc.contenido_hash, huellaDe("# Hola"));
    assert.equal(doc.bucket, "legal-borradores", "un borrador NO va al bucket bloqueado");
    assert.equal(archivo.llamadas.at(-1).texto, "# Hola");
  });

  it("un documento publicado YA NO SE EDITA", async () => {
    const base = baseFalsa([publicado()]);
    await assert.rejects(servicio(base, archivoFalso()).guardarBorrador(2, "corregido"), /ya no se edita/);
    assert.deepEqual(base.escrituras, []);
  });

  it("crear un borrador exige una clase conocida", async () => {
    const base = baseFalsa([]);
    await assert.rejects(servicio(base, archivoFalso()).crearBorrador("lo_que_sea", "v1"), /desconocida/);
  });

  it("no se crea dos veces la misma version de la misma clase", async () => {
    const base = baseFalsa([borrador()]);
    await assert.rejects(servicio(base, archivoFalso()).crearBorrador(CLASES.TERMINOS, "v1"), /Ya existe/);
  });

  it("el historial del borrador sale del archivo, no de una tabla", async () => {
    const base = baseFalsa([borrador()]);
    const historial = await servicio(base, archivoFalso()).historial(1);
    assert.equal(historial.length, 1);
    assert.equal(historial[0].objectVersionId, "ver-3");
  });
});

describe("DocumentosLegales · retirar", () => {
  it("cambia el estado y NO mueve el objeto archivado", async () => {
    const base = baseFalsa([publicado()]);
    const archivo = archivoFalso();
    const doc = await servicio(base, archivo).retirar(2);

    assert.equal(doc.estado, "retired");
    assert.equal(doc.object_version_id, "ver-1");
    assert.ok(!archivo.llamadas.some((l) => l.metodo === "archivar"), "retirar no escribe en el archivo");
  });

  it("no se retira lo que no esta publicado", async () => {
    const base = baseFalsa([borrador()]);
    await assert.rejects(servicio(base, archivoFalso()).retirar(1), /no esta publicado/);
  });
});

describe("DocumentosLegales · leer lo publicado", () => {
  it("el texto sale del ARCHIVO y siempre por version de objeto", async () => {
    const base = baseFalsa([publicado()]);
    const archivo = archivoFalso();
    const [doc] = await servicio(base, archivo).publicados();

    assert.equal(doc.texto, "TEXTO PUBLICABLE");
    const lectura = archivo.llamadas.find((l) => l.metodo === "leerArchivado");
    assert.equal(lectura.objectVersionId, "ver-1", "jamas por clave");
    assert.equal(lectura.hash, publicado().contenido_hash, "y verificando la huella registrada");
  });

  it("validar un alta NO baja el texto de MinIO", async () => {
    // Se pide en cada registro y no mira el texto: bajarlo seria una descarga por alta para nada.
    const base = baseFalsa([publicado()]);
    const archivo = archivoFalso();
    const resultado = await servicio(base, archivo).validarAceptacion([2]);

    assert.equal(resultado.valida, true);
    assert.deepEqual(archivo.llamadas, []);
  });

  it("faltar una clase publicada invalida el alta", async () => {
    const base = baseFalsa([publicado(), publicado({ id: 3, clase: CLASES.DATOS })]);
    const resultado = await servicio(base, archivoFalso()).validarAceptacion([2]);
    assert.equal(resultado.valida, false);
    assert.deepEqual(resultado.faltan, [CLASES.DATOS]);
  });

  it("un id que no esta publicado se rechaza", async () => {
    const base = baseFalsa([borrador(), publicado()]);
    const resultado = await servicio(base, archivoFalso()).validarAceptacion([1]);
    assert.equal(resultado.valida, false);
    assert.equal(resultado.motivo, "documento_no_publicado");
  });

  it("una fila publicada SIN puntero al archivo no tumba la lista: da texto nulo", async () => {
    const base = baseFalsa([publicado({ object_version_id: null })]);
    const [doc] = await servicio(base, archivoFalso()).publicados();
    assert.equal(doc.texto, null);
  });
});

describe("DocumentosLegales · la huella", () => {
  it("normaliza los finales de linea de Windows", async () => {
    assert.equal(huellaDe("uno\r\ndos"), huellaDe("uno\ndos"));
  });

  it("y el salto de linea que añade cualquier editor al final", async () => {
    assert.equal(huellaDe("texto"), huellaDe("texto\n\n"));
  });
});

describe("DocumentosLegales · adoptarDelArchivo", () => {
  const enElArchivo = (objectKey, objectVersionId, fecha) => ({
    bucket: "legal", objectKey, objectVersionId, fecha, tamano: 10,
  });

  it("con la tabla vacia indexa lo subido, con su version real y la huella CALCULADA", async () => {
    // Es la unica forma de sembrar: el `object_version_id` no existe hasta despues de subir, asi
    // que un INSERT del esquema no puede conocerlo.
    const base = baseFalsa([]);
    const archivo = archivoFalso({ bytes: Buffer.from("# Terminos") });
    archivo.inventario = [enElArchivo("terminos_de_uso/v1.md", "ver-99", new Date(2026, 0, 1))];

    const hechos = await servicio(base, archivo).adoptarDelArchivo();

    assert.deepEqual(hechos.map((h) => h.accion), ["indexado"]);
    assert.equal(base.filas[0].estado, "published");
    assert.equal(base.filas[0].object_version_id, "ver-99");
    assert.equal(base.filas[0].contenido_hash, huellaDe("# Terminos"));
    assert.equal(archivo.llamadas.at(-1).objectVersionId, "ver-99", "lo leyo por version, no por clave");
  });

  it("ignora lo que no tenga forma de documento legal", async () => {
    const base = baseFalsa([]);
    const archivo = archivoFalso();
    archivo.inventario = [
      enElArchivo("suelto.md", "ver-1", new Date()),
      enElArchivo("clase_inventada/v1.md", "ver-2", new Date()),
      enElArchivo("terminos_de_uso/v1.md", "ver-3", new Date()),
    ];

    const hechos = await servicio(base, archivo).adoptarDelArchivo();
    assert.deepEqual(hechos.map((h) => h.clase), [CLASES.TERMINOS]);
  });

  it("con varias versiones de una clase indexa la mas reciente, y solo una", async () => {
    // El indice unico parcial admite UNA publicada por clase: indexar dos reventaria el arranque.
    const base = baseFalsa([]);
    const archivo = archivoFalso();
    archivo.inventario = [
      enElArchivo("terminos_de_uso/v1.md", "ver-1", new Date(2026, 0, 1)),
      enElArchivo("terminos_de_uso/v2.md", "ver-2", new Date(2026, 5, 1)),
    ];

    const hechos = await servicio(base, archivo).adoptarDelArchivo();
    assert.equal(hechos.length, 1);
    assert.equal(hechos[0].version, "v2");
  });

  it("SELLA una fila antigua sin puntero cuando la huella lo demuestra", async () => {
    // La fila la sembro el `INSERT` del esquema, cuando el texto vivia en una columna: esta
    // publicada, tiene su huella y no apunta a ninguna parte. Hay consentimientos colgando de su
    // id, asi que se repara en vez de recrearse.
    const legada = publicado({ id: 5, bucket: null, object_key: null, object_version_id: null,
      contenido_hash: huellaDe("EL TEXTO QUE ACEPTARON") });
    const base = baseFalsa([legada]);
    const archivo = archivoFalso({ bytes: Buffer.from("EL TEXTO QUE ACEPTARON") });
    archivo.inventario = [enElArchivo("terminos_de_uso/v1.md", "ver-42", new Date())];

    const hechos = await servicio(base, archivo).adoptarDelArchivo();

    assert.deepEqual(hechos.map((h) => h.accion), ["sellado"]);
    assert.equal(base.filas[0].id, 5, "la misma fila: los consentimientos siguen apuntando a ella");
    assert.equal(base.filas[0].object_version_id, "ver-42");
  });

  it("y NO la sella si la huella no coincide: seria cambiar lo que alguien acepto", async () => {
    const legada = publicado({ id: 5, bucket: null, object_key: null, object_version_id: null,
      contenido_hash: huellaDe("EL TEXTO QUE ACEPTARON") });
    const base = baseFalsa([legada]);
    const archivo = archivoFalso({ bytes: Buffer.from("UN TEXTO DISTINTO") });
    archivo.inventario = [enElArchivo("terminos_de_uso/v1.md", "ver-42", new Date())];

    assert.deepEqual(await servicio(base, archivo).adoptarDelArchivo(), []);
    assert.equal(base.filas[0].object_version_id, null, "la fila se queda como estaba");
    assert.deepEqual(base.escrituras, []);
  });

  it("no toca lo que YA tiene puntero: esto no es una sincronizacion", async () => {
    const base = baseFalsa([publicado()]);
    const archivo = archivoFalso();
    archivo.inventario = [enElArchivo("terminos_de_uso/v1.md", "ver-nuevo", new Date())];

    assert.deepEqual(await servicio(base, archivo).adoptarDelArchivo(), []);
    assert.equal(base.filas[0].object_version_id, "ver-1");
    assert.deepEqual(base.escrituras, []);
  });

  it("un borrador antiguo tampoco se sella: no esta publicado", async () => {
    const base = baseFalsa([borrador()]);
    const archivo = archivoFalso();
    archivo.inventario = [enElArchivo("terminos_de_uso/v1.md", "ver-9", new Date())];

    assert.deepEqual(await servicio(base, archivo).adoptarDelArchivo(), []);
    assert.deepEqual(base.escrituras, []);
  });
});
