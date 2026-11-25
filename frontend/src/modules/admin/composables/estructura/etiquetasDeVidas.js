/* LA ETIQUETA DE UNA VIDA — «Escuela A · 2026-11-01 → 2026-11-24» — para la columna «Vida que
 * termina» de las tres tablas de equivalencias, que en el editor de /admin salía como un número.
 *
 * El mapa de referencias del editor resuelve por NOMBRE de columna, y `antecesor_vigencia_id` apunta
 * a tres tablas distintas según quién la lleve; por eso esta columna no puede ir en ese mapa y tiene
 * su propia resolución, por tabla. Las etiquetas de cada clase se piden una vez, la primera que hace
 * falta, y se guardan: como el estado es reactivo, la celda se repinta sola cuando llegan.
 */
import { reactive } from "vue";
import { adminSqlService } from "@/modules/admin/services/AdminSqlService";

const CLASE_DE = Object.freeze({
  unit_equivalencias: "unidad",
  position_equivalencias: "puesto",
  process_equivalencias: "proceso"
});
const etiquetas = reactive({});
const pedidas = new Set();

const cargar = async (clase) => {
  try {
    const { data } = await adminSqlService.getVidasConSuNodo(clase);
    etiquetas[clase] = Object.fromEntries((Array.isArray(data) ? data : []).map((v) => [String(v.id), v.etiqueta]));
  } catch {
    etiquetas[clase] = {};
  }
};

/* Devuelve la etiqueta, o `null` si esa tabla no lleva vidas o todavía no han llegado. */
export const etiquetaDeVida = (tablaDeEquivalencias, vidaId) => {
  const clase = CLASE_DE[tablaDeEquivalencias];
  if (!clase || vidaId === null || vidaId === undefined || vidaId === "") return null;
  if (!pedidas.has(clase)) {
    pedidas.add(clase);
    cargar(clase);
  }
  return etiquetas[clase]?.[String(vidaId)] ?? null;
};
