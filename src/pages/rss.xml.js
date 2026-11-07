import rss from '@astrojs/rss';
import { getPosts } from '../lib/posts';
import { SITE } from '../lib/site';

export async function GET(context) {
  const posts = await getPosts();
  return rss({
    title: SITE.name,
    description: SITE.description,
    site: context.site,
    items: posts.map((p) => ({
      title: p.data.title,
      description: p.data.description,
      pubDate: p.data.pubDate,
      link: `/posts/${p.id}/`,
    })),
  });
}
