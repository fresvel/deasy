import * as Minio from 'minio';
import amqp from 'amqplib';
import { exec } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Configuración MinIO
const minioUrl = new URL(process.env.MINIO_ENDPOINT || 'http://minio:9000');
const minioClient = new Minio.Client({
  endPoint: minioUrl.hostname,
  port: minioUrl.port ? parseInt(minioUrl.port) : (minioUrl.protocol === 'https:' ? 443 : 80),
  useSSL: minioUrl.protocol === 'https:',
  accessKey: process.env.MINIO_ACCESS_KEY || 'deasy_minio',
  secretKey: process.env.MINIO_SECRET_KEY || 'deasy_minio_secret'
});

const SPOOL_BUCKET = process.env.MINIO_SPOOL_BUCKET || 'deasy-spool';

// Configuración RabbitMQ
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://rabbitmq';
const REQUEST_QUEUE = 'multisigner/request';
const RESPONSE_QUEUE = 'multisigner/response';

// Función para descargar de MinIO
async function downloadFromMinio(bucket, objectName, localPath) {
  // Verificar que el objeto exista antes de descargarlo.
  await minioClient.statObject(bucket, objectName);

  const obj = await minioClient.getObject(bucket, objectName);

  // El cliente puede devolver un stream o directamente un buffer.
  if (obj && typeof obj.pipe === 'function') {
    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(localPath);
      obj.on('error', (err) => {
        reject(new Error(`MinIO download error (${bucket}/${objectName}): ${err.message}`));
      });
      writeStream.on('error', reject);
      writeStream.on('finish', resolve);
      obj.pipe(writeStream);
    });
  }

  // Si viene como buffer/Uint8Array
  if (Buffer.isBuffer(obj) || obj instanceof Uint8Array) {
    await fs.writeFile(localPath, obj);
    return;
  }

  throw new Error(`Unknown object type returned by MinIO for ${bucket}/${objectName}`);
}

// Función para subir a MinIO
async function uploadToMinio(bucket, objectName, localPath) {
  return new Promise((resolve, reject) => {
    minioClient.fPutObject(bucket, objectName, localPath, {}, (err, etag) => {
      if (err) reject(new Error(`MinIO upload error (${bucket}/${objectName}): ${err.message}`));
      else resolve(etag);
    });
  });
}

// Función para ejecutar comandos
function execCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

// Procesar firma
async function processSignature(data) {
  const tempDir = path.join('/tmp', uuidv4());
  await fs.ensureDir(tempDir);

  try {
    // Descargar PDF
    const pdfPath = path.join(tempDir, 'input.pdf');
    await downloadFromMinio(SPOOL_BUCKET, data.minioPdfPath, pdfPath);

    // Descargar certificado
    const certPath = path.join(tempDir, 'cert.p12');
    await downloadFromMinio(SPOOL_BUCKET, data.minioCertPath, certPath);

    // Guardar contraseña
    const passPath = path.join(tempDir, 'pass.txt');
    await fs.writeFile(passPath, data.certPassword);

    // Preprocesamiento QR
    // Nota: ajustar sigmaker/index.js para aceptar texto como argumento
    await execCommand(`cd sigmaker && node index.js "${data.stampText}"`);

    let coordinates;
    if (data.signType === 'coordinates') {
      coordinates = data.coordinates;
    } else if (data.signType === 'token') {
      // Ejecutar find_marker.py
      const markerOutput = await execCommand(`python3 find_marker.py ${pdfPath}`);
      if (markerOutput.trim() === 'NOT_FOUND') {
        throw new Error('Marcador no encontrado');
      }
      const [page, x, y] = markerOutput.trim().split(',');
      coordinates = { page: parseInt(page), x: parseInt(x), y: parseInt(y) };
    } else {
      throw new Error('Tipo de firma inválido');
    }

    // Limpiar PDF con ghostscript
    const cleanedPath = path.join(tempDir, 'cleaned.pdf');
    await execCommand(`gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/prepress -o ${cleanedPath} ${pdfPath}`);

    // Insertar campo
    const outputPath = path.join(tempDir, 'output.pdf');
    const field = `${coordinates.page}/${coordinates.x},${coordinates.y},${coordinates.x + 110},${coordinates.y - 80}/ela`;
    await execCommand(`pyhanko sign addfields --field ${field} ${cleanedPath} ${outputPath}`);

    // Firmar
    const signedPath = path.join(tempDir, 'signed.pdf');
    await execCommand(`pyhanko sign addsig --style-name noto-qr --field ela pkcs12 --passfile ${passPath} ${outputPath} ${signedPath} ${certPath}`);

    // Subir de vuelta a MinIO (reemplazar)
    await uploadToMinio(SPOOL_BUCKET, data.minioPdfPath, signedPath);

    return { status: 'success', signedPath: data.minioPdfPath };
  } catch (error) {
    return { status: 'error', message: error.message };
  } finally {
    // Limpiar temporales
    await fs.remove(tempDir);
  }
}

// Conectar a RabbitMQ y procesar
async function startService() {
  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();

  await channel.assertQueue(REQUEST_QUEUE);
  await channel.assertQueue(RESPONSE_QUEUE);

  console.log('Multisigner service started, waiting for messages...');

  channel.consume(REQUEST_QUEUE, async (msg) => {
    if (msg) {
      const data = JSON.parse(msg.content.toString());
      console.log('Received request:', data);

      const result = await processSignature(data);
      console.log('Result:', result);

      channel.sendToQueue(RESPONSE_QUEUE, Buffer.from(JSON.stringify(result)));
      channel.ack(msg);
    }
  });
}

startService().catch(console.error);