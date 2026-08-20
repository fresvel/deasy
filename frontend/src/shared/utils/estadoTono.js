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

/* ══════════════════════════════════════════════════════════════════════════════════════════
   LOS EJES QUE SEGUÍAN FUERA — añadidos el 2026-08-20 (F9-bis)
   ══════════════════════════════════════════════════════════════════════════════════════════

   F3.3 migró ADMIN y dejó HOME atrás. Medido hoy: los 12 consumidores de este fichero son los
   doce de `modules/admin/`, y `modules/home/` mantenía **nueve traductores propios** —cinco en
   `homeView.helpers.js`, uno en `HomeView.vue`, dos en sus componentes, uno en un composable—
   que hacían exactamente esto mismo con otro nombre.

   ⚠️ NO ERAN COPIAS: SE CONTRADECÍAN. Cuatro valores salían con dos colores distintos según
   qué función los tradujera, y las cuatro discrepancias las resuelve la doctrina que este
   fichero YA tenía escrita arriba, no un criterio nuevo:

     valor                antes                                    ahora      por qué
     ─────────────────────────────────────────────────────────────────────────────────────────
     pendiente/pending    warning (flujo) vs salmon (paso firma)    SALMON     el ámbar ya dice
                                                                               «retirado» (CORRIDA)
     en proceso/in_prog.  info (flujo, llenado) vs warning (×2)     INFO       ni bueno ni malo,
                                                                               como `changed` (DIFF)
     cancelado/cancelled  danger (flujo, solicitud) vs neutral      NEUTRAL    el rojo es error y
                                                                               destrucción (CORRIDA)
     activo/active        warning («En curso», RoutedProcessPanel)  SUCCESS    ya era SUCCESS en
                                                                               CICLO_VIDA y CORRIDA

   `completed` es la excepción deliberada y por eso hay dos ejes y no uno: una CORRIDA completada
   es INFO —agotó su ciclo, no es un logro— y un DOCUMENTO firmado completo es SUCCESS. Ejes
   distintos, tonos distintos, y ese es justamente el motivo de nombrarlos por eje. */

const clave = (valor) => String(valor ?? "").trim().toLowerCase();

/* ── TAREA (`tasks.status`, `task_items.status`, `task_assignments.status`) ────────────────
   El mismo vocabulario en las tres tablas, en español y con `_`. */
const TAREA = Object.freeze({
  pendiente: TONOS.SALMON,
  en_proceso: TONOS.INFO,
  completada: TONOS.SUCCESS,
  cancelada: TONOS.NEUTRAL
});

const ETIQUETA_TAREA = Object.freeze({
  pendiente: "Pendiente",
  en_proceso: "En proceso",
  completada: "Completada",
  cancelada: "Cancelada"
});

export const tonoTarea = (valor) => TAREA[clave(valor)] ?? TONOS.NEUTRAL;
export const etiquetaTarea = (valor) => ETIQUETA_TAREA[clave(valor)] ?? "Sin estado";

/* ── LLENADO (`document_fill_flows.status`, `fill_requests.status` y los pasos del flujo) ──
   `returned` es el único tono que el eje de firma no gasta: un paso de llenado puede estar
   DEVUELTO, y eso no existe firmando. Venía de `getFillStepStatusTagVariant`. */
const LLENADO = Object.freeze({
  pending: TONOS.SALMON,
  in_progress: TONOS.INFO,
  approved: TONOS.SUCCESS,
  rejected: TONOS.DANGER,
  returned: TONOS.WARNING,
  cancelled: TONOS.NEUTRAL
});

const ETIQUETA_LLENADO = Object.freeze({
  pending: "Pendiente",
  in_progress: "En progreso",
  approved: "Aprobado",
  rejected: "Rechazado",
  returned: "Devuelto",
  cancelled: "Cancelado"
});

export const tonoLlenado = (valor) => LLENADO[clave(valor)] ?? TONOS.NEUTRAL;
export const etiquetaLlenado = (valor) => ETIQUETA_LLENADO[clave(valor)] ?? "Pendiente";

/* ── PASO DE UN FLUJO DE FIRMA ────────────────────────────────────────────────────────────
   `current` no es un valor que venga de la base: lo inyecta la vista cuando el paso es el que
   toca. Se queda aquí porque el consumidor lo trata como un estado más. */
const PASO_FIRMA = Object.freeze({
  completed: TONOS.SUCCESS,
  current: TONOS.INFO,
  rejected: TONOS.DANGER,
  pending: TONOS.SALMON,
  unresolved: TONOS.SALMON
});

export const tonoPasoFirma = (valor) => PASO_FIRMA[clave(valor)] ?? TONOS.NEUTRAL;

/* ── SOLICITUD DE FIRMA (`signature_request_statuses`, en español) ─────────────────────── */
const SOLICITUD_FIRMA = Object.freeze({
  pendiente: TONOS.SALMON,
  en_progreso: TONOS.INFO,
  "en progreso": TONOS.INFO,
  completado: TONOS.SUCCESS,
  rechazado: TONOS.DANGER,
  cancelado: TONOS.NEUTRAL
});

export const tonoSolicitudFirma = (valor) => SOLICITUD_FIRMA[clave(valor)] ?? TONOS.NEUTRAL;

/* ── DOCUMENTO (`documents.status` y `document_versions.status`) ───────────────────────────
   Los dos vocabularios los declara `DocumentStateService.js` y se solapan en 9 de sus valores;
   aquí van fundidos porque el color no distingue documento de versión.

   El criterio, que es el mismo de todo el fichero: NEUTRAL lo que aún no existe o ya no pide
   nada (inicial, borrador, archivado, cancelado) · SALMON lo que espera a alguien · INFO lo que
   está en marcha · WARNING lo que reclama atención · SUCCESS lo terminado. */
const DOCUMENTO = Object.freeze({
  inicial: TONOS.NEUTRAL,
  borrador: TONOS.NEUTRAL,
  "pendiente de llenado": TONOS.SALMON,
  "en proceso": TONOS.INFO,
  "en llenado": TONOS.INFO,
  "en revisión de llenado": TONOS.INFO,
  "en revision de llenado": TONOS.INFO,
  observado: TONOS.WARNING,
  "listo para firma": TONOS.INFO,
  "pendiente de firma": TONOS.SALMON,
  "firmado parcial": TONOS.INFO,
  "firmado completo": TONOS.SUCCESS,
  final: TONOS.SUCCESS,
  archivado: TONOS.NEUTRAL,
  cancelado: TONOS.NEUTRAL
});

export const tonoDocumento = (valor) => DOCUMENTO[clave(valor)] ?? TONOS.NEUTRAL;

/* ── PERSONA (`persons.status`) ────────────────────────────────────────────────────────────
   `Verificado` va a PRIMARY y no a SUCCESS: verificar no es «estar bien», es una marca de la
   institución sobre el registro — la misma lectura que `direct`/`type` en ORIGEN.
   `Reportado` sí es DANGER: es el único estado del sistema que denuncia un problema. */
const PERSONA = Object.freeze({
  inactivo: TONOS.NEUTRAL,
  activo: TONOS.SUCCESS,
  verificado: TONOS.PRIMARY,
  reportado: TONOS.DANGER
});

export const tonoPersona = (valor) => PERSONA[clave(valor)] ?? TONOS.NEUTRAL;

/* ── VACANTE (`vacancies.status`) ─────────────────────────────────────────────────────────
   `abierta` es INFO y no SUCCESS: una vacante abierta no es un logro, es un hecho. */
const VACANTE = Object.freeze({
  abierta: TONOS.INFO,
  cubierta: TONOS.SUCCESS,
  cerrada: TONOS.NEUTRAL,
  cancelada: TONOS.NEUTRAL
});

export const tonoVacante = (valor) => VACANTE[clave(valor)] ?? TONOS.NEUTRAL;

/* ── CONTRATO (`contracts.status`) ─────────────────────────────────────────────────────── */
const CONTRATO = Object.freeze({
  activo: TONOS.SUCCESS,
  finalizado: TONOS.INFO,
  cancelado: TONOS.NEUTRAL
});

export const tonoContrato = (valor) => CONTRATO[clave(valor)] ?? TONOS.NEUTRAL;

/* ── ACCESO A UN ENTREGABLE ────────────────────────────────────────────────────────────────
   Venía de `getDeliverableAccessTagVariant`. `derivado` conserva el turquesa de `accent`: no
   es mejor ni peor que el directo, es otra procedencia. */
const ACCESO = Object.freeze({
  directo: TONOS.SUCCESS,
  derivado: TONOS.ACCENT
});

export const tonoAcceso = (valor) => ACCESO[clave(valor)] ?? TONOS.NEUTRAL;

/* ── CLASE DE OBSERVACIÓN ──────────────────────────────────────────────────────────────────
   No es un estado sino una CLASE de anotación, pero comparte el vocabulario de tonos y vivía
   igualmente suelta (`DeliverableObservations.dotClass`). Una observación resuelta gana
   SUCCESS por encima de su clase, que es lo que ya hacía. */
const OBSERVACION = Object.freeze({
  return_reason: TONOS.WARNING,
  rejection_reason: TONOS.DANGER,
  internal_note: TONOS.NEUTRAL,
  observation: TONOS.INFO
});

export const tonoObservacion = (clase, resuelta = false) =>
  (resuelta ? TONOS.SUCCESS : (OBSERVACION[clave(clase)] ?? TONOS.INFO));

/* ── FLUJO — EL EJE TOLERANTE ──────────────────────────────────────────────────────────────
   El único que no corresponde a una columna: lo consume la tarjeta de entregable, que recibe
   un estado que puede venir de `documents.status` (español), de `fill_requests.status` (inglés)
   o de una solicitud de firma, y NO sabe de cuál. Por eso mira en los tres ejes por orden.

   Sustituye a `getWorkflowStateTagVariant` (lista bilingüe escrita a mano), a
   `signatureRequestTagVariant` (HomeView) y a `statusMeta` (RoutedProcessPanel), que hacían lo
   mismo con tres vocabularios que no coincidían. El `fallback` se conserva porque sus
   llamantes lo usan para distinguir «sin estado» de «estado desconocido». */
const FLUJO_EXTRA = Object.freeze({
  /* Sinónimos que ninguna columna declara pero que el backend devuelve en texto libre. */
  completed: TONOS.SUCCESS,
  completado: TONOS.SUCCESS,
  completada: TONOS.SUCCESS,
  aprobado: TONOS.SUCCESS,
  firmado: TONOS.SUCCESS,
  signed: TONOS.SUCCESS,
  done: TONOS.SUCCESS,
  closed: TONOS.SUCCESS,
  cerrado: TONOS.SUCCESS,
  finalizado: TONOS.SUCCESS,
  /* `activo` lo traia `RoutedProcessPanel` en AMBAR, etiquetado «En curso». Es la cuarta
     contradiccion: CICLO_VIDA y CORRIDA lo dan en verde desde el 2026-08-15. */
  activo: TONOS.SUCCESS,
  activa: TONOS.SUCCESS,
  "en curso": TONOS.INFO,
  procesando: TONOS.INFO,
  "in progress": TONOS.INFO,
  enviado: TONOS.SALMON,
  sent: TONOS.SALMON,
  devuelto: TONOS.WARNING,
  rechazado: TONOS.DANGER,
  cancelada: TONOS.NEUTRAL,
  error: TONOS.DANGER
});

export const tonoFlujo = (valor, fallback = TONOS.NEUTRAL) => {
  const k = clave(valor);
  if (!k) return fallback;
  return DOCUMENTO[k]
    ?? LLENADO[k]
    ?? SOLICITUD_FIRMA[k]
    ?? TAREA[k]
    ?? CICLO_VIDA[k]
    ?? FLUJO_EXTRA[k]
    ?? fallback;
};

/* ── PASO DE UN FLUJO DE LLENADO ──────────────────────────────────────────────────────────
   El mismo mapa que LLENADO más una regla: el paso que TOCA manda sobre su propio estado.
   Es la gemela de `tonoPasoFirma`, y lo es a propósito — desde F3.3·L7 las dos listas de pasos
   comparten un solo bloque de CSS (`deasy-flow-step--{tono}`), así que no pueden discrepar.

   ⚠️ Y discrepaban: `getFillStepTono` mandaba a NEUTRAL todo lo que no fuera aprobado,
   rechazado o devuelto —incluido `pending`—, mientras el paso de firma pintaba `pending` en
   SALMON. Mismo componente, dos colores para el mismo estado. Gana SALMON, que es lo que ya
   hacía firma y lo que dice CORRIDA. */
export const tonoPasoLlenado = (estado, esActual = false) =>
  (esActual ? TONOS.INFO : tonoLlenado(estado));

/* La etiqueta del eje tolerante. Los valores en INGLES tienen traduccion; los que ya vienen en
   español —`documents.status` y `document_versions.status` los declara asi la base— solo se
   capitalizan, que es lo que hacia `RoutedProcessPanel` y es correcto: inventarles una segunda
   forma seria volver a tener dos nombres para lo mismo. */
const ETIQUETA_FLUJO = Object.freeze({
  ...ETIQUETA_CICLO_VIDA,
  ...ETIQUETA_LLENADO,
  ...ETIQUETA_TAREA,
  completed: "Completado",
  signed: "Firmado",
  done: "Completado",
  closed: "Cerrado",
  sent: "Enviado",
  "in progress": "En progreso",
  error: "Error"
});

export const etiquetaFlujo = (valor) => {
  const k = clave(valor);
  if (!k) return "Sin estado";
  if (ETIQUETA_FLUJO[k]) return ETIQUETA_FLUJO[k];
  const bruto = String(valor).trim();
  return bruto.charAt(0).toUpperCase() + bruto.slice(1);
};
