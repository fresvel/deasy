import { exec } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { downloadFromMinio, uploadToMinio } from './minioClient.js';
import { generateStampImage } from './sigmaker/index.js';

/**
 * Ejecuta un comando de shell y devuelve stdout.
 */
function execCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Command failed: ${command}\n${stderr || error.message}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

/**
 * Valida los campos requeridos del payload.
 * @param {object} data
 * @returns {string|null} mensaje de error o null si es válido
 */
function validatePayload(data) {
  const required = ['signType', 'minioPdfPath', 'stampText', 'finalPath', 'minioCertPath', 'certPassword'];
  for (const field of required) {
    if (!data[field]) return `Missing required field: ${field}`;
  }

  if (!['coordinates', 'token'].includes(data.signType)) {
    return `Invalid signType: must be 'coordinates' or 'token'`;
  }

  if (data.signType === 'coordinates') {
    if (!data.coordinates || typeof data.coordinates.page !== 'number'
      || typeof data.coordinates.x !== 'number'
      || typeof data.coordinates.y !== 'number') {
      return `signType 'coordinates' requires coordinates: { page, x, y }`;
    }
  }

  if (data.signType === 'token') {
    if (!data.token || typeof data.token !== 'string') {
      return `signType 'token' requires a token string`;
    }
  }

  return null;
}

/**
 * Busca el marcador de token en el PDF usando find_marker.py.
 * @param {string} pdfPath ruta local del PDF limpio
 * @param {string} token token a buscar (formato !-XXXXXXXXXX-!)
 * @returns {{ page: number, x: number, y: number }}
 */
async function findTokenCoordinates(pdfPath, token) {
  const scriptPath = path.resolve('./find_marker.py');
  const output = await execCommand(`python3 "${scriptPath}" "${pdfPath}" "${token}"`);
  const result = output.trim();

  if (result === 'NOT_FOUND') {
    throw new Error(`Token marker '${token}' not found in PDF`);
  }

  const [page, x, y] = result.split(',').map(Number);
  return { page, x, y };
}

/**
 * Proceso completo de firma de un documento.
 * @param {object} data payload JSON recibido
 */
export async function signDocument(data) {
  const validationError = validatePayload(data);
  if (validationError) {
    return { status: 'error', message: validationError };
  }

  const tempDir = path.join(os.tmpdir(), randomUUID());
  await fs.ensureDir(tempDir);

  // Paths temporales
  const pdfPath     = path.join(tempDir, 'input.pdf');
  const cleanedPath = path.join(tempDir, 'cleaned.pdf');
  const outputPath  = path.join(tempDir, 'output.pdf');
  const signedPath  = path.join(tempDir, 'signed.pdf');
  const stampPath   = path.join(tempDir, 'firma.png');
  const passPath    = path.join(tempDir, 'pass.txt');
  const certPath    = path.join(tempDir, 'cert.p12');

  try {
    // 1. Descargar PDF desde MinIO
    console.log(`[signer] Downloading PDF: ${data.minioPdfPath}`);
    await downloadFromMinio(data.minioPdfPath, pdfPath);

    // 2. Descargar certificado .p12 desde MinIO
    console.log(`[signer] Downloading cert: ${data.minioCertPath}`);
    await downloadFromMinio(data.minioCertPath, certPath);

    // 3. Escribir contraseña en archivo temporal en disco (pyhanko requiere archivo)
    //    Usamos un archivo en /tmp que es tmpfs (RAM en Linux)
    await fs.writeFile(passPath, data.certPassword, { mode: 0o600 });

    // 4. Generar imagen del estampado con QR
    console.log(`[signer] Generating stamp image for: ${data.stampText}`);
    await generateStampImage({
      outputPath: stampPath,
      stampText: data.stampText,
      finalPath: data.finalPath,
      logoPath: path.resolve('./sigmaker/puce_logo.png'),
    });

    // 5. Limpiar PDF con Ghostscript
    console.log(`[signer] Cleaning PDF with Ghostscript`);
    await execCommand(
      `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/prepress -dNOPAUSE -dBATCH -o "${cleanedPath}" "${pdfPath}"`
    );

    // 6. Obtener coordenadas según el tipo de firma
    let coordinates;
    if (data.signType === 'coordinates') {
      coordinates = data.coordinates;
      console.log(`[signer] Using provided coordinates: page=${coordinates.page} x=${coordinates.x} y=${coordinates.y}`);
    } else {
      console.log(`[signer] Searching for token marker: ${data.token}`);
      coordinates = await findTokenCoordinates(cleanedPath, data.token);
      console.log(`[signer] Token found at: page=${coordinates.page} x=${coordinates.x} y=${coordinates.y}`);
    }

    // 7. Insertar campo de firma con pyhanko
    const x2 = coordinates.x + 110;
    const y2 = coordinates.y - 80;
    const field = `${coordinates.page}/${coordinates.x},${coordinates.y},${x2},${y2}/ela`;
    console.log(`[signer] Adding signature field: ${field}`);
    await execCommand(`pyhanko sign addfields --field ${field} "${cleanedPath}" "${outputPath}"`);

    // 8. Copiar pyhanko.yml con el stamp configurado para usar la imagen generada
    const pyhankoConfig = generatePyhankoConfig(stampPath);
    const pyhankoConfigPath = path.join(tempDir, 'pyhanko.yml');
    await fs.writeFile(pyhankoConfigPath, pyhankoConfig);

    // 9. Firmar el documento
    console.log(`[signer] Signing document`);
    await execCommand(
      `cd "${tempDir}" && pyhanko --config "${pyhankoConfigPath}" sign addsig --style-name noto-qr --field ela pkcs12 --passfile "${passPath}" "${outputPath}" "${signedPath}" "${certPath}"`
    );

    // 10. Subir documento firmado a MinIO (reemplaza el original en el spool)
    console.log(`[signer] Uploading signed PDF to MinIO: ${data.minioPdfPath}`);
    await uploadToMinio(data.minioPdfPath, signedPath);

    console.log(`[signer] Done. Signed at: ${data.minioPdfPath}`);
    return {
      status: 'success',
      message: 'Document signed successfully',
      signedPath: data.minioPdfPath,
      finalPath: data.finalPath,
    };

  } catch (error) {
    console.error(`[signer] Error:`, error.message);
    return {
      status: 'error',
      message: error.message,
    };
  } finally {
    // Limpiar directorio temporal
    await fs.remove(tempDir).catch(() => {});
  }
}

/**
 * Genera el contenido del pyhanko.yml con la ruta dinámica de la imagen de firma.
 */
function generatePyhankoConfig(stampImagePath) {
  return `logging:
  root-level: ERROR
  root-output: stderr

stamp-styles:
  noto-qr:
    type: text
    stamp-text: ""
    background: "${stampImagePath}"
    background-opacity: 1
    border-width: 0
    background-layout:
      x-align: left
      inner-content-scaling: 'shrink-to-fit'
    inner-content-layout:
      x-align: left
      y-align: top
      margins:
        right: 10
      inner-content-scaling: 'none'
    text-box-style:
      font-size: 10
      vertical-text: bottom
`;
}