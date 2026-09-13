import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', '@mapbox', 'mapbox-gl-rtl-text', 'dist', 'mapbox-gl-rtl-text.js');
const destDir = join(root, 'public', 'vendor');
mkdirSync(destDir, { recursive: true });
copyFileSync(src, join(destDir, 'mapbox-gl-rtl-text.js'));
