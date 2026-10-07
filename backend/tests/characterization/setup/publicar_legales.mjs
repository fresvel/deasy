// SIEMBRA EL ARCHIVO LEGAL, y existe porque sin ella el harness NO ES REPRODUCIBLE.
//
// ⚠️ EL PROBLEMA QUE ARREGLA, medido el 2026-10-07. `test:char:run` daba 319 de 321 en una pila
// RECIÉN CREADA, y los dos fallos eran `/legal/documentos` y su golden. Se comprobó que no era de
// ningún cambio de código: con el backend de `develop` en la MISMA pila fallaban los mismos dos.
//
// La causa: los textos legales viven SÓLO en MinIO (`deasy-legal`, con retención COMPLIANCE), y
// **ningún paso automático los creaba**. En las pilas A, B y C estaban porque alguien los publicó a
// mano meses atrás; una pila nueva arranca con el archivo vacío, el bootstrap adopta cero y el alta
// registraría CERO consentimientos sin que nada se queje. Una suite golden-master que depende de
// contenido publicado a mano no es una suite: es una coincidencia.
//
// ⚠️ Y LOS TEXTOS DE `legal/` SON LOS DE VERDAD, exportados de la pila A byte a byte para que el
// golden siga valiendo: `terminos_de_uso` son 2025 caracteres, que es exactamente lo que el golden
// afirma. No son textos inventados.
//
// Va DESPUÉS del bootstrap y ANTES del seed, y conduce el sistema por su propia API —como el resto
// del harness— en vez de escribir en MinIO a mano: así el object key, la huella y la retención salen
// por el mismo camino que en producción.
//
// Es IDEMPOTENTE: en una pila donde el archivo ya los tiene, el bootstrap los adopta y aquí se
// salta. Publicar dos veces fallaría a propósito —lo publicado es inmutable—.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { get, post, put } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";

const CARPETA = join(dirname(fileURLToPath(import.meta.url)), "legal");

// `<clase>__<version>.md`, que es la misma forma que el archivo usa en MinIO (`<clase>/<version>.md`).
const PATRON = /^([a-z_]+)__(.+)\.md$/;

// Un `ENOENT` de `scandir` no explica nada a quien lo lea dentro de media hora: el mismo mensaje
// sirve para la carpeta que falta y para la que esta vacia.
const textosDelArchivo = () => {
  if (!existsSync(CARPETA)) return [];
  return readdirSync(CARPETA).sort().filter((n) => PATRON.test(n));
};

const main = async () => {
  const nombres = textosDelArchivo();
  if (!nombres.length) {
    throw new Error(
      `No hay textos legales en ${CARPETA}. Sin ellos el alta registraria CERO consentimientos y dos ` +
        "pruebas de caracterizacion fallarian sin explicar por que (pasó el 2026-10-07)."
    );
  }

  const token = await tokenFor("admin");

  const actuales = await get("/admin/legal/documentos", { token });
  if (!actuales.ok) {
    throw new Error(`no se pudo listar lo legal: ${actuales.status} ${JSON.stringify(actuales.body)}`);
  }
  const publicadas = new Set(
    (actuales.body?.documentos ?? []).filter((d) => d.estado === "published").map((d) => d.clase)
  );

  let publicados = 0;
  const saltados = [];
  for (const nombre of nombres) {
    const [, clase, version] = PATRON.exec(nombre);

    if (publicadas.has(clase)) {
      saltados.push(`${clase} (ya publicada, adoptada del archivo)`);
      continue;
    }

    const texto = readFileSync(join(CARPETA, nombre), "utf8");

    const borrador = await post("/admin/legal/documentos", { token, body: { clase, version } });
    if (borrador.status !== 201) {
      throw new Error(`crear borrador ${clase} ${version}: ${borrador.status} ${JSON.stringify(borrador.body)}`);
    }
    const id = borrador.body?.documento?.id;

    const guardado = await put(`/admin/legal/documentos/${id}`, { token, body: { texto } });
    if (!guardado.ok) {
      throw new Error(`guardar ${clase}: ${guardado.status} ${JSON.stringify(guardado.body)}`);
    }

    const publicado = await post(`/admin/legal/documentos/${id}/publicar`, { token, body: {} });
    if (!publicado.ok) {
      throw new Error(`publicar ${clase}: ${publicado.status} ${JSON.stringify(publicado.body)}`);
    }
    publicados += 1;
    console.log(`[legal] publicado ${clase} ${version} (${texto.length} caracteres)`);
  }

  for (const s of saltados) console.log(`[legal] saltado: ${s}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
