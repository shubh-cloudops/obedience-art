#!/usr/bin/env node
/**
 * Builds a news-style cover from the logos of the organisations in a post. No AI, no network, no keys.
 *
 * Usage:  node scripts/make-logo-cover.mjs <post-slug>
 *
 * Reads `coverOrgs: [openai, huggingface]` and `pillar:` from the post's front-matter, draws the
 * logos on the site's dark "Signal" background, saves src/assets/covers/<slug>.jpg, and sets
 * `cover:` and `coverAlt:` in the front-matter.
 *
 * Logo lookup per organisation (src/data/orgs.json):
 *   1. src/assets/logos/<file>  - the official file from the organisation's brand page
 *   2. simple-icons             - CC0 package of brand marks
 *   3. the organisation's name  - drawn as a wordmark
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import sharp from 'sharp';
import opentype from 'opentype.js';

const require = createRequire(import.meta.url);
const W = 1600;
const H = 900;
const C = { bg: '#0b0f1a', tile: '#121829', line: '#2a3652', text: '#e6eaf2', muted: '#94a3b8', cyan: '#22d3ee', violet: '#a78bfa' };
const PILLARS = {
  autopsy: 'THE BREAKDOWN',
  'spec-gap': 'THE SPEC GAP',
  mirror: 'THE MIRROR',
  'open-question': 'THE OPEN QUESTION',
  'claim-check': 'CLAIM CHECK',
  'obedience-test': 'THE OBEDIENCE TEST',
  'build-log': 'BUILD LOG',
};

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--'));
const STYLE = args.find((a) => a.startsWith('--style='))?.slice(8) ?? 'editorial'; // editorial | tiles
const PREVIEW = args.find((a) => a.startsWith('--preview='))?.slice(10); // write the JPG here, leave the post alone
if (!slug) {
  console.error('Usage: node scripts/make-logo-cover.mjs <post-slug> [--style=editorial|tiles] [--preview=<file.jpg>]');
  process.exit(1);
}
const postsDir = path.join('src', 'content', 'posts');
const file = ['.mdx', '.md'].map((ext) => path.join(postsDir, slug + ext)).find(existsSync);
if (!file) {
  console.error(`No post found for slug "${slug}" in ${postsDir}`);
  process.exit(1);
}
let source = await readFile(file, 'utf8');
const ids = source.match(/^coverOrgs:\s*\[(.*)\]\s*$/m)?.[1].split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean);
if (!ids?.length) {
  console.error(`Add a line like  coverOrgs: [openai, huggingface]  to the front-matter of ${file}.`);
  process.exit(1);
}
if (ids.length > 4) {
  console.error('Use at most 4 organisations so each logo stays readable.');
  process.exit(1);
}
const pillar = source.match(/^pillar:\s*(\S+)/m)?.[1];
const verdict = source.match(/^verdict:\s*(\S+)/m)?.[1];
const fm = (k) => source.match(new RegExp(`^${k}:\\s*"?(.*?)"?\\s*$`, 'm'))?.[1];
// coverLine: the short, punchy headline printed on the image (falls back to the title)
const headline = (fm('coverLine') ?? fm('title') ?? '').replace(/\\"/g, '"');

const orgs = JSON.parse(await readFile('src/data/orgs.json', 'utf8'));
const unknown = ids.filter((id) => !orgs[id]);
if (unknown.length) {
  console.error(`Unknown organisation id(s): ${unknown.join(', ')}. Add them to src/data/orgs.json first.`);
  process.exit(1);
}

const font = opentype.parse(
  (await readFile(require.resolve('@fontsource/space-grotesk/files/space-grotesk-latin-600-normal.woff'))).buffer,
);
// Headlines use the site's editorial serif (Newsreader); labels keep Space Grotesk.
const fontSerif = opentype.parse(
  (await readFile(require.resolve('@fontsource/newsreader/files/newsreader-latin-700-normal.woff'))).buffer,
);
const fontBold = opentype.parse(
  (await readFile(require.resolve('@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff'))).buffer,
);

/** Text as an SVG path (so the result never depends on installed fonts). anchor: start | middle | end */
function text(str, x, y, size, fill, { anchor = 'start', f = font, spacing = 0 } = {}) {
  const width = f.getAdvanceWidth(str, size, { letterSpacing: spacing });
  const x0 = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
  const d = f.getPath(str, x0, y, size, { letterSpacing: spacing }).toPathData(2);
  return `<path d="${d}" fill="${fill}"/>`;
}

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Returns { svg, light } for an organisation's logo, fitted into a box of `size` at (x, y). */
async function logo(id, x, y, size, h = size) {
  const org = orgs[id];
  const filePath = org.file && path.join('src', 'assets', 'logos', org.file);
  if (filePath && existsSync(filePath)) {
    const raw = await readFile(filePath, 'utf8');
    const vb = raw.match(/viewBox="([^"]+)"/)?.[1] ?? `0 0 ${raw.match(/width="([\d.]+)/)?.[1] ?? 100} ${raw.match(/height="([\d.]+)/)?.[1] ?? 100}`;
    const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    const fills = [...raw.matchAll(/fill(?:=|:)\s*"?(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}|black|white|currentColor)/g)].map((m) => m[1]);
    const dark = fills.length === 0 || fills.some((c) => c === 'black' || c === 'currentColor' || (c.startsWith('#') && luminance(c.length === 4 ? '#' + [...c.slice(1)].map((h) => h + h).join('') : c) < 0.2));
    // Official files are never recoloured. A dark logo gets a light tile so it stays visible.
    const [, , vw, vh] = vb.split(/[\s,]+/).map(Number);
    return {
      light: dark,
      hex: org.color,
      aspect: vw / vh,
      svg: `<svg x="${x}" y="${y}" width="${size}" height="${h}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" color="#000">${inner}</svg>`,
    };
  }
  if (org.simpleIcon) {
    const icon = JSON.parse(await readFile(path.join('node_modules', 'simple-icons', 'data', 'simple-icons.json'), 'utf8'));
    const meta = icon.find((i) => (i.slug ?? i.title.toLowerCase().replace(/[^a-z0-9]/g, '')) === org.simpleIcon);
    const svgFile = await readFile(path.join('node_modules', 'simple-icons', 'icons', `${org.simpleIcon}.svg`), 'utf8');
    const d = svgFile.match(/ d="([^"]+)"/)[1];
    const hex = `#${meta?.hex ?? 'FFFFFF'}`;
    const fill = luminance(hex) < 0.12 ? C.text : hex;
    const s = size / 24;
    return { light: false, hex: org.color ?? hex, svg: `<path d="${d}" fill="${fill}" transform="translate(${x} ${y}) scale(${s})"/>` };
  }
  // Wordmark fallback
  const words = org.name;
  let fs = 64;
  while (fontBold.getAdvanceWidth(words, fs) > size * 1.15 && fs > 28) fs -= 2;
  return { light: false, hex: org.color, svg: text(words, x + size / 2, y + size / 2 + fs * 0.35, fs, C.text, { anchor: 'middle', f: fontBold }) };
}

async function tilesLayout() {
// Layout: tiles in a row, centred, inside the 21:9 safe band (the featured card crops to 21:9).
const n = ids.length;
const tile = n <= 2 ? 300 : n === 3 ? 250 : 210;
const gap = n <= 2 ? 150 : 90;
const rowW = n * tile + (n - 1) * gap;
const x0 = (W - rowW) / 2;
const ty = 300;
const parts = [];
for (let i = 0; i < n; i++) {
  const x = x0 + i * (tile + gap);
  const pad = tile * 0.2;
  const lg = await logo(ids[i], x + pad, ty + pad, tile - pad * 2);
  parts.push(
    `<rect x="${x}" y="${ty}" width="${tile}" height="${tile}" rx="${tile * 0.16}" fill="${lg.light ? '#f4f6fb' : C.tile}" stroke="${C.line}" stroke-width="2"/>`,
    `<rect x="${x}" y="${ty}" width="${tile}" height="${tile}" rx="${tile * 0.16}" fill="url(#sheen)"/>`,
    lg.svg,
    text(orgs[ids[i]].name, x + tile / 2, ty + tile + 58, n <= 2 ? 40 : 32, C.text, { anchor: 'middle' }),
  );
  if (i < n - 1) parts.push(text('×', x + tile + gap / 2, ty + tile / 2 + 22, 64, C.muted, { anchor: 'middle' }));
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="g1" cx="18%" cy="12%" r="60%"><stop offset="0" stop-color="${C.cyan}" stop-opacity="0.22"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/></radialGradient>
    <radialGradient id="g2" cx="88%" cy="95%" r="60%"><stop offset="0" stop-color="${C.violet}" stop-opacity="0.22"/><stop offset="1" stop-color="${C.violet}" stop-opacity="0"/></radialGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.06"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
    <pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.4" fill="#ffffff" fill-opacity="0.07"/></pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  <rect width="${W}" height="${H}" fill="url(#dots)"/>
  <rect width="${W}" height="${H}" fill="url(#g1)"/>
  <rect width="${W}" height="${H}" fill="url(#g2)"/>
  ${pillar && PILLARS[pillar] ? text(PILLARS[pillar], W / 2, 215, 30, C.cyan, { anchor: 'middle', spacing: 0.22 }) : ''}
  ${parts.join('\n  ')}
  ${text('Obedience', W - 200, H - 120, 28, C.muted, { anchor: 'end', f: fontBold })}${text(' ART', W - 140, H - 120, 28, C.cyan, { anchor: 'middle', f: fontBold })}
</svg>`;

return svg;
}

const VERDICT = { true: ['TRUE', '#34d399'], 'partly-true': ['PARTLY TRUE', '#fbbf24'], overstated: ['OVERSTATED', '#fbbf24'], false: ['FALSE', '#f472b6'], unverified: ['UNVERIFIED', '#94a3b8'] };

/** Wrap a headline into at most `max` lines that fit `width` at `size`. */
function wrap(str, width, size, f, max) {
  const words = str.split(/\s+/);
  const lines = [''];
  for (const w of words) {
    const tryLine = lines.at(-1) ? `${lines.at(-1)} ${w}` : w;
    if (f.getAdvanceWidth(tryLine, size) <= width || !lines.at(-1)) lines[lines.length - 1] = tryLine;
    else lines.push(w);
  }
  return lines.length <= max ? lines : null;
}

/** News-style cover: each organisation gets a panel lit in its brand colour with a big logo; a bold headline band below. */
async function editorialLayout() {
  const n = ids.length;
  const top = 0;
  const panelH = 500;
  const pw = W / n;
  const defs = [];
  const parts = [];
  for (let i = 0; i < n; i++) {
    const x = i * pw;
    const size = n <= 2 ? 250 : n === 3 ? 200 : 170;
    const plate = size * 1.36;
    const cx = x + pw / 2;
    const cy = top + 120 + (panelH - 120) / 2 - 10;
    let lg = await logo(ids[i], cx - size / 2, cy - size / 2, size);
    if (lg.light && lg.aspect > 1.2) {
      // Wide official logo (wordmark): size it by width so it reads as big as the others.
      const lw = Math.min(pw * 0.62, size * 1.7);
      const lh = lw / lg.aspect;
      lg = await logo(ids[i], cx - lw / 2, cy - lh / 2, lw, lh);
      lg.box = [lw, lh];
    }
    const glow = lg.hex ?? C.cyan;
    defs.push(`<radialGradient id="p${i}" cx="50%" cy="55%" r="65%"><stop offset="0" stop-color="${glow}" stop-opacity="0.45"/><stop offset="0.6" stop-color="${glow}" stop-opacity="0.08"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>`);
    parts.push(`<rect x="${x}" y="${top}" width="${pw}" height="${panelH}" fill="url(#p${i})"/>`);
    // A dark logo sits on a white plate; others float directly on the glow. Logos are never recoloured.
    if (lg.light) {
      const [bw, bh] = lg.box ? [lg.box[0] + 90, lg.box[1] + 90] : [plate, plate];
      parts.push(`<rect x="${cx - bw / 2}" y="${cy - bh / 2}" width="${bw}" height="${bh}" rx="${Math.min(bw, bh) * 0.22}" fill="#f4f6fb" filter="url(#lift)"/>`);
    }
    parts.push(`<g filter="url(#lift)">${lg.svg}</g>`);
    if (i > 0) {
      parts.push(`<line x1="${x}" y1="${top + 150}" x2="${x}" y2="${panelH - 20}" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2"/>`);
      parts.push(`<circle cx="${x}" cy="${cy}" r="34" fill="${C.bg}" stroke="#ffffff" stroke-opacity="0.18" stroke-width="2"/>`);
      parts.push(text('×', x, cy + 17, 52, C.text, { anchor: 'middle' }));
    }
  }
  // Headline band
  const bandY = panelH;
  const left = 110;
  const maxW = W - left * 2;
  let size = 100;
  let lines = wrap(headline, maxW, size, fontSerif, 2);
  while (!lines && size > 56) lines = wrap(headline, maxW, (size -= 4), fontSerif, 2);
  lines ??= wrap(headline, maxW, size, fontSerif, 3) ?? [headline];
  const kickerY = bandY + 62;
  const kicker = pillar && PILLARS[pillar] ? PILLARS[pillar] : '';
  let chip = '';
  if (verdict && VERDICT[verdict]) {
    const [label, col] = VERDICT[verdict];
    const kw = kicker ? font.getAdvanceWidth(kicker, 30, { letterSpacing: 0.22 }) : 0;
    const cxp = left + kw + (kicker ? 28 : 0);
    const lw = font.getAdvanceWidth(label, 26, { letterSpacing: 0.12 }) + 44;
    chip = `<rect x="${cxp}" y="${kickerY - 34}" width="${lw}" height="46" rx="23" fill="${col}" fill-opacity="0.14" stroke="${col}" stroke-width="2"/>` + text(label, cxp + lw / 2, kickerY - 2, 26, col, { anchor: 'middle', spacing: 0.12 });
  }
  const lineH = size * 1.08;
  const headY = kickerY + 40 + size;
  const head = lines.map((l, i) => text(l, left, headY + i * lineH, size, C.text, { f: fontSerif })).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    ${defs.join('\n    ')}
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.bg}" stop-opacity="0"/><stop offset="1" stop-color="${C.bg}" stop-opacity="1"/></linearGradient>
    <pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.4" fill="#ffffff" fill-opacity="0.07"/></pattern>
    <filter id="lift" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#000" flood-opacity="0.5"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="#070a12"/>
  <rect width="${W}" height="${H}" fill="url(#dots)"/>
  <rect x="0" y="${panelH - 140}" width="${W}" height="140" fill="url(#fade)"/>
  ${parts.join('\n  ')}
  <rect x="0" y="${bandY}" width="${W}" height="${H - bandY}" fill="${C.bg}"/>
  <rect x="${left}" y="${bandY}" width="120" height="6" fill="${C.cyan}"/>
  ${kicker ? text(kicker, left, kickerY, 30, C.cyan, { spacing: 0.22 }) : ''}
  ${chip}
  ${head}
  ${brand(W - 64, 78)}
</svg>`;
}

/** "Obedience ART" mark, right-aligned at x. */
function brand(x, y) {
  const artW = fontBold.getAdvanceWidth('ART', 30);
  return text('Obedience', x - artW - 10, y, 30, C.text, { anchor: 'end', f: fontBold }) + text('ART', x, y, 30, C.cyan, { anchor: 'end', f: fontBold });
}

const svg = STYLE === 'tiles' ? await tilesLayout() : await editorialLayout();
if (PREVIEW) {
  await sharp(Buffer.from(svg)).jpeg({ quality: 90, mozjpeg: true }).toFile(PREVIEW);
  console.log(`Saved preview ${PREVIEW}`);
  process.exit(0);
}
const outDir = path.join('src', 'assets', 'covers');
await mkdir(outDir, { recursive: true });
const out = path.join(outDir, `${slug}.jpg`);
await sharp(Buffer.from(svg)).jpeg({ quality: 90, mozjpeg: true }).toFile(out);
console.log(`Saved ${out}`);

// Front-matter: cover + alt text that names the organisations
const names = ids.map((id) => orgs[id].name);
const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
const alt = `Logos of ${list}, the organisations in this story.`;
if (/^coverAlt:.*$/m.test(source)) source = source.replace(/^coverAlt:.*$/m, `coverAlt: "${alt}"`);
else source = source.replace(/^coverOrgs:.*$/m, (l) => `${l}\ncoverAlt: "${alt}"`);
if (!/^cover:/m.test(source)) source = source.replace(/^coverOrgs:.*$/m, (l) => `${l}\ncover: ../../assets/covers/${slug}.jpg`);
await writeFile(file, source);
console.log(`Updated cover and coverAlt in ${file}`);
