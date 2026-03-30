import * as Minio from 'minio';
import fs from 'fs-extra';

const minioUrl = new URL(process.env.MINIO_ENDPOINT || 'http://minio:9000');

const minioClient = new Minio.Client({
  endPoint: minioUrl.hostname,
  port: minioUrl.port ? parseInt(minioUrl.port) : (minioUrl.protocol === 'https:' ? 443 : 80),
  useSSL: minioUrl.protocol === 'https:',
  accessKey: process.env.MINIO_ACCESS_KEY || 'deasy_minio',
  secretKey: process.env.MINIO_SECRET_KEY || 'deasy_minio_secret',
});

const SPOOL_BUCKET = process.env.MINIO_SPOOL_BUCKET || 'deasy-spool';

/**
 * Descarga un objeto del bucket de spool a una ruta local.
 * @param {string} bucket bucket de MinIO
 * @param {string} objectName ruta del objeto en MinIO
 * @param {string} localPath ruta local de destino
 */
export async function downloadFromMinio(bucket, objectName, localPath) {
  const resolvedBucket = bucket || SPOOL_BUCKET;
  await minioClient.statObject(resolvedBucket, objectName);

  const obj = await minioClient.getObject(resolvedBucket, objectName);

  if (obj && typeof obj.pipe === 'function') {
    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(localPath);
      obj.on('error', (err) => reject(new Error(`MinIO download error (${objectName}): ${err.message}`)));
      writeStream.on('error', reject);
      writeStream.on('finish', resolve);
      obj.pipe(writeStream);
    });
  }

  if (Buffer.isBuffer(obj) || obj instanceof Uint8Array) {
    await fs.writeFile(localPath, obj);
    return;
  }

  throw new Error(`Unknown object type returned by MinIO for ${objectName}`);
}

/**
 * Sube un archivo local al bucket de spool de MinIO.
 * @param {string} bucket bucket de MinIO
 * @param {string} objectName ruta del objeto en MinIO
 * @param {string} localPath ruta local del archivo a subir
 */
export async function uploadToMinio(bucket, objectName, localPath) {
  const resolvedBucket = bucket || SPOOL_BUCKET;
  return new Promise((resolve, reject) => {
    minioClient.fPutObject(resolvedBucket, objectName, localPath, {}, (err, etag) => {
      if (err) reject(new Error(`MinIO upload error (${objectName}): ${err.message}`));
      else resolve(etag);
    });
  });
}
