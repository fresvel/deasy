import InstitucionService from "../../services/system/InstitucionService.js";
import { nombreLocal } from "../../services/users/documentosPorPais.js";

// PUBLICO A PROPOSITO, igual que el catalogo geografico: lo consume el REGISTRO, que por definicion
// usa quien todavia no tiene cuenta. Y lo que devuelve no es secreto — es cómo se llama la
// institución y de qué país es, que está en su propia web.
//
// Existe porque sin él la pantalla de registro tendría que saberse el país: hasta el 2026-08-29
// llevaba escrito «Cédula (Ecuador)» en una lista, así que un despliegue peruano se lo habría
// enseñado a sus usuarios peruanos.
export const getInstitucionPublica = async (_req, res) => {
  try {
    const servicio = new InstitucionService();
    const institucion = await servicio.actual();
    res.json({
      nombre: institucion.nombre,
      pais: {
        id: institucion.pais_id,
        iso: institucion.pais_iso,
        nombre: institucion.pais_nombre
      },
      // Cómo llama este país a su documento de identidad. La pantalla lo pinta tal cual.
      documento_nacional: {
        nombre: nombreLocal(institucion.pais_iso),
        etiqueta: `${nombreLocal(institucion.pais_iso)} (${institucion.pais_nombre})`
      }
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
};
