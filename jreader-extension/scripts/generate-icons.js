import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ICON_SIZES = [16, 32, 48, 64, 96, 128];
const SOURCE_SVG = path.join(__dirname, '..', 'icon.svg');
const ICONS_DIR = path.join(__dirname, '..', 'icons');

async function generateIcons() {
  // Ensure icons directory exists
  await fs.mkdir(ICONS_DIR, { recursive: true });

  // Generate each icon size
  for (const size of ICON_SIZES) {
    await sharp(SOURCE_SVG)
      .resize(size, size)
      .png()
      .toFile(path.join(ICONS_DIR, `icon-${size}.png`));
    
    console.log(`Generated ${size}x${size} icon`);
  }
}

generateIcons().catch(console.error);