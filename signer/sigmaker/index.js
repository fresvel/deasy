import QRCode from 'qrcode';
import fs from 'fs-extra';
import { createCanvas, loadImage } from 'canvas';

/**
 * Obtiene la fecha actual en zona horaria de Guayaquil (Ecuador).
 */
function getGuayaquilDate() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

/**
 * Ajusta el texto para que quepa en el ancho máximo del canvas.
 */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = words[0];

  for (let i = 1; i < words.length; i++) {
    const testLine = line + ' ' + words[i];
    if (ctx.measureText(testLine).width < maxWidth) {
      line = testLine;
    } else {
      lines.push(line);
      line = words[i];
    }
  }
  lines.push(line);
  return lines;
}

/**
 * Genera la imagen PNG del estampado de firma con QR.
 *
 * @param {object} options
 * @param {string} options.outputPath  ruta donde se guardará la imagen PNG
 * @param {string} options.stampText  nombre completo del firmante
 * @param {string} options.finalPath  URL que se codificará en el QR (ruta pública del doc firmado)
 * @param {string} options.logoPath   ruta absoluta al logo PNG de PUCE
 */
export function generateStampImage({ outputPath, stampText, finalPath, logoPath }) {
  return new Promise(async (resolve, reject) => {
    try {
      const timestamp = getGuayaquilDate();
      const qrText = `\n${stampText}\n${timestamp}`;

      const qrOptions = {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 220,
        color: { dark: '#000000', light: '#FFFFFF' },
      };

      // El QR codifica la ruta final pública del documento firmado
      const qrBuffer = await QRCode.toBuffer(finalPath || qrText, qrOptions);
      const qrImage = await loadImage(qrBuffer);
      const logo = await loadImage(logoPath);

      const rawLines = qrText.split('\n');
      const line1 = rawLines[0];   // vacío (compatibilidad con formato original)
      const line2 = rawLines[1];   // nombre del firmante
      const fecha = rawLines[2];   // fecha

      const textWidth = 450;
      const spacing = 25;
      const fontSize = 40;
      const lineHeight = fontSize + 6;
      const fontFamily = 'Red Hat Mono';

      const testCanvas = createCanvas(10, 10);
      const testCtx = testCanvas.getContext('2d');
      testCtx.font = `${fontSize}px '${fontFamily}'`;

      const wrappedName = wrapText(testCtx, line2, textWidth);

      const logoScale = 0.1;
      const logoW = logo.width * logoScale;
      const logoH = logo.height * logoScale;
      const logoTopMargin = -20;
      const logoBottomMargin = 20;

      const blockHeight =
        lineHeight +
        wrappedName.length * lineHeight +
        logoTopMargin +
        logoH + logoBottomMargin +
        lineHeight;

      const totalHeight = Math.max(qrImage.height, blockHeight) + spacing * 2;
      const totalWidth = qrImage.width + textWidth + spacing * 3;

      const canvas = createCanvas(totalWidth, totalHeight);
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = '#FFFFFF00';
      ctx.fillRect(0, 0, totalWidth, totalHeight);

      const qrY = (totalHeight - qrImage.height) / 2;
      ctx.drawImage(qrImage, spacing, qrY);

      const blockY = totalHeight - blockHeight;
      const textX = qrImage.width + spacing * 2;
      let textY = blockY;

      ctx.fillStyle = '#000000';
      ctx.font = `${fontSize}px '${fontFamily}'`;
      ctx.textAlign = 'left';

      ctx.fillText(line1, textX, textY);
      textY += lineHeight;

      wrappedName.forEach((line) => {
        ctx.fillText(line, textX, textY);
        textY += lineHeight;
      });

      textY += logoTopMargin;
      ctx.drawImage(logo, textX, textY, logoW, logoH);
      textY += logoH + logoBottomMargin;

      ctx.fillStyle = '#0066CC';
      ctx.font = `24px '${fontFamily}'`;
      ctx.textAlign = 'center';
      const fechaX = textX + logoW / 2;
      ctx.fillText(fecha, fechaX, textY);

      const out = fs.createWriteStream(outputPath);
      canvas.createPNGStream().pipe(out);
      out.on('finish', () => {
        console.log(`[sigmaker] Stamp image generated: ${outputPath}`);
        resolve();
      });
      out.on('error', reject);

    } catch (err) {
      reject(err);
    }
  });
}