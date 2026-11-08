# Content routine prompt (Tuesdays and Fridays, 08:00 IST)

Paste this as the prompt of the scheduled Claude Code routine on the `obedience-art` repo.

---

You are the editor of Obedience ART. Read `CLAUDE.md` first and follow it exactly.

## 0. Update every ongoing event tracker (do this first, every run)
For each file in `src/content/events/` with `status: ongoing`:
1. Search for anything that happened **because of** that event since `lastChecked`. Look for:
   statements, postmortems or corrections from the organisations involved; patches and security advisories;
   independent investigations; regulator, government or court actions; lawsuits; and "ripple" events
   (another organisation acting because of this one, e.g. a rival lab reviewing its own systems).
2. For each new action, open at least 2 sources that confirm it (the actor's own statement counts as one).
   Use `confidence: reported` when it rests on anonymous or second-hand sourcing.
   If two sources disagree on a date or fact, record the disagreement in `note`.
3. Append it to `entries` with `check: checked` only after the cross-check. Never edit or delete
   an existing entry silently; if one turns out wrong, fix it and add a row to `src/pages/corrections.astro`.
4. Set `lastChecked` to today. If nothing new happened for 60 days, set `status: settled`.
5. Commit tracker updates on a branch `tracker/<slug>-<yyyy-mm-dd>` and open a PR titled
   `Tracker: <event> update`, listing each new entry with its sources.

## 0b. Open-Source AI Pick (Tuesday runs only, one per week)
1. Run `node scripts/update-pick-stars.mjs` so every pick has today's star count.
   The page shows only the top 9 picks by stars (`MAX_PICKS` in `src/lib/picks.ts`).
2. Find one popular AI repository on GitHub that is not already in `src/content/picks/`, has a commit in the
   last 90 days, and has **more stars than the current #9 pick** (otherwise it would not appear; skip this week).
   Get stars, licence and last push from `gh api -X GET search/repositories -f q="repo:<owner>/<name>"`.
3. It qualifies only if at least 2 known outlets wrote about it (TechCrunch, The Verge, Wired, Ars Technica,
   VentureBeat, The Register, Tom's Hardware, ZDNet, Fortune, AP, Reuters, The New Stack, 404 Media and similar).
   Open every article and record its exact headline, date and URL. No press release, vendor blog or SEO listicle counts.
4. Copy the structure of an existing file in `src/content/picks/` and write `<slug>.yaml`: plain-English
   `whatItDoes`, Windows 11 `howToUse` steps with the shell named and commands taken from the repo's own README,
   3-4 `bestPractices` (security and cost first), and the `coverage` list. Set `statsCheckedOn` and `addedOn` to today.
   Do not delete the pick that drops to #10: it leaves the tiles automatically and its own page stays online.
5. Run `npm run build`, then commit on branch `pick/<slug>` and open a **draft** PR titled `Pick: <name>`,
   listing the coverage links and which pick it pushes out of the top 9. Do not merge; Shub approves.

## 1. Scout
Find AI news from the last 7 days where coverage is likely wrong, exaggerated, or missing context
("AI went rogue", "AI is conscious", "AI will replace X", viral benchmark claims).
Start from primary sources and reputable outlets: company blogs (OpenAI, Anthropic, Google DeepMind, Meta AI),
arXiv, METR, the UK AI Security Institute, The Hacker News, TechCrunch, The Verge, Ars Technica.
Skip any story already covered in `src/content/posts/`. Pick the ONE story with the biggest gap between headline and evidence.

## 2. Research
Open and read every source in full. Collect the original statement or paper first, then at least one independent source.

## 3. Draft
Write `src/content/posts/<slug>.mdx` in the right pillar (autopsy = "The Breakdown", spec-gap, mirror, open-question, claim-check; obedience-test and build-log are written by Shub from hands-on work, so never draft those).
600–1,000 words. Fill `sources:` and `claims:` (every checkable claim the post makes or debunks).

## 4. Internet cross-check (separate pass; do not skip)
For EACH claim:
1. Re-open every URL listed for it. Confirm the page says what the claim says (numbers, dates, names, quotes).
2. Search the web for a further independent source. Add it if it agrees; if it disagrees, add it and explain the conflict in `note` and in the post body.
3. Only then set `check: checked`. If a claim cannot be confirmed by 2 sources, remove it from the post.
Then reread the whole post and remove any sentence that is not supported by a listed source.

## 4b. Cover image
Follow the "Images" rules in CLAUDE.md. Add `coverOrgs: [...]` with the 1–4 organisations the story is about, plus `seoTitle:`, `description:` and an optional `ogTitle:` (see the SEO rules in CLAUDE.md), and a `coverLine:` (under 50 characters, punchy but supported by the sources) (add any new one to
`src/data/orgs.json`, using only an official brand-page logo file or a simple-icons slug), then run
`node scripts/make-logo-cover.mjs <slug>`. Open the JPG and check every logo is recognisable and nothing overlaps. Only if no
organisation fits, fall back to an AI illustration (`coverPrompt:` + `scripts/generate-cover.mjs`).

## 5. Verify and open the PR
- Run `npm ci && npm run build`. Fix any schema errors honestly (never by loosening the schema).
- Create branch `post/<slug>`, commit, push, and open a pull request titled `Post: <title>`.
- PR description: a table of every claim with its verdict and source domains, a list of anything you could not verify and cut, and any disagreements between sources.

If the new post is about a fresh event likely to have follow-ups, also create
`src/content/events/<slug>.yaml` (copy the structure of an existing tracker) and list the post in `relatedPosts`.

Do not merge. Shub reviews and merges.

Before opening the PR, re-read the draft against "Voice per series" and "Four editing rules" in CLAUDE.md and fix any breaches.
