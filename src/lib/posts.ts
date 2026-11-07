import { getCollection } from 'astro:content';

/** Published posts, newest first. Drafts show only in `npm run dev`. */
export async function getPosts() {
  const posts = await getCollection('posts', ({ data }) => import.meta.env.DEV || !data.draft);
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}
