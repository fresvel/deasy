/* EL DICCIONARIO VALOR → TONO.
 *
 * Antes de F3.3 el color de un estado vivía en ~20 helpers repartidos por veinte ficheros, cada
 * uno devolviendo cadenas de utilidades Tailwind (`"bg-emerald-50 text-success ring-emerald-200"`).
 * Eso tenía dos consecuencias, y la segunda es la grave:
 *
 *   1. El mismo valor se pintaba con 4-5 recetas distintas según la pantalla.
 *   2. **Ningún gate de CSS podía verlo**, porque una clase dentro de una cadena de JavaScript no
 *      está ni en un `.css` ni en un `class=`. Por eso duró meses.
 *
 * El corte que ordena esto se enuncia en una frase:
 *
 *   > Si la función pregunta por los DATOS, se queda en su componente. Si pregunta por el COLOR,
 *   > se va al CSS. Entre las dos está el nombre del tono, y ese es el contrato: vive aquí.
 *
 * Precedente del repo: `workspaceNavIcons.js`, que hace exactamente esto para los iconos de la
 * barra —un módulo JS que nombra un modificador CSS— y tiene su test al lado.
 */

/* El vocabulario cerrado. Son las variantes de `AppTag` (`variantClassMap` en `AppTag.vue`). */
export const TONOS = Object.freeze({
  SUCCESS: "success",
  WARNING: "warning",
  DANGER: "danger",
  INFO: "info",
  SALMON: "salmon",
  PRIMARY: "primary",
  ACCENT: "accent",
  NEUTRAL: "neutral"
});

/* ── CICLO DE VIDA ─────────────────────────────────────────────────────────────────────────
 *
 * Cubre DOS ejes con un solo diccionario, porque son el mismo concepto con distinto nombre de
 * campo: `process_definition_versions.status` (draft/active/retired) y
 * `template_artifacts.lifecycle_state` (draft/published/retired).
 *
 * ⚠️ EL ESQUEMA LO DECIDIÓ EL DUEÑO EL 2026-08-15, y corrige una contradicción dura: hasta
 * entonces `UnitGraphView.processStatusClass` y `ProcessGraphView.configStatusClass` leían **el
 * mismo campo de la misma tabla** y pintaban `draft` y `retired` al revés uno del otro. Un tercer
 * sitio pintaba `retired` en ROJO.
 *
 *   · `draft` → NEUTRAL. Un borrador aún no existe: no reclama atención.
 *   · `retired` → WARNING. Sí la reclama, porque estuvo vivo y dejó de estarlo.
 *
 * Es lo que `AdminEditorModal` ya hacía —el único sitio migrado— con esa razón escrita en su
 * código. Los demás se alinean a él, no al revés. */
const CICLO_VIDA = Object.freeze({
  draft: TONOS.NEUTRAL,
  active: TONOS.SUCCESS,
  published: TONOS.SUCCESS,
  retired: TONOS.WARNING
});

export const tonoCicloVida = (valor) => CICLO_VIDA[valor] ?? TONOS.NEUTRAL;

/* Las etiquetas estaban escritas CINCO veces (ProcessConfigNode, ProcessTemplateNode,
   ProcessGraphView ×2, AdminEditorModal, AdminDraftArtifactModal). Un solo sitio. */
const ETIQUETA_CICLO_VIDA = Object.freeze({
  draft: "Borrador",
  active: "Activa",
  published: "Publicada",
  retired: "Retirada"
});

export const etiquetaCicloVida = (valor) => ETIQUETA_CICLO_VIDA[valor] ?? "Sin estado";

/* ── CORRIDA (`process_runs.status`) ───────────────────────────────────────────────────────
 *
 * ⚠️ `pending` PASA DE ÁMBAR A SALMÓN, y es consecuencia directa del esquema de arriba: el ámbar
 * ya significa «retirado», y en el mismo cajón del drawer conviven configuraciones y corridas. Un
 * color no puede querer decir dos cosas en la misma lista.
 *
 * No se inventa un tono: `--color-pending` (orange-700, 5.52:1) ya existía sin más consumidor que
 * las firmas, y el comentario de `tokens.css` que lo declara dice literalmente «pendiente, ni
 * éxito ni fallo».
 *
 * `cancelled` va a NEUTRAL y no a DANGER: el rojo está reservado para error y para destrucción, y
 * una corrida cancelada no es ninguna de las dos. */
const CORRIDA = Object.freeze({
  pending: TONOS.SALMON,
  active: TONOS.SUCCESS,
  completed: TONOS.INFO,
  cancelled: TONOS.NEUTRAL
});

export const tonoCorrida = (valor) => CORRIDA[valor] ?? TONOS.NEUTRAL;

/* ── DIFF DE ACTIVACIÓN ────────────────────────────────────────────────────────────────────
 *
 * ⚠️ `changed` PASA DE ÁMBAR A INFO, por el mismo motivo que `pending`. Y encaja mejor: un cambio
 * no es bueno ni malo, es informativo. `removed` sí conserva el rojo — quitar es destruir. */
const DIFF = Object.freeze({
  added: TONOS.SUCCESS,
  changed: TONOS.INFO,
  removed: TONOS.DANGER,
  unchanged: TONOS.NEUTRAL
});

export const tonoDiff = (valor) => DIFF[valor] ?? TONOS.NEUTRAL;

/* ── ACTIVIDAD (`is_active`) ───────────────────────────────────────────────────────────────
 *
 * ⚠️ Un nodo inactivo pasa de ROSA a ámbar, y el tinte rosa del nodo entero muere. Rojo sobre un
 * nodo se lee como «error», y un proceso desactivado no es un error: es un estado válido. Aquí el
 * mapeo QUITA un tono en vez de añadirlo. */
export const tonoActividad = (activo) => (activo ? TONOS.SUCCESS : TONOS.WARNING);

/* ── SINCRONIZACIÓN DE FLUJO (`AdminRecordViewerModal`) ────────────────────────────────── */
const SINCRONIZACION = Object.freeze({
  synced: TONOS.SUCCESS,
  stale: TONOS.WARNING,
  no_link: TONOS.NEUTRAL
});

export const tonoSincronizacion = (valor) => SINCRONIZACION[valor] ?? TONOS.NEUTRAL;

/* ── COBERTURA ─────────────────────────────────────────────────────────────────────────────
 *
 * «Cuántos de N están cubiertos»: configuraciones activas de un proceso, puestos ocupados de una
 * unidad. **No es un valor de un enum sino una razón sobre un continuo**, y por eso su destino no
 * es la pastilla sino el contador del nodo (`graph-node__badge`), que es otro componente.
 *
 * Devuelve el ESTADO y el TONO por separado a propósito: el estado lo necesita el `title` («2
 * ocupados de 5 puestos») y el tono lo necesita la clase. Juntarlos obligaría a quien quiere el
 * texto a leer un nombre de color. */
export const coberturaEstado = (hechos, total) => {
  if (!total) return "na";
  if (hechos >= total) return "lleno";
  if (hechos <= 0) return "vacio";
  return "parcial";
};

const COBERTURA = Object.freeze({
  na: TONOS.NEUTRAL,
  vacio: TONOS.DANGER,
  parcial: TONOS.WARNING,
  lleno: TONOS.SUCCESS
});

export const tonoCobertura = (estado) => COBERTURA[estado] ?? TONOS.NEUTRAL;

/* ── ORIGEN DE UNA REGLA DE PROCESO (`UnitGraphView`) ──────────────────────────────────── */
const ORIGEN = Object.freeze({
  direct: TONOS.PRIMARY,
  type: TONOS.PRIMARY,
  global: TONOS.NEUTRAL,
  other: TONOS.NEUTRAL
});

export const tonoOrigen = (valor) => ORIGEN[valor] ?? TONOS.NEUTRAL;

/* ── ÁMBITO DE UNA PLANTILLA (`AdminDraftArtifactModal`) ────────────────────────────────
 *
 * `ad_hoc` era ámbar, que pasaría a decir «retirado». Va a INFO: no es un aviso, es una
 * clasificación. */
const AMBITO = Object.freeze({
  official: TONOS.PRIMARY,
  ad_hoc: TONOS.INFO
});

export const tonoAmbito = (valor) => AMBITO[valor] ?? TONOS.NEUTRAL;
