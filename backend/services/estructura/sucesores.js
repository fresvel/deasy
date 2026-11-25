// REPARTIR LAS EQUIVALENCIAS ENTRE LAS VIDAS (frente 27, D-05).
//
// Lo que tiene sucesores es una VIDA —la vez que el nodo rigió hasta tal día—, no el nodo. Las tres
// clases de nodo las leen igual: una consulta trae las vidas, otra las equivalencias, y aquí se
// cuelga cada equivalencia de la suya. Es pura: ni base ni reglas, y por eso la comparten los dos
// dominios sin que ninguno lea las tablas del otro.

export const agruparPor = (filas, clave) => {
  const grupos = new Map();
  for (const fila of filas ?? []) {
    if (!grupos.has(fila[clave])) grupos.set(fila[clave], []);
    grupos.get(fila[clave]).push(fila);
  }
  return grupos;
};

// Cada vida sale con su lista `sucesores` —vacía si no tiene—, sin la clave que sólo servía para
// repartir.
export const conSusSucesores = (vidas, equivalencias) => {
  const porVida = agruparPor(equivalencias, "antecesor_vigencia_id");
  return (vidas ?? []).map((vida) => ({
    ...vida,
    sucesores: (porVida.get(vida.id) ?? []).map(({ antecesor_vigencia_id: _vida, ...resto }) => resto)
  }));
};
