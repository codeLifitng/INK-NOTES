import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const svg = readFileSync(resolve(root, 'public/favicon.svg'));

const sizes = [
  { size: 16, dir: 'extension/icons', name: 'icon-16.png' },
  { size: 48, dir: 'extension/icons', name: 'icon-48.png' },
  { size: 128, dir: 'extension/icons', name: 'icon-128.png' },
  { size: 192, dir: 'public/icons', name: 'icon-192.png' },
  { size: 512, dir: 'public/icons', name: 'icon-512.png' },
];

for (const { size, dir, name } of sizes) {
  const outDir = resolve(root, dir);
  mkdirSync(outDir, { recursive: true });
  await sharp(svg).resize(size, size).png().toFile(resolve(outDir, name));
  console.log(`  ${dir}/${name} (${size}x${size})`);
}
console.log('Done.');
