// Rasterizes public/app-icon.svg into the PNG icons the PWA manifest and iOS
// reference. Re-run with `node scripts/gen-icons.mjs` if the source SVG changes.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'public', 'app-icon.svg');
const pub = join(root, 'public');

const targets = [
  { file: 'pwa-192.png', size: 192 },
  { file: 'pwa-512.png', size: 512 },
  { file: 'apple-touch-icon-180.png', size: 180 },
];

for (const { file, size } of targets) {
  await sharp(src, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 28, g: 25, b: 23, alpha: 1 } })
    .png()
    .toFile(join(pub, file));
  console.log(`wrote public/${file} (${size}x${size})`);
}
