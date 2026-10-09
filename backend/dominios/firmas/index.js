// LA PUERTA DEL DOMINIO `firmas` — Y ESTÁ VACÍA, PERO NO POR LO MISMO QUE LA DE `empleo`.
//
// Aquí vivió `datos/flujoDeFirma.js`, el primer `datos/` que tuvo este dominio: las cuatro
// funciones de la EJECUCIÓN de la firma (buscar la instancia, cancelar sus solicitudes, cancelarla,
// reabrirla). Se disolvió en el paso 3b de la fase 4 del frente 24, y conviene entender por qué no
// se movió a otro sitio: **la ejecución dejó de ser de este dominio**.
//
// Un recorrido en marcha y los turnos que reparte son hechos de la TAREA, no de la firma, y la
// prueba es que las dos mitades hacían las mismas cuatro preguntas con dos juegos de tablas. Hoy son
// `tareas.recorridos` y `tareas.turnos`, con una columna `accion` que vale `entrega` o `firma`.
//
// LO QUE SIGUE SIENDO DE `firmas` son los certificados y el estado TÉCNICO de una firma
// —`signature_statuses`, `user_certificates`—, más las cuatro tablas de receta que el paso 4 retira.
// Cuando ese código se mueva, sale por aquí; hasta entonces este fichero no exporta nada.
export {};
