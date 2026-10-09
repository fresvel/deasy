// LA PUERTA DEL DOMINIO `firmas` — lo único que se importa de fuera.
//
// QUÉ ES ESTE DOMINIO, y conviene decirlo porque su nombre engaña: **no es «el flujo de firma»**.
// Es el MECANISMO de firmar un PDF —poner la rúbrica en el papel, comprobar que vale, hacerlo en
// lote— más el estado técnico del resultado. Dos tablas, `signature_statuses` (nivel 0) y
// `signature_batch_jobs` (nivel 6).
//
// LO QUE NO ES. Aquí vivió `datos/flujoDeFirma.js`, las cuatro funciones de la EJECUCIÓN de la
// firma, y se disolvió en el paso 3b de la fase 4 del frente 24. No se movió a otro sitio: **la
// ejecución dejó de ser de este dominio**. Un recorrido en marcha y los turnos que reparte son
// hechos de la TAREA, y la prueba es que las dos mitades —entrega y firma— hacían las mismas cuatro
// preguntas con dos juegos de tablas. Hoy son `tareas.recorridos` y `tareas.turnos`, con una columna
// `accion` que vale `entrega` o `firma`.
//
// ⚠️ Y AQUÍ DECÍA QUE `user_certificates` ERA DE ESTE DOMINIO. **No lo es**: el mapa dice
// `person_certificates`, en `identidad` (nivel 1), y el nombre que este comentario citaba no existe
// en el esquema. El dominio de una tabla se le pregunta al mapa, no se adivina por el nombre — que
// es la misma lección que `cargos`, de `identidad` y no de `organizacion`.
//
// SE MOVIÓ EN F7.5 (frente 22) el 2026-10-09: 5 consultas, 1 tabla propia, y **tres `pool`
// capturados al importar** que se arreglaron por el camino — ver el aviso en `datos/lotes.js`.
// LA PUERTA EXPORTA UNA SOLA COSA, y eso es un hallazgo, no una decisión de estilo: al medir quién
// necesitaba los servicios desde fuera salió que **nadie**. `buildSignContext`,
// `processSinglePdfSigning` y `persistSignatureWorkflowResult` sólo las usaba el controlador que se
// movió con ellas. Así que este dominio queda **cerrado**: de fuera sólo entra su router.
//
// Si mañana `tareas` necesita firmar algo, la dependencia se declara aquí y se ve.
export { default as firmasRouter } from "./routes/index.js";
