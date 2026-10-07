// LA PUERTA DEL DOMINIO `organizacion`: el organigrama y el territorio.
//
// Es lo ÚNICO que otro dominio —o `index.js`— puede importar de aquí. Medido al moverlo: de fuera
// entraban **9 imports a 7 ficheros distintos**; ahora entran por este fichero.
//
// ⚠️ Lo que NO se exporta es tan importante como lo que sí: `datos/` y `datos/consulta/` no salen del
// dominio. Si algo de fuera los necesita, falta una operación aquí — no un import más.
//
// ⚠️ Y `routes/system_router.js` ARRASTRA DOS RUTAS QUE NO SON DE ESTE DOMINIO: `/system/bootstrap/
// status` y `/system/bootstrap/initialize`, que son del **transversal** (la instalación). El router
// viene aquí porque **6 de sus 8 rutas** son de organizacion —la institución y la geografía—, y
// partirlo ahora obligaría a montar dos routers en el mismo prefijo sin ninguna necesidad. Se parte
// el día que el bootstrap se mueva a `transversal/`, y queda escrito para que ese día se vea.
export { default as programRouter } from "./routes/program_router.js";
export { default as unitRouter } from "./routes/unit_router.js";
export { default as systemRouter } from "./routes/system_router.js";

// El alta de unidades desde el editor de `/admin` (la ruta vive en `routes/admin_router.js`).
export { createProgram } from "./controllers/program_controler.js";

// El organigrama: lo usa el editor genérico de `/admin` para su pestaña de unidades.
export { default as OrgStructureService } from "./services/orgStructure.js";

// La institución: quién es, y cuál es su país. Lo preguntan la recuperación de correo y el documento
// de identidad —para saber qué documento es el «nacional»—.
export { default as InstitucionService } from "./services/InstitucionService.js";

// El territorio del Ecuador, que siembra el bootstrap. Son datos, no código.
export { PAISES, PROVINCIAS_EC, CANTONES_EC, PARROQUIAS_EC } from "./catalogos/geografiaCatalog.js";
