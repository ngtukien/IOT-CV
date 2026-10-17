// Gói src/scene3d.js + three.js thành một IIFE để nhúng thẳng vào trang HTML.
// Gọi từ build.py:  node bundle3d.mjs <entry.js> <out.js>
// Lấy rolldown và three từ frontend/node_modules (đã có sẵn nhờ Vite), không cài thêm gì.
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [, , entry, outFile] = process.argv;
if (!entry || !outFile) {
  console.error('dung: node bundle3d.mjs <entry.js> <out.js>');
  process.exit(2);
}

const modules = resolve('frontend/node_modules');
const pnpmDir = resolve(modules, '.pnpm');
const rolldownDir = readdirSync(pnpmDir).find((d) => d.startsWith('rolldown@'));
if (!rolldownDir) {
  console.error('khong thay rolldown trong frontend/node_modules/.pnpm — chay pnpm install trong frontend/');
  process.exit(1);
}
const { build } = await import(
  pathToFileURL(resolve(pnpmDir, rolldownDir, 'node_modules/rolldown/dist/index.mjs')).href
);

const three = resolve(modules, 'three');
await build({
  input: resolve(entry),
  resolve: {
    alias: {
      'three/addons': resolve(three, 'examples/jsm'),
      three: resolve(three, 'build/three.module.js'),
    },
  },
  output: { format: 'iife', file: resolve(outFile), minify: true },
  logLevel: 'warn',
});
console.log('[bundle3d] ok');
