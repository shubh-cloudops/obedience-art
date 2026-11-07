#!/usr/bin/env node
/**
 * Renders the brand ambassador's expression set with Cloudflare Workers AI (FLUX.1 [schnell], free tier).
 *
 * Usage:  node --env-file=.env scripts/generate-ambassador.mjs [expression ...]
 *   No names = render every expression in scripts/cover-styles.json "expressions".
 * Needs env vars: CF_ACCOUNT_ID, CF_AI_TOKEN  (never hard-code them)
 *
 * Saves src/assets/ambassador/<expression>.jpg. The site picks these up automatically.
 *
 *         node --env-file=.env scripts/generate-ambassador.mjs --model-sheet [count=4]
 *   Renders full-body front views (cover-styles.json "modelSheet") to art-source/fullbody-<n>.jpg,
 *   the input for image-to-3D. art-source/ is git-ignored: it is not part of the site.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const MODEL = '@cf/black-forest-labs/flux-1-schnell';
const MAX_PROMPT = 2048; // model limit

const config = JSON.parse(await readFile(new URL('./cover-styles.json', import.meta.url), 'utf8'));
const args = process.argv.slice(2);
const names = args.filter((a) => !a.startsWith('--'));
const wanted = names.length ? names : Object.keys(config.expressions);

const sheet = args.includes('--model-sheet');
const hero = args.includes('--hero'); // female full-length figure -> src/assets/ambassador-female/hero.jpg
const female = args.includes('--female') || hero; // render the female Art (cover-styles.json "characterFemale") into src/assets/ambassador-female/
const unknown = sheet ? [] : wanted.filter((n) => !config.expressions[n]);
if (unknown.length) {
  console.error(`Unknown expression(s): ${unknown.join(', ')}. Choose from: ${Object.keys(config.expressions).join(', ')}`);
  process.exit(1);
}
const { CF_ACCOUNT_ID, CF_AI_TOKEN } = process.env;
if (!CF_ACCOUNT_ID || !CF_AI_TOKEN) {
  console.error('Missing CF_ACCOUNT_ID or CF_AI_TOKEN environment variables.');
  process.exit(1);
}

// The expression prompts were written for the male butler; adapt pronouns and the robotic hand for the female Art.
const feminise = (t) => t.replace(/\bhis\b/g, 'her').replace(/\bhim\b/g, 'her').replace(/\bhe\b/g, 'she').replace(/\bHe\b/g, 'She').replace(/silver robotic (right )?hand/g, 'chrome robotic left hand').replace(/\bright hand\b/g, 'left hand');
const outDir = sheet ? 'art-source' : path.join('src', 'assets', female ? 'ambassador-female' : 'ambassador');
await mkdir(outDir, { recursive: true });
const jobs = sheet
  ? Array.from({ length: Number(names[0] ?? 4) }, (_, i) => `fullbody-${i + 1}`)
  : hero
    ? ['hero']
    : wanted;

for (const name of jobs) {
  const prompt = sheet
    ? `${config.modelSheet}. ${config.rules}.`
    : hero
      ? `${config.styleFemale}. ${config.characterFemale.replace(/Three-quarter length framing[^.]*$/, '')} ${config.heroFemale}. ${config.rules}.`
      : female
        ? `${config.styleFemale}. ${config.characterFemale}. ${feminise(config.expressions[name].prompt)}. ${config.rules}.`
        : `${female ? config.characterFemale : config.character}. ${female ? feminise(config.expressions[name].prompt) : config.expressions[name].prompt}. ${config.styles.personified}. ${config.rules}.`;
  if (prompt.length > MAX_PROMPT) {
    console.error(`Prompt for "${name}" is ${prompt.length} characters; the model allows ${MAX_PROMPT}. Shorten it.`);
    process.exit(1);
  }
  console.log(`Generating "${name}"...`);
  let res;
  try {
    res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${MODEL}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CF_AI_TOKEN}`, 'Content-Type': 'application/json' },
      // FLUX schnell on Workers AI rejects "seed" (HTTP 400), so every run is a fresh random face.
      body: JSON.stringify({ prompt, steps: 4 }),
    });
  } catch (err) {
    console.error(`Could not reach api.cloudflare.com: ${err.cause?.code ?? err.message}`);
    process.exit(1);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.result?.image) {
    console.error(`Workers AI request failed (HTTP ${res.status}):`, JSON.stringify(body.errors ?? body).slice(0, 500));
    console.error('Common causes: token permissions, wrong account ID, or the daily free limit (resets 00:00 UTC).');
    process.exit(1);
  }
  const out = path.join(outDir, `${name}.jpg`);
  await writeFile(out, Buffer.from(body.result.image, 'base64'));
  console.log(`Saved ${out}`);
}
