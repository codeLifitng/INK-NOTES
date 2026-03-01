import { execSync } from 'child_process';
import { cpSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const extDir = resolve(root, 'extension');
const appDir = resolve(extDir, 'app');

// 1. Build the Vite app
console.log('Building app...');
execSync('npm run build', { cwd: root, stdio: 'inherit' });

// 2. Copy dist/ into extension/app/
if (existsSync(appDir)) rmSync(appDir, { recursive: true });
cpSync(resolve(root, 'dist'), appDir, { recursive: true });

// 3. Fix asset paths in index.html (extension needs relative paths, not absolute)
const htmlPath = resolve(appDir, 'index.html');
let html = readFileSync(htmlPath, 'utf-8');
html = html.replace(/href="\//g, 'href="./').replace(/src="\//g, 'src="./');
writeFileSync(htmlPath, html);

console.log('Extension built at: extension/');
console.log('Load it as unpacked extension at chrome://extensions');
