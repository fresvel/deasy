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
import { computed, ref, watch } from "vue";
import { adminSqlService } from "@/modules/admin/services/AdminSqlService";
import { canAccessResource } from "@/core/utils/accessControl.js";

/* Lo mínimo que la base acepta como motivo de una corrección. */
export const MOTIVO_MINIMO = 10;
/* ¿Puede esta persona corregir la estructura? Es un permiso aparte del de editarla. */
export const puedeCorregirLaEstructura = () => canAccessResource("correcciones_estructura", "create");

const VIDA_VACIA = Object.freeze({
  id: null,
  vigente_desde: "",
  inicio_origen: "",
  inicio_acto_id: "",
  vigente_hasta: "",
  fin_origen: "",
  fin_acto_id: "",
  /* Sólo se usa si lo que se guarda es una corrección. */
  motivo: "",
  /* La casilla de «entiendo que no se recupera»: sólo cuenta si la supresión rige ya. */
  confirmaSupresion: false
});

/* LAS EQUIVALENCIAS (frente 27, D-05): la tabla de cada clase y cómo se llama en ella el sucesor. */
const EQUIVALENCIAS_DE = Object.freeze({
  unit_vigencias: { tabla: "unit_equivalencias", sucesor: "sucesor_unit_id" },
  position_vigencias: { tabla: "position_equivalencias", sucesor: "sucesor_position_id" },
  process_vigencias: { tabla: "process_equivalencias", sucesor: "sucesor_process_id" }
});

const CLASE_DE = Object.freeze({ unit_vigencias: "unidad", position_vigencias: "puesto", process_vigencias: "proceso" });

/* LA FRASE DE LO QUE SE CIERRA: «21 roles asignados y 2 vacantes abiertas». */
export const fraseDeEfectos = (efectos = []) => {
  const partes = efectos.map((e) => `${e.n} ${e.n === 1 ? e.singular : e.plural}`);
  if (partes.length <= 1) return partes[0] || "";
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
};

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
  /* La fecha de inicio con que se abrió el formulario: cambiarla, si ya ocurrió, es una corrección. */
  const desdeOriginal = ref("");
  /* Y la de fin: cambiarla o quitarla, si ya ocurrió, también lo es. */
  const hastaOriginal = ref("");
  /* La última vida de un nodo suprimido: lo que se corrige si su fin estaba mal. */
  const ultimaVida = ref(null);
  const hoy = () => new Date().toISOString().slice(0, 10);

  /* ¿LO QUE SE VA A GUARDAR ES UNA CORRECCIÓN? Dos casos, los mismos que exige la base: que un
     origen diga «corrección», o que se cambie la fecha de inicio de una vida que ya empezó —eso es
     afirmar que rigió desde otro día—. Poner fin a una vida NO lo es: es suprimir. */
  const esCorreccion = computed(() => {
    const f = vidaForm.value;
    if (f.inicio_origen === "correccion" || (f.vigente_hasta && f.fin_origen === "correccion")) return true;
    if (vidaModo.value !== "editar") return false;
    const inicioCambiado = Boolean(desdeOriginal.value) && desdeOriginal.value <= hoy() && f.vigente_desde !== desdeOriginal.value;
    const finCambiado = Boolean(hastaOriginal.value) && hastaOriginal.value <= hoy() && (f.vigente_hasta || "") !== hastaOriginal.value;
    return inicioCambiado || finCambiado;
  });

  /* SUPRIMIR, Y LO QUE ARRASTRA. Poner fin a una vida que no lo tenía es suprimir. Si esa fecha ya
     llegó —hoy o antes—, la base cierra en el acto lo que colgaba del nodo y NO lo devuelve al
     reactivar; y un fin que ya ocurrió no se puede quitar. El único momento de evitar el error es
     antes, así que ahí se dice qué se va a cerrar y se pide confirmarlo. Con fecha futura no se
     cierra nada todavía: se avisa de cuándo, y de que hasta entonces se puede cambiar. */
  const nodoId = ref(null);
  const efectos = ref([]);
  const suprime = computed(() => vidaModo.value === "editar" && !hastaOriginal.value && Boolean(vidaForm.value.vigente_hasta));
  const suprimeYa = computed(() => suprime.value && vidaForm.value.vigente_hasta <= hoy());
  const suprimeMasAdelante = computed(() => suprime.value && vidaForm.value.vigente_hasta > hoy());
  const efectosQueSeCierran = computed(() => efectos.value.filter((e) => e.seCierra));
  const efectosQueSeQuedan = computed(() => efectos.value.filter((e) => !e.seCierra));
  const cargarEfectos = async () => {
    const clase = CLASE_DE[tabla];
    if (!clase || !nodoId.value) return;
    try {
      const { data } = await adminSqlService.getEfectosDeSuprimir(clase, nodoId.value);
      efectos.value = data?.efectos || [];
    } catch {
      efectos.value = [];
    }
  };
  /* Se piden la primera vez que el formulario pasa a «suprime», no al abrir el modal. */
  watch(suprime, (ahora) => {
    if (ahora) cargarEfectos();
    else vidaForm.value.confirmaSupresion = false;
  });

  /* Al corregir la fecha de un fin, la nueva tiene que haber ocurrido también: un fin pasado no se
     quita ni se aplaza —ni como corrección—. */
  const corrigiendoElFin = ref(false);
  const finCorregidoValido = computed(() => {
    const hasta = vidaForm.value.vigente_hasta;
    return !corrigiendoElFin.value || (Boolean(hasta) && hasta <= hoy());
  });

  /* LO QUE LA BASE VA A EXIGIR, DICHO ANTES. Un inicio lleva su origen; un fin, el suyo; y una
     reorganización, el acto que la ordena. Antes el botón se dejaba pulsar y la base lo rechazaba —
     y al crear un puesto con su vigencia, eso dejaba el puesto creado y en borrador—. */
  const loQueFalta = computed(() => {
    const f = vidaForm.value;
    if (!f.vigente_desde) return "";
    if (!f.inicio_origen) return "Elige el origen del inicio.";
    if (f.inicio_origen === "reorganizacion" && !f.inicio_acto_id) return "Una reorganización lleva su acto: elige el que lo ordena.";
    if (!f.vigente_hasta) return "";
    if (!f.fin_origen) return "Elige el origen del fin.";
    if (f.fin_origen === "reorganizacion" && !f.fin_acto_id) return "Una reorganización lleva su acto: elige el que lo suprime.";
    return "";
  });

  const sePuedeGuardar = computed(() =>
    vidaModo.value !== "cerrada"
    && Boolean(vidaForm.value.vigente_desde)
    && !loQueFalta.value
    && (!esCorreccion.value || String(vidaForm.value.motivo || "").trim().length >= MOTIVO_MINIMO)
    && (!suprimeYa.value || Boolean(vidaForm.value.confirmaSupresion))
    // Con hijos no se suprime: la base lo rechazaría, y aquí se dice antes.
    && !(suprime.value && efectosQueSeQuedan.value.length)
    && finCorregidoValido.value
  );

  /* LO QUE SUCEDE A LO QUE SE SUPRIME. Quien tiene sucesores es una VIDA con fecha de fin —la última
     de un nodo suprimido, o la que está en curso si ya tiene su fin guardado—, no el nodo: cada vez
     que termina puede tener los suyos. Varios sucesores son una división; varios antecesores, una
     fusión. Se registran y se quitan en el acto, sin esperar al «Guardar» del formulario: no son
     parte de la vida, cuelgan de ella. Las reglas —que el sucesor rija ese día o después, que nadie
     se suceda a sí mismo— las impone la base. */
  const antecesores = ref([]);
  /* REACTIVAR ALGO QUE YA TIENE SUCESORES SE DEJA PASAR, CON AVISO (decisión del dueño, 2026-11-24).
     Puede ser un hecho nuevo —la unidad se dividió y años después vuelve— o deshacer un error; el
     sistema no sabe cuál, y quien reactiva sí. Lo que no puede es pasar en silencio: los sucesores
     de la vida anterior siguen registrados, y si la supresión fue un error hay que quitarlos. */
  const sucesoresDeLaVidaAnterior = computed(() => {
    if (vidaModo.value !== "nueva") return null;
    const terminadas = vidas.value
      .filter((v) => v.vigente_hasta && v.sucesores?.length)
      .sort((x, y) => String(y.vigente_hasta).localeCompare(String(x.vigente_hasta)));
    return terminadas[0] || null;
  });
  const vidaQueTermina = computed(() => {
    let id = null;
    if (vidaModo.value === "cerrada") id = ultimaVida.value?.vigencia_id ?? null;
    else if (vidaModo.value === "editar" && hastaOriginal.value) id = vidaForm.value.id;
    return id ? vidas.value.find((v) => v.id === id) || null : null;
  });
  const sucesores = computed(() => vidaQueTermina.value?.sucesores || []);
  const conSucesoresDe = (vidaId, lista) => {
    vidas.value = vidas.value.map((v) => (v.id === vidaId ? { ...v, sucesores: lista } : v));
  };
  const anadirSucesor = async ({ id, etiqueta }) => {
    const vida = vidaQueTermina.value;
    const eq = EQUIVALENCIAS_DE[tabla];
    if (!vida || !eq || !id) return;
    const { data } = await adminSqlService.create(eq.tabla, { antecesor_vigencia_id: vida.id, [eq.sucesor]: Number(id) });
    conSucesoresDe(vida.id, [...(vida.sucesores || []), { id: data?.id, nodo_id: Number(id), nombre: etiqueta }]);
  };
  /* QUITAR UN SUCESOR DE ALGO QUE YA TERMINÓ ES UNA CORRECCIÓN: pide su permiso y su motivo, y deja
     en la bitácora lo que decía. Con el fin todavía futuro es un plan, y se quita sin más. */
  const quitarEsCorreccion = computed(() => {
    const fin = vidaQueTermina.value?.vigente_hasta;
    return Boolean(fin) && fin <= hoy();
  });
  const quitarSucesor = async (equivalenciaId, motivo = "") => {
    const vida = vidaQueTermina.value;
    const eq = EQUIVALENCIAS_DE[tabla];
    if (!vida || !eq) return;
    if (quitarEsCorreccion.value) {
      await adminSqlService.corregirEstructura({ tabla: eq.tabla, id: equivalenciaId, quitar: true, motivo: String(motivo).trim() });
    } else {
      await adminSqlService.remove(eq.tabla, { id: equivalenciaId });
    }
    conSucesoresDe(vida.id, (vida.sucesores || []).filter((s) => s.id !== equivalenciaId));
  };

  /* Decide el modo a partir del periodo que cuenta hoy, que es lo que el nodo trae consigo
     (`estado`, `vigencia_id` y sus fechas). `lista` son todas sus vidas, si ya se conocen, y
     `susAntecesores`, a quién sucede. */
  const prepararVida = (nodo, lista = null, susAntecesores = []) => {
    if (lista) vidas.value = lista;
    antecesores.value = susAntecesores || [];
    nodoId.value = nodo?.id ?? null;
    efectos.value = [];
    corrigiendoElFin.value = false;
    if (nodo?.estado === "vigente" || nodo?.estado === "programado") {
      vidaModo.value = "editar";
      vidaForm.value = {
        id: nodo.vigencia_id ?? null,
        vigente_desde: nodo.vigente_desde || "",
        inicio_origen: nodo.inicio_origen || "",
        inicio_acto_id: nodo.inicio_acto_id ? String(nodo.inicio_acto_id) : "",
        vigente_hasta: nodo.vigente_hasta || "",
        fin_origen: nodo.fin_origen || "",
        fin_acto_id: nodo.fin_acto_id ? String(nodo.fin_acto_id) : "",
        motivo: "",
        confirmaSupresion: false
      };
      desdeOriginal.value = nodo.vigente_desde || "";
      hastaOriginal.value = nodo.vigente_hasta || "";
      ultimaVida.value = null;
      return;
    }
    vidaModo.value = nodo?.estado === "suprimido" ? "cerrada" : "nueva";
    vidaForm.value = { ...VIDA_VACIA };
    desdeOriginal.value = "";
    hastaOriginal.value = "";
    // Un nodo suprimido trae consigo su última vida —es el periodo que cuenta hoy—.
    ultimaVida.value = nodo?.estado === "suprimido" && nodo.vigencia_id ? nodo : null;
  };

  /* CORREGIR LA FECHA DEL FIN DE UNA VIDA QUE YA TERMINÓ: «terminó el 20, no el 24». Sólo la fecha,
     y sólo a otra que también haya ocurrido. QUITAR el fin no se puede —ni así—: para que el nodo
     vuelva a regir se reactiva, que abre una vida nueva y deja escrita la anterior. */
  const sePuedeCorregirElFin = computed(() => vidaModo.value === "cerrada" && Boolean(ultimaVida.value));
  const empezarCorreccionDelFin = () => {
    const v = ultimaVida.value;
    if (!v) return;
    vidaModo.value = "editar";
    vidaForm.value = {
      id: v.vigencia_id,
      vigente_desde: v.vigente_desde || "",
      inicio_origen: v.inicio_origen || "",
      inicio_acto_id: v.inicio_acto_id ? String(v.inicio_acto_id) : "",
      vigente_hasta: v.vigente_hasta || "",
      fin_origen: v.fin_origen || "",
      fin_acto_id: v.fin_acto_id ? String(v.fin_acto_id) : "",
      motivo: "",
      confirmaSupresion: false
    };
    desdeOriginal.value = v.vigente_desde || "";
    hastaOriginal.value = v.vigente_hasta || "";
    corrigiendoElFin.value = true;
  };

  const empezarVidaNueva = () => {
    vidaModo.value = "nueva";
    vidaForm.value = { ...VIDA_VACIA };
    desdeOriginal.value = "";
    hastaOriginal.value = "";
    corrigiendoElFin.value = false;
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
    const editando = vidaModo.value === "editar" && f.id;
    // UNA CORRECCIÓN VA POR SU CAMINO: el editor de siempre la rechazaría, y es correcto que lo haga.
    if (esCorreccion.value) {
      return adminSqlService.corregirEstructura({
        tabla,
        id: editando ? f.id : null,
        cambios: editando ? datos : { [claveDelNodo]: nodoId, ...datos },
        motivo: String(f.motivo || "").trim()
      });
    }
    if (editando) {
      return adminSqlService.update(tabla, { id: f.id }, datos);
    }
    return adminSqlService.create(tabla, { [claveDelNodo]: nodoId, ...datos });
  };

  /* Se borra sólo lo que aún no ha regido: una vida PROGRAMADA se puede descartar entera —se
     registró por error, o la reorganización se canceló—. Una que ya empezó no: la base lo rechaza, y
     por eso el botón sólo se ofrece en la primera. */
  const sePuedeDescartar = computed(() => {
    const desde = vidaForm.value.vigente_desde;
    return vidaModo.value === "editar" && Boolean(vidaForm.value.id) && Boolean(desde)
      && desde > new Date().toISOString().slice(0, 10);
  });
  const descartarVida = () => adminSqlService.remove(tabla, { id: vidaForm.value.id });

  return {
    sePuedeDescartar,
    descartarVida,
    vidas,
    vidaForm,
    vidaModo,
    actoOptions,
    vidasAnteriores,
    tituloDeLaVida,
    etiquetaDeGuardarVida,
    sePuedeGuardar,
    loQueFalta,
    sucesoresDeLaVidaAnterior,
    esCorreccion,
    sePuedeCorregirElFin,
    empezarCorreccionDelFin,
    corrigiendoElFin,
    hoy,
    suprime,
    suprimeYa,
    suprimeMasAdelante,
    efectosQueSeCierran,
    efectosQueSeQuedan,
    cargarEfectos,
    puedeCorregir: puedeCorregirLaEstructura(),
    antecesores,
    vidaQueTermina,
    sucesores,
    anadirSucesor,
    quitarSucesor,
    quitarEsCorreccion,
    nodoId,
    prepararVida,
    empezarVidaNueva,
    cargarActos,
    guardarVida
  };
}
