// Deja pasar SÓLO a los microservicios de Deasy, nunca a un navegador.
//
// ⚠️ POR QUÉ HACE FALTA, Y NO ES OBVIO: el proxy publica el backend ENTERO bajo `/api/`
//
//     location /api/ { proxy_pass http://backend/; }     ← la barra final quita el prefijo
//
// así que CUALQUIER ruta que el backend sirva es alcanzable desde internet. Sin esto, las rutas
// internas estarían abiertas al mundo.
//
// Son DOS capas, y las dos hacen falta:
//   1. Una regla en nginx que devuelve 404 para `/api/internal/` — se comprueba desde fuera.
//   2. Esta clave compartida — porque una regla de proxy mal copiada en otro entorno no puede ser
//      lo único que protege.
//
// La clave va por cabecera y NO por parámetro: los parámetros acaban en los registros del servidor.
export const CABECERA = "x-deasy-servicio";

export const requiereServicioInterno = (req, res, next) => {
  const esperada = process.env.INTERNAL_SERVICE_KEY;

  // Sin clave configurada NO se abre la puerta: se cierra. Un despliegue al que se le olvidó
  // ponerla no debe quedar con las rutas internas al aire — falla ruidoso y se arregla.
  if (!esperada) {
    console.error("INTERNAL_SERVICE_KEY no está configurada: las rutas internas quedan cerradas.");
    return res.status(503).json({ message: "Servicio interno no configurado." });
  }

  const recibida = req.get(CABECERA);
  if (!recibida || recibida !== esperada) {
    // 404 y no 401: a quien no debería estar aquí no se le confirma que la ruta existe.
    return res.status(404).json({ message: "No encontrado." });
  }

  next();
};
