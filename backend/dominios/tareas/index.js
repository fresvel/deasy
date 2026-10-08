// LA PUERTA del dominio `tareas` — **parcial a propósito, y conviene saberlo**.
//
// Hoy este dominio sólo tiene `datos/`: sus `routes/`, `controllers/` y `services/` siguen en
// `backend/services/` y se mueven en **F7.5**, que es la fase que los reparte tabla por tabla. La
// carpeta nació con el piloto de F7 —que necesitaba el SQL de tres dominios fuera del flujo— y esta
// puerta se abrió al integrarlo, porque sin ella los tres `UPDATE` que `services/documents` hacía por
// su cuenta no tenían por dónde entrar.
//
// ⚠️ Así que esto NO es el contrato de un dominio terminado: es su `datos/` con la puerta puesta. El
// contrato completo está en `chat`, `organizacion` e `identidad`.
export {
  actualizarArchivoVigente,
  actualizarEstado,
  getMaxDocumentVersionForTaskItem,
  insertDocumentVersion
} from "./datos/documentVersions.js";
export { getLatestDocumentVersionForTaskItem } from "./datos/consulta/ultimaVersionDelEntregable.js";
