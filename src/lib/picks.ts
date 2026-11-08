import { getCollection, type CollectionEntry } from 'astro:content';
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * The page has two rows of tiles (Shub, 2026-11-08):
 * - Top picks: the MAX_PICKS most-starred repos of all time.
 * - Rising: up to RISING_PICKS newer repos, first published on GitHub in the last RISING_MAX_AGE_DAYS days,
 *   that have already passed RISING_MIN_STARS stars. Ranked by stars too.
 * Stars and creation dates are refreshed daily by scripts/update-pick-stars.mjs (GitHub Action), and the site
 * rebuilds after each refresh, so a rising repo leaves the row on its own once it is older than the window.
 * A pick that drops off both rows keeps its own page so links keep working.
 */
export const MAX_PICKS = 6;
export const RISING_PICKS = 6;
export const RISING_MAX_AGE_DAYS = 60;
export const RISING_MIN_STARS = 2000;

export const PICK_CATEGORY: Record<string, string> = {
  'run-models': 'Run models locally',
  'build-apps': 'Build AI apps',
  agents: 'AI agents',
  coding: 'AI coding tools',
  speech: 'Speech',
  images: 'Images and video',
};

const DAY = 86_400_000;

/** Days since the repo was created on GitHub, or null if the date isn't recorded yet. */
export const ageInDays = (p: { data: { createdOn?: Date } }, now = Date.now()): number | null =>
  p.data.createdOn ? Math.floor((now - p.data.createdOn.valueOf()) / DAY) : null;

/** A pick counts as rising while it is young enough and already past the star bar. */
export const isRising = (p: Pick, now = Date.now()) => {
  const age = ageInDays(p, now);
  return age !== null && age <= RISING_MAX_AGE_DAYS && p.data.stars >= RISING_MIN_STARS;
};

/**
 * Published picks ranked by stars, most first; ties by name so builds are stable.
 * `top` is the all-time row, `rising` the new-repo row; a repo is never in both.
 */
export const getRankedPicks = async () => {
  const all = (await getCollection('picks', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.stars - a.data.stars || a.data.name.localeCompare(b.data.name),
  );
  const top = all.slice(0, MAX_PICKS);
  const rising = all.slice(MAX_PICKS).filter((p) => isRising(p)).slice(0, RISING_PICKS);
  const dropped = all.filter((p) => !top.includes(p) && !rising.includes(p));
  return { top, rising, dropped, all };
};

export type Pick = CollectionEntry<'picks'>;

/** Where a pick sits on the page, for its own page's rank line. */
export const placeOf = (p: Pick, ranked: Awaited<ReturnType<typeof getRankedPicks>>) => {
  const t = ranked.top.indexOf(p);
  if (t >= 0) return `#${t + 1} in the top ${MAX_PICKS}`;
  const r = ranked.rising.indexOf(p);
  if (r >= 0) return `#${r + 1} on the Rising row`;
  return `#${ranked.all.indexOf(p) + 1} overall (not on the tiles right now)`;
};

/**
 * Star change over the last 7 days, from starHistory. Uses the newest point that is at least
 * 7 days older than the latest one; null until the tracker has a week of data.
 */
export const weeklyChange = (p: Pick): number | null => {
  const h = [...p.data.starHistory].sort((a, b) => a.date.valueOf() - b.date.valueOf());
  if (h.length < 2) return null;
  const latest = h.at(-1)!;
  const base = h.filter((x) => latest.date.valueOf() - x.date.valueOf() >= 7 * DAY).at(-1);
  return base ? latest.stars - base.stars : null;
};

export const fmtStars = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : `${n}`);
export const fmtChange = (n: number) => `${n >= 0 ? '+' : '−'}${fmtStars(Math.abs(n))}`;

/**
 * GitHub's auto-generated social card for a pick. The deploy workflow downloads it to
 * public/picks/cards/<slug>.png (scripts/fetch-pick-cards.mjs) so the site serves it itself;
 * if that download failed, fall back to GitHub's URL (its first path segment is a cache key GitHub ignores).
 */
export const repoCard = (slug: string, repo: string) =>
  existsSync(path.resolve('public/picks/cards', `${slug}.png`))
    ? `/picks/cards/${slug}.png`
    : `https://opengraph.githubassets.com/obedience-art/${repo}`;
