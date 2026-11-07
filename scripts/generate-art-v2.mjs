#!/usr/bin/env node
/**
 * Renders female Art with Cloudflare Workers AI FLUX.2 [klein] 4B (free tier: ~170 of 10,000 daily Neurons per image).
 * Unlike FLUX.1 schnell it takes width/height, a seed and up to 4 reference images, so Art's face and outfit stay consistent.
 *
 * Usage (from the project folder):
 *   node --env-file=.env scripts/generate-art-v2.mjs [expression ...] [--hero] [--ref=path.jpg] [--seed=1234] [--tries=1]
 *   No expression names and no --hero = every expression in scripts/cover-styles.json.
 *   --ref   an existing Art image used as the face/style reference (default src/assets/ambassador-female/concerned.jpg).
 *   --self-ref        use each expression's own current image as the reference (keeps its face and pose).
 *   --outfit=path.jpg second reference; only its dress/neckline is copied.
 * Needs env vars: CF_ACCOUNT_ID, CF_AI_TOKEN (never hard-code them).
 *
 * Writes previews to art-source/v2/<name>[-tryN].jpg (git-ignored). Copy the keepers into src/assets/ambassador-female/.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const MODEL = '@cf/black-forest-labs/flux-2-klein-4b';
const config = JSON.parse(await readFile(new URL('./cover-styles.json', import.meta.url), 'utf8'));
const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const hero = args.includes('--hero');
const names = args.filter((a) => !a.startsWith('--'));
const jobs = [...(names.length || hero ? names : Object.keys(config.expressions)), ...(hero ? ['hero'] : [])];
const tries = Number(opt('tries', 1));
const baseSeed = Number(opt('seed', 4242));
const refPath = opt('ref', path.join('src', 'assets', 'ambassador-female', 'concerned.jpg'));
const outfitPath = opt('outfit'); // optional 2nd reference: copy only the dress/neckline from it
const selfRef = args.includes('--self-ref'); // use each expression's own current image as image 0
// --human-hand: draw both hands as ordinary human hands (no chrome hand in this image), at Shub's request for eager.
const humanHand = args.includes('--human-hand');
const HAND_RE = /Her left hand is an elegant polished chrome robotic hand[^.]*\./;
const HUMAN_HAND = 'Both of her hands are ordinary, natural human hands with warm skin, a thumb and four fingers each, anatomically correct; no robotic or metal parts are visible anywhere in this image.';
const handFix = (t) => (humanHand ? t.replace(HAND_RE, HUMAN_HAND).replace(/(polished )?(chrome|silver|metal) robotic (left |right )?hand/gi, 'left hand') : t);

const unknown = jobs.filter((n) => n !== 'hero' && !config.expressions[n]);
if (unknown.length) {
  console.error(`Unknown expression(s): ${unknown.join(', ')}. Choose from: ${Object.keys(config.expressions).join(', ')}`);
  process.exit(1);
}
const { CF_ACCOUNT_ID, CF_AI_TOKEN } = process.env;
if (!CF_ACCOUNT_ID || !CF_AI_TOKEN) {
  console.error('Missing CF_ACCOUNT_ID or CF_AI_TOKEN environment variables.');
  process.exit(1);
}

// The model needs reference images smaller than 512x512.
const small = (p) => sharp(p).resize(448, 448, { fit: 'cover', position: 'top' }).jpeg({ quality: 90 }).toBuffer();
const baseRef = await small(refPath);
const outfit = outfitPath ? await small(outfitPath) : null;

const feminise = (t) => t.replace(/\bhis\b/g, 'her').replace(/\bhim\b/g, 'her').replace(/\bhe\b/g, 'she').replace(/\bHe\b/g, 'She').replace(/silver robotic (right )?hand/g, 'chrome robotic left hand').replace(/\bright hand\b/g, 'left hand');
const outDir = path.join('art-source', 'v2');
await mkdir(outDir, { recursive: true });

for (const name of jobs) {
  const action = name === 'hero' ? config.heroFemaleV2 : `${feminise(config.expressions[name].prompt)}. ${config.framingPortraitV2}`;
  const ownPath = path.join('src', 'assets', 'ambassador-female', `${name}.jpg`);
  const ref = selfRef && name !== 'hero' ? await small(ownPath) : baseRef;
  const lead = outfit
    ? 'Image 0 shows Art: keep exactly the same woman, the same facial expression, the same pose and hand position, and the same painting style as image 0. Image 1 shows only the dress: copy its neckline and lacing exactly, nothing else from image 1.'
    : 'Image 0 shows Art: keep exactly the same woman (face, hair, temple plate) and the same painting style.';
  const prompt = handFix(`${lead} ${config.styleFemale}. ${config.characterFemaleV2}. ${action}. ${config.rules}.`);
  const [width, height] = name === 'hero' ? [768, 1344] : [1024, 1024];
  for (let t = 1; t <= tries; t++) {
    const form = new FormData();
    form.append('prompt', prompt);
    form.append('width', String(width));
    form.append('height', String(height));
    form.append('seed', String(baseSeed + t - 1));
    form.append('input_image_0', new Blob([ref], { type: 'image/jpeg' }), 'ref.jpg');
    if (outfit) form.append('input_image_1', new Blob([outfit], { type: 'image/jpeg' }), 'outfit.jpg');
    console.log(`Generating "${name}" (${width}x${height}, try ${t}/${tries})...`);
    let res;
    try {
      res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${MODEL}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${CF_AI_TOKEN}` },
        body: form,
      });
    } catch (err) {
      console.error(`Could not reach api.cloudflare.com: ${err.cause?.code ?? err.message}`);
      process.exit(1);
    }
    const body = await res.json().catch(() => ({}));
    const image = body?.result?.image;
    if (!res.ok || !image) {
      console.error(`Workers AI request failed (HTTP ${res.status}):`, JSON.stringify(body.errors ?? body).slice(0, 500));
      console.error('Common causes: token permissions, the daily free limit (resets 00:00 UTC), or the safety filter rejecting the prompt.');
      process.exit(1);
    }
    const out = path.join(outDir, `${name}${tries > 1 ? `-try${t}` : ''}.jpg`);
    await sharp(Buffer.from(image, 'base64')).jpeg({ quality: 90 }).toFile(out);
    console.log(`Saved ${out}`);
  }
}
