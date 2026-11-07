#!/usr/bin/env node
/**
 * Download GitHub's social card for every Open-Source AI Pick into public/picks/cards/<slug>.png,
 * so the site serves the images itself instead of hotlinking opengraph.githubassets.com
 * (GitHub renders those on demand and often fails or times out when a page asks for several at once).
 *
 *   node scripts/fetch-pick-cards.mjs
 *
 * Runs in the deploy workflow before `npm run build`. The files are build output (git-ignored).
 * A card that cannot be fetched is skipped with a warning; the page then falls back to the hotlink
 * (repoCard() in src/lib/picks.ts), so a GitHub hiccup never blocks a deploy.
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';

const SRC = path.resolve('src/content/picks');
const OUT = path.resolve('public/picks/cards');
const TRIES = 4;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchCard(repo) {
  // The first path segment is a cache key GitHub ignores; a daily key picks up repo description changes.
  const url = `https://opengraph.githubassets.com/${new Date().toISOString().slice(0, 10)}/${repo}`;
  for (let i = 1; i <= TRIES; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'obedience-art-pick-cards' }, signal: AbortSignal.timeout(30_000) });
      const type = res.headers.get('content-type') ?? '';
      if (res.ok && type.startsWith('image/')) return Buffer.from(await res.arrayBuffer());
      throw new Error(`HTTP ${res.status} ${type}`);
    } catch (e) {
      if (i === TRIES) throw e;
      await sleep(2000 * 2 ** (i - 1)); // 2s, 4s, 8s
    }
  }
}

await mkdir(OUT, { recursive: true });
const files = (await readdir(SRC)).filter((f) => /\.ya?ml$/.test(f)).sort();
let missing = 0;
for (const f of files) {
  const slug = f.replace(/\.ya?ml$/, '');
  const { repo } = YAML.parse(await readFile(path.join(SRC, f), 'utf8'));
  try {
    const png = await fetchCard(repo); // one at a time: GitHub is slow to render cards in parallel
    await writeFile(path.join(OUT, `${slug}.png`), png);
    console.log(`${slug.padEnd(14)} ${repo.padEnd(30)} ${(png.length / 1024).toFixed(0)} KB`);
  } catch (e) {
    missing++;
    console.warn(`::warning::${slug}: could not fetch the GitHub card for ${repo} (${e.message}); the page will hotlink it instead.`);
  }
}
console.log(`${files.length - missing}/${files.length} cards saved to public/picks/cards/`);
