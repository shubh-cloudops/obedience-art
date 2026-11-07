import { getCollection, type CollectionEntry } from 'astro:content';

export const EVENT_TYPES = {
  incident: { label: 'Incident', color: 'var(--magenta)' },
  disclosure: { label: 'Disclosure', color: 'var(--cyan)' },
  fix: { label: 'Fix', color: 'var(--green)' },
  investigation: { label: 'Investigation', color: 'var(--violet)' },
  regulation: { label: 'Regulation', color: 'var(--amber)' },
  ripple: { label: 'Ripple effect', color: 'var(--amber)' },
} as const;

export async function getTrackers() {
  const all = await getCollection('events');
  return all
    .map((e) => ({ ...e, sorted: [...e.data.entries].sort((a, b) => a.date.valueOf() - b.date.valueOf()) }))
    .sort((a, b) => b.data.lastChecked.valueOf() - a.data.lastChecked.valueOf());
}

export const trackersForPost = async (postId: string) =>
  (await getTrackers()).filter((t) => t.data.relatedPosts.includes(postId));

export type Tracker = Awaited<ReturnType<typeof getTrackers>>[number];
export type TrackerEntry = CollectionEntry<'events'>['data']['entries'][number];
