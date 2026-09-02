import crypto from "node:crypto";

/**
 * La huella de un texto legal.
 *
 * ⚠️ **SOBRE UN TEXTO NORMALIZADO**, y no sobre los bytes tal cual. Un fichero editado en Windows
 * llega con `\r\n` y en Linux con `\n`: el contenido que lee la persona es el mismo, pero la huella
 * sería distinta y la comprobación fallaría sin que nada esté mal. También se recorta el final,
 * porque un salto de línea de más lo añade cualquier editor.
 *
 * ⚠️ **Vive en su propio módulo desde que el texto se fue al archivo.** Lo necesitan los DOS lados
 * —`DocumentosLegales` para sellar la fila y `ArchivoLegal` para verificar lo que releyó de MinIO— y
 * tenerlo en uno de ellos obligaba al otro a importarlo, cerrando un ciclo. Una segunda copia de
 * esta normalización sería peor: dos huellas distintas del mismo texto es exactamente el fallo que
 * la huella viene a delatar.
 */
export const huellaDe = (texto) =>
  crypto.createHash("sha256").update(String(texto ?? "").replace(/\r\n/g, "\n").trimEnd(), "utf8").digest("hex");

export default huellaDe;
