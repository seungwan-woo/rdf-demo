import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rootDir = resolve('.');
const distDir = resolve(rootDir, 'dist');
const distIndexPath = resolve(distDir, 'index.html');
const rootIndexPath = resolve(rootDir, 'index.html');
const distAssetsPath = resolve(distDir, 'assets');
const rootAssetsPath = resolve(rootDir, 'assets');

if (!existsSync(distIndexPath)) {
  throw new Error(`Missing dist index: ${distIndexPath}`);
}

if (!existsSync(distAssetsPath)) {
  throw new Error(`Missing dist assets directory: ${distAssetsPath}`);
}

const rootIndex = readFileSync(distIndexPath, 'utf8')
  .replace(/(src|href)="\/[^"/]+\/assets\//g, '$1="./assets/')
  .replace(/(src|href)="\/assets\//g, '$1="./assets/');

writeFileSync(rootIndexPath, rootIndex);
rmSync(rootAssetsPath, { recursive: true, force: true });
mkdirSync(rootAssetsPath, { recursive: true });
cpSync(distAssetsPath, rootAssetsPath, { recursive: true });

console.log('Synced root index.html and assets/ from dist/.');
