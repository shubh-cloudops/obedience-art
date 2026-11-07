#!/usr/bin/env node
/**
 * Generates a post's cover illustration with Cloudflare Workers AI (FLUX.1 [schnell], free tier).
 *
 * Usage (PowerShell or bash):  node scripts/generate-cover.mjs <post-slug>
 * Needs env vars: CF_ACCOUNT_ID, CF_AI_TOKEN  (never hard-code them)
 *
 * Reads `coverPrompt` from the post's front-matter, wraps it in the active style and safety rules,
 * saves src/assets/covers/<slug>.jpg and adds `cover:` to the front-matter if it is missing.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const MODEL = '@cf/black-forest-labs/flux-1-schnell';

// Style and safety rules live in scripts/cover-styles.json ("active" picks the style).
// Override once with:  node scripts/generate-cover.mjs <slug> --style gritty
const config = JSON.parse(await readFile(new URL('./cover-styles.json', import.meta.url), 'utf8'));
const styleFlag = process.argv.indexOf('--style');
const styleName = styleFlag > -1 ? process.argv[styleFlag + 1] : config.active;
const STYLE = config.styles[styleName];
if (!STYLE) {
  console.error(`Unknown style "${styleName}". Choose one of: ${Object.keys(config.styles).join(', ')}`);
  process.exit(1);
}
const RULES = config.rules;

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node scripts/generate-cover.mjs <post-slug>');
  process.exit(1);
}
const { CF_ACCOUNT_ID, CF_AI_TOKEN } = process.env;
if (!CF_ACCOUNT_ID || !CF_AI_TOKEN) {
  console.error('Missing CF_ACCOUNT_ID or CF_AI_TOKEN environment variables.');
  process.exit(1);
}

const postsDir = path.join('src', 'content', 'posts');
const file = ['.mdx', '.md'].map((ext) => path.join(postsDir, slug + ext)).find(existsSync);
if (!file) {
  console.error(`No post found for slug "${slug}" in ${postsDir}`);
  process.exit(1);
}
let source = await readFile(file, 'utf8');
const subject = source.match(/^coverPrompt:\s*"?(.+?)"?\s*$/m)?.[1];
if (!subject) {
  console.error(`Add a coverPrompt: line to the front-matter of ${file} first.`);
  process.exit(1);
}

const character = styleName.startsWith('personified') && config.character ? `${config.character}. ` : '';
const prompt = `${character}${subject}. ${STYLE}. ${RULES}.`;
console.log(`Generating ${styleName} cover for ${slug}...`);
let res;
try {
  res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CF_AI_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, steps: 4 }),
  });
} catch (err) {
  console.error(`Could not reach api.cloudflare.com: ${err.cause?.code ?? err.message}`);
  console.error('Check your internet connection, or allow api.cloudflare.com in the environment network settings.');
  process.exit(1);
}
const body = await res.json().catch(() => ({}));
if (!res.ok || !body?.result?.image) {
  console.error(`Workers AI request failed (HTTP ${res.status}):`, JSON.stringify(body.errors ?? body).slice(0, 500));
  console.error('Common causes: wrong token permissions (use the "Workers AI" template), wrong account ID, or the daily free limit was reached (resets 00:00 UTC).');
  process.exit(1);
}

const outDir = path.join('src', 'assets', 'covers');
await mkdir(outDir, { recursive: true });
const out = path.join(outDir, `${slug}.jpg`);
await writeFile(out, Buffer.from(body.result.image, 'base64'));
console.log(`Saved ${out}`);

if (!/^cover:/m.test(source)) {
  source = source.replace(/^coverPrompt:.*$/m, (line) => `${line}\ncover: ../../assets/covers/${slug}.jpg`);
  await writeFile(file, source);
  console.log(`Added cover: to ${file}. Check that coverAlt describes the image.`);
}
