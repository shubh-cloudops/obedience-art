#!/usr/bin/env node
/**
 * Traffic report for obedienceart.com from Cloudflare Web Analytics (free, cookieless).
 *
 *   node scripts/traffic-report.mjs            # last 7 full days, compared with the 7 days before
 *   node scripts/traffic-report.mjs --days 30  # any window length
 *
 * Writes Markdown to stdout and to traffic-report.md. Read-only: it never changes the site.
 *
 * Needs (never hard-code them):
 *   CF_ANALYTICS_TOKEN  API token with one permission: Account > Account Analytics > Read
 *   CF_ACCOUNT_ID       Cloudflare account ID (dashboard URL or Account home > Account details)
 *   CF_SITE_TAG         optional: Web Analytics site tag. Leave unset while obedienceart.com is the
 *                       account's only Web Analytics site; then every site in the account is counted.
 */
import { writeFile } from 'node:fs/promises';

// Strip spaces and a byte-order mark: Windows PowerShell adds one when it pipes a value into `gh secret set`.
const clean = (v) => (v ?? '').replace(/^\uFEFF/, '').trim();
const [token, accountTag, siteTag] = ['CF_ANALYTICS_TOKEN', 'CF_ACCOUNT_ID', 'CF_SITE_TAG'].map((k) => clean(process.env[k]));
if (!token || !accountTag) {
  console.error('Missing CF_ANALYTICS_TOKEN or CF_ACCOUNT_ID. See the header of this file.');
  process.exit(1);
}

const i = process.argv.indexOf('--days');
const days = i > -1 ? Number(process.argv[i + 1]) : 7;
const DAY = 86_400_000;
// Whole UTC days, ending at midnight today, so a report never counts a half day.
const end = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
const start = new Date(end - days * DAY);
const prevStart = new Date(start - days * DAY);
const iso = (d) => d.toISOString();
const day = (d) => d.toISOString().slice(0, 10);

const QUERY = `
query Traffic($account: String!, $filter: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject, $prev: AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject) {
  viewer {
    accounts(filter: { accountTag: $account }) {
      total: rumPageloadEventsAdaptiveGroups(limit: 1, filter: $filter) { count sum { visits } }
      previous: rumPageloadEventsAdaptiveGroups(limit: 1, filter: $prev) { count sum { visits } }
      daily: rumPageloadEventsAdaptiveGroups(limit: 100, filter: $filter, orderBy: [date_ASC]) {
        count sum { visits } dimensions { date }
      }
      pages: rumPageloadEventsAdaptiveGroups(limit: 10, filter: $filter, orderBy: [count_DESC]) {
        count dimensions { requestPath }
      }
      referrers: rumPageloadEventsAdaptiveGroups(limit: 8, filter: $filter, orderBy: [count_DESC]) {
        count dimensions { refererHost }
      }
      countries: rumPageloadEventsAdaptiveGroups(limit: 8, filter: $filter, orderBy: [count_DESC]) {
        count dimensions { countryName }
      }
    }
  }
}`;

const window = (from, to) => ({
  AND: [{ datetime_geq: iso(from), datetime_lt: iso(to) }, ...(siteTag ? [{ siteTag }] : [])],
});

const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: QUERY,
    variables: { account: accountTag, filter: window(start, end), prev: window(prevStart, start) },
  }),
});
const json = await res.json();
if (!res.ok || json.errors?.length) {
  console.error('Cloudflare API error:', res.status, JSON.stringify(json.errors ?? json));
  process.exit(1);
}
const a = json.data.viewer.accounts[0];
if (!a) {
  console.error('No account data. Check CF_ACCOUNT_ID and that the token has Account Analytics: Read.');
  process.exit(1);
}

const views = a.total[0]?.count ?? 0;
const visits = a.total[0]?.sum.visits ?? 0;
const pViews = a.previous[0]?.count ?? 0;
const pVisits = a.previous[0]?.sum.visits ?? 0;
const change = (now, before) => (before === 0 ? (now ? 'new' : '0%') : `${now >= before ? '+' : ''}${Math.round(((now - before) / before) * 100)}%`);
const n = (x) => x.toLocaleString('en-GB');
const rows = (list, key) =>
  list.length ? list.map((r) => `| ${r.dimensions[key] || '(direct / none)'} | ${n(r.count)} |`).join('\n') : '| (no data yet) | 0 |';

const md = `## Traffic: ${day(start)} to ${day(new Date(end - DAY))} (${days} days)

| | This period | Previous ${days} days | Change |
|---|---:|---:|---:|
| Visits | ${n(visits)} | ${n(pVisits)} | ${change(visits, pVisits)} |
| Page views | ${n(views)} | ${n(pViews)} | ${change(views, pViews)} |

**Per day (visits / page views):** ${a.daily.map((d) => `${d.dimensions.date.slice(5)}: ${n(d.sum.visits)}/${n(d.count)}`).join(', ') || 'no data yet'}

### Top pages
| Page | Views |
|---|---:|
${rows(a.pages, 'requestPath')}

### Where visitors came from
| Referrer | Views |
|---|---:|
${rows(a.referrers, 'refererHost')}

### Countries
| Country | Views |
|---|---:|
${rows(a.countries, 'countryName')}

_Source: Cloudflare Web Analytics (cookieless, sampled; visitors with ad blockers are not counted)._
`;

await writeFile('traffic-report.md', md);
console.log(md);
