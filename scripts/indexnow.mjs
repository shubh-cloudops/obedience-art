#!/usr/bin/env node
/**
 * Tell Bing (and other IndexNow engines: Yandex, Seznam, Naver) which pages just changed.
 *
 *   node scripts/indexnow.mjs --all                 # every URL in the live sitemap
 *   node scripts/indexnow.mjs <changed files...>    # only the pages those source files produce
 *
 * Runs after each deploy (.github/workflows/deploy.yml). The key below is public by design:
 * IndexNow checks that https://obedienceart.com/<key>.txt exists, which proves we own the site.
 * Google does not use IndexNow; it reads the sitemap submitted in Search Console.
 */
const KEY = '8e5c7ff7c86e4b7e19e84aef5afd133f';
const SITE = 'https://obedienceart.com';
const args = process.argv.slice(2);

let paths = new Set();
if (args.includes('--all')) {
  const xml = await (await fetch(`${SITE}/sitemap-0.xml`)).text();
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) paths.add(new URL(m[1]).pathname);
} else {
  for (const f of args) {
    let m;
    if ((m = f.match(/^src\/content\/posts\/(.+)\.mdx?$/))) paths.add(`/posts/${m[1]}/`).add('/posts/').add('/');
    else if ((m = f.match(/^src\/content\/events\/(.+)\.ya?ml$/))) paths.add(`/tracker/${m[1]}/`).add('/tracker/');
    else if ((m = f.match(/^src\/content\/picks\/(.+)\.ya?ml$/))) paths.add(`/picks/${m[1]}/`).add('/picks/');
  }
}

if (!paths.size) {
  console.log('IndexNow: no content pages changed, nothing to submit.');
  process.exit(0);
}

const urlList = [...paths].map((p) => SITE + p);
let res;
try {
  res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList }),
  });
} catch (err) {
  console.log(`IndexNow: request failed (${err.message}); the sitemap still covers these pages.`);
  process.exit(0);
}
// 200 = received, 202 = received and key check pending. Anything else is reported but never fails the deploy.
console.log(`IndexNow: HTTP ${res.status} for ${urlList.length} URL(s)`);
for (const u of urlList) console.log('  ' + u);
