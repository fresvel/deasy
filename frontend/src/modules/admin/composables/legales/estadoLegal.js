/**
 * QUÉ SE PUEDE HACER CON UN TEXTO LEGAL, Y QUÉ SE LE DICE A QUIEN LO VA A HACER.
 *
 * ── POR QUÉ ESTO NO VIVE EN EL COMPONENTE ───────────────────────────────────────────────────────
 *
 * Porque aquí hay **dos cosas irreversibles** y una pantalla no es sitio para razonarlas:
 *
 *   · **Publicar mete el texto en un archivo WORM.** No se puede quitar ni corregir — ni por
 *     nosotros. Una errata publicada sólo se arregla publicando otra versión, que es una decisión
 *     distinta y con coste.
 *   · **Retirar no borra.** La versión retirada se conserva para siempre, porque hay gente cuya
 *     prueba de consentimiento apunta a ella. Borrarla dejaría esos consentimientos sin respaldo.
 *
 * Los avisos que dicen eso son constantes de este módulo y **tienen test**, exactamente por el mismo
 * motivo por el que `semaforo.js` tiene test: el día que alguien los suavice a un «¿estás seguro?»,
 * algo se pone rojo.
 *
 * ── Y SE NOMBRA EL TONO, NO EL COLOR ────────────────────────────────────────────────────────────
 *
 * Regla del repositorio con su propia puerta (`check:color-theme`, `check:state-tone`): si la
 * función pregunta por los DATOS se queda en su componente; si pregunta por el COLOR se va al CSS.
 * En medio está el nombre del tono. El vocabulario es el de `AppTag`, y el diccionario de ciclo de
 * vida —`draft` · `published` · `retired`— ya existe en `estadoTono.js` con estos tres valores
 * exactos: se REUSA, no se copia. Era el mismo eje que `template_artifacts.lifecycle_state`.
 */
import { TONOS, etiquetaCicloVida, tonoCicloVida } from "@/shared/utils/estadoTono";

/** Cómo se llama cada clase en pantalla. La clase es del modelo; esto es de la vista. */
export const CLASES = Object.freeze({
  terminos_de_uso: "Términos de uso",
  tratamiento_de_datos: "Tratamiento de datos personales",
});

/* El orden en que se enseñan. Uno que el backend traiga y aquí no esté NO se esconde: se pinta al
   final con su nombre crudo. Una lista escrita a mano que filtra es una forma de perder datos. */
const ORDEN = Object.keys(CLASES);

export const etiquetaClase = (clase) => CLASES[clase] ?? String(clase ?? "");

/** Agrupa por clase conservando lo desconocido. Devuelve `[{ clase, titulo, versiones }]`. */
export const agruparPorClase = (documentos = []) => {
  const grupos = new Map(ORDEN.map((clase) => [clase, []]));
  for (const documento of documentos) {
    const clase = documento?.clase ?? "";
    if (!grupos.has(clase)) grupos.set(clase, []);
    grupos.get(clase).push(documento);
  }
  return [...grupos.entries()].map(([clase, versiones]) => ({
    clase,
    titulo: etiquetaClase(clase),
    versiones,
  }));
};

/**
 * La fecha, legible y ESTABLE.
 *
 * ⚠️ No se usa `toLocaleString()` a secas: depende de la zona y del idioma de la máquina, así que
 * dos personas mirando la misma pantalla verían fechas distintas —y un test vería una tercera—.
 * Aquí importa poder decir «esta versión se publicó ANTES que aquélla», y para eso el formato fijo
 * `AAAA-MM-DD HH:MM` en UTC basta y no miente.
 */
export const fechaLegible = (iso) => {
  if (!iso) return "—";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return String(iso);
  return `${fecha.toISOString().slice(0, 10)} ${fecha.toISOString().slice(11, 16)} UTC`;
};

export const tonoDeDocumento = (documento) => tonoCicloVida(documento?.estado);
export const etiquetaDeEstado = (documento) => etiquetaCicloVida(documento?.estado);

/* ── LAS TRES REGLAS DE LO QUE SE PUEDE HACER ───────────────────────────────────────────────────
 *
 * Están aquí y no en el `v-if` de la plantilla porque el componente las necesita DOS veces —para
 * enseñar el botón y para no dejar pasar la acción— y porque son la única defensa del lado del
 * navegador contra editar algo que ya es inmutable. La de verdad la pone el backend; ésta evita
 * pedir una operación que sabemos que va a fallar, y evita enseñar un botón que miente. */

/** Sólo un borrador se edita. Lo publicado está en WORM: el backend lo rechazaría, y con razón. */
export const puedeEditarse = (documento) => documento?.estado === "draft";

/** Sólo se publica lo que aún es borrador. Publicar dos veces no tiene significado. */
export const puedePublicarse = (documento) => documento?.estado === "draft";

/** Sólo se retira lo publicado. Un borrador no se retira: se deja de editar. */
export const puedeRetirarse = (documento) => documento?.estado === "published";

/* ── LO QUE SE DICE ANTES DE HACERLO ────────────────────────────────────────────────────────────
 *
 * ⚠️ NO SON «¿ESTÁS SEGURO?». Un «¿estás seguro?» no informa de nada: quien lo lee ya cree estar
 * seguro, porque no sabe lo que ignora. Lo que hay que decir es QUÉ pasa después y QUÉ ya no se
 * podrá deshacer. */

export const AVISO_PUBLICAR = Object.freeze({
  titulo: "Publicar es irreversible",
  cuerpo:
    "Al publicar, el texto entra en un archivo inmutable. Ni nosotros podemos quitarlo ni corregirlo: " +
    "no hay «deshacer», no hay «editar después» y no hay borrado. " +
    "Si esta versión lleva una errata, la única salida es publicar otra versión con el texto corregido.",
  confirmar: "Sí, publicar y hacerlo inmutable",
});

export const AVISO_RETIRAR = Object.freeze({
  titulo: "Retirar no borra: la versión se conserva para siempre",
  cuerpo:
    "Retirar sólo significa que esta versión deja de ofrecerse a quien se registre a partir de ahora. " +
    "El texto se conserva para siempre, porque hay personas cuyo consentimiento apunta a ESTA versión " +
    "y su prueba dejaría de poder comprobarse si desapareciera.",
  confirmar: "Sí, dejar de ofrecerla",
});

export const avisoDe = (accion) => (accion === "retirar" ? AVISO_RETIRAR : AVISO_PUBLICAR);

/**
 * La SEGUNDA consecuencia de publicar, que no es evidente y no la dice el botón: sólo puede haber
 * una versión publicada por clase, así que publicar **retira la que estuviera vigente**.
 *
 * Lo hace el backend en la misma transacción (`DocumentosLegales.publicar`), y sin este aviso quien
 * pulsa cree que está añadiendo una versión cuando además está jubilando otra.
 */
export const avisoDeDesplazamiento = (versionVigente) =>
  versionVigente
    ? `Al publicar, la versión ${versionVigente} —hoy vigente— pasa a retirada automáticamente. No se borra: se conserva, porque hay consentimientos que apuntan a ella.`
    : "";

/* ── EL ARCHIVO INMUTABLE ───────────────────────────────────────────────────────────────────────
 *
 * ⚠️ **NO SE PINTA VERDE SIN RETENCIÓN DE CUMPLIMIENTO**, y es el mismo argumento que sostiene el
 * semáforo de los canales: un veredicto verde sin nada detrás es peor que no tener veredicto,
 * porque tiene la autoridad de un semáforo.
 *
 * Y aquí el matiz tiene nombre propio en el propio almacén: el modo **`GOVERNANCE` se puede
 * levantar** por quien tenga el permiso adecuado, así que promete inmutabilidad y no la garantiza.
 * Sólo `COMPLIANCE` no la puede levantar nadie, ni la cuenta raíz. Pintar los dos igual sería
 * decirle a la institución que su archivo es inviolable cuando puede no serlo. */
const MODO_QUE_NADIE_LEVANTA = "compliance";

export const tonoDelArchivo = (archivo) => {
  if (!archivo) return TONOS.NEUTRAL;
  if (!archivo.bloqueado) return TONOS.DANGER;
  return String(archivo.modo ?? "").toLowerCase() === MODO_QUE_NADIE_LEVANTA
    ? TONOS.SUCCESS
    : TONOS.WARNING;
};

export const etiquetaDelArchivo = (archivo) => {
  if (!archivo) return "Sin datos";
  if (!archivo.bloqueado) return "Sin retención";
  return String(archivo.modo ?? "").toLowerCase() === MODO_QUE_NADIE_LEVANTA
    ? "Retención de cumplimiento"
    : "Retención revocable";
};

/** Qué se le dice a quien mira, que es distinto del color y a veces más importante. */
export const explicacionDelArchivo = (archivo) => {
  if (!archivo) return "Todavía no se ha podido consultar el estado del archivo.";
  if (!archivo.bloqueado) {
    return "El archivo NO tiene retención activa: lo publicado se podría borrar o sustituir. Mientras siga así, no se puede afirmar que un texto publicado sea inalterable.";
  }
  const dias = Number(archivo.dias ?? 0);
  const plazo = dias > 0 ? `durante ${dias} días` : "sin plazo declarado";
  if (String(archivo.modo ?? "").toLowerCase() !== MODO_QUE_NADIE_LEVANTA) {
    return `El archivo retiene lo publicado ${plazo}, pero en un modo que alguien con permiso PUEDE levantar. No equivale a inmutabilidad.`;
  }
  return `Lo publicado queda retenido ${plazo} en modo de cumplimiento: no lo puede borrar ni sustituir nadie, tampoco quien administra el almacén.`;
};
