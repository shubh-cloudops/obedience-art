#!/usr/bin/env node
/**
 * Prepares a 3D model for the web: shrinks textures, then gzips the whole file.
 * Geometry, skeleton and animation clips are untouched.
 *
 * Usage:  node scripts/pack-model.mjs <path-to-model.glb> [maxTextureSide=1024]
 * Output: public/models/art.glb.gz   (the site downloads this and unzips it in the browser;
 *         a .vrm input is written to art.vrm.gz instead)
 *
 * Why: VRoid exports are 10-20 MB; most of it is blend-shape data that compresses ~5x,
 * but GitHub Pages does not gzip .vrm files, so we ship them pre-compressed.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import sharp from 'sharp';

const [src, maxArg] = process.argv.slice(2);
if (!src) {
  console.error('Usage: node scripts/pack-model.mjs <path-to-model.glb> [maxTextureSide]');
  process.exit(1);
}
const MAX = Number(maxArg ?? 1024);
const b = await readFile(src);
if (b.toString('latin1', 0, 4) !== 'glTF') {
  console.error(`${src} is not a GLB/VRM file.`);
  process.exit(1);
}
const jsonLen = b.readUInt32LE(12);
const j = JSON.parse(b.toString('utf8', 20, 20 + jsonLen));
const binStart = 20 + jsonLen + 8;
const binLen = b.readUInt32LE(20 + jsonLen);
const bin = b.subarray(binStart, binStart + binLen);
const views = j.bufferViews;
const data = views.map((v) => bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength));

const thumb = j.extensions?.VRMC_vrm?.meta?.thumbnailImage ?? j.extensions?.VRM?.meta?.texture;
for (const [i, im] of (j.images ?? []).entries()) {
  if (im.bufferView === undefined) continue;
  const raw = data[im.bufferView];
  const limit = i === thumb ? 256 : MAX;
  const meta = await sharp(raw).metadata();
  if (Math.max(meta.width ?? 0, meta.height ?? 0) <= limit) continue;
  const out = await sharp(raw).resize({ width: limit, height: limit, fit: 'inside' }).png({ compressionLevel: 9 }).toBuffer();
  data[im.bufferView] = out;
  im.mimeType = 'image/png';
}

// Rebuild the binary chunk with 4-byte alignment
const parts = [];
let offset = 0;
views.forEach((v, i) => {
  const pad = (4 - (offset % 4)) % 4;
  if (pad) parts.push(Buffer.alloc(pad));
  offset += pad;
  v.byteOffset = offset;
  v.byteLength = data[i].length;
  parts.push(data[i]);
  offset += data[i].length;
});
const tail = (4 - (offset % 4)) % 4;
if (tail) parts.push(Buffer.alloc(tail));
const newBin = Buffer.concat(parts);
j.buffers[0].byteLength = newBin.length;
let js = Buffer.from(JSON.stringify(j));
if (js.length % 4) js = Buffer.concat([js, Buffer.alloc(4 - (js.length % 4), 0x20)]);
const header = Buffer.alloc(12);
header.write('glTF', 0, 'latin1');
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + js.length + 8 + newBin.length, 8);
const chunk = (len, type) => {
  const h = Buffer.alloc(8);
  h.writeUInt32LE(len, 0);
  h.write(type, 4, 'latin1');
  return h;
};
const glb = Buffer.concat([header, chunk(js.length, 'JSON'), js, chunk(newBin.length, 'BIN\0'), newBin]);
const gz = gzipSync(glb, { level: 9 });

await mkdir('public/models', { recursive: true });
const outFile = `public/models/art.${src.toLowerCase().endsWith('.vrm') ? 'vrm' : 'glb'}.gz`;
await writeFile(outFile, gz);
const mb = (n) => (n / 1e6).toFixed(1);
console.log(`${src}: ${mb(b.length)} MB -> ${mb(glb.length)} MB -> gzipped ${mb(gz.length)} MB`);
console.log(`Saved ${outFile}`);
