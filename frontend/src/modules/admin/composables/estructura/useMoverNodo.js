/* MOVER UN NODO DE PADRE, en el organigrama y en el mapa de procesos (frente 27, D-04).
 *
 * Con aristas fechadas, cambiar de padre dejó de ser un gesto sin preguntas: si la relación que el
 * nodo tiene ya rige, no se pisa — se le pone fin y se abre otra, y eso necesita saber DESDE CUÁNDO y
 * con qué origen (y, si es una reorganización, qué acto la ordena). Si la relación es un borrador o
 * aún no ha empezado, se cambia sin más, como siempre.
 *
 * Este composable es ese «depende»: `pedir()` ejecuta directo cuando no hace falta fecha, y cuando
 * sí, abre el diálogo (`NodeMoverModal`) y espera. Devuelve `true` si el movimiento se hizo.
 *
 * `mover(hijoId, padreId, extras)` lo pone cada vista: es la llamada a SU ruta.
 */
import { computed, ref } from "vue";

const ESTADOS_VIVOS = ["borrador", "programado", "vigente"];

/* ¿Hay que preguntar la fecha? La misma tabla que decide el servidor (`planDeMovimiento`):
   una relación vigente no se pisa; y un nodo que ya tiene vida y no cuelga de nadie no puede
   recibir un borrador de relación, porque nada lo pondría en marcha. */
export const necesitaFecha = ({ estadoDeLaArista, estadoDelNodo, padreId }) => {
  if (estadoDeLaArista === "vigente") return true;
  const tieneArista = ESTADOS_VIVOS.includes(estadoDeLaArista);
  return !tieneArista && Boolean(padreId) && ["vigente", "programado"].includes(estadoDelNodo);
};

/* LA FRASE DEL CAMBIO PROGRAMADO, o "" si no hay ninguno. La relación que se dibuja es la de hoy;
   si ya tiene fecha de fin, hay que decirlo — y decir a dónde va el nodo, si va a algún sitio. */
export const fraseDelCambioProgramado = ({ estado, hasta, proximoPadre, proximoDesde }) => {
  if (estado !== "vigente") return "";
  if (proximoPadre) return `Desde el ${proximoDesde || hasta} dependerá de ${proximoPadre}.`;
  return hasta ? `El ${hasta} dejará de depender de su padre.` : "";
};

const hoy = () => new Date().toISOString().slice(0, 10);

export const useMoverNodo = ({ mover }) => {
  const peticion = ref(null);
  const form = ref({ vigente_desde: "", origen: "", acto_id: "" });
  const error = ref("");
  const guardando = ref(false);
  let resolver = null;

  const cerrar = (hecho) => {
    peticion.value = null;
    error.value = "";
    resolver?.(hecho);
    resolver = null;
  };

  const pedir = async ({ hijoId, padreId = null, hijoNombre = "", padreNombre = "", estadoDeLaArista, estadoDelNodo }) => {
    if (!necesitaFecha({ estadoDeLaArista, estadoDelNodo, padreId })) {
      await mover(hijoId, padreId, {});
      return true;
    }
    form.value = { vigente_desde: hoy(), origen: "", acto_id: "" };
    error.value = "";
    peticion.value = { hijoId, padreId, hijoNombre, padreNombre };
    return new Promise((resolve) => {
      resolver = resolve;
    });
  };

  const sePuedeConfirmar = computed(() => {
    const f = form.value;
    return Boolean(f.vigente_desde && f.origen && (f.origen !== "reorganizacion" || f.acto_id));
  });

  const confirmar = async () => {
    if (!peticion.value || !sePuedeConfirmar.value) return;
    guardando.value = true;
    error.value = "";
    try {
      const f = form.value;
      await mover(peticion.value.hijoId, peticion.value.padreId, {
        vigente_desde: f.vigente_desde,
        origen: f.origen,
        acto_id: f.origen === "reorganizacion" ? Number(f.acto_id) : null
      });
      cerrar(true);
    } catch (e) {
      // Lo que falla aquí se dice aquí: el diálogo sigue abierto para corregir la fecha o el origen.
      error.value = e?.response?.data?.message || "No se pudo mover.";
    } finally {
      guardando.value = false;
    }
  };

  return { peticion, form, error, guardando, sePuedeConfirmar, pedir, confirmar, cancelar: () => cerrar(false) };
};
