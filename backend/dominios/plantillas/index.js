// LA PUERTA del dominio `plantillas` — **parcial**, igual que la de `tareas` y por el mismo motivo:
// hoy sólo tiene `datos/`, y el resto se mueve en F7.5. Ver la nota de `dominios/tareas/index.js`.
// AQUI SE EXPORTABA `datos/flujoDeLlenado.js`, las cinco funciones de la ejecucion de ENTREGA.
// Se disolvio en la fase 4 del frente 24: la ejecucion ya no es de este dominio --`recorridos` y
// `turnos` son de `tareas`-- y las cinco preguntas eran las mismas que las de firma. Viven una sola
// vez en `dominios/tareas/datos/recorrido.js`.

// La receta del recorrido unificado (frente 24, fase 4). Escribe `pasos_declarados` y
// `participantes_declarados`: las dos tablas de este dominio, por su `datos/`.
export {
  participantesDeUnPasoDeEntrega,
  participantesDeUnPasoDeFirma,
  reemplazarReceta,
  hayRecetaDeclarada,
  leerRecetaDeEdicion,
  leerRecetaDeEntregable,
  resolverReceta
} from "./datos/recetaDelRecorrido.js";
