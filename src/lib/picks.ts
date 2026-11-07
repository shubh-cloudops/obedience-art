import { getCollection } from 'astro:content';

/**
 * The page shows only the top MAX_PICKS repos by GitHub stars. Stars are refreshed daily by
 * scripts/update-pick-stars.mjs (GitHub Action), so when a new pick is added, or a repo falls behind,
 * the lowest-starred pick drops off the tiles automatically. Its own page stays online so links keep working.
 */
export const MAX_PICKS = 9;

export const PICK_CATEGORY: Record<string, string> = {
  'run-models': 'Run models locally',
  'build-apps': 'Build AI apps',
  agents: 'AI agents',
  speech: 'Speech',
  images: 'Images and video',
};

const DAY = 86_400_000;

/** Published picks ranked by stars, most first; ties by name so builds are stable. */
export const getRankedPicks = async () => {
  const all = (await getCollection('picks', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.stars - a.data.stars || a.data.name.localeCompare(b.data.name),
  );
  return { shown: all.slice(0, MAX_PICKS), dropped: all.slice(MAX_PICKS), all };
};

export type Pick = Awaited<ReturnType<typeof getRankedPicks>>['all'][number];

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

/** GitHub's auto-generated social card. The first path segment is a cache key GitHub ignores. */
export const repoCard = (repo: string) => `https://opengraph.githubassets.com/obedience-art/${repo}`;
