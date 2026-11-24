// MOVER UN NODO DE PADRE, DECIDIDO UNA VEZ PARA LOS DOS ARBOLES (frente 27, D-04).
//
// Con aristas fechadas, cambiar de padre dejo de ser un UPDATE. Lo que hay que hacer depende de en
// que estado esta la arista que el nodo tiene hoy, y eso es lo que decide esta funcion. Es PURA:
// no toca la base. Devuelve los pasos, y cada arbol los ejecuta con las consultas de su dominio
// --organizacion las de unidades, procesos las de procesos--, porque una tabla la escribe su dueño.
//
//   arista de hoy      | que significa moverla
//   -------------------|------------------------------------------------------------------
//   ninguna            | abrir una: borrador si el nodo aun no tiene vida, fechada si la tiene
//   borrador           | cambiarle el padre: nadie ha dependido de ella todavia
//   programada         | lo mismo: aun no ha regido ni un dia
//   vigente            | CERRARLA en la fecha del cambio y ABRIR otra desde ese mismo dia
//
// Lo unico que no decide es si el cambio cierra un ciclo: eso necesita leer el arbol y lo hace quien
// llama, antes de ejecutar.
import { conflict } from "../../errors/HttpError.js";

const texto = (valor) => String(valor ?? "").trim();

/**
 * @param {object|null} actual  la arista que cuenta hoy para el hijo: { id, padreId, estado, vigente_desde }
 *                              o null. Una arista ya terminada (`suprimido`) cuenta como ninguna.
 * @param {object} pedido       { padreId, desde, origen, actoId, hijoConVida }
 * @returns {Array<object>}     pasos: { op: "abrir" | "reemparejar" | "cerrar" | "borrar", ... }
 */
export const planDeMovimiento = (actual, { padreId = null, desde = null, origen = null, actoId = null, hijoConVida = false } = {}) => {
  const viva = actual && actual.estado !== "suprimido" ? actual : null;
  const nuevoPadre = padreId ? Number(padreId) : null;
  const fecha = texto(desde) || null;
  const motivo = texto(origen) || null;
  const acto = actoId ? Number(actoId) : null;

  const exigirFecha = (que) => {
    if (!fecha || !motivo) {
      throw conflict(`${que} Indica desde qué día y con qué origen.`);
    }
  };

  if (viva && Number(viva.padreId) === Number(nuevoPadre || 0)) {
    return [];
  }

  if (!viva) {
    if (!nuevoPadre) return [];
    if (hijoConVida) {
      // Un borrador de relación sólo arranca al ABRIRSE la vida del nodo. Si la vida ya existe
      // —rija o esté programada—, sin fecha la relación no empezaría nunca.
      exigirFecha("Este nodo ya tiene fecha de vigencia: su relación con el nuevo padre necesita fecha.");
      return [{ op: "abrir", padreId: nuevoPadre, desde: fecha, origen: motivo, actoId: acto }];
    }
    return [{ op: "abrir", padreId: nuevoPadre, desde: null, origen: null, actoId: null }];
  }

  if (viva.estado === "borrador" || viva.estado === "programado") {
    return nuevoPadre
      ? [{ op: "reemparejar", id: viva.id, padreId: nuevoPadre }]
      : [{ op: "borrar", id: viva.id }];
  }

  // Vigente: la relación ya rigió, así que no se pisa. Se cierra y, si hay nuevo padre, se abre otra.
  exigirFecha("Esta relación ya rige: no se cambia, se le pone fin y se abre otra.");
  if (fecha <= texto(viva.vigente_desde)) {
    throw conflict(
      `El cambio tiene que ser posterior al ${texto(viva.vigente_desde)}, que es desde cuando rige la relación actual.`
    );
  }
  const pasos = [{ op: "cerrar", id: viva.id, hasta: fecha, origen: motivo, actoId: acto }];
  if (nuevoPadre) {
    pasos.push({ op: "abrir", padreId: nuevoPadre, desde: fecha, origen: motivo, actoId: acto });
  }
  return pasos;
};
