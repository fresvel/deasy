import { exec } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { randomUUID } from 'crypto';
import { downloadFromMinio, uploadToMinio } from './minioClient.js';
import { generateStampImage } from './sigmaker/index.js';

const BASE_DIR = path.resolve('./workspace');
const INPUT_DIR = path.join(BASE_DIR, 'input');
const OUTPUT_DIR = path.join(BASE_DIR, 'output');
const TEMP_DIR = path.join(BASE_DIR, 'temp');

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

function validatePayload(data) {
  const required = [
    'signType',
    'minioPdfPath',
    'stampText',
    'finalPath',
    'minioCertPath',
    'certPassword',
  ];

  for (const field of required) {
    if (!data[field]) return `Missing required field: ${field}`;
  }

  if (!['coordinates', 'token'].includes(data.signType)) {
    return `Invalid signType: must be 'coordinates' or 'token'`;
  }

  if (data.signType === 'coordinates') {
    if (
      !data.coordinates ||
      typeof data.coordinates.page !== 'number' ||
      typeof data.coordinates.x !== 'number' ||
      typeof data.coordinates.y !== 'number'
    ) {
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

export async function signDocument(data) {
  const validationError = validatePayload(data);
  if (validationError) {
    return { status: 'error', message: validationError };
  }

  const jobId = randomUUID();
  const originalName = path.basename(data.minioPdfPath, '.pdf');
  const jobTempDir = path.join(TEMP_DIR, jobId);

  const pdfPath = path.join(INPUT_DIR, `${jobId}_${originalName}.pdf`);
  const signedPath = path.join(OUTPUT_DIR, `${jobId}_${originalName}_signed.pdf`);

  const cleanedPath = path.join(jobTempDir, 'cleaned.pdf');
  const outputPath = path.join(jobTempDir, 'output.pdf');
  const stampPath = path.join(jobTempDir, 'firma.png');
  const passPath = path.join(jobTempDir, 'pass.txt');
  const certPath = path.join(jobTempDir, 'cert.p12');
  const pyhankoConfigPath = path.join(jobTempDir, 'pyhanko.yml');

  await fs.ensureDir(INPUT_DIR);
  await fs.ensureDir(OUTPUT_DIR);
  await fs.ensureDir(jobTempDir);

  try {
    console.log(`[signer] [${jobId}] Starting signing job...`);

    console.log(`[signer] [${jobId}] Downloading PDF: ${data.minioPdfPath}`);
    await downloadFromMinio(data.minioPdfPath, pdfPath);

    console.log(`[signer] [${jobId}] Downloading cert: ${data.minioCertPath}`);
    await downloadFromMinio(data.minioCertPath, certPath);

    await fs.writeFile(passPath, data.certPassword, { mode: 0o600 });

    console.log(`[signer] [${jobId}] Generating stamp image for: ${data.stampText}`);
    await generateStampImage({
      outputPath: stampPath,
      stampText: data.stampText,
      finalPath: data.finalPath,
      logoPath: path.resolve('./sigmaker/puce_logo.png'),
    });

    console.log(`[signer] [${jobId}] Cleaning PDF with Ghostscript`);
    await execCommand(
      `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/prepress -dNOPAUSE -dBATCH -o "${cleanedPath}" "${pdfPath}"`
    );

    let coordinates;

    if (data.signType === 'coordinates') {
      coordinates = data.coordinates;
      console.log(
        `[signer] [${jobId}] Using coordinates: page=${coordinates.page}, x=${coordinates.x}, y=${coordinates.y}`
      );
    } else {
      console.log(`[signer] [${jobId}] Searching token: ${data.token}`);
      coordinates = await findTokenCoordinates(cleanedPath, data.token);
      console.log(
        `[signer] [${jobId}] Token found at: page=${coordinates.page}, x=${coordinates.x}, y=${coordinates.y}`
      );
    }

    const x2 = coordinates.x + 110;
    const y2 = coordinates.y - 80;

    const field = `${coordinates.page}/${coordinates.x},${coordinates.y},${x2},${y2}/ela`;

    console.log(`[signer] [${jobId}] Adding signature field: ${field}`);
    await execCommand(
      `pyhanko sign addfields --field "${field}" "${cleanedPath}" "${outputPath}"`
    );

    console.log(`[signer] [${jobId}] Generating pyHanko config`);
    await fs.writeFile(pyhankoConfigPath, generatePyhankoConfig(stampPath));

    console.log(`[signer] [${jobId}] Signing document with PKCS#12`);
    const signCmd = `pyhanko --config "${pyhankoConfigPath}" sign addsig pkcs12 --style-name noto-qr --field ela --passfile "${passPath}" "${outputPath}" "${signedPath}" "${certPath}"`;

    console.log(`[signer] [${jobId}] Running command: ${signCmd}`);
    await execCommand(signCmd);

    console.log(`[signer] [${jobId}] Uploading signed PDF to MinIO: ${data.minioPdfPath}`);
    await uploadToMinio(data.minioPdfPath, signedPath);

    console.log(`[signer] [${jobId}] Done.`);
    return {
      status: 'success',
      message: 'Document signed successfully',
      signedPath: data.minioPdfPath,
      finalPath: data.finalPath,
      jobId,
    };
  } catch (error) {
    console.error(`[signer] [${jobId}] Error:`, error.message);
    return {
      status: 'error',
      message: error.message,
      jobId,
    };
  } finally {
    await fs.remove(jobTempDir).catch(() => {});
  }
}

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