import QRCode from "qrcode"
import fs from "fs-extra"
import { createCanvas, loadImage } from 'canvas'

class QRCodeGenerator {
  constructor(outputPath, text) {
    this.outputPath = outputPath;
    this.timestamp = new Date().toISOString().substring(0,10); // Estampa de tiempo
    this.qrtext = `Firma Electrónica:\n${text}\n${this.timestamp}\nPUCESE`;
    console.log(this.timestamp)
    this.qrOptions = {
      errorCorrectionLevel: 'H',
      margin: 2,
      with:200,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    };
  }

  async generate() {
    try {
      const qrBuffer = await QRCode.toBuffer(this.qrtext, this.qrOptions);
      const qrImage = await loadImage(qrBuffer);

      const textWidth = 300;
      const canvas = createCanvas(qrImage.width + textWidth, qrImage.height);
      const ctx = canvas.getContext('2d');

      ctx.drawImage(qrImage, 0, 0);

      // Configurar el texto a la derecha
      ctx.fillStyle = '#000000';
      ctx.font = '30px NotoSerif-Regular';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      // Dibujar el texto en el costado derecho
      const lines = this.wrapText(ctx, this.qrtext, textWidth);
      const lineHeight = 30;
      const startY = (qrImage.height - (lines.length * lineHeight)) / 2;

      lines.forEach((line, index) => {
        ctx.fillText(line, qrImage.width + 10, startY + index * lineHeight);
      });

      // Guardar la imagen final
      const out = fs.createWriteStream(this.outputPath);
      const stream = canvas.createPNGStream();
      stream.pipe(out);
      out.on('finish', () => console.log(`Código QR generado en ${this.outputPath}`));

    } catch (error) {
      console.error('Error al generar el QR:', error);
    }
  }

  // Función para dividir el texto en varias líneas si es muy largo
  wrapText(ctx, text, maxWidth) {
    const input_lines = text.split('\n');
    const words = input_lines.join(' ').split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(`${currentLine} ${word}`).width;

      if (width < maxWidth) {
        currentLine += ` ${word}`;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    console.log(lines)
    return lines;
  }
}



// Ejemplo de uso
const qrGenerator = new QRCodeGenerator('/home/fresvel/Documentos/Pucese/deasy/backend/services/signflow/testing/firma.png', 'Homero Javier Velasteguí Izurieta');
qrGenerator.generate();
