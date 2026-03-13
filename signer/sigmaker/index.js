import QRCode from "qrcode"
import fs from "fs-extra"
import { createCanvas, loadImage } from 'canvas'

class QRCodeGenerator {
  constructor(outputPath, text, logoPath) {
    this.outputPath = outputPath;
    this.logoPath = logoPath;

    this.timestamp = this.getGuayaquilDate();   // <-- FECHA GUAYAQUIL
    //this.qrtext = `Firmado por:\n${text}\n${this.timestamp}`;
    this.qrtext = `\n${text}\n${this.timestamp}`;


    this.qrOptions = {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 220,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    };

    this.fontFamily = "Red Hat Mono";
  }

  // 🔥 FECHA EN GUAYAQUIL YYYY-MM-DD
  getGuayaquilDate() {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Guayaquil",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date());
  }

  wrapText(ctx, text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let line = words[0];

    for (let i = 1; i < words.length; i++) {
      const testLine = line + " " + words[i];
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

  async generate() {
    try {
      const qrBuffer = await QRCode.toBuffer(this.qrtext, this.qrOptions);
      const qrImage = await loadImage(qrBuffer);

      const logo = await loadImage(this.logoPath);

      const rawLines = this.qrtext.split("\n");
      const line1 = rawLines[0];
      const line2 = rawLines[1];
      const fecha = rawLines[2];

      const textWidth = 450;
      const spacing = 25;
      const fontSize = 40;
      const lineHeight = fontSize + 6;

      const testCanvas = createCanvas(10, 10);
      const testCtx = testCanvas.getContext("2d");
      testCtx.font = `${fontSize}px '${this.fontFamily}'`;

      const wrappedName = this.wrapText(testCtx, line2, textWidth);

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
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "#FFFFFF00";
      ctx.fillRect(0, 0, totalWidth, totalHeight);

      const qrY = (totalHeight - qrImage.height) / 2;
      ctx.drawImage(qrImage, spacing, qrY);

      const blockY = (totalHeight - blockHeight);

      ctx.fillStyle = "#000000";
      ctx.font = `${fontSize}px '${this.fontFamily}'`;
      ctx.textAlign = "left";

      const textX = qrImage.width + spacing * 2;
      let textY = blockY;

      ctx.fillText(line1, textX, textY);
      textY += lineHeight;

      wrappedName.forEach(line => {
        ctx.fillText(line, textX, textY);
        textY += lineHeight;
      });

      textY += logoTopMargin;

      ctx.drawImage(logo, textX, textY, logoW, logoH);
      textY += logoH + logoBottomMargin;

      ctx.fillStyle = "#0066CC";
      ctx.font = `24px '${this.fontFamily}'`;
      ctx.textAlign = "center";

      const fechaX = textX + (logoW / 2);
      ctx.fillText(fecha, fechaX, textY);

      const out = fs.createWriteStream(this.outputPath);
      canvas.createPNGStream().pipe(out);
      out.on("finish", () => console.log("Firma generada:", this.outputPath));

    } catch (err) {
      console.error("Error:", err);
    }
  }
}

// Ejemplo
const qrGenerator = new QRCodeGenerator(
  '../firma.png',
  'Homero Javier Velasteguí Izurieta',
  './puce_logo.png'
);

qrGenerator.generate();
