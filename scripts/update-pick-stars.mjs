#!/usr/bin/env node
/**
 * Refresh GitHub star counts for every Open-Source AI Pick.
 *
 *   node scripts/update-pick-stars.mjs            # update all picks in src/content/picks/
 *   node scripts/update-pick-stars.mjs --dry-run  # print the counts, change nothing
 *
 * For each pick it sets `stars` and `statsCheckedOn` to today, and appends today's count to
 * `starHistory` (one point per day, last 90 kept). The page uses that history for the weekly change
 * and ranks picks by stars; only the top MAX_PICKS show as tiles (src/lib/picks.ts).
 *
 * Auth: set GITHUB_TOKEN (or GH_TOKEN) for 5,000 requests/hour; without it GitHub allows 60/hour,
 * which is still plenty for a few dozen picks. If the direct API call fails and the `gh` CLI is
 * installed, it falls back to `gh api` (handy inside Claude Code sessions).
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import YAML from 'yaml';

const DIR = path.resolve('src/content/picks');
const HISTORY_DAYS = 90;
const dryRun = process.argv.includes('--dry-run');
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const today = new Date().toISOString().slice(0, 10);

async function viaApi(repo) {
  const res = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'obedience-art-pick-stars',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${repo}`);
  const j = await res.json();
  return { stars: j.stargazers_count, fullName: j.full_name, archived: j.archived };
}

function viaGh(repo) {
  const out = execFileSync('gh', ['api', '-X', 'GET', 'search/repositories', '-f', `q=repo:${repo}`, '--jq', '.items[0]'], { encoding: 'utf8' });
  const j = JSON.parse(out);
  if (!j?.stargazers_count) throw new Error(`gh found nothing for ${repo}`);
  return { stars: j.stargazers_count, fullName: j.full_name, archived: j.archived };
}

async function lookup(repo) {
  try {
    return await viaApi(repo);
  } catch (e) {
    try {
      return viaGh(repo);
    } catch {
      throw e;
    }
  }
}

const files = (await readdir(DIR)).filter((f) => /\.ya?ml$/.test(f)).sort();
let failed = 0;
for (const f of files) {
  const file = path.join(DIR, f);
  const doc = YAML.parseDocument(await readFile(file, 'utf8'));
  const repo = doc.get('repo');
  try {
    const { stars, fullName, archived } = await lookup(repo);
    const before = doc.get('stars');
    const note = [
      fullName !== repo ? `renamed to ${fullName}` : '',
      archived ? 'ARCHIVED' : '',
    ].filter(Boolean).join(', ');
    console.log(`${repo.padEnd(34)} ${String(before).padStart(7)} -> ${String(stars).padStart(7)}${note ? `  (${note})` : ''}`);
    if (dryRun) continue;

    if (fullName !== repo) doc.set('repo', fullName); // GitHub renames (e.g. comfyanonymous -> Comfy-Org)
    doc.set('stars', stars);
    doc.set('statsCheckedOn', today);
    const history = (doc.get('starHistory')?.toJSON?.() ?? []).filter((p) => String(p.date).slice(0, 10) !== today);
    history.push({ date: today, stars });
    doc.set('starHistory', history.slice(-HISTORY_DAYS));
    await writeFile(file, doc.toString({ lineWidth: 110 }));
  } catch (e) {
    failed++;
    console.error(`${repo}: ${e.message}`);
  }
}
if (failed) {
  console.error(`${failed} pick(s) could not be updated.`);
  process.exit(1);
}
