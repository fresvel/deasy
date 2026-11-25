// SIEMBRA EL ARCHIVO LEGAL, y existe porque sin ella el harness NO ES REPRODUCIBLE.
//
// ⚠️ EL PROBLEMA QUE ARREGLA, medido el 2026-10-07. `test:char:run` daba 319 de 321 en una pila
// RECIÉN CREADA, y los dos fallos eran `/legal/documentos` y su golden. Se comprobó que no era de
// ningún cambio de código: con el backend de `develop` en la MISMA pila fallaban los mismos dos.
//
// La causa: los textos legales viven SÓLO en el almacén (`deasy-legal`, con retención COMPLIANCE), y
// **ningún paso automático los creaba**. En las pilas A, B y C estaban porque alguien los publicó a
// mano meses atrás; una pila nueva arranca con el archivo vacío, el bootstrap adopta cero y el alta
// registraría CERO consentimientos sin que nada se queje. Una suite golden-master que depende de
// contenido publicado a mano no es una suite: es una coincidencia.
//
// ⚠️ LOS TEXTOS SON LOS MISMOS QUE LA INSTALACIÓN PRECARGA (`services/legal/textos/`, a través de
// `textosIniciales()`): una sola copia. Vivían aquí, en `legal/`, exportados byte a byte de la pila
// A para que el golden siguiera valiendo —`terminos_de_uso` son 2025 caracteres, que es lo que el
// golden afirma—, y se mudaron sin tocar un byte el 2026-11-25.
//
// Desde ese día el bootstrap deja un BORRADOR de cada clase. Este paso lo PUBLICA —que es lo único
// que la instalación no hace sola— en vez de crear otro; y si no lo encuentra, lo crea.
//
// Va DESPUÉS del bootstrap y ANTES del seed, y conduce el sistema por su propia API —como el resto
// del harness— en vez de escribir en el almacén a mano: así el object key, la huella y la retención salen
// por el mismo camino que en producción.
//
// Es IDEMPOTENTE: en una pila donde el archivo ya los tiene, el bootstrap los adopta y aquí se
// salta. Publicar dos veces fallaría a propósito —lo publicado es inmutable—.
import { get, post, put } from "../lib/http.mjs";
import { tokenFor } from "../lib/auth.mjs";
import { textosIniciales } from "../../../services/legal/textosIniciales.js";

const main = async () => {
  const textos = textosIniciales();
  const token = await tokenFor("admin");

  const actuales = await get("/admin/legal/documentos", { token });
  if (!actuales.ok) {
    throw new Error(`no se pudo listar lo legal: ${actuales.status} ${JSON.stringify(actuales.body)}`);
  }
  const documentos = actuales.body?.documentos ?? [];
  const publicadas = new Set(documentos.filter((d) => d.estado === "published").map((d) => d.clase));

  const saltados = [];
  for (const { clase, version, texto } of textos) {
    if (publicadas.has(clase)) {
      saltados.push(`${clase} (ya publicada, adoptada del archivo)`);
      continue;
    }

    // El borrador que precargó el bootstrap, si está; si no, uno nuevo.
    let id = documentos.find((d) => d.clase === clase && d.version === version && d.estado === "draft")?.id;
    const origen = id ? "precargado" : "creado aquí";
    if (!id) {
      const borrador = await post("/admin/legal/documentos", { token, body: { clase, version } });
      if (borrador.status !== 201) {
        throw new Error(`crear borrador ${clase} ${version}: ${borrador.status} ${JSON.stringify(borrador.body)}`);
      }
      id = borrador.body?.documento?.id;
    }

    const guardado = await put(`/admin/legal/documentos/${id}`, { token, body: { texto } });
    if (!guardado.ok) {
      throw new Error(`guardar ${clase}: ${guardado.status} ${JSON.stringify(guardado.body)}`);
    }

    const publicado = await post(`/admin/legal/documentos/${id}/publicar`, { token, body: {} });
    if (!publicado.ok) {
      throw new Error(`publicar ${clase}: ${publicado.status} ${JSON.stringify(publicado.body)}`);
    }
    console.log(`[legal] publicado ${clase} ${version} (${texto.length} caracteres; borrador ${origen})`);
  }

  for (const s of saltados) console.log(`[legal] saltado: ${s}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
