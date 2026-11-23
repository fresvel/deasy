/* LAS VIDAS DE UN NODO DE LA ESTRUCTURA — un proceso, una unidad, un puesto (frente 27, D-03).
 *
 * Un nodo puede regir, suprimirse y volver a regir, y cada vez es una fila de su tabla de periodos
 * (`process_vigencias`, `unit_vigencias`…). Este composable lleva el estado de la pestaña «Vigencia»
 * de su modal: qué vida se está viendo, en qué modo, y cómo se guarda. La forma es la misma para
 * las tres clases de nodo; sólo cambian la tabla y el nombre de su clave, y por eso se pasan.
 *
 * `vidaModo` dice qué enseña la pestaña:
 *   · "nueva"   — no hay ninguna vida (borrador), o se pidió reactivar: formulario para abrir una.
 *   · "editar"  — hay una vida vigente o programada: se le mueven las fechas o se le pone fin.
 *   · "cerrada" — la última terminó: sólo se ofrece reactivar.
 *
 * Las reglas —una reorganización exige acto, dos vidas no se solapan, el fin lleva su origen— NO
 * están aquí: las impone la base, y lo que rechace llega como mensaje a quien llama a `guardarVida`.
 */
import { computed, ref } from "vue";
import { adminSqlService } from "@/modules/admin/services/AdminSqlService";

const VIDA_VACIA = Object.freeze({
  id: null,
  vigente_desde: "",
  inicio_origen: "",
  inicio_acto_id: "",
  vigente_hasta: "",
  fin_origen: "",
  fin_acto_id: ""
});

const ETIQUETA_ORIGEN = Object.freeze({
  carga_inicial: "Carga inicial",
  reorganizacion: "Reorganización",
  correccion: "Corrección"
});
export const etiquetaOrigen = (origen) => ETIQUETA_ORIGEN[origen] || "—";

const filasDe = (data) => (Array.isArray(data) ? data : data?.rows || data?.data || []);

export function useNodeVigencia({ tabla, claveDelNodo }) {
  const vidas = ref([]);
  const vidaForm = ref({ ...VIDA_VACIA });
  const vidaModo = ref("nueva");
  const actoOptions = ref([]);

  const vidasAnteriores = computed(() => vidas.value.filter((v) => v.id !== vidaForm.value.id));
  const tituloDeLaVida = computed(() => {
    if (vidaModo.value === "editar") return "Vida en curso";
    if (vidaModo.value === "cerrada") return "Sin vida en curso";
    return vidas.value.length ? "Vida nueva" : "Poner en vigor";
  });
  const etiquetaDeGuardarVida = computed(() => {
    if (vidaModo.value === "editar") return "Guardar";
    return vidas.value.length ? "Reactivar" : "Poner en vigor";
  });
  const sePuedeGuardar = computed(() => vidaModo.value !== "cerrada" && Boolean(vidaForm.value.vigente_desde));

  /* Decide el modo a partir del periodo que cuenta hoy, que es lo que el nodo trae consigo
     (`estado`, `vigencia_id` y sus fechas). `lista` son todas sus vidas, si ya se conocen. */
  const prepararVida = (nodo, lista = null) => {
    if (lista) vidas.value = lista;
    if (nodo?.estado === "vigente" || nodo?.estado === "programado") {
      vidaModo.value = "editar";
      vidaForm.value = {
        id: nodo.vigencia_id ?? null,
        vigente_desde: nodo.vigente_desde || "",
        inicio_origen: nodo.inicio_origen || "",
        inicio_acto_id: nodo.inicio_acto_id ? String(nodo.inicio_acto_id) : "",
        vigente_hasta: nodo.vigente_hasta || "",
        fin_origen: nodo.fin_origen || "",
        fin_acto_id: nodo.fin_acto_id ? String(nodo.fin_acto_id) : ""
      };
      return;
    }
    vidaModo.value = nodo?.estado === "suprimido" ? "cerrada" : "nueva";
    vidaForm.value = { ...VIDA_VACIA };
  };

  const empezarVidaNueva = () => {
    vidaModo.value = "nueva";
    vidaForm.value = { ...VIDA_VACIA };
  };

  /* Los actos entre los que elegir cuando el origen es una reorganización. Se piden al abrir el
     modal y no al montar la pantalla: la mayoría de las visitas no editan nada. */
  const cargarActos = async () => {
    try {
      const { data } = await adminSqlService.list("actos", { orderBy: "fecha_emision", order: "desc", limit: 500 });
      actoOptions.value = filasDe(data).map((acto) => ({
        id: acto.id,
        etiqueta: `${acto.numero} · ${String(acto.fecha_emision || "").slice(0, 10)} · ${acto.asunto}`
      }));
    } catch {
      actoOptions.value = [];
    }
  };

  /* Abre una vida nueva (poner en vigor, reactivar) o modifica la que está en curso. Deja pasar el
     error tal cual: quien llama decide dónde enseñarlo. */
  const guardarVida = async (nodoId) => {
    const f = vidaForm.value;
    // Vacío es NULL, no cadena vacía: sin fecha de fin no hay origen ni acto de fin.
    const datos = {
      vigente_desde: f.vigente_desde,
      inicio_origen: f.inicio_origen || null,
      inicio_acto_id: f.inicio_origen === "reorganizacion" && f.inicio_acto_id ? Number(f.inicio_acto_id) : null,
      vigente_hasta: f.vigente_hasta || null,
      fin_origen: f.vigente_hasta ? (f.fin_origen || null) : null,
      fin_acto_id: f.fin_origen === "reorganizacion" && f.fin_acto_id ? Number(f.fin_acto_id) : null
    };
    if (vidaModo.value === "editar" && f.id) {
      return adminSqlService.update(tabla, { id: f.id }, datos);
    }
    return adminSqlService.create(tabla, { [claveDelNodo]: nodoId, ...datos });
  };

  return {
    vidas,
    vidaForm,
    vidaModo,
    actoOptions,
    vidasAnteriores,
    tituloDeLaVida,
    etiquetaDeGuardarVida,
    sePuedeGuardar,
    prepararVida,
    empezarVidaNueva,
    cargarActos,
    guardarVida
  };
}
