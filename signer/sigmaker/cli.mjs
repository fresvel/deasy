import { generateStampImage } from './index.js';

const [outputPath, stampText, finalPath, logoPath] = process.argv.slice(2);

if (!outputPath || !stampText || !logoPath) {
  console.error('Usage: node cli.mjs <outputPath> <stampText> <finalPath> <logoPath>');
  process.exit(1);
}

generateStampImage({
  outputPath,
  stampText,
  finalPath,
  logoPath,
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
