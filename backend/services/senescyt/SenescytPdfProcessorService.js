import { SenescytPdfTextExtractorService } from './SenescytPdfTextExtractorService.js';
import { SenescytPdfParserService }        from './SenescytPdfParserService.js';
import { SenescytPdfValidationService }    from './SenescytPdfValidationService.js';
import { SenescytPdfStorageService }       from './SenescytPdfStorageService.js';

/**
 * Responsabilidad: orquestar storage, extracción, parsing y validación.
 * Devuelve un objeto de preview que el controller puede enviar al cliente
 * antes de que el usuario confirme qué títulos importar al dosier.
 *
 * Flujo:
 *   1. Subir PDF a MinIO  → obtener metadata de storage
 *   2. Extraer texto      → rawText + páginas + metadatos
 *   3. Parsear            → titular + títulos mapeados
 *   4. Validar            → cédula + campos mínimos
 *   5. Armar preview      → devolver al controller sin persistir en el dosier
 */
export class SenescytPdfProcessorService {

    constructor() {
        this._extractor  = new SenescytPdfTextExtractorService();
        this._parser     = new SenescytPdfParserService();
        this._validator  = new SenescytPdfValidationService();
        this._storage    = new SenescytPdfStorageService();
    }

    /**
     * Procesa el PDF SENESCYT y devuelve el preview de títulos detectados.
     * No persiste nada en MongoDB. Sí sube el PDF a MinIO.
     *
     * @param {Buffer} pdfBuffer        - contenido del PDF
     * @param {string} originalName     - nombre original del archivo
     * @param {string} cedulaDosier     - cédula de la URL del dosier
     * @returns {Promise<{
     *   storage:        object,
     *   titular:        {nombre: string|null, cedula: string|null},
     *   titulos:        object[],
     *   globalWarnings: string[]
     * }>}
     * @throws {Error} si la cédula no coincide o no hay títulos detectados
     */
    async procesarPreview(pdfBuffer, originalName, cedulaDosier) {
        // 1. Subir PDF a MinIO primero para que el storage key esté disponible
        //    en el preview y luego pueda vincularse en la confirmación.
        const storageMetadata = await this._storage.uploadSenescytPdf(
            pdfBuffer,
            cedulaDosier,
            originalName
        );

        // 2. Extraer texto del PDF
        const { rawText } = await this._extractor.extract(pdfBuffer);

        // 3. Parsear texto → titular + títulos
        const parsed = this._parser.parse(rawText);

        // 4. Validar (lanza Error si cédula no coincide)
        const { titulos, globalWarnings } = this._validator.validate(parsed, cedulaDosier);

        // 5. Adjuntar metadata de storage a cada título del preview
        //    y preparar la estructura de soporte adicional (vacía por ahora)
        const titulosConStorage = titulos.map(titulo => ({
            ...titulo,
            soporte_senescyt:  storageMetadata,
            soporte_adicional: this._storage.buildSoporteAdicionalPlaceholder(cedulaDosier)
        }));

        return {
            storage:        storageMetadata,
            titular:        parsed.titular,
            titulos:        titulosConStorage,
            globalWarnings
        };
    }
}
