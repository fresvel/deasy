import crypto from 'crypto';
import { MinioHelper } from '../infrastructure/MinioHelper.js';

const DOSSIER_BUCKET = process.env.MINIO_DOSSIER_BUCKET || 'deasy-dossier';

/**
 * Responsabilidad: subir el PDF SENESCYT (y preparar soporte para el PDF
 * adicional por título) a MinIO, devolviendo la metadata de storage.
 *
 * Prefijos usados:
 *   dossier/{cedula}/titulos/senescyt/   → PDF del certificado SENESCYT
 *   dossier/{cedula}/titulos/soportes/   → PDFs adicionales de respaldo por título
 */
export class SenescytPdfStorageService {

    /**
     * Genera un hash SHA-256 del buffer para identificar el objeto de forma única.
     * @param {Buffer} buffer
     * @returns {string}
     */
    _hashBuffer(buffer) {
        return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
    }

    /**
     * Normaliza el nombre original del archivo para usarlo como parte del object_key.
     * @param {string} originalName
     * @returns {string}
     */
    _sanitizeName(originalName) {
        return String(originalName || 'senescyt.pdf')
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .toLowerCase();
    }

    /**
     * Sube el PDF del certificado SENESCYT a MinIO.
     *
     * @param {Buffer} pdfBuffer
     * @param {string} cedula         - cédula del titular (usada en el prefijo del objeto)
     * @param {string} originalName   - nombre original del archivo subido por el usuario
     * @returns {Promise<{bucket: string, object_key: string, etag: string, mime_type: string, original_name: string, uploaded_at: Date}>}
     */
    async uploadSenescytPdf(pdfBuffer, cedula, originalName) {
        await MinioHelper.ensureBucket(DOSSIER_BUCKET);

        const hash      = this._hashBuffer(pdfBuffer);
        const safeName  = this._sanitizeName(originalName);
        const objectKey = `dossier/${cedula}/titulos/senescyt/${hash}_${safeName}`;

        const result = await MinioHelper.putBuffer(
            DOSSIER_BUCKET,
            objectKey,
            pdfBuffer,
            { 'content-type': 'application/pdf' }
        );

        return {
            bucket:        DOSSIER_BUCKET,
            object_key:    objectKey,
            etag:          result?.etag ?? result ?? '',
            mime_type:     'application/pdf',
            original_name: originalName,
            uploaded_at:   new Date()
        };
    }

    /**
     * Devuelve la estructura de metadata vacía que se usará para el soporte
     * adicional por título. El llenado real de este soporte se realizará
     * cuando el flujo de PDF adicional esté completo (otra rama/tarea).
     *
     * @param {string} cedula
     * @returns {{bucket: string, object_key_prefix: string, mime_type: string|null, etag: string|null, original_name: string|null, uploaded_at: Date|null}}
     */
    buildSoporteAdicionalPlaceholder(cedula) {
        return {
            bucket:        DOSSIER_BUCKET,
            object_key:    `dossier/${cedula}/titulos/soportes/`,  // prefijo; se completará con el nombre real
            etag:          null,
            mime_type:     null,
            original_name: null,
            uploaded_at:   null
        };
    }
}
