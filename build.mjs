import { cp, mkdir } from 'node:fs/promises';

const output = new URL('./public/', import.meta.url);
const siteFiles = ['index.html', 'app.js', 'catalog.js', 'excel.js', 'style.css', 'assets', 'vendor', 'promotions'];
await mkdir(output, { recursive: true });
await Promise.all(siteFiles.map((name) => cp(
  new URL(name, import.meta.url), new URL(name, output), { recursive: true }
)));
