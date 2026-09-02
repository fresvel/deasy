/**
 * De qué color se pinta un canal.
 *
 * ── LA REGLA QUE SOSTIENE TODA LA PANTALLA ──────────────────────────────────────────────────────
 *
 * **Con `evidencia: "afirmacion"` NUNCA se pinta verde.** Y no es una preferencia estética: es la
 * lección de las dos caídas que motivaron esta pantalla.
 *
 * El 2026-08-31 el canal de Telegram estuvo horas sin poder resolver `api.telegram.org` y su estado
 * decía `conectado: true`, porque esa bandera sólo significaba «arranqué y nadie me paró». Una
 * pantalla que pintara verde con eso habría sido peor que no tener pantalla: habría dado por sano un
 * canal muerto, con la autoridad de un semáforo.
 *
 * Por eso el backend manda DOS cosas —el veredicto y **qué lo respalda**— y aquí sólo se pinta verde
 * cuando hay una prueba detrás.
 */

/**
 * ⚠️ **SE NOMBRA EL TONO, NO EL COLOR**, y es una regla del repositorio con su propia puerta
 * (`check:color-theme`): si la función pregunta por los DATOS se queda en su componente; si pregunta
 * por el COLOR se va al CSS. En medio está el nombre del tono, y ése es el contrato.
 *
 * El vocabulario es el de `AppTag`, no uno mío. Devolver «verde» habría metido una segunda forma de
 * nombrar lo mismo, que es justo lo que ese diccionario existe para evitar.
 */
import { TONOS } from "@/shared/utils/estadoTono";

/** Lo que respalda un verdadero verde. Cualquier otra cosa, ámbar como mucho. */
const EVIDENCIAS_QUE_PRUEBAN = ["sondeo", "plataforma"];

export const tonoDe = (canal) => {
  if (!canal) return TONOS.NEUTRAL;

  // Bloqueado y caído son los dos rojos, y se distinguen en el TEXTO, no en el color: los dos piden
  // que alguien actúe, pero uno no se arregla reiniciando.
  if (canal.salud === "bloqueado" || canal.salud === "caido") return TONOS.DANGER;
  if (canal.salud === "desconocido") return TONOS.NEUTRAL;
  // Esperar a que alguien escanee NO es un fallo: es una tarea pendiente, y merece su propio aviso.
  if (canal.salud === "sin_vincular") return TONOS.WARNING;

  // ⚠️ AQUÍ ESTÁ LA REGLA. `salud: "sano"` con `evidencia: "afirmacion"` es exactamente lo que decía
  // el canal muerto de las seis horas.
  if (canal.salud === "sano" && EVIDENCIAS_QUE_PRUEBAN.includes(canal.evidencia)) return TONOS.SUCCESS;
  return TONOS.WARNING;
};

/** Qué se le dice a quien mira, que es distinto del color y a veces más importante. */
export const explicacionDe = (canal) => {
  if (!canal) return "";
  if (canal.salud === "bloqueado") {
    return `La plataforma responde ${canal.estadoPlataforma ?? "con un bloqueo"}. Esto NO se arregla reiniciando: hace falta que alguien lo mire.`;
  }
  if (canal.salud === "sin_vincular") return "Hay que escanear el código para vincular la sesión.";
  if (canal.salud === "caido") return canal.ultimoError || "El canal no está funcionando.";
  if (canal.evidencia === "afirmacion") {
    // Se dice literalmente que no está probado. Callarlo es lo que convierte una suposición en un
    // hecho a ojos de quien mira.
    return "El canal dice estar bien, pero no se ha podido confirmar con la plataforma.";
  }
  if (canal.nombre === "whatsapp") {
    // ⚠️ NO se promete que reciba. La sesión puede estar CONNECTED y aun así no entregar un mensaje
    // --pasó el 2026-09-01 con `@lid`--, así que decir «funciona» sería un verde falso.
    return "La sesión está viva. La entrega de un mensaje de otra persona no se puede comprobar sola.";
  }
  return "El sondeo responde: si llega un mensaje, se recibe.";
};

/** Hace cuánto, en palabras. `null` cuando no hay dato, que también es información. */
export const desdeHace = (iso, ahora = Date.now()) => {
  if (!iso) return null;
  const segundos = Math.max(0, Math.floor((ahora - new Date(iso).getTime()) / 1000));
  if (segundos < 60) return `hace ${segundos} s`;
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 48) return `hace ${horas} h`;
  return `hace ${Math.floor(horas / 24)} días`;
};
