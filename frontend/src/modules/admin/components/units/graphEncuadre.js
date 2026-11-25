/* CON QUÉ ZOOM ABREN LOS DOS MAPAS — el organigrama y el de procesos.
 *
 * Los dos se encuadraban solos para que cupiera todo, y por eso el mismo nodo se veía a 156 px en
 * el organigrama (17 unidades, zoom 0,65) y a 520 en el mapa de procesos (3 procesos, zoom 2):
 * parecían de dos tamaños. El dueño pidió que abran igual (2026-11-24). Abren centrados y con este
 * zoom, quepa o no: 0,7 es lo que hoy deja ver el organigrama casi entero. A partir de ahí, la rueda
 * y los controles; el botón de encuadrar sigue ajustando a todo el contenido.
 */
export const ZOOM_INICIAL = 0.7;

/* Lo engancha cada vista una vez: encuadra en cuanto los nodos tienen medidas, y sólo la primera. */
export const encuadrarAlAbrir = ({ onNodesInitialized, fitView }) => {
  let hecho = false;
  onNodesInitialized(() => {
    if (hecho) return;
    hecho = true;
    fitView({ minZoom: ZOOM_INICIAL, maxZoom: ZOOM_INICIAL });
  });
};
