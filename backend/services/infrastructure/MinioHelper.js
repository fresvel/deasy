import * as Minio from 'minio';
// Singleton del cliente MinIO compartido entre servicios.
// NO duplicar esta lógica en otros servicios nuevos; importar desde aquí.
let _client = null;
export class MinioHelper {
    /**
     * Devuelve (o crea) el cliente MinIO singleton.
     * @returns {Minio.Client}
     */
    static getClient() {
        if (_client) return _client;

        const endpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
        const url      = new URL(endpoint);
        const useSSL   = String(process.env.MINIO_USE_SSL || '').trim() === '1'
                         || url.protocol === 'https:';

        _client = new Minio.Client({
            endPoint:  url.hostname,
            port:      Number(url.port || (useSSL ? 443 : 80)),
            useSSL,
            accessKey: process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER  || '',
            secretKey: process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || ''
        });

        return _client;
    }
    /**
     * Crea el bucket si no existe.
     * @param {string} bucketName
     */

    
    static async ensureBucket(bucketName) {
        const client = MinioHelper.getClient();
        const exists = await client.bucketExists(bucketName);
        if (!exists) {
            await client.makeBucket(bucketName);
        }
    }


    /**
     * Sube un Buffer a MinIO y devuelve etag  metadata básica.
     * @param {string} bucketName
     * @param {string} objectKey
     * @param {Buffer} buffer
     * @param {Record<string,string>} [metadata]
     * @returns {Promise<{etag: string}>}
     */

    static async putBuffer(bucketName, objectKey, buffer, metadata = {}) {
        const client = MinioHelper.getClient();
        const result = await client.putObject(
            bucketName,
            objectKey,
            buffer,
            buffer.length,
            metadata
        );
        return result;
    }
}
