import DocumentosLegales from "../../services/legal/DocumentosLegales.js";

let _documentos = null;
const documentos = () => (_documentos ??= new DocumentosLegales());

/**
 * Los textos vigentes, para enseñarlos en el registro.
 *
 * ⚠️ **Es PÚBLICA a propósito**: hay que poder leerlos **antes** de tener cuenta, porque aceptarlos
 * es requisito para tenerla. El Art. 12 de la LOPDP lo exige además en el momento: la información
 * debe darse *«de forma previa […] en el momento mismo de la recogida»*.
 *
 * ⚠️ **Y la sirve el BACKEND, no el frontend.** Antes el texto era un fichero estático del frontend y
 * el backend no lo veía: lo que se enseñaba y lo que se habría registrado podían no ser lo mismo, y
 * nadie se enteraría hasta que hiciera falta. Ahora hay una sola fuente.
 */
export const documentosVigentes = async (_req, res) => {
  try {
    const publicados = await documentos().publicados();
    return res.json({
      documentos: publicados.map((d) => ({
        id: d.id,
        clase: d.clase,
        version: d.version,
        texto: d.texto,
        // Se manda para que se pueda comprobar desde fuera que el texto no cambió. No es un secreto.
        contenidoHash: d.contenido_hash,
      })),
    });
  } catch (error) {
    console.error("No se pudieron leer los documentos legales:", error.message);
    return res.status(500).json({ message: "No se pudieron cargar los documentos()." });
  }
};
