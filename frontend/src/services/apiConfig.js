// Configuración centralizada para rutas de la API
// Puedes adaptar HOST, PORT, y rutas aquí según el entorno

const API_BASE_URL = process.env.VUE_APP_API_BASE_URL || "http://localhost:3000";

export const API_ROUTES = {
  BASE: API_BASE_URL,
  PROGRAMS: `${API_BASE_URL}/easym/v1/program`,
  AREAS: `${API_BASE_URL}/easym/v1/area`,
  TAREAS_PENDIENTES: (usuario) => `${API_BASE_URL}/easym/v1/tarea/pendiente?usuario=${usuario}`,
  INFORME_TUTORIAS: `${API_BASE_URL}/easym/v1/tutorias/parcial`,
  GENERAR_REPORTE: `${API_BASE_URL}/easym/v1/academia/co/logros.web`,
  OBTENER_REPORTE: `${API_BASE_URL}/easym/v1/academia/co/logros.pdf`,
};

