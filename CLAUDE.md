# Obedience ART: rules for Claude

Obedience ART is a static Astro blog that demystifies AI news and AI misinformation.

## Editorial stance (do not drift from it)
- AI is capable, often more than its builders expect.
- Whether AI is conscious is an open question. Report what researchers argue; never claim a verdict either way.
- AI is "dangerously obedient": it pursues the goal and the score it is given, even when that is not what was meant.
  Harm comes from badly articulated requirements, weak scorers, and bad actors, not from rebellion.
- No doom and no hype. Name what the sources show and where they disagree.

## Non-negotiable fact rules
1. Every factual claim must trace to a source you actually opened and read. Search snippets are not sources.
2. Prefer primary sources (company statements, papers, incident reports, independent investigations). News articles are secondary.
3. **Internet cross-check:** every claim in `claims:` needs at least 2 sources, and they must agree.
   If they conflict, say so in the post and in the claim's `note`.
4. Only set `check: checked` after comparing the claim with every listed source. Otherwise leave `check: pending`.
5. Never invent quotes, numbers, dates, or URLs. If you cannot verify something, cut it or mark the post `draft: true`.
6. The build fails on violations of rules 3–4 (see `src/content.config.ts`). Never weaken that schema to make a build pass.

## Event trackers (`src/content/events/*.yaml`)
- A tracker is a living timeline of what organisations did *because of* an event. It never stops at the headline.
- Same cross-check rule: every entry needs 2+ sources and `check: checked`; the build enforces it.
- Append, don't rewrite. Corrections go in the corrections log.

## Open-Source AI Picks (`src/content/picks/*.yaml`, page `/picks/`)
- One popular AI GitHub repo per file. A pick needs coverage from at least 2 known tech outlets, each linked; the build enforces 2+.
- Ranked by GitHub stars. `/picks/` shows only the top 9 (`MAX_PICKS` in `src/lib/picks.ts`) as clickable tiles with rank, stars and 7-day change; lower picks keep their own `/picks/<slug>/` page.
- Stars are refreshed daily by `.github/workflows/pick-stars.yml` running `scripts/update-pick-stars.mjs` (updates `stars`, `statsCheckedOn`, `starHistory`). Never edit star numbers by hand.
- Image is GitHub's own social card (`repoCard()` in `src/lib/picks.ts`), built from `repo`. The deploy workflow downloads it to `public/picks/cards/` (`scripts/fetch-pick-cards.mjs`, git-ignored) so the site serves it itself; hotlinking failed for most tiles. Never upload or AI-generate repo images.
- How-to steps target Windows 11, name the shell, and use commands from the repo's README. Best practices put security and cost first.
- The routine adds one pick a week (Tuesday runs) as a draft PR, only if it beats the current #9 on stars; Shub approves.

## Images (cover rules set by Shub; follow them for every article)
- **Default cover = logo cover**, news style. List the 1–4 organisations the story is about in `coverOrgs: [openai, huggingface]` (ids from `src/data/orgs.json`), plus a punchy `coverLine:` (under 50 characters, different from the title, no clickbait, nothing the sources don't support), then run `node scripts/make-logo-cover.mjs <slug>`. The editorial layout puts big logos lit in brand colours on top and the pillar, verdict and coverLine below. It writes the JPG, `cover:` and `coverAlt:`. No AI and no keys.
- **Logos:** only official files from the organisation's own brand/press page (saved in `src/assets/logos/`, source URL recorded in `orgs.json`) or the CC0 `simple-icons` package. Never recolour, redraw, distort or AI-generate a logo. If no logo is available, the script draws the name as a wordmark. Add a new organisation to `orgs.json` first.
- Logos are shown only to identify who is in the story. The cover caption says so, and nothing may suggest endorsement.
- **AI illustration (fallback only):** for stories with no clear organisation, use `coverPrompt:` + `scripts/generate-cover.mjs` with the ambassador rules in `scripts/cover-styles.json`. Never creepy; never a real person, actor or film/comic character; no text, logos or signatures. coverAlt starts "AI illustration:".
- **The animated ambassador Art** (`src/components/Companion.astro`) reacts to any element with `data-art="<expression>"` and `data-art-say="<short line>"`. The verdict, Spec Gap, claims, sources and comments already have them. In a post, you may wrap one key paragraph in `<div data-art="surprised" data-art-say="...">`. Keep lines under 12 words, friendly, and never a factual claim.

## Writing style
- British spelling. Plain words. Explain jargon once.
- Every Post-Mortem post (pillar id `autopsy`) uses the `<SpecGap asked measured happened />` component.
- When an incident has a clear route, add `<PathDiagram intended={[...]} actual={[...]} />` (intended path vs what the AI did; mark `breach: true` on steps that crossed a boundary). Every step must come from `sources:`.
- Link the first mention of every source inline.

### Voice per series (house style, set by Shub on 2026-11-04)
Use these as rhythms. Never imitate a named writer's sentences or signature phrases.
- **The Post-Mortem, Claim Check: lab log.** The first sentence states the mechanism or the verdict. Evidence before interpretation. No warm-up, no scene-setting.
- **The Spec Gap, The Mirror: first-principles minimalist.** Open with one counterintuitive claim in plain words, e.g. "it was a communication problem, not a smarter-model problem". Short declarative sentences, zero jargon.
- **The Open Question: empirical analogist.** Pair a concrete research finding with a careful, everyday metaphor. Never declare a verdict on consciousness or moral status.
- **The Obedience Test, Build Log (Shub's own): practitioner.** Open with a real moment from Shub's work, then switch to lab-log detail: exact prompts, outputs, numbers, costs and the fix.

### Four editing rules (apply to every draft)
1. **Bar test.** Read the opening paragraph aloud. If you wouldn't say a sentence that way to a smart friend, delete it. If the first paragraph is throat-clearing, start with the second.
2. **Vary cadence.** Never write more than three medium-length sentences in a row. Follow a long explanation with a short sentence.
3. **Specifics over adjectives.** Replace "huge", "alarming" or "unprecedented" with the number, the date or the named thing, and only figures from `sources:`. If no figure is sourced, cut the adjective instead of inventing one.
4. **No default AI phrasing.** Banned: moreover, furthermore, crucially, notably, delve, "it's not just X, it's Y", "in today's rapidly evolving landscape", "a testament to", "navigate the complexities". Use "but", "and yet", "here is why", or a new paragraph.

## Workflow
- Never push to `main`. Work on a branch named `post/<slug>` and open a pull request. A human merges.
- Run `npm run build` before opening a PR; it must pass.

## SEO (every post)
- `title` is the on-page H1: editorial and can be long.
- `seoTitle`: the search-result title. Put the keywords first and keep it under 60 characters; the brand is added when the total stays within 65.
- `ogTitle` (optional): the social share title, with concrete numbers that are **in the sources**.
- `description`: 160 characters at most. Put the main entity and concept in it (for example ExploitGym, Hugging Face, specification gaming).
- Slug: the event plus the concept, hyphenated, no stop words. Once a post is published, never rename its slug.
- The first two paragraphs name the event, the organisations and the concept.
- SEO copy follows the same fact rules as the body. Never add numbers or details from SEO tools or other AI tools unless two sources in `sources:` support them.
- The post layout already emits BlogPosting JSON-LD, og:/twitter: tags and the canonical URL. Don't add FAQPage schema: Google limits FAQ rich results to government and health sites.

## Series written by Shub
- `obedience-test`: hands-on tests of new models (instructions given, what the model did, where it over-obeyed, gamed the goal or skipped a rule). Include the exact prompts and outputs as evidence.
- `build-log`: building with AI on Azure and AWS. Include real costs, mistakes and a teardown section.
The routine never drafts these two; they come from Shub's own work. Help edit them, and keep the same source rules.
